import type { RuleSet } from '@platform/schema';
import { hasRole, type Role, type Session } from '@/lib/auth';
import type { ConfigBundle } from '@/lib/demo/types';

export type PolicyCheckStage = 'save' | 'submit-for-review' | 'approve' | 'promote';

export type PolicyError = {
  policyKey: string;
  code: string;
  message: string;
  stage: PolicyCheckStage;
  hint: string;
};

export interface PolicyEvaluationInput {
  stage: PolicyCheckStage;
  session: Session;
  currentBundle?: ConfigBundle;
  nextBundle?: ConfigBundle;
}

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
  return await policyEngine.evaluate(input);
}

export function registerPolicy(policy: PolicyDefinition): void {
  policyEngine.register(policy);
}

export function unregisterPolicy(policyKey: string): void {
  policyEngine.unregister(policyKey);
}

export function clearRegisteredPoliciesForTests(): void {
  policyEngine.clearPlugins();
}

export function listPolicies(): PolicyDefinition[] {
  return policyEngine.listPolicies();
}

export function requireRole(
  input: { session: Session },
  role: Role,
  stage: PolicyCheckStage,
): PolicyError[] {
  if (hasRole(input.session, role)) return [];
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
