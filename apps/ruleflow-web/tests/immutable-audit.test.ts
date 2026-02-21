import { describe, expect, it } from 'vitest';
import {
  appendImmutableAuditEvent,
  listImmutableAuditEvents,
  resetImmutableAuditForTests,
  verifyImmutableAuditChain,
} from '../src/server/immutable-audit';

describe('immutable audit log', () => {
  it('appends hash-chained immutable events', async () => {
    await resetImmutableAuditForTests();
    await appendImmutableAuditEvent({
      tenantId: 'tenant-1',
      actor: 'u-1',
      category: 'api',
      action: 'call',
      target: 'endpoint-a',
    });
    await appendImmutableAuditEvent({
      tenantId: 'tenant-1',
      actor: 'u-1',
      category: 'rules',
      action: 'evaluate',
      target: 'rule-a',
    });
    const events = await listImmutableAuditEvents(20);
    expect(events.length).toBeGreaterThanOrEqual(2);
    expect(verifyImmutableAuditChain(events)).toBe(true);
  });
});
