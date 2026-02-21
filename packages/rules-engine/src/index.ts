import type {
  ExecutionContext,
  JSONValue,
  Rule,
  RuleAction,
  RuleCondition,
  RuleOperand,
  RuleSet,
  RuleScope,
} from '@platform/schema';
import {
  emitBusinessMetric,
  logRulesTrace,
  type ConditionExplain,
  type ExplainOperand,
  type RuleActionDiff,
  type RuleRead,
  type RulesTrace,
  type TraceLogger,
} from '@platform/observability';

export interface EvaluateRulesInput {
  rules: Rule[] | RuleSet;
  context: ExecutionContext;
  data: Record<string, JSONValue>;
  options?: {
    timeoutMs?: number;
    maxRules?: number;
    maxDepth?: number;
    memoizeConditionEvaluations?: boolean;
    memoCacheSize?: number;
    mode?: 'apply' | 'predicate';
    correlationId?: string;
    versionId?: string;
    logTrace?: boolean;
    traceLogger?: (trace: RulesTrace) => void;
    logger?: TraceLogger<RulesTrace>;
  };
}

export interface EvaluateRulesResult {
  data: Record<string, JSONValue>;
  context: ExecutionContext;
  trace: RulesTrace;
}

export interface RulesEngineLimits {
  timeoutMs: number;
  maxRules: number;
  maxDepth: number;
}

export interface RulesEngineActionPolicy {
  allowCustomActions: boolean;
  allowedActionTypes: string[];
}

export interface RulesEnginePerformancePolicy {
  pathCacheSize: number;
  conditionMemoSize: number;
  memoizeConditionEvaluations: boolean;
}

export interface RulesEngineConfig {
  limits?: Partial<RulesEngineLimits>;
  actionPolicy?: Partial<RulesEngineActionPolicy>;
  performance?: Partial<RulesEnginePerformancePolicy>;
}

export interface RuleActionHandlerContext {
  data: Record<string, JSONValue>;
  context: ExecutionContext;
  trace: RulesTrace;
  ruleId: string;
}

export type RuleActionHandler = (
  action: RuleAction,
  ctx: RuleActionHandlerContext,
) => void;

const DEFAULT_TIMEOUT_MS = 50;
const DEFAULT_MAX_RULES = 1000;
const DEFAULT_MAX_DEPTH = 10;
const DEFAULT_PATH_CACHE_SIZE = 500;
const DEFAULT_CONDITION_MEMO_SIZE = 2048;

const DEFAULT_RULES_ENGINE_CONFIG: Readonly<{
  limits: RulesEngineLimits;
  actionPolicy: RulesEngineActionPolicy;
  performance: RulesEnginePerformancePolicy;
}> = {
  limits: {
    timeoutMs: DEFAULT_TIMEOUT_MS,
    maxRules: DEFAULT_MAX_RULES,
    maxDepth: DEFAULT_MAX_DEPTH,
  },
  actionPolicy: {
    allowCustomActions: false,
    allowedActionTypes: [],
  },
  performance: {
    pathCacheSize: DEFAULT_PATH_CACHE_SIZE,
    conditionMemoSize: DEFAULT_CONDITION_MEMO_SIZE,
    memoizeConditionEvaluations: true,
  },
};

let configuredRulesEngine: RulesEngineConfig = {};
const customActionHandlers = new Map<string, RuleActionHandler>();

export function evaluateRules(input: EvaluateRulesInput): EvaluateRulesResult {
  const started = Date.now();
  const rulesArray = Array.isArray(input.rules) ? input.rules : input.rules.rules;
  const runtimeConfig = resolveRulesEngineConfig();
  updatePathCacheLimit(runtimeConfig.performance.pathCacheSize);
  const timeoutMs = input.options?.timeoutMs ?? runtimeConfig.limits.timeoutMs;
  const maxRules = input.options?.maxRules ?? runtimeConfig.limits.maxRules;
  const maxDepth = input.options?.maxDepth ?? runtimeConfig.limits.maxDepth;
  const memoizeConditionEvaluations =
    input.options?.memoizeConditionEvaluations ?? runtimeConfig.performance.memoizeConditionEvaluations;
  const memoCacheSize = input.options?.memoCacheSize ?? runtimeConfig.performance.conditionMemoSize;
  const mode = input.options?.mode ?? 'apply';
  const conditionMemo = memoizeConditionEvaluations
    ? new LruCache<string, { result: boolean; explain: ConditionExplain; reads: RuleRead[] }>(memoCacheSize)
    : null;
  let mutationEpoch = 0;

  const trace: RulesTrace = {
    startedAt: new Date(started).toISOString(),
    durationMs: 0,
    rulesConsidered: [],
    rulesMatched: [],
    conditionResults: {},
    conditionExplains: {},
    readsByRuleId: {},
    actionDiffs: [],
    actionsApplied: [],
    events: [],
    errors: [],
    context: {
      correlationId: input.options?.correlationId,
      tenantId: input.context.tenantId,
      userId: input.context.userId,
      versionId: input.options?.versionId,
    },
  };

  const data = deepClone(input.data);
  const context = deepClone(input.context);

  const scoped = rulesArray.filter((rule) => matchesScope(rule.scope, context));
  const sorted = scoped.sort((a, b) => {
    const priorityDiff = (b.priority ?? 0) - (a.priority ?? 0);
    if (priorityDiff !== 0) return priorityDiff;
    return a.ruleId.localeCompare(b.ruleId);
  });

  trace.rulesConsidered = sorted.map((rule) => rule.ruleId);

  for (let i = 0; i < sorted.length; i += 1) {
    if (i >= maxRules) {
      trace.errors.push({ message: `Max rules limit reached: ${maxRules}` });
      break;
    }
    if (Date.now() - started > timeoutMs) {
      trace.errors.push({ message: `Rules evaluation timeout after ${timeoutMs}ms` });
      break;
    }

    const rule = sorted[i];
    if (!rule) continue;
    try {
      const memoKey = conditionMemo ? `${mutationEpoch}:${stableSerialize(rule.when)}` : '';
      const cached = conditionMemo ? conditionMemo.get(memoKey) : undefined;
      const explained = cached
        ? {
            result: cached.result,
            explain: deepClone(cached.explain),
            reads: deepClone(cached.reads),
          }
        : evaluateConditionExplain(rule.when, context, data, { maxDepth });
      if (!cached && conditionMemo) {
        conditionMemo.set(memoKey, {
          result: explained.result,
          explain: deepClone(explained.explain),
          reads: deepClone(explained.reads),
        });
      }
      trace.conditionResults[rule.ruleId] = explained.result;
      trace.conditionExplains![rule.ruleId] = explained.explain;
      trace.readsByRuleId![rule.ruleId] = explained.reads;
      if (explained.result) {
        trace.rulesMatched.push(rule.ruleId);
        if (mode === 'apply') {
          const actions = rule.actions ?? [];
          let hadMutatingAction = false;
          for (const action of actions) {
            applyAction(action, { data, context, trace, ruleId: rule.ruleId }, runtimeConfig.actionPolicy);
            hadMutatingAction = true;
          }
          if (hadMutatingAction) {
            mutationEpoch += 1;
          }
        }
      }
    } catch (error) {
      trace.errors.push({ ruleId: rule.ruleId, message: toErrorMessage(error) });
      if (isThrowError(error)) {
        break;
      }
    }
  }

  trace.durationMs = Date.now() - started;
  emitBusinessMetric({
    name: 'rules.evaluation.duration_ms',
    value: trace.durationMs,
    unit: 'ms',
    attributes: {
      considered: trace.rulesConsidered.length,
      matched: trace.rulesMatched.length,
      errors: trace.errors.length,
      tenant_id: input.context.tenantId,
    },
  });
  emitBusinessMetric({
    name: 'rules.evaluation.matched_count',
    value: trace.rulesMatched.length,
    attributes: {
      tenant_id: input.context.tenantId,
    },
  });

  if (input.options?.traceLogger) {
    input.options.traceLogger(trace);
  }
  // Guard `process.env` for client bundles.
  const traceEnv = typeof process !== 'undefined' ? process.env.RULEFLOW_TRACE : undefined;
  if (input.options?.logTrace || traceEnv === '1') {
    logRulesTrace(trace, input.options?.logger);
  }

  return { data, context, trace };
}

export function evaluateCondition(
  condition: RuleCondition,
  context: ExecutionContext,
  data: Record<string, JSONValue>,
  options?: { maxDepth?: number },
): boolean {
  const runtimeConfig = resolveRulesEngineConfig();
  updatePathCacheLimit(runtimeConfig.performance.pathCacheSize);
  const maxDepth = options?.maxDepth ?? runtimeConfig.limits.maxDepth;
  return evalCondition(condition, context, data, 0, maxDepth);
}

export function createMemoizedConditionEvaluator(options?: {
  cacheSize?: number;
  maxDepth?: number;
}): (condition: RuleCondition, context: ExecutionContext, data: Record<string, JSONValue>) => boolean {
  const cache = new LruCache<string, boolean>(options?.cacheSize ?? DEFAULT_CONDITION_MEMO_SIZE);
  return (condition, context, data) => {
    const key = `${stableSerialize(condition)}|${stableSerialize(context)}|${stableSerialize(data)}`;
    const cached = cache.get(key);
    if (cached !== undefined) {
      return cached;
    }
    const result = evaluateCondition(condition, context, data, { maxDepth: options?.maxDepth });
    cache.set(key, result);
    return result;
  };
}

function evaluateConditionExplain(
  condition: RuleCondition,
  context: ExecutionContext,
  data: Record<string, JSONValue>,
  options?: { maxDepth?: number },
): { result: boolean; explain: ConditionExplain; reads: RuleRead[] } {
  const runtimeConfig = resolveRulesEngineConfig();
  const maxDepth = options?.maxDepth ?? runtimeConfig.limits.maxDepth;
  const reads: RuleRead[] = [];
  const explain = evalConditionExplain(condition, context, data, reads, 0, maxDepth);
  const deduped = new Map<string, RuleRead>();
  for (const read of reads) {
    deduped.set(read.path, read);
  }
  return { result: explain.result, explain, reads: Array.from(deduped.values()) };
}

function evalConditionExplain(
  condition: RuleCondition,
  context: ExecutionContext,
  data: Record<string, JSONValue>,
  reads: RuleRead[],
  depth: number,
  maxDepth: number,
): ConditionExplain {
  if (depth > maxDepth) {
    throw new Error(`Max condition depth exceeded: ${maxDepth}`);
  }

  if ('all' in condition) {
    const children = condition.all.map((child) => evalConditionExplain(child, context, data, reads, depth + 1, maxDepth));
    const result = children.every((child) => child.result);
    return { kind: 'all', result, children };
  }

  if ('any' in condition) {
    const children = condition.any.map((child) => evalConditionExplain(child, context, data, reads, depth + 1, maxDepth));
    const result = children.some((child) => child.result);
    return { kind: 'any', result, children };
  }

  if ('not' in condition) {
    const child = evalConditionExplain(condition.not, context, data, reads, depth + 1, maxDepth);
    return { kind: 'not', result: !child.result, child };
  }

  const left = resolveOperandExplain(condition.left, context, data, reads);
  const right = condition.right ? resolveOperandExplain(condition.right, context, data, reads) : undefined;

  const leftValue = left.kind === 'path' ? left.value : left.value;
  const rightValue = right ? (right.kind === 'path' ? right.value : right.value) : undefined;

  let result = false;
  switch (condition.op) {
    case 'eq':
      result = deepEqual(leftValue, rightValue);
      break;
    case 'neq':
      result = !deepEqual(leftValue, rightValue);
      break;
    case 'gt':
      result = typeof leftValue === 'number' && typeof rightValue === 'number' && leftValue > rightValue;
      break;
    case 'gte':
      result = typeof leftValue === 'number' && typeof rightValue === 'number' && leftValue >= rightValue;
      break;
    case 'lt':
      result = typeof leftValue === 'number' && typeof rightValue === 'number' && leftValue < rightValue;
      break;
    case 'lte':
      result = typeof leftValue === 'number' && typeof rightValue === 'number' && leftValue <= rightValue;
      break;
    case 'before':
    case 'after':
    case 'on':
    case 'dateEq':
    case 'dateBefore':
    case 'dateAfter':
    case 'dateBetween':
    case 'plusDays':
      result = compareDates(condition.op, leftValue, rightValue, context.locale);
      break;
    case 'in':
      result = Array.isArray(rightValue) && rightValue.some((item) => deepEqual(item, leftValue));
      break;
    case 'contains':
      if (typeof leftValue === 'string' && typeof rightValue === 'string') {
        result = leftValue.includes(rightValue);
      } else if (Array.isArray(leftValue)) {
        result = leftValue.some((item) => deepEqual(item, rightValue));
      } else {
        result = false;
      }
      break;
    case 'startsWith':
      result = typeof leftValue === 'string' && typeof rightValue === 'string' && leftValue.startsWith(rightValue);
      break;
    case 'endsWith':
      result = typeof leftValue === 'string' && typeof rightValue === 'string' && leftValue.endsWith(rightValue);
      break;
    case 'exists':
      result = leftValue !== undefined;
      break;
    default:
      result = false;
  }

  return { kind: 'compare', result, op: condition.op, left, right };
}

function resolveOperandExplain(
  operand: RuleOperand,
  context: ExecutionContext,
  data: Record<string, JSONValue>,
  reads: RuleRead[],
): ExplainOperand {
  if ('value' in operand) {
    const value = resolveDynamicValue(operand.value, context, data);
    return { kind: 'value', value: value === undefined ? null : value };
  }

  const path = operand.path;
  let value: JSONValue | undefined;
  if (path.startsWith('context.')) {
    value = getPath(context as unknown as Record<string, JSONValue>, path.slice('context.'.length));
  } else if (path.startsWith('data.')) {
    value = getPath(data, path.slice('data.'.length));
  } else {
    value = getPath(data, path);
  }

  reads.push({ path, value: cloneValue(value) });
  return { kind: 'path', path, value };
}

function evalCondition(
  condition: RuleCondition,
  context: ExecutionContext,
  data: Record<string, JSONValue>,
  depth: number,
  maxDepth: number,
): boolean {
  if (depth > maxDepth) {
    throw new Error(`Max condition depth exceeded: ${maxDepth}`);
  }

  if ('all' in condition) {
    return condition.all.every((child) => evalCondition(child, context, data, depth + 1, maxDepth));
  }

  if ('any' in condition) {
    return condition.any.some((child) => evalCondition(child, context, data, depth + 1, maxDepth));
  }

  if ('not' in condition) {
    return !evalCondition(condition.not, context, data, depth + 1, maxDepth);
  }

  const left = resolveOperand(condition.left, context, data);
  const right = condition.right ? resolveOperand(condition.right, context, data) : undefined;

  switch (condition.op) {
    case 'eq':
      return deepEqual(left, right);
    case 'neq':
      return !deepEqual(left, right);
    case 'gt':
      return typeof left === 'number' && typeof right === 'number' && left > right;
    case 'gte':
      return typeof left === 'number' && typeof right === 'number' && left >= right;
    case 'lt':
      return typeof left === 'number' && typeof right === 'number' && left < right;
    case 'lte':
      return typeof left === 'number' && typeof right === 'number' && left <= right;
    case 'before':
    case 'after':
    case 'on':
    case 'dateEq':
    case 'dateBefore':
    case 'dateAfter':
    case 'dateBetween':
    case 'plusDays':
      return compareDates(condition.op, left, right, context.locale);
    case 'in':
      return Array.isArray(right) && right.some((item) => deepEqual(item, left));
    case 'contains':
      if (typeof left === 'string' && typeof right === 'string') {
        return left.includes(right);
      }
      if (Array.isArray(left)) {
        return left.some((item) => deepEqual(item, right));
      }
      return false;
    case 'startsWith':
      return typeof left === 'string' && typeof right === 'string' && left.startsWith(right);
    case 'endsWith':
      return typeof left === 'string' && typeof right === 'string' && left.endsWith(right);
    case 'exists':
      return left !== undefined;
    default:
      return false;
  }
}

function resolveOperand(
  operand: RuleOperand,
  context: ExecutionContext,
  data: Record<string, JSONValue>,
): JSONValue | undefined {
  if ('value' in operand) {
    return resolveDynamicValue(operand.value, context, data);
  }
  const path = operand.path;
  if (path.startsWith('context.')) {
    return getPath(context as unknown as Record<string, JSONValue>, path.slice('context.'.length));
  }
  if (path.startsWith('data.')) {
    return getPath(data, path.slice('data.'.length));
  }
  return getPath(data, path);
}

function matchesScope(scope: RuleScope | undefined, context: ExecutionContext): boolean {
  if (!scope) return true;
  if (scope.countries && scope.countries.length > 0 && !scope.countries.includes(context.country)) {
    return false;
  }
  if (scope.tenants && scope.tenants.length > 0 && !scope.tenants.includes(context.tenantId)) {
    return false;
  }
  if (scope.orgs && scope.orgs.length > 0) {
    if (!context.orgId || !scope.orgs.includes(context.orgId)) {
      return false;
    }
  }
  if (scope.programs && scope.programs.length > 0) {
    if (!context.programId || !scope.programs.includes(context.programId)) {
      return false;
    }
  }
  if (scope.issuers && scope.issuers.length > 0) {
    if (!context.issuerId || !scope.issuers.includes(context.issuerId)) {
      return false;
    }
  }
  if (scope.roles && scope.roles.length > 0) {
    const roles = new Set([context.role, ...context.roles]);
    if (!scope.roles.some((role) => roles.has(role))) {
      return false;
    }
  }
  return true;
}

function applyAction(
  action: RuleAction,
  ctx: {
    data: Record<string, JSONValue>;
    context: ExecutionContext;
    trace: RulesTrace;
    ruleId: string;
  },
  actionPolicy: RulesEngineActionPolicy,
): void {
  switch (action.type) {
    case 'setField': {
      const path = stripPrefix(action.path, 'data.');
      const before = cloneValue(getPath(ctx.data, path));
      setPath(ctx.data, path, action.value);
      const after = cloneValue(getPath(ctx.data, path));
      recordActionDiff(ctx.trace, { ruleId: ctx.ruleId, action, target: 'data', path, before, after });
      ctx.trace.actionsApplied.push({ ruleId: ctx.ruleId, action });
      break;
    }
    case 'setContext': {
      const path = stripPrefix(action.path, 'context.');
      const contextObj = ctx.context as unknown as Record<string, JSONValue>;
      const before = cloneValue(getPath(contextObj, path));
      setPath(contextObj, path, action.value);
      const after = cloneValue(getPath(contextObj, path));
      recordActionDiff(ctx.trace, { ruleId: ctx.ruleId, action, target: 'context', path, before, after });
      ctx.trace.actionsApplied.push({ ruleId: ctx.ruleId, action });
      break;
    }
    case 'throwError':
      ctx.trace.actionsApplied.push({ ruleId: ctx.ruleId, action });
      throw new RuleActionError(action.message);
    case 'emitEvent':
      ctx.trace.actionsApplied.push({ ruleId: ctx.ruleId, action });
      ctx.trace.events.push({ ruleId: ctx.ruleId, event: action.event, payload: action.payload });
      break;
    case 'removeField': {
      const target = resolveTarget(ctx, action.path);
      if (target) {
        const before = cloneValue(getPath(target.obj, target.path));
        removePath(target.obj, target.path);
        const after = cloneValue(getPath(target.obj, target.path));
        const targetKind: RuleActionDiff['target'] = action.path.startsWith('context.') ? 'context' : 'data';
        recordActionDiff(ctx.trace, { ruleId: ctx.ruleId, action, target: targetKind, path: target.path, before, after });
        ctx.trace.actionsApplied.push({ ruleId: ctx.ruleId, action });
      }
      break;
    }
    case 'addItem': {
      const target = resolveTarget(ctx, action.path);
      if (target) {
        const before = cloneValue(getPath(target.obj, target.path));
        const current = getPath(target.obj, target.path);
        if (Array.isArray(current)) {
          current.push(action.value);
        } else {
          setPath(target.obj, target.path, [action.value]);
        }
        const after = cloneValue(getPath(target.obj, target.path));
        const targetKind: RuleActionDiff['target'] = action.path.startsWith('context.') ? 'context' : 'data';
        recordActionDiff(ctx.trace, { ruleId: ctx.ruleId, action, target: targetKind, path: target.path, before, after });
        ctx.trace.actionsApplied.push({ ruleId: ctx.ruleId, action });
      }
      break;
    }
    case 'mapField': {
      const source = resolveTarget(ctx, action.from);
      const dest = resolveTarget(ctx, action.to);
      if (source && dest) {
        const before = cloneValue(getPath(dest.obj, dest.path));
        const value = getPath(source.obj, source.path);
        if (value !== undefined) {
          setPath(dest.obj, dest.path, value);
        }
        const after = cloneValue(getPath(dest.obj, dest.path));
        const targetKind: RuleActionDiff['target'] = action.to.startsWith('context.') ? 'context' : 'data';
        recordActionDiff(ctx.trace, { ruleId: ctx.ruleId, action, target: targetKind, path: dest.path, before, after });
        ctx.trace.actionsApplied.push({ ruleId: ctx.ruleId, action });
      }
      break;
    }
    default: {
      executeCustomAction(action, ctx, actionPolicy);
    }
  }
}

function resolveTarget(
  ctx: { data: Record<string, JSONValue>; context: ExecutionContext },
  path: string,
): { obj: Record<string, JSONValue>; path: string } | null {
  if (path.startsWith('context.')) {
    return {
      obj: ctx.context as unknown as Record<string, JSONValue>,
      path: stripPrefix(path, 'context.'),
    };
  }
  if (path.startsWith('data.')) {
    return {
      obj: ctx.data,
      path: stripPrefix(path, 'data.'),
    };
  }
  return { obj: ctx.data, path };
}

function stripPrefix(path: string, prefix: string): string {
  return path.startsWith(prefix) ? path.slice(prefix.length) : path;
}

function recordActionDiff(trace: RulesTrace, diff: RuleActionDiff): void {
  if (!trace.actionDiffs) trace.actionDiffs = [];
  trace.actionDiffs.push(diff);
}

function cloneValue(value: JSONValue | undefined): JSONValue | undefined {
  if (value === undefined) return undefined;
  return deepClone(value);
}

function deepClone<T>(value: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

function getPath(obj: Record<string, JSONValue>, path: string): JSONValue | undefined {
  if (!path) return obj as unknown as JSONValue;
  const parts = tokenizePath(path);
  let current: JSONValue | undefined = obj;
  for (const part of parts) {
    if (part === undefined) return undefined;
    if (current === null || current === undefined) return undefined;
    if (typeof part === 'number') {
      if (!Array.isArray(current)) return undefined;
      current = current[part];
    } else {
      if (isUnsafeKey(part)) return undefined;
      if (typeof current !== 'object' || Array.isArray(current)) return undefined;
      current = (current as Record<string, JSONValue>)[part];
    }
  }
  return current;
}

function setPath(obj: Record<string, JSONValue>, path: string, value?: JSONValue): void {
  const parts = tokenizePath(path);
  let current: Record<string, JSONValue> | JSONValue[] = obj;
  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i];
    if (part === undefined) return;
    const isLast = i === parts.length - 1;
    if (isLast) {
      if (typeof part === 'number' && Array.isArray(current)) {
        (current as JSONValue[])[part] = value as JSONValue;
      } else if (typeof part === 'string' && !Array.isArray(current)) {
        if (isUnsafeKey(part)) return;
        (current as Record<string, JSONValue>)[part] = value as JSONValue;
      }
      return;
    }

    const nextPart = parts[i + 1];
    if (typeof part === 'number') {
      if (!Array.isArray(current)) return;
      const arr = current as JSONValue[];
      if (arr[part] === undefined) {
        arr[part] = typeof nextPart === 'number' ? [] : {};
      }
      current = arr[part] as Record<string, JSONValue> | JSONValue[];
    } else {
      if (isUnsafeKey(part)) return;
      if (Array.isArray(current)) return;
      const objRef = current as Record<string, JSONValue>;
      if (objRef[part] === undefined) {
        objRef[part] = typeof nextPart === 'number' ? [] : {};
      }
      current = objRef[part] as Record<string, JSONValue> | JSONValue[];
    }
  }
}

function removePath(obj: Record<string, JSONValue>, path: string): void {
  const parts = tokenizePath(path);
  if (parts.length === 0) return;
  const last = parts[parts.length - 1];
  if (last === undefined) return;
  const parentParts = parts.slice(0, -1);
  let current: JSONValue | undefined = obj;
  for (const part of parentParts) {
    if (part === undefined) return;
    if (current === null || current === undefined) return;
    if (typeof part === 'number') {
      if (!Array.isArray(current)) return;
      current = current[part];
    } else {
      if (isUnsafeKey(part)) return;
      if (typeof current !== 'object' || Array.isArray(current)) return;
      current = (current as Record<string, JSONValue>)[part];
    }
  }
  if (current === null || current === undefined) return;
  if (typeof last === 'number') {
    if (Array.isArray(current)) current.splice(last, 1);
  } else if (typeof current === 'object' && !Array.isArray(current)) {
    if (isUnsafeKey(last)) return;
    delete (current as Record<string, JSONValue>)[last];
  }
}

function tokenizePath(path: string): Array<string | number> {
  const cached = pathCache.get(path);
  if (cached) return cached;
  const normalized = path.replace(/\[(\d+)\]/g, '.$1');
  const tokens = normalized
    .split('.')
    .filter((segment) => segment.length > 0)
    .map((segment) => {
      const index = Number(segment);
      return Number.isNaN(index) ? segment : index;
    });
  pathCache.set(path, tokens);
  return tokens;
}

function deepEqual(a: JSONValue | undefined, b: JSONValue | undefined): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return a === b;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((value, index) => deepEqual(value, b[index]));
  }
  if (typeof a === 'object' && typeof b === 'object') {
    const aKeys = Object.keys(a as Record<string, JSONValue>);
    const bKeys = Object.keys(b as Record<string, JSONValue>);
    if (aKeys.length !== bKeys.length) return false;
    return aKeys.every((key) => deepEqual((a as Record<string, JSONValue>)[key], (b as Record<string, JSONValue>)[key]));
  }
  return false;
}

function compareDates(
  op: 'before' | 'after' | 'on' | 'plusDays' | 'dateEq' | 'dateBefore' | 'dateAfter' | 'dateBetween',
  left: JSONValue | undefined,
  right: JSONValue | undefined,
  locale: string,
): boolean {
  const leftMs = coerceDateMs(left, locale);
  if (leftMs === null) return false;
  if (op === 'dateBetween') {
    const range = coerceDateRange(right, locale);
    if (!range) return false;
    return leftMs >= range.start && leftMs <= range.end;
  }
  if (op === 'plusDays') {
    const plusDaysValue = coercePlusDays(right, locale);
    if (!plusDaysValue) return false;
    return leftMs === plusDaysValue;
  }
  const rightMs = coerceDateMs(right, locale);
  if (rightMs === null) return false;
  switch (op) {
    case 'on':
    case 'dateEq':
      return leftMs === rightMs;
    case 'before':
    case 'dateBefore':
      return leftMs < rightMs;
    case 'after':
    case 'dateAfter':
      return leftMs > rightMs;
    default:
      return false;
  }
}

function coerceDateRange(value: JSONValue | undefined, locale: string): { start: number; end: number } | null {
  if (!Array.isArray(value) || value.length < 2) return null;
  const start = coerceDateMs(value[0] as JSONValue, locale);
  const end = coerceDateMs(value[1] as JSONValue, locale);
  if (start === null || end === null) return null;
  return { start, end };
}

function coerceDateMs(value: JSONValue | undefined, locale: string): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (dateOnlyMatch) {
    const year = Number(dateOnlyMatch[1]);
    const month = Number(dateOnlyMatch[2]) - 1;
    const day = Number(dateOnlyMatch[3]);
    return Date.UTC(year, month, day);
  }

  const localMatch = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(trimmed);
  if (localMatch) {
    const year = Number(localMatch[1]);
    const month = Number(localMatch[2]) - 1;
    const day = Number(localMatch[3]);
    const hour = Number(localMatch[4]);
    const minute = Number(localMatch[5]);
    const second = localMatch[6] ? Number(localMatch[6]) : 0;
    return Date.UTC(year, month, day, hour, minute, second);
  }

  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:\d{2})$/.test(trimmed)) {
    const parsed = Date.parse(trimmed);
    return Number.isNaN(parsed) ? null : parsed;
  }

  const localeDate = parseLocaleDateString(trimmed, locale);
  if (localeDate !== null) return localeDate;

  return null;
}

function coercePlusDays(value: JSONValue | undefined, locale: string): number | null {
  if (!value) return null;
  if (Array.isArray(value) && value.length >= 2) {
    const base = coerceDateMs(value[0] as JSONValue, locale);
    const days = typeof value[1] === 'number' ? value[1] : Number(value[1]);
    if (base === null || !Number.isFinite(days)) return null;
    return shiftDateByDays(base, days);
  }
  if (typeof value === 'object' && !Array.isArray(value)) {
    const rec = value as Record<string, JSONValue>;
    const base = coerceDateMs(rec.date, locale);
    const days = typeof rec.days === 'number' ? rec.days : Number(rec.days);
    if (base === null || !Number.isFinite(days)) return null;
    return shiftDateByDays(base, days);
  }
  return null;
}

function shiftDateByDays(baseMs: number, days: number): number {
  const dayMs = 24 * 60 * 60 * 1000;
  return baseMs + Math.round(days) * dayMs;
}

function parseLocaleDateString(value: string, locale: string): number | null {
  const normalized = value.trim();
  const parts = normalized.split(/[\/.-]/).map((part) => part.trim());
  if (parts.length !== 3 || !parts.every((part) => /^\d{1,4}$/.test(part))) {
    return null;
  }

  const order = detectLocaleDateOrder(locale);
  const a = Number(parts[0]);
  const b = Number(parts[1]);
  const c = Number(parts[2]);
  if (![a, b, c].every((part) => Number.isFinite(part))) return null;

  let year = 0;
  let month = 0;
  let day = 0;

  if (order === 'ymd') {
    year = a;
    month = b;
    day = c;
  } else if (order === 'mdy') {
    month = a;
    day = b;
    year = c;
  } else {
    day = a;
    month = b;
    year = c;
  }

  if (year < 100) {
    year = year >= 70 ? year + 1900 : year + 2000;
  }
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return Date.UTC(year, month - 1, day);
}

function detectLocaleDateOrder(locale: string): 'mdy' | 'dmy' | 'ymd' {
  try {
    const formatter = new Intl.DateTimeFormat(locale || 'en-US');
    const parts = formatter.formatToParts(new Date(Date.UTC(2001, 10, 22)));
    const order = parts
      .filter((part) => part.type === 'day' || part.type === 'month' || part.type === 'year')
      .map((part) => part.type)
      .join('');
    if (order === 'yearmonthday') return 'ymd';
    if (order === 'monthdayyear') return 'mdy';
    return 'dmy';
  } catch {
    return 'mdy';
  }
}

function resolveDynamicValue(
  value: JSONValue,
  context: ExecutionContext,
  data: Record<string, JSONValue>,
): JSONValue | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return value;
  }
  const record = value as Record<string, JSONValue>;
  if (record.$path && typeof record.$path === 'string') {
    return resolveOperand({ path: record.$path }, context, data);
  }
  if (record.$transform && typeof record.$transform === 'string') {
    return evaluateTransform(record.$transform, record.args, context, data, context.locale);
  }
  return value;
}

function evaluateTransform(
  transform: string,
  args: JSONValue | undefined,
  context: ExecutionContext,
  data: Record<string, JSONValue>,
  locale: string,
): JSONValue | undefined {
  if (!Array.isArray(args) || args.length > 8) return undefined;
  const resolvedArgs = args.map((arg) => resolveTransformArg(arg, context, data));
  switch (transform) {
    case 'add':
      return numericFold(resolvedArgs, (acc, value) => acc + value);
    case 'subtract':
      return numericFold(resolvedArgs, (acc, value) => acc - value);
    case 'multiply':
      return numericFold(resolvedArgs, (acc, value) => acc * value);
    case 'divide':
      return numericFold(resolvedArgs, (acc, value) => (value === 0 ? Number.NaN : acc / value));
    case 'mod':
      if (resolvedArgs.length !== 2) return undefined;
      {
        const left = toFiniteNumber(resolvedArgs[0]);
        const right = toFiniteNumber(resolvedArgs[1]);
        if (left === null || right === null || right === 0) return undefined;
        return left % right;
      }
    case 'abs': {
      const value = toFiniteNumber(resolvedArgs[0]);
      return value === null ? undefined : Math.abs(value);
    }
    case 'round': {
      const value = toFiniteNumber(resolvedArgs[0]);
      return value === null ? undefined : Math.round(value);
    }
    case 'floor': {
      const value = toFiniteNumber(resolvedArgs[0]);
      return value === null ? undefined : Math.floor(value);
    }
    case 'ceil': {
      const value = toFiniteNumber(resolvedArgs[0]);
      return value === null ? undefined : Math.ceil(value);
    }
    case 'trim':
      return typeof resolvedArgs[0] === 'string' ? resolvedArgs[0].trim() : undefined;
    case 'lower':
      return typeof resolvedArgs[0] === 'string' ? resolvedArgs[0].toLowerCase() : undefined;
    case 'upper':
      return typeof resolvedArgs[0] === 'string' ? resolvedArgs[0].toUpperCase() : undefined;
    case 'concat':
      return resolvedArgs.map((value) => String(value ?? '')).join('');
    case 'plusDays': {
      const payload: JSONValue = { date: resolvedArgs[0] as JSONValue, days: resolvedArgs[1] as JSONValue };
      const shifted = coercePlusDays(payload, locale);
      return shifted ?? undefined;
    }
    default:
      return undefined;
  }
}

function resolveTransformArg(
  arg: JSONValue,
  context: ExecutionContext,
  data: Record<string, JSONValue>,
): JSONValue | undefined {
  if (arg && typeof arg === 'object' && !Array.isArray(arg)) {
    const rec = arg as Record<string, JSONValue>;
    if (rec.$path && typeof rec.$path === 'string') {
      return resolveOperand({ path: rec.$path }, context, data);
    }
  }
  return arg;
}

function numericFold(
  args: Array<JSONValue | undefined>,
  reducer: (acc: number, value: number) => number,
): number | undefined {
  if (args.length === 0) return undefined;
  const first = toFiniteNumber(args[0]);
  if (first === null) return undefined;
  let acc = first;
  for (let i = 1; i < args.length; i += 1) {
    const value = toFiniteNumber(args[i]);
    if (value === null) return undefined;
    acc = reducer(acc, value);
    if (!Number.isFinite(acc)) return undefined;
  }
  return acc;
}

function toFiniteNumber(value: JSONValue | undefined): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function executeCustomAction(
  action: RuleAction,
  ctx: RuleActionHandlerContext,
  actionPolicy: RulesEngineActionPolicy,
): void {
  const actionType = typeof (action as { type?: unknown }).type === 'string'
    ? ((action as { type: string }).type)
    : 'unknown';
  if (!actionPolicy.allowCustomActions) {
    ctx.trace.errors.push({ ruleId: ctx.ruleId, message: `Unsupported action: ${actionType}` });
    return;
  }
  if (actionPolicy.allowedActionTypes.length > 0 && !actionPolicy.allowedActionTypes.includes(actionType)) {
    ctx.trace.errors.push({ ruleId: ctx.ruleId, message: `Action not allowed by policy: ${actionType}` });
    return;
  }
  const handler = customActionHandlers.get(actionType);
  if (!handler) {
    ctx.trace.errors.push({ ruleId: ctx.ruleId, message: `No handler registered for action: ${actionType}` });
    return;
  }
  handler(action, ctx);
  ctx.trace.actionsApplied.push({ ruleId: ctx.ruleId, action });
}

export function configureRulesEngine(config: RulesEngineConfig): void {
  configuredRulesEngine = {
    limits: {
      ...(configuredRulesEngine.limits ?? {}),
      ...(config.limits ?? {}),
    },
    actionPolicy: {
      ...(configuredRulesEngine.actionPolicy ?? {}),
      ...(config.actionPolicy ?? {}),
    },
    performance: {
      ...(configuredRulesEngine.performance ?? {}),
      ...(config.performance ?? {}),
    },
  };
}

export function resetRulesEngineConfig(): void {
  configuredRulesEngine = {};
}

export function registerRuleActionHandler(type: string, handler: RuleActionHandler): void {
  if (!type || !/^[a-zA-Z0-9_.-]+$/.test(type)) {
    throw new Error('Invalid custom action type. Use alphanumeric, ".", "-", "_" only.');
  }
  customActionHandlers.set(type, handler);
}

export function unregisterRuleActionHandler(type: string): void {
  customActionHandlers.delete(type);
}

export function clearRuleActionHandlers(): void {
  customActionHandlers.clear();
}

function resolveRulesEngineConfig(): {
  limits: RulesEngineLimits;
  actionPolicy: RulesEngineActionPolicy;
  performance: RulesEnginePerformancePolicy;
} {
  const env = readConfigFromEnv();
  return {
    limits: {
      timeoutMs:
        configuredRulesEngine.limits?.timeoutMs ??
        env.limits.timeoutMs ??
        DEFAULT_RULES_ENGINE_CONFIG.limits.timeoutMs,
      maxRules:
        configuredRulesEngine.limits?.maxRules ??
        env.limits.maxRules ??
        DEFAULT_RULES_ENGINE_CONFIG.limits.maxRules,
      maxDepth:
        configuredRulesEngine.limits?.maxDepth ??
        env.limits.maxDepth ??
        DEFAULT_RULES_ENGINE_CONFIG.limits.maxDepth,
    },
    actionPolicy: {
      allowCustomActions:
        configuredRulesEngine.actionPolicy?.allowCustomActions ??
        env.actionPolicy.allowCustomActions ??
        DEFAULT_RULES_ENGINE_CONFIG.actionPolicy.allowCustomActions,
      allowedActionTypes:
        configuredRulesEngine.actionPolicy?.allowedActionTypes ??
        env.actionPolicy.allowedActionTypes ??
        DEFAULT_RULES_ENGINE_CONFIG.actionPolicy.allowedActionTypes,
    },
    performance: {
      pathCacheSize:
        configuredRulesEngine.performance?.pathCacheSize ??
        env.performance.pathCacheSize ??
        DEFAULT_RULES_ENGINE_CONFIG.performance.pathCacheSize,
      conditionMemoSize:
        configuredRulesEngine.performance?.conditionMemoSize ??
        env.performance.conditionMemoSize ??
        DEFAULT_RULES_ENGINE_CONFIG.performance.conditionMemoSize,
      memoizeConditionEvaluations:
        configuredRulesEngine.performance?.memoizeConditionEvaluations ??
        env.performance.memoizeConditionEvaluations ??
        DEFAULT_RULES_ENGINE_CONFIG.performance.memoizeConditionEvaluations,
    },
  };
}

function readConfigFromEnv(): {
  limits: Partial<RulesEngineLimits>;
  actionPolicy: Partial<RulesEngineActionPolicy>;
  performance: Partial<RulesEnginePerformancePolicy>;
} {
  if (typeof process === 'undefined' || !process.env) {
    return { limits: {}, actionPolicy: {}, performance: {} };
  }
  const timeoutMs = parsePositiveInt(process.env.RULEFLOW_RULES_TIMEOUT_MS);
  const maxRules = parsePositiveInt(process.env.RULEFLOW_RULES_MAX_RULES);
  const maxDepth = parsePositiveInt(process.env.RULEFLOW_RULES_MAX_DEPTH);
  const pathCacheSize = parsePositiveInt(process.env.RULEFLOW_RULES_PATH_CACHE_SIZE);
  const conditionMemoSize = parsePositiveInt(process.env.RULEFLOW_RULES_CONDITION_MEMO_SIZE);
  const memoizeConditionEvaluations = parseBoolean(process.env.RULEFLOW_RULES_MEMOIZE_CONDITIONS);
  const allowCustomActions = parseBoolean(process.env.RULEFLOW_RULES_ALLOW_CUSTOM_ACTIONS);
  const allowedActionTypes = parseCsv(process.env.RULEFLOW_RULES_ALLOWED_ACTIONS);
  const limits: Partial<RulesEngineLimits> = {};
  if (timeoutMs !== undefined) limits.timeoutMs = timeoutMs;
  if (maxRules !== undefined) limits.maxRules = maxRules;
  if (maxDepth !== undefined) limits.maxDepth = maxDepth;
  const performance: Partial<RulesEnginePerformancePolicy> = {};
  if (pathCacheSize !== undefined) performance.pathCacheSize = pathCacheSize;
  if (conditionMemoSize !== undefined) performance.conditionMemoSize = conditionMemoSize;
  if (memoizeConditionEvaluations !== undefined) performance.memoizeConditionEvaluations = memoizeConditionEvaluations;
  const actionPolicy: Partial<RulesEngineActionPolicy> = {};
  if (allowCustomActions !== undefined) actionPolicy.allowCustomActions = allowCustomActions;
  if (allowedActionTypes !== undefined) actionPolicy.allowedActionTypes = allowedActionTypes;
  return {
    limits,
    actionPolicy,
    performance,
  };
}

function parsePositiveInt(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return undefined;
  return parsed;
}

function parseBoolean(value: string | undefined): boolean | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === '1' || normalized === 'true') return true;
  if (normalized === '0' || normalized === 'false') return false;
  return undefined;
}

function parseCsv(value: string | undefined): string[] | undefined {
  if (!value) return undefined;
  const parts = value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : undefined;
}

class RuleActionError extends Error {}

class LruCache<K, V> {
  private store = new Map<K, V>();

  constructor(private limit: number) {}

  setLimit(limit: number): void {
    this.limit = Math.max(1, limit);
    this.prune();
  }

  get(key: K): V | undefined {
    const value = this.store.get(key);
    if (value === undefined) return undefined;
    this.store.delete(key);
    this.store.set(key, value);
    return value;
  }

  set(key: K, value: V): void {
    if (this.store.has(key)) this.store.delete(key);
    this.store.set(key, value);
    this.prune();
  }

  private prune(): void {
    while (this.store.size > this.limit) {
      const first = this.store.keys().next().value;
      if (first === undefined) break;
      this.store.delete(first);
    }
  }
}

const pathCache = new LruCache<string, Array<string | number>>(DEFAULT_PATH_CACHE_SIZE);
let currentPathCacheLimit = DEFAULT_PATH_CACHE_SIZE;

function updatePathCacheLimit(limit: number): void {
  const safeLimit = Number.isInteger(limit) && limit > 0 ? limit : DEFAULT_PATH_CACHE_SIZE;
  if (safeLimit === currentPathCacheLimit) return;
  currentPathCacheLimit = safeLimit;
  pathCache.setLimit(safeLimit);
}

function isUnsafeKey(value: string): boolean {
  return value === '__proto__' || value === 'constructor' || value === 'prototype';
}

function isThrowError(error: unknown): boolean {
  return error instanceof RuleActionError;
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function stableSerialize(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => sortValue(entry));
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(record).sort((a, b) => a.localeCompare(b))) {
      sorted[key] = sortValue(record[key]);
    }
    return sorted;
  }
  return value;
}
