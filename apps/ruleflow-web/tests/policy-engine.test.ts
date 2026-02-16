import { describe, expect, it } from 'vitest';
import type { Session } from '../src/lib/auth';
import { evaluatePolicies, requireRole } from '../src/server/policy-engine';

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

describe('policy engine', () => {
  it('blocks EU interestRate mutations', async () => {
    const errors = await evaluatePolicies({
      stage: 'save',
      session: authorSession,
      nextBundle: {
        uiSchema: { version: '1.0.0', pageId: 'page', layout: { id: 'root', type: 'stack', children: [] }, components: [] },
        flowSchema: { version: '1.0.0', initialState: 'start', states: { start: { uiPageId: 'page', on: {} } } },
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
        apiMappingsById: {},
      },
    });

    expect(errors.some((error) => error.code === 'eu_interest_rate_guard')).toBe(true);
  });

  it('requires publisher role for promote stage', async () => {
    const errors = await evaluatePolicies({
      stage: 'promote',
      session: authorSession,
    });
    expect(errors.some((error) => error.code === 'role_required')).toBe(true);
  });

  it('passes promote checks for publisher session', async () => {
    const errors = await evaluatePolicies({
      stage: 'promote',
      session: publisherSession,
    });
    expect(errors).toEqual([]);
  });

  it('returns explicit RBAC policy error when role is missing', () => {
    const errors = requireRole({ session: authorSession }, 'Approver', 'approve');
    expect(errors).toHaveLength(1);
    expect(errors[0]?.code).toBe('role_required');
    expect(errors[0]?.policyKey).toBe('rbac.approver_required');
  });
});
