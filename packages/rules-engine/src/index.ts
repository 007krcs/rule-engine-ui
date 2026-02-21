import type {
  ExecutionContext,
  JSONValue,
  Rule,
  RuleAction,
  RuleCondition,
  RuleOperand,
  RuleSet,
  RuleScope,
  TransformSpec,
} from '@platform/schema';
import {
  logRulesTrace,
  type ConditionExplain,
  type ExplainOperand,
  type RuleActionDiff,
  type RuleRead,
  type RulesTrace,
  type TraceLogger,
} from '@platform/observability';

// =============================================
// Configuration Types
// =============================================

export interface RulesEngineConfig {
  timeoutMs: number;
  maxRules: number;
  maxDepth: number;
  locale?: string;
  timezone?: string;
}

export interface EvaluateRulesInput {
  rules: Rule[] | RuleSet;
  context: ExecutionContext;
  data: Record<string, JSONValue>;
  options?: {
    timeoutMs?: number;
    maxRules?: number;
    maxDepth?: number;
    mode?: 'apply' | 'predicate';
    logTrace?: boolean;
    traceLogger?: (trace: RulesTrace) => void;
    logger?: TraceLogger<RulesTrace>;
    locale?: string;
    timezone?: string;
    actionHandlers?: ActionHandlerRegistry;
  };
}

export interface EvaluateRulesResult {
  data: Record<string, JSONValue>;
  context: ExecutionContext;
  trace: RulesTrace;
}

// =============================================
// Configurable Defaults (Environment/Config)
// =============================================

function getEnvNumber(key: string, fallback: number): number {
  if (typeof process === 'undefined') return fallback;
  const value = process.env[key];
  if (!value) return fallback;
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

const DEFAULT_TIMEOUT_MS = getEnvNumber('RULES_ENGINE_TIMEOUT_MS', 50);
const DEFAULT_MAX_RULES = getEnvNumber('RULES_ENGINE_MAX_RULES', 1000);
const DEFAULT_MAX_DEPTH = getEnvNumber('RULES_ENGINE_MAX_DEPTH', 10);

let globalConfig: RulesEngineConfig = {
  timeoutMs: DEFAULT_TIMEOUT_MS,
  maxRules: DEFAULT_MAX_RULES,
  maxDepth: DEFAULT_MAX_DEPTH,
};

export function configureRulesEngine(config: Partial<RulesEngineConfig>): void {
  globalConfig = { ...globalConfig, ...config };
}

export function getRulesEngineConfig(): RulesEngineConfig {
  return { ...globalConfig };
}

export function resetRulesEngineConfig(): void {
  globalConfig = {
    timeoutMs: DEFAULT_TIMEOUT_MS,
    maxRules: DEFAULT_MAX_RULES,
    maxDepth: DEFAULT_MAX_DEPTH,
  };
}

// =============================================
// Action Handler Registry (Extensibility)
// =============================================

export type ActionHandler = (
  action: RuleAction,
  ctx: ActionContext,
) => void;

export interface ActionContext {
  data: Record<string, JSONValue>;
  context: ExecutionContext;
  trace: RulesTrace;
  ruleId: string;
}

export interface ActionHandlerRegistry {
  register: (type: string, handler: ActionHandler, options?: ActionHandlerOptions) => void;
  get: (type: string) => ActionHandler | undefined;
  has: (type: string) => boolean;
  list: () => string[];
}

export interface ActionHandlerOptions {
  allowedPaths?: string[];
  sandbox?: boolean;
}

const builtInActions = new Set([
  'setField', 'setContext', 'throwError', 'emitEvent',
  'removeField', 'addItem', 'mapField', 'transform', 'custom',
]);

export function createActionHandlerRegistry(): ActionHandlerRegistry {
  const handlers = new Map<string, { handler: ActionHandler; options?: ActionHandlerOptions }>();

  return {
    register: (type, handler, options) => {
      if (builtInActions.has(type)) {
        throw new Error(`Cannot override built-in action type: ${type}`);
      }
      if (!isValidActionType(type)) {
        throw new Error(`Invalid action type name: ${type}. Must match /^[a-zA-Z][a-zA-Z0-9_]*$/`);
      }
      handlers.set(type, { handler, options });
    },
    get: (type) => handlers.get(type)?.handler,
    has: (type) => handlers.has(type),
    list: () => Array.from(handlers.keys()),
  };
}

function isValidActionType(type: string): boolean {
  return /^[a-zA-Z][a-zA-Z0-9_]*$/.test(type);
}

const defaultActionRegistry = createActionHandlerRegistry();

export function evaluateRules(input: EvaluateRulesInput): EvaluateRulesResult {
  const started = Date.now();
  const rulesArray = Array.isArray(input.rules) ? input.rules : input.rules.rules;
  const timeoutMs = input.options?.timeoutMs ?? globalConfig.timeoutMs;
  const maxRules = input.options?.maxRules ?? globalConfig.maxRules;
  const maxDepth = input.options?.maxDepth ?? globalConfig.maxDepth;
  const locale = input.options?.locale ?? globalConfig.locale ?? input.context.locale;
  const timezone = input.options?.timezone ?? globalConfig.timezone ?? input.context.timezone;
  const mode = input.options?.mode ?? 'apply';
  const actionHandlers = input.options?.actionHandlers ?? defaultActionRegistry;

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
  };

  const data = deepClone(input.data);
  const context = deepClone(input.context);

  const evalContext: EvalContext = { locale, timezone };

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
      const explained = evaluateConditionExplain(rule.when, context, data, { maxDepth, evalContext });
      trace.conditionResults[rule.ruleId] = explained.result;
      trace.conditionExplains![rule.ruleId] = explained.explain;
      trace.readsByRuleId![rule.ruleId] = explained.reads;
      if (explained.result) {
        trace.rulesMatched.push(rule.ruleId);
        if (mode === 'apply') {
          const actions = rule.actions ?? [];
          for (const action of actions) {
            applyAction(action, { data, context, trace, ruleId: rule.ruleId }, actionHandlers, evalContext);
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

// =============================================
// Evaluation Context
// =============================================

interface EvalContext {
  locale?: string;
  timezone?: string;
}

export function evaluateCondition(
  condition: RuleCondition,
  context: ExecutionContext,
  data: Record<string, JSONValue>,
  options?: { maxDepth?: number; locale?: string; timezone?: string },
): boolean {
  const maxDepth = options?.maxDepth ?? globalConfig.maxDepth;
  const evalContext: EvalContext = {
    locale: options?.locale ?? context.locale,
    timezone: options?.timezone ?? context.timezone,
  };
  return evalCondition(condition, context, data, 0, maxDepth, evalContext);
}

function evaluateConditionExplain(
  condition: RuleCondition,
  context: ExecutionContext,
  data: Record<string, JSONValue>,
  options?: { maxDepth?: number; evalContext?: EvalContext },
): { result: boolean; explain: ConditionExplain; reads: RuleRead[] } {
  const maxDepth = options?.maxDepth ?? globalConfig.maxDepth;
  const evalContext = options?.evalContext ?? { locale: context.locale, timezone: context.timezone };
  const reads: RuleRead[] = [];
  const explain = evalConditionExplain(condition, context, data, reads, 0, maxDepth, evalContext);
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
  evalContext: EvalContext,
): ConditionExplain {
  if (depth > maxDepth) {
    throw new Error(`Max condition depth exceeded: ${maxDepth}`);
  }

  if ('all' in condition) {
    const children = condition.all.map((child) => evalConditionExplain(child, context, data, reads, depth + 1, maxDepth, evalContext));
    const result = children.every((child) => child.result);
    return { kind: 'all', result, children };
  }

  if ('any' in condition) {
    const children = condition.any.map((child) => evalConditionExplain(child, context, data, reads, depth + 1, maxDepth, evalContext));
    const result = children.some((child) => child.result);
    return { kind: 'any', result, children };
  }

  if ('not' in condition) {
    const child = evalConditionExplain(condition.not, context, data, reads, depth + 1, maxDepth, evalContext);
    return { kind: 'not', result: !child.result, child };
  }

  const left = resolveOperandExplain(condition.left, context, data, reads);
  const right = condition.right ? resolveOperandExplain(condition.right, context, data, reads) : undefined;

  const leftValue = left.kind === 'path' ? left.value : left.value;
  const rightValue = right ? (right.kind === 'path' ? right.value : right.value) : undefined;

  const result = evaluateOperator(condition.op, leftValue, rightValue, evalContext);
  return { kind: 'compare', result, op: condition.op, left, right };
}

// =============================================
// Operator Evaluation
// =============================================

function evaluateOperator(
  op: string,
  left: JSONValue | undefined,
  right: JSONValue | undefined,
  evalContext: EvalContext,
): boolean {
  switch (op) {
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
    case 'dateEq':
    case 'dateBefore':
    case 'dateAfter':
    case 'dateBetween':
    case 'dateOn':
      return compareDates(op as DateOperator, left, right, evalContext);
    case 'datePlusDays':
      return compareDatePlusDays(left, right, evalContext);
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
      return left !== undefined && left !== null;
    case 'isEmpty':
      return isEmptyValue(left);
    case 'isNotEmpty':
      return !isEmptyValue(left);
    case 'matches':
      return typeof left === 'string' && typeof right === 'string' && safeRegexTest(right, left);
    case 'length':
      return evaluateLengthOperator(left, right);
    default:
      return false;
  }
}

function isEmptyValue(value: JSONValue | undefined): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string') return value.length === 0;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
}

function safeRegexTest(pattern: string, value: string): boolean {
  try {
    if (pattern.length > 500) return false;
    const regex = new RegExp(pattern);
    return regex.test(value);
  } catch {
    return false;
  }
}

function evaluateLengthOperator(left: JSONValue | undefined, right: JSONValue | undefined): boolean {
  if (typeof right !== 'number') return false;
  if (typeof left === 'string') return left.length === right;
  if (Array.isArray(left)) return left.length === right;
  return false;
}

function resolveOperandExplain(
  operand: RuleOperand,
  context: ExecutionContext,
  data: Record<string, JSONValue>,
  reads: RuleRead[],
): ExplainOperand {
  if ('value' in operand) {
    return { kind: 'value', value: operand.value };
  }

  if ('path' in operand) {
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

  return { kind: 'value', value: null };
}

function evalCondition(
  condition: RuleCondition,
  context: ExecutionContext,
  data: Record<string, JSONValue>,
  depth: number,
  maxDepth: number,
  evalContext: EvalContext,
): boolean {
  if (depth > maxDepth) {
    throw new Error(`Max condition depth exceeded: ${maxDepth}`);
  }

  if ('all' in condition) {
    return condition.all.every((child) => evalCondition(child, context, data, depth + 1, maxDepth, evalContext));
  }

  if ('any' in condition) {
    return condition.any.some((child) => evalCondition(child, context, data, depth + 1, maxDepth, evalContext));
  }

  if ('not' in condition) {
    return !evalCondition(condition.not, context, data, depth + 1, maxDepth, evalContext);
  }

  const left = resolveOperand(condition.left, context, data);
  const right = condition.right ? resolveOperand(condition.right, context, data) : undefined;

  return evaluateOperator(condition.op, left, right, evalContext);
}

function resolveOperand(
  operand: RuleOperand,
  context: ExecutionContext,
  data: Record<string, JSONValue>,
): JSONValue | undefined {
  if ('value' in operand) {
    return operand.value;
  }
  if ('path' in operand) {
    const path = operand.path;
    if (path.startsWith('context.')) {
      return getPath(context as unknown as Record<string, JSONValue>, path.slice('context.'.length));
    }
    if (path.startsWith('data.')) {
      return getPath(data, path.slice('data.'.length));
    }
    return getPath(data, path);
  }
  return undefined;
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
  actionHandlers: ActionHandlerRegistry,
  evalContext: EvalContext,
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
    case 'transform': {
      const target = resolveTarget(ctx, action.path);
      if (target) {
        const before = cloneValue(getPath(target.obj, target.path));
        const result = applyTransform(action.transform, before, evalContext);
        setPath(target.obj, target.path, result);
        const after = cloneValue(getPath(target.obj, target.path));
        const targetKind: RuleActionDiff['target'] = action.path.startsWith('context.') ? 'context' : 'data';
        recordActionDiff(ctx.trace, { ruleId: ctx.ruleId, action, target: targetKind, path: target.path, before, after });
        ctx.trace.actionsApplied.push({ ruleId: ctx.ruleId, action });
      }
      break;
    }
    case 'custom': {
      const handler = actionHandlers.get(action.handler);
      if (handler) {
        handler(action, ctx);
        ctx.trace.actionsApplied.push({ ruleId: ctx.ruleId, action });
      } else {
        ctx.trace.errors.push({ ruleId: ctx.ruleId, message: `Unknown custom action handler: ${action.handler}` });
      }
      break;
    }
    default: {
      const actionType = (action as { type?: string }).type ?? 'unknown';
      const customHandler = actionHandlers.get(actionType);
      if (customHandler) {
        customHandler(action, ctx);
        ctx.trace.actionsApplied.push({ ruleId: ctx.ruleId, action });
      } else {
        ctx.trace.errors.push({ ruleId: ctx.ruleId, message: `Unsupported action: ${actionType}` });
      }
    }
  }
}

// =============================================
// Safe Transform Functions
// =============================================

function applyTransform(
  transform: TransformSpec,
  value: JSONValue | undefined,
  evalContext: EvalContext,
): JSONValue {
  switch (transform.type) {
    case 'math':
      return applyMathTransform(transform.expression, value, transform.args);
    case 'string':
      return applyStringTransform(transform.expression, value, transform.args);
    case 'date':
      return applyDateTransform(transform.expression, value, transform.args, evalContext);
    case 'template':
      return applyTemplateTransform(transform.expression, value, transform.args);
    default:
      return value ?? null;
  }
}

function applyMathTransform(
  expression: string,
  value: JSONValue | undefined,
  args?: Record<string, JSONValue>,
): JSONValue {
  const num = typeof value === 'number' ? value : 0;
  const a = typeof args?.a === 'number' ? args.a : 0;
  const b = typeof args?.b === 'number' ? args.b : 0;

  switch (expression) {
    case 'add':
      return num + a;
    case 'subtract':
      return num - a;
    case 'multiply':
      return num * a;
    case 'divide':
      return a !== 0 ? num / a : 0;
    case 'modulo':
      return a !== 0 ? num % a : 0;
    case 'abs':
      return Math.abs(num);
    case 'round':
      return Math.round(num);
    case 'floor':
      return Math.floor(num);
    case 'ceil':
      return Math.ceil(num);
    case 'min':
      return Math.min(num, a);
    case 'max':
      return Math.max(num, a);
    case 'clamp':
      return Math.min(Math.max(num, a), b);
    case 'pow':
      return Math.pow(num, a);
    case 'sqrt':
      return Math.sqrt(num);
    default:
      return num;
  }
}

function applyStringTransform(
  expression: string,
  value: JSONValue | undefined,
  args?: Record<string, JSONValue>,
): JSONValue {
  const str = typeof value === 'string' ? value : String(value ?? '');
  const a = typeof args?.a === 'string' ? args.a : '';
  const start = typeof args?.start === 'number' ? args.start : 0;
  const end = typeof args?.end === 'number' ? args.end : str.length;

  switch (expression) {
    case 'upper':
      return str.toUpperCase();
    case 'lower':
      return str.toLowerCase();
    case 'trim':
      return str.trim();
    case 'trimStart':
      return str.trimStart();
    case 'trimEnd':
      return str.trimEnd();
    case 'concat':
      return str + a;
    case 'prepend':
      return a + str;
    case 'replace':
      const b = typeof args?.b === 'string' ? args.b : '';
      return str.replace(a, b);
    case 'replaceAll':
      const replaceWith = typeof args?.b === 'string' ? args.b : '';
      return str.split(a).join(replaceWith);
    case 'substring':
      return str.substring(start, end);
    case 'slice':
      return str.slice(start, end);
    case 'split':
      return str.split(a);
    case 'join':
      return Array.isArray(value) ? value.join(a) : str;
    case 'padStart':
      const padLen = typeof args?.length === 'number' ? args.length : 0;
      return str.padStart(padLen, a || ' ');
    case 'padEnd':
      const padEndLen = typeof args?.length === 'number' ? args.length : 0;
      return str.padEnd(padEndLen, a || ' ');
    case 'length':
      return str.length;
    default:
      return str;
  }
}

function applyDateTransform(
  expression: string,
  value: JSONValue | undefined,
  args?: Record<string, JSONValue>,
  evalContext?: EvalContext,
): JSONValue {
  const dateMs = coerceDateMs(value, evalContext?.locale);
  if (dateMs === null) return value ?? null;

  const days = typeof args?.days === 'number' ? args.days : 0;
  const months = typeof args?.months === 'number' ? args.months : 0;
  const years = typeof args?.years === 'number' ? args.years : 0;

  switch (expression) {
    case 'addDays':
      return new Date(dateMs + days * 24 * 60 * 60 * 1000).toISOString();
    case 'addMonths': {
      const d = new Date(dateMs);
      d.setMonth(d.getMonth() + months);
      return d.toISOString();
    }
    case 'addYears': {
      const d = new Date(dateMs);
      d.setFullYear(d.getFullYear() + years);
      return d.toISOString();
    }
    case 'startOfDay': {
      const d = new Date(dateMs);
      d.setHours(0, 0, 0, 0);
      return d.toISOString();
    }
    case 'endOfDay': {
      const d = new Date(dateMs);
      d.setHours(23, 59, 59, 999);
      return d.toISOString();
    }
    case 'toISOString':
      return new Date(dateMs).toISOString();
    case 'toDateString':
      return new Date(dateMs).toISOString().split('T')[0] ?? '';
    case 'getYear':
      return new Date(dateMs).getFullYear();
    case 'getMonth':
      return new Date(dateMs).getMonth() + 1;
    case 'getDay':
      return new Date(dateMs).getDate();
    case 'getDayOfWeek':
      return new Date(dateMs).getDay();
    default:
      return new Date(dateMs).toISOString();
  }
}

function applyTemplateTransform(
  expression: string,
  value: JSONValue | undefined,
  args?: Record<string, JSONValue>,
): JSONValue {
  if (typeof expression !== 'string') return value ?? null;

  let result = expression;
  const context = { value, ...(args ?? {}) };

  for (const [key, val] of Object.entries(context)) {
    const placeholder = `{{${key}}}`;
    const replacement = val === null || val === undefined ? '' : String(val);
    result = result.split(placeholder).join(replacement);
  }

  return result;
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
  if (pathCache.size > MAX_PATH_CACHE) {
    pathCache.clear();
  }
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

type DateOperator = 'dateEq' | 'dateBefore' | 'dateAfter' | 'dateBetween' | 'dateOn';

function compareDates(
  op: DateOperator,
  left: JSONValue | undefined,
  right: JSONValue | undefined,
  evalContext: EvalContext,
): boolean {
  const leftMs = coerceDateMs(left, evalContext.locale);
  if (leftMs === null) return false;

  if (op === 'dateBetween') {
    const range = coerceDateRange(right, evalContext.locale);
    if (!range) return false;
    return leftMs >= range.start && leftMs <= range.end;
  }

  if (op === 'dateOn') {
    const rightMs = coerceDateMs(right, evalContext.locale);
    if (rightMs === null) return false;
    const leftDate = new Date(leftMs);
    const rightDate = new Date(rightMs);
    return (
      leftDate.getUTCFullYear() === rightDate.getUTCFullYear() &&
      leftDate.getUTCMonth() === rightDate.getUTCMonth() &&
      leftDate.getUTCDate() === rightDate.getUTCDate()
    );
  }

  const rightMs = coerceDateMs(right, evalContext.locale);
  if (rightMs === null) return false;

  switch (op) {
    case 'dateEq':
      return leftMs === rightMs;
    case 'dateBefore':
      return leftMs < rightMs;
    case 'dateAfter':
      return leftMs > rightMs;
    default:
      return false;
  }
}

function compareDatePlusDays(
  left: JSONValue | undefined,
  right: JSONValue | undefined,
  evalContext: EvalContext,
): boolean {
  const leftMs = coerceDateMs(left, evalContext.locale);
  if (leftMs === null) return false;

  const days = typeof right === 'number' ? right : 0;
  const targetMs = leftMs + days * 24 * 60 * 60 * 1000;
  const now = Date.now();

  return now >= targetMs;
}

function coerceDateRange(
  value: JSONValue | undefined,
  locale?: string,
): { start: number; end: number } | null {
  if (!Array.isArray(value) || value.length < 2) return null;
  const start = coerceDateMs(value[0] as JSONValue, locale);
  const end = coerceDateMs(value[1] as JSONValue, locale);
  if (start === null || end === null) return null;
  return { start, end };
}

function coerceDateMs(value: JSONValue | undefined, locale?: string): number | null {
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

  if (locale) {
    const localeMatch = parseLocaleDate(trimmed, locale);
    if (localeMatch !== null) return localeMatch;
  }

  return null;
}

function parseLocaleDate(dateString: string, locale: string): number | null {
  const usMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(dateString);
  if (usMatch && (locale.startsWith('en-US') || locale === 'en')) {
    const month = Number(usMatch[1]) - 1;
    const day = Number(usMatch[2]);
    const year = Number(usMatch[3]);
    if (month >= 0 && month <= 11 && day >= 1 && day <= 31) {
      return Date.UTC(year, month, day);
    }
  }

  const euMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(dateString);
  if (euMatch && (locale.startsWith('en-GB') || locale.startsWith('de') || locale.startsWith('fr'))) {
    const day = Number(euMatch[1]);
    const month = Number(euMatch[2]) - 1;
    const year = Number(euMatch[3]);
    if (month >= 0 && month <= 11 && day >= 1 && day <= 31) {
      return Date.UTC(year, month, day);
    }
  }

  const dotMatch = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(dateString);
  if (dotMatch) {
    const day = Number(dotMatch[1]);
    const month = Number(dotMatch[2]) - 1;
    const year = Number(dotMatch[3]);
    if (month >= 0 && month <= 11 && day >= 1 && day <= 31) {
      return Date.UTC(year, month, day);
    }
  }

  return null;
}

class RuleActionError extends Error {}

const MAX_PATH_CACHE = 500;
const pathCache = new Map<string, Array<string | number>>();

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
