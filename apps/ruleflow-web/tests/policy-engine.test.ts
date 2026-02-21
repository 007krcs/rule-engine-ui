import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session } from '../src/lib/auth';
import { clearRegisteredPoliciesForTests, evaluatePolicies, requireRole } from '../src/server/policy-engine';
import type { PolicyEvaluationInput } from '../src/server/policy-engine';

const authorSession: Session = {
  user: { id: 'u-1', name: 'Author', email: 'author@example.com' },
  tenantId: 'tenant-1',
  roles: ['Author'],
};

const publisherSession: Session = {
  user: { id: 'u-2', name: 'Publisher', email: 'publisher@example.com' },
  tenantId: 'tenant-1',
  roles: ['Author', 'Publisher'],
};

function policyInput(input: Partial<PolicyEvaluationInput> = {}): PolicyEvaluationInput {
  return {
    stage: 'save',
    tenantId: 'tenant-1',
    userId: 'u-1',
    roles: ['Author'],
    ...input,
  };
}

function minimalBundle() {
  return {
    uiSchema: { version: '1.0.0', pageId: 'page', layout: { id: 'root', type: 'stack', children: [] }, components: [] },
    flowSchema: { version: '1.0.0', initialState: 'start', states: { start: { uiPageId: 'page', on: {} } } },
    rules: { version: '1.0.0', rules: [] },
    apiMappingsById: {},
  };
}

describe('policy engine', () => {
  beforeEach(() => {
    delete process.env.OPA_URL;
    delete process.env.OPA_PACKAGE;
    delete process.env.OPA_TIMEOUT_MS;
    delete process.env.RULEFLOW_OPA_MODE;
    vi.unstubAllGlobals();
    clearRegisteredPoliciesForTests();
  });

  afterEach(() => {
    delete process.env.OPA_URL;
    delete process.env.OPA_PACKAGE;
    delete process.env.OPA_TIMEOUT_MS;
    delete process.env.RULEFLOW_OPA_MODE;
    vi.unstubAllGlobals();
    clearRegisteredPoliciesForTests();
  });

  it('blocks EU interestRate mutations', async () => {
    const errors = await evaluatePolicies(
      policyInput({
        stage: 'save',
        nextBundle: {
          ...minimalBundle(),
          rules: {
            version: '1.0.0',
            rules: [
              {
                ruleId: 'EU_RULE',
                priority: 1,
                scope: { countries: ['DE'] },
                when: { op: 'eq', left: { value: true }, right: { value: true } },
                actions: [{ type: 'setField', path: 'data.interestRate', value: 7 }],
              },
            ],
          },
        },
      }),
    );

    expect(errors.some((error) => error.code === 'eu_interest_rate_guard')).toBe(true);
  });

  it('requires publisher role for promote stage', async () => {
    const errors = await evaluatePolicies(
      policyInput({
        stage: 'promote',
        roles: ['Author'],
      }),
    );
    expect(errors.some((error) => error.code === 'role_required')).toBe(true);
  });

  it('passes promote checks for publisher role', async () => {
    const errors = await evaluatePolicies(
      policyInput({
        stage: 'promote',
        roles: publisherSession.roles,
        userId: publisherSession.user.id,
      }),
    );
    expect(errors).toEqual([]);
  });

  it('merges OPA deny decisions when configured', async () => {
    process.env.OPA_URL = 'http://opa.local';
    process.env.OPA_PACKAGE = 'ruleflow/allow';
    process.env.RULEFLOW_OPA_MODE = 'enforce';
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        return new Response(
          JSON.stringify({
            result: {
              allow: false,
              reasons: ['Denied by external policy'],
            },
          }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' },
          },
        );
      }),
    );

    const errors = await evaluatePolicies(
      policyInput({
        stage: 'save',
        nextBundle: minimalBundle(),
      }),
    );

    expect(errors.some((error) => error.code === 'opa_denied')).toBe(true);
    expect(errors.some((error) => error.policyKey === 'policy.external.opa')).toBe(true);
  });

  it('returns OPA connectivity errors when backend is unreachable', async () => {
    process.env.OPA_URL = 'http://opa.local';
    process.env.RULEFLOW_OPA_MODE = 'enforce';
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('connect ECONNREFUSED');
      }),
    );

    const errors = await evaluatePolicies(
      policyInput({
        stage: 'save',
        nextBundle: minimalBundle(),
      }),
    );

    expect(errors.some((error) => error.code === 'opa_unreachable')).toBe(true);
  });

  it('runs OPA in shadow mode by default and does not block', async () => {
    process.env.OPA_URL = 'http://opa.local';
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ result: { allow: false, reason: 'shadow deny' } }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    );
    const errors = await evaluatePolicies(
      policyInput({
        stage: 'save',
        nextBundle: minimalBundle(),
      }),
    );
    expect(errors).toEqual([]);
  });

  it('returns explicit RBAC policy error when role is missing', () => {
    const errors = requireRole({ session: authorSession }, 'Approver', 'approve');
    expect(errors).toHaveLength(1);
    expect(errors[0]?.code).toBe('role_required');
    expect(errors[0]?.policyKey).toBe('rbac.approver_required');
  });
});
