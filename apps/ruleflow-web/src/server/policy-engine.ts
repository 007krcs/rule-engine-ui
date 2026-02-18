import type { RuleSet } from '@platform/schema';
import { hasRole, type Role, type Session } from '@/lib/auth';
import { clearOpaDecisionCacheForTests, evaluateOpaPolicy, OpaClientError } from '@/server/policy/opa-client';
import type { PolicyCheckStage, PolicyError, PolicyEvaluationInput } from '@/server/policy/types';

export type { PolicyCheckStage, PolicyError, PolicyEvaluationInput } from '@/server/policy/types';

export interface PolicyDefinition {
  key: string;
  description: string;
  stages: readonly PolicyCheckStage[];
  evaluate(input: PolicyEvaluationInput): PolicyError[] | Promise<PolicyError[]>;
}

const EU_COUNTRIES = new Set([
  'AT',
  'BE',
  'BG',
  'HR',
  'CY',
  'CZ',
  'DK',
  'EE',
  'FI',
  'FR',
  'DE',
  'GR',
  'HU',
  'IE',
  'IT',
  'LV',
  'LT',
  'LU',
  'MT',
  'NL',
  'PL',
  'PT',
  'RO',
  'SK',
  'SI',
  'ES',
  'SE',
]);

export class PolicyEngine {
  private readonly builtIns: PolicyDefinition[];
  private readonly plugins = new Map<string, PolicyDefinition>();

  constructor(builtIns: PolicyDefinition[]) {
    this.builtIns = [...builtIns];
  }

  register(policy: PolicyDefinition): void {
    this.plugins.set(policy.key, policy);
  }

  unregister(policyKey: string): void {
    this.plugins.delete(policyKey);
  }

  clearPlugins(): void {
    this.plugins.clear();
  }

  listPolicies(): PolicyDefinition[] {
    return [...this.builtIns, ...this.plugins.values()];
  }

  async evaluate(input: PolicyEvaluationInput): Promise<PolicyError[]> {
    const errors: PolicyError[] = [];
    for (const policy of this.listPolicies()) {
      if (!policy.stages.includes(input.stage)) {
        continue;
      }
      errors.push(...(await policy.evaluate(input)));
    }
    return errors;
  }
}

const builtinPolicies: PolicyDefinition[] = [
  {
    key: 'policy.publisher_required_for_activation',
    description: 'Only Publisher role can promote/rollback active configs.',
    stages: ['promote'],
    evaluate(input) {
      return requireRole(input, 'Publisher', 'promote');
    },
  },
  {
    key: 'policy.eu_interest_rate_guard',
    description: 'EU-scoped rules cannot mutate interestRate.',
    stages: ['save', 'submit-for-review', 'approve', 'promote'],
    evaluate(input) {
      const bundle = input.nextBundle ?? input.currentBundle;
      const rules = bundle?.rules;
      if (!rules) return [];

      const violation = detectEuInterestRateMutation(rules);
      if (!violation) return [];
      return [
        {
          policyKey: 'policy.eu_interest_rate_guard',
          code: 'eu_interest_rate_guard',
          stage: input.stage,
          message: 'EU-scoped rules cannot mutate interestRate',
          hint: `Remove action "${violation}" or limit scope outside EU`,
        },
      ];
    },
  },
];

const policyEngine = new PolicyEngine(builtinPolicies);

export async function evaluatePolicies(input: PolicyEvaluationInput): Promise<PolicyError[]> {
  const errors = await policyEngine.evaluate(input);
  errors.push(...(await evaluateExternalPolicies(input)));
  return errors;
}

export function registerPolicy(policy: PolicyDefinition): void {
  policyEngine.register(policy);
}

export function unregisterPolicy(policyKey: string): void {
  policyEngine.unregister(policyKey);
}

export function clearRegisteredPoliciesForTests(): void {
  policyEngine.clearPlugins();
  clearOpaDecisionCacheForTests();
}

export function listPolicies(): PolicyDefinition[] {
  return policyEngine.listPolicies();
}

export function requireRole(
  input: { session: Session } | { roles: readonly Role[] },
  role: Role,
  stage: PolicyCheckStage,
): PolicyError[] {
  const allowed = 'session' in input ? hasRole(input.session, role) : input.roles.includes(role);
  if (allowed) return [];
  return [
    {
      policyKey: `rbac.${role.toLowerCase()}_required`,
      code: 'role_required',
      stage,
      message: `${role} role is required`,
      hint: `Ask a tenant admin to grant the ${role} role`,
    },
  ];
}

function detectEuInterestRateMutation(ruleSet: RuleSet): string | null {
  for (const rule of ruleSet.rules) {
    const countries = rule.scope?.countries ?? [];
    const affectsEu = countries.some((country) => EU_COUNTRIES.has(String(country).toUpperCase()));
    if (!affectsEu) continue;
    for (const action of rule.actions ?? []) {
      if (action.type === 'setField' && action.path === 'data.interestRate') {
        return `setField:${action.path}`;
      }
    }
  }
  return null;
}

async function evaluateExternalPolicies(input: PolicyEvaluationInput): Promise<PolicyError[]> {
  try {
    const decision = await evaluateOpaPolicy(input);
    if (!decision || decision.allow) {
      return [];
    }

    const primaryMessage = decision.messages[0] ?? 'External OPA policy denied this operation.';
    const rest = decision.messages.slice(1);

    return [
      {
        policyKey: 'policy.external.opa',
        code: 'opa_denied',
        stage: input.stage,
        message: primaryMessage,
        hint:
          rest.length > 0
            ? rest.join(' | ')
            : 'Ask your policy administrator to update the OPA rule set for this stage.',
      },
    ];
  } catch (error) {
    if (error instanceof OpaClientError) {
      return [
        {
          policyKey: 'policy.external.opa',
          code: error.code,
          stage: input.stage,
          message: error.message,
          hint: 'Check OPA_URL, OPA_PACKAGE, OPA_TIMEOUT_MS, and OPA service health.',
        },
      ];
    }

    return [
      {
        policyKey: 'policy.external.opa',
        code: 'opa_error',
        stage: input.stage,
        message: `OPA policy evaluation failed: ${error instanceof Error ? error.message : String(error)}`,
        hint: 'Check external policy service connectivity and response payload.',
      },
    ];
  }
}
