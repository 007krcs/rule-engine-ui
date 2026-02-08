import { describe, expect, it, vi } from 'vitest';
import type { RulesTrace, RuntimeTrace } from '../src/index';
import { formatRulesTrace, formatRuntimeTrace, logRulesTrace, logRuntimeTrace } from '../src/index';

describe('observability', () => {
  it('formats and logs rules traces', () => {
    const trace: RulesTrace = {
      startedAt: '2026-02-08T00:00:00Z',
      durationMs: 12,
      rulesConsidered: ['a', 'b'],
      rulesMatched: ['a'],
      conditionResults: { a: true },
      actionsApplied: [],
      events: [],
      errors: [],
    };
    const logger = vi.fn();
    expect(formatRulesTrace(trace)).toContain('1/2');
    logRulesTrace(trace, logger);
    expect(logger).toHaveBeenCalled();
  });

  it('formats runtime traces', () => {
    const trace: RuntimeTrace = {
      startedAt: '2026-02-08T00:00:00Z',
      durationMs: 33,
      flow: {
        startedAt: '2026-02-08T00:00:00Z',
        durationMs: 1,
        event: 'next',
        fromStateId: 'start',
        toStateId: 'review',
        uiPageId: 'page',
        reason: 'ok',
        actionsToRun: [],
      },
    };
    const logger = vi.fn();
    expect(formatRuntimeTrace(trace)).toContain('RuntimeTrace');
    logRuntimeTrace(trace, logger);
    expect(logger).toHaveBeenCalled();
  });
});
