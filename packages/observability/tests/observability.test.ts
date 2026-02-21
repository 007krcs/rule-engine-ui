import { describe, expect, it, vi } from 'vitest';
import type { RulesTrace, RuntimeTrace } from '../src/index';
import {
  createExternalCallSpan,
  formatRulesTrace,
  formatRuntimeTrace,
  logRulesTrace,
  logRuntimeTrace,
  registerBusinessMetricHook,
  registerOpenTelemetryExporter,
  setLogLevelResolver,
  shouldLog,
} from '../src/index';

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

  it('emits business metrics and otel spans/hooks', () => {
    const exporter = {
      exportSpans: vi.fn(),
      exportMetrics: vi.fn(),
    };
    const hook = vi.fn();
    const disposeExporter = registerOpenTelemetryExporter(exporter);
    const disposeHook = registerBusinessMetricHook(hook);

    const trace: RulesTrace = {
      startedAt: '2026-02-08T00:00:00Z',
      durationMs: 12,
      rulesConsidered: ['a'],
      rulesMatched: ['a'],
      conditionResults: { a: true },
      actionsApplied: [],
      events: [],
      errors: [],
    };
    logRulesTrace(trace, vi.fn());
    expect(exporter.exportSpans).toHaveBeenCalled();
    expect(exporter.exportMetrics).toHaveBeenCalled();
    expect(hook).toHaveBeenCalled();
    disposeExporter();
    disposeHook();
  });

  it('supports dynamic log level resolver', () => {
    setLogLevelResolver(() => 'warn');
    expect(shouldLog('info', { module: 'rules-engine' })).toBe(false);
    expect(shouldLog('error', { module: 'rules-engine' })).toBe(true);
    setLogLevelResolver(() => 'info');
  });

  it('creates external call spans', () => {
    const span = createExternalCallSpan({
      name: 'postgres.query',
      module: 'persistence-dal',
      startedAtMs: 1000,
      endedAtMs: 1200,
      tenantId: 'tenant-1',
    });
    expect(span.name).toBe('postgres.query');
    expect(span.status?.code).toBe('OK');
  });
});
