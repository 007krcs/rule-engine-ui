import { describe, expect, it } from 'vitest';
import { buildContributionResult } from '../src/ContributionEngine';
import { ModelRegistry } from '../src/ModelRegistry';
import { PredictionTrace } from '../src/PredictionTrace';

describe('ml-dashboard', () => {
  it('builds local/global contribution views and sorts by absolute value', () => {
    const registry = new ModelRegistry();
    registry.register({
      id: 'credit-risk-v1',
      name: 'Credit Risk',
      version: '1.0.0',
      owner: 'risk-team',
    });

    const trace = new PredictionTrace();
    trace.add({
      predictionId: 'p1',
      modelId: 'credit-risk-v1',
      timestamp: '2026-02-21T12:00:00Z',
      predicted: 0.84,
      protectedGroup: 'A',
      features: { income: 50000, debtRatio: 0.45 },
      contributions: { income: -0.12, debtRatio: 0.31, priorDefault: 0.21 },
    });
    trace.add({
      predictionId: 'p2',
      modelId: 'credit-risk-v1',
      timestamp: '2026-02-21T12:01:00Z',
      predicted: 0.41,
      protectedGroup: 'B',
      features: { income: 78000, debtRatio: 0.21 },
      contributions: { income: -0.09, debtRatio: 0.12, priorDefault: 0.08 },
    });

    const model = registry.get('credit-risk-v1');
    const local = buildContributionResult(model, trace.list('credit-risk-v1'), {
      mode: 'local',
      predictionId: 'p1',
      sortByAbsolute: true,
    });
    const global = buildContributionResult(model, trace.list('credit-risk-v1'), {
      mode: 'global',
      sortByAbsolute: true,
    });

    expect(local.model?.name).toBe('Credit Risk');
    expect(local.contributions[0]?.feature).toBe('debtRatio');
    expect(local.waterfall.length).toBe(3);
    expect(local.chart.baseSeries.length).toBe(3);

    expect(global.contributions.length).toBe(3);
    expect(global.chart.baseSeries.length).toBe(3);
  });

  it('computes bias metrics by group', () => {
    const trace = new PredictionTrace();
    trace.add({
      predictionId: 'p1',
      modelId: 'm1',
      timestamp: '2026-02-21T12:00:00Z',
      predicted: 0.9,
      protectedGroup: 'A',
      features: {},
      contributions: {},
    });
    trace.add({
      predictionId: 'p2',
      modelId: 'm1',
      timestamp: '2026-02-21T12:00:00Z',
      predicted: 0.2,
      protectedGroup: 'B',
      features: {},
      contributions: {},
    });

    const metrics = trace.biasMetrics('m1');
    expect(metrics.groupPositiveRate.A).toBe(1);
    expect(metrics.groupPositiveRate.B).toBe(0);
    expect(metrics.demographicParityGap).toBe(1);
  });
});
