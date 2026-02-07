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
import type { RulesTrace } from '@platform/observability';

export interface EvaluateRulesInput {
  rules: Rule[] | RuleSet;
  context: ExecutionContext;
  data: Record<string, JSONValue>;
  options?: {
    timeoutMs?: number;
    maxRules?: number;
    maxDepth?: number;
    mode?: 'apply' | 'predicate';
  };
}

export interface EvaluateRulesResult {
  data: Record<string, JSONValue>;
  context: ExecutionContext;
  trace: RulesTrace;
}

const DEFAULT_TIMEOUT_MS = 50;
const DEFAULT_MAX_RULES = 1000;
const DEFAULT_MAX_DEPTH = 10;

export function evaluateRules(input: EvaluateRulesInput): EvaluateRulesResult {
  const started = Date.now();
  const rulesArray = Array.isArray(input.rules) ? input.rules : input.rules.rules;
  const timeoutMs = input.options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxRules = input.options?.maxRules ?? DEFAULT_MAX_RULES;
  const maxDepth = input.options?.maxDepth ?? DEFAULT_MAX_DEPTH;
  const mode = input.options?.mode ?? 'apply';

  const trace: RulesTrace = {
    startedAt: new Date(started).toISOString(),
    durationMs: 0,
    rulesConsidered: [],
    rulesMatched: [],
    conditionResults: {},
    actionsApplied: [],
    events: [],
    errors: [],
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
      const result = evaluateCondition(rule.when, context, data, { maxDepth });
      trace.conditionResults[rule.ruleId] = result;
      if (result) {
        trace.rulesMatched.push(rule.ruleId);
        if (mode === 'apply') {
          const actions = rule.actions ?? [];
          for (const action of actions) {
            applyAction(action, { data, context, trace, ruleId: rule.ruleId });
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

  return { data, context, trace };
}

export function evaluateCondition(
  condition: RuleCondition,
  context: ExecutionContext,
  data: Record<string, JSONValue>,
  options?: { maxDepth?: number },
): boolean {
  const maxDepth = options?.maxDepth ?? DEFAULT_MAX_DEPTH;
  return evalCondition(condition, context, data, 0, maxDepth);
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
    return operand.value;
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
): void {
  switch (action.type) {
    case 'setField':
      setPath(ctx.data, stripPrefix(action.path, 'data.'), action.value);
      ctx.trace.actionsApplied.push({ ruleId: ctx.ruleId, action });
      break;
    case 'setContext':
      setPath(
        ctx.context as unknown as Record<string, JSONValue>,
        stripPrefix(action.path, 'context.'),
        action.value,
      );
      ctx.trace.actionsApplied.push({ ruleId: ctx.ruleId, action });
      break;
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
        removePath(target.obj, target.path);
        ctx.trace.actionsApplied.push({ ruleId: ctx.ruleId, action });
      }
      break;
    }
    case 'addItem': {
      const target = resolveTarget(ctx, action.path);
      if (target) {
        const current = getPath(target.obj, target.path);
        if (Array.isArray(current)) {
          current.push(action.value);
        } else {
          setPath(target.obj, target.path, [action.value]);
        }
        ctx.trace.actionsApplied.push({ ruleId: ctx.ruleId, action });
      }
      break;
    }
    case 'mapField': {
      const source = resolveTarget(ctx, action.from);
      const dest = resolveTarget(ctx, action.to);
      if (source && dest) {
        const value = getPath(source.obj, source.path);
        if (value !== undefined) {
          setPath(dest.obj, dest.path, value);
        }
        ctx.trace.actionsApplied.push({ ruleId: ctx.ruleId, action });
      }
      break;
    }
    default: {
      const actionType = (action as { type?: string }).type ?? 'unknown';
      ctx.trace.errors.push({ ruleId: ctx.ruleId, message: `Unsupported action: ${actionType}` });
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
      if (typeof current !== 'object' || Array.isArray(current)) return;
      current = (current as Record<string, JSONValue>)[part];
    }
  }
  if (current === null || current === undefined) return;
  if (typeof last === 'number') {
    if (Array.isArray(current)) current.splice(last, 1);
  } else if (typeof current === 'object' && !Array.isArray(current)) {
    delete (current as Record<string, JSONValue>)[last];
  }
}

function tokenizePath(path: string): Array<string | number> {
  const normalized = path.replace(/\[(\d+)\]/g, '.$1');
  return normalized
    .split('.')
    .filter((segment) => segment.length > 0)
    .map((segment) => {
      const index = Number(segment);
      return Number.isNaN(index) ? segment : index;
    });
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

class RuleActionError extends Error {}

function isThrowError(error: unknown): boolean {
  return error instanceof RuleActionError;
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
