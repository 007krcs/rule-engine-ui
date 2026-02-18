import type {
  CompareCondition,
  ExecutionContext,
  JSONValue,
  Rule,
  RuleAction,
  RuleCondition,
  RuleOperator,
  RuleScope,
  RuleSet,
} from '@platform/schema';

export type OperandDraft =
  | { kind: 'path'; path: string }
  | { kind: 'value'; valueText: string };

export type ConditionDraft =
  | {
      id: string;
      kind: 'group';
      op: 'all' | 'any';
      children: ConditionDraft[];
    }
  | {
      id: string;
      kind: 'not';
      child: ConditionDraft;
    }
  | {
      id: string;
      kind: 'compare';
      op: RuleOperator;
      left: OperandDraft;
      right?: OperandDraft;
    };

export type ActionType = RuleAction['type'];

export type ActionDraft =
  | {
      id: string;
      type: 'setField' | 'setContext' | 'addItem';
      path: string;
      valueText: string;
    }
  | {
      id: string;
      type: 'removeField';
      path: string;
    }
  | {
      id: string;
      type: 'mapField';
      from: string;
      to: string;
    }
  | {
      id: string;
      type: 'emitEvent';
      event: string;
      payloadText: string;
    }
  | {
      id: string;
      type: 'throwError';
      message: string;
      code: string;
    };

export type ScopeDraft = {
  countriesText: string;
  rolesText: string;
  tenantsText: string;
  orgsText: string;
  programsText: string;
  issuersText: string;
};

export type RuleDraft = {
  id: string;
  ruleId: string;
  description: string;
  priority: number;
  scope: ScopeDraft;
  when: ConditionDraft;
  actions: ActionDraft[];
};

let draftCounter = 0;

function nextDraftId(prefix: string): string {
  draftCounter += 1;
  return `${prefix}-${draftCounter}`;
}

export function createDefaultConditionDraft(): ConditionDraft {
  return {
    id: nextDraftId('condition'),
    kind: 'compare',
    op: 'eq',
    left: { kind: 'path', path: 'data.value' },
    right: { kind: 'value', valueText: '""' },
  };
}

export function createConditionGroupDraft(op: 'all' | 'any' = 'all'): ConditionDraft {
  return {
    id: nextDraftId('condition'),
    kind: 'group',
    op,
    children: [createDefaultConditionDraft()],
  };
}

export function createConditionNotDraft(): ConditionDraft {
  return {
    id: nextDraftId('condition'),
    kind: 'not',
    child: createDefaultConditionDraft(),
  };
}

export function createActionDraft(type: ActionType = 'setField'): ActionDraft {
  const id = nextDraftId('action');
  if (type === 'setField' || type === 'setContext' || type === 'addItem') {
    return {
      id,
      type,
      path: type === 'setContext' ? 'context.locale' : 'data.field',
      valueText: type === 'addItem' ? '{"item":"value"}' : 'true',
    };
  }
  if (type === 'removeField') {
    return { id, type, path: 'data.field' };
  }
  if (type === 'mapField') {
    return { id, type, from: 'data.source', to: 'data.target' };
  }
  if (type === 'emitEvent') {
    return { id, type, event: 'ruleEvent', payloadText: '{"source":"rules-editor"}' };
  }
  return { id, type, message: 'Rule blocked execution', code: '' };
}

function toScopeText(values: string[] | undefined): string {
  return values && values.length > 0 ? values.join(', ') : '';
}

function toScopeArray(text: string): string[] | undefined {
  const values = text
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  return values.length > 0 ? values : undefined;
}

export function scopeFromRule(scope: RuleScope | undefined): ScopeDraft {
  return {
    countriesText: toScopeText(scope?.countries),
    rolesText: toScopeText(scope?.roles),
    tenantsText: toScopeText(scope?.tenants),
    orgsText: toScopeText(scope?.orgs),
    programsText: toScopeText(scope?.programs),
    issuersText: toScopeText(scope?.issuers),
  };
}

export function scopeToRule(scope: ScopeDraft): RuleScope | undefined {
  const next: RuleScope = {
    countries: toScopeArray(scope.countriesText) as RuleScope['countries'],
    roles: toScopeArray(scope.rolesText),
    tenants: toScopeArray(scope.tenantsText),
    orgs: toScopeArray(scope.orgsText),
    programs: toScopeArray(scope.programsText),
    issuers: toScopeArray(scope.issuersText),
  };
  const hasEntries =
    (next.countries?.length ?? 0) > 0 ||
    (next.roles?.length ?? 0) > 0 ||
    (next.tenants?.length ?? 0) > 0 ||
    (next.orgs?.length ?? 0) > 0 ||
    (next.programs?.length ?? 0) > 0 ||
    (next.issuers?.length ?? 0) > 0;
  return hasEntries ? next : undefined;
}

function valueToText(value: JSONValue | undefined): string {
  if (value === undefined) return '';
  return JSON.stringify(value);
}

export function parseValueText(valueText: string): JSONValue {
  const trimmed = valueText.trim();
  if (!trimmed) return '';
  try {
    return JSON.parse(trimmed) as JSONValue;
  } catch {
    if (trimmed === 'true') return true;
    if (trimmed === 'false') return false;
    if (trimmed === 'null') return null;
    const numberValue = Number(trimmed);
    if (!Number.isNaN(numberValue) && Number.isFinite(numberValue)) return numberValue;
    return trimmed;
  }
}

function operandFromRule(operand: CompareCondition['left'] | CompareCondition['right']): OperandDraft {
  if (!operand) return { kind: 'value', valueText: '' };
  if ('path' in operand) return { kind: 'path', path: operand.path };
  return { kind: 'value', valueText: valueToText(operand.value) };
}

function operandToRule(operand: OperandDraft): CompareCondition['left'] {
  if (operand.kind === 'path') {
    return { path: operand.path.trim() || 'data.value' };
  }
  return { value: parseValueText(operand.valueText) };
}

export function conditionFromRule(condition: RuleCondition): ConditionDraft {
  if ('all' in condition) {
    return {
      id: nextDraftId('condition'),
      kind: 'group',
      op: 'all',
      children: condition.all.map(conditionFromRule),
    };
  }
  if ('any' in condition) {
    return {
      id: nextDraftId('condition'),
      kind: 'group',
      op: 'any',
      children: condition.any.map(conditionFromRule),
    };
  }
  if ('not' in condition) {
    return {
      id: nextDraftId('condition'),
      kind: 'not',
      child: conditionFromRule(condition.not),
    };
  }
  return {
    id: nextDraftId('condition'),
    kind: 'compare',
    op: condition.op,
    left: operandFromRule(condition.left),
    right: condition.right ? operandFromRule(condition.right) : undefined,
  };
}

export function conditionToRule(condition: ConditionDraft): RuleCondition {
  if (condition.kind === 'group') {
    const children = condition.children.length > 0 ? condition.children.map(conditionToRule) : [conditionToRule(createDefaultConditionDraft())];
    return condition.op === 'all' ? { all: children } : { any: children };
  }
  if (condition.kind === 'not') {
    return { not: conditionToRule(condition.child) };
  }
  const compare: CompareCondition = {
    op: condition.op,
    left: operandToRule(condition.left),
  };
  if (condition.op !== 'exists') {
    compare.right = operandToRule(condition.right ?? { kind: 'value', valueText: 'null' });
  }
  return compare;
}

export function actionFromRule(action: RuleAction): ActionDraft {
  if (action.type === 'setField' || action.type === 'setContext' || action.type === 'addItem') {
    return {
      id: nextDraftId('action'),
      type: action.type,
      path: action.path,
      valueText: valueToText(action.value),
    };
  }
  if (action.type === 'removeField') {
    return {
      id: nextDraftId('action'),
      type: action.type,
      path: action.path,
    };
  }
  if (action.type === 'mapField') {
    return {
      id: nextDraftId('action'),
      type: action.type,
      from: action.from,
      to: action.to,
    };
  }
  if (action.type === 'emitEvent') {
    return {
      id: nextDraftId('action'),
      type: action.type,
      event: action.event,
      payloadText: valueToText(action.payload),
    };
  }
  return {
    id: nextDraftId('action'),
    type: action.type,
    message: action.message,
    code: action.code ?? '',
  };
}

export function actionToRule(action: ActionDraft): RuleAction {
  if (action.type === 'setField' || action.type === 'setContext' || action.type === 'addItem') {
    return {
      type: action.type,
      path: action.path.trim(),
      value: parseValueText(action.valueText),
    };
  }
  if (action.type === 'removeField') {
    return {
      type: action.type,
      path: action.path.trim(),
    };
  }
  if (action.type === 'mapField') {
    return {
      type: action.type,
      from: action.from.trim(),
      to: action.to.trim(),
    };
  }
  if (action.type === 'emitEvent') {
    return {
      type: action.type,
      event: action.event.trim(),
      payload: parseValueText(action.payloadText),
    };
  }
  if (action.type === 'throwError') {
    return {
      type: action.type,
      message: action.message.trim() || 'Rule action error',
      ...(action.code.trim() ? { code: action.code.trim() } : {}),
    };
  }
  return {
    type: 'emitEvent',
    event: 'ruleEvent',
  };
}

export function ruleToDraft(rule: Rule): RuleDraft {
  return {
    id: nextDraftId('rule'),
    ruleId: rule.ruleId,
    description: rule.description ?? '',
    priority: typeof rule.priority === 'number' ? rule.priority : 100,
    scope: scopeFromRule(rule.scope),
    when: conditionFromRule(rule.when),
    actions: (rule.actions ?? []).map(actionFromRule),
  };
}

export function draftToRule(rule: RuleDraft): Rule {
  const actions = rule.actions.map(actionToRule);
  return {
    ruleId: rule.ruleId.trim() || `RULE_${rule.id}`,
    ...(rule.description.trim() ? { description: rule.description.trim() } : {}),
    priority: Number.isFinite(rule.priority) ? rule.priority : 100,
    when: conditionToRule(rule.when),
    ...(actions.length > 0 ? { actions } : {}),
    ...(scopeToRule(rule.scope) ? { scope: scopeToRule(rule.scope) } : {}),
  };
}

export function rulesToDrafts(ruleSet: RuleSet): RuleDraft[] {
  return (ruleSet.rules ?? []).map(ruleToDraft);
}

export function draftsToRuleSet(version: string, drafts: RuleDraft[]): RuleSet {
  return {
    version: version || '1.0.0',
    rules: drafts.map(draftToRule),
  };
}

export function createDefaultRuleDraft(): RuleDraft {
  const id = nextDraftId('rule');
  return {
    id,
    ruleId: `RULE_${id.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}`,
    description: '',
    priority: 100,
    scope: scopeFromRule(undefined),
    when: createConditionGroupDraft('all'),
    actions: [createActionDraft('setField')],
  };
}

export function cloneRuleDraft(rule: RuleDraft): RuleDraft {
  const cloned = JSON.parse(JSON.stringify(rule)) as RuleDraft;
  cloned.id = nextDraftId('rule');
  cloned.ruleId = `${rule.ruleId}_COPY`;
  cloned.when = rehydrateConditionIds(cloned.when);
  cloned.actions = cloned.actions.map((action) => ({ ...action, id: nextDraftId('action') }));
  return cloned;
}

function rehydrateConditionIds(condition: ConditionDraft): ConditionDraft {
  if (condition.kind === 'group') {
    return {
      ...condition,
      id: nextDraftId('condition'),
      children: condition.children.map(rehydrateConditionIds),
    };
  }
  if (condition.kind === 'not') {
    return {
      ...condition,
      id: nextDraftId('condition'),
      child: rehydrateConditionIds(condition.child),
    };
  }
  return {
    ...condition,
    id: nextDraftId('condition'),
  };
}

export const DEFAULT_SIMULATION_CONTEXT: ExecutionContext = {
  tenantId: 'tenant-1',
  userId: 'analyst-1',
  role: 'author',
  roles: ['author'],
  country: 'US',
  locale: 'en-US',
  timezone: 'America/New_York',
  device: 'desktop',
  permissions: ['read'],
  featureFlags: { demo: true },
};

export const DEFAULT_SIMULATION_DATA: Record<string, JSONValue> = {
  acceptedTerms: true,
  formValid: true,
  readyToSubmit: true,
  orderTotal: 1200,
  loanAmount: 250000,
  riskLevel: 'Medium',
};
