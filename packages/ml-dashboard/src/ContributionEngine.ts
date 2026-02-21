import { createChartRenderer } from '@platform/chart-engine';
import type { ModelMetadata } from './ModelRegistry';
import type { ExplanationMode, PredictionRecord } from './PredictionTrace';

export interface ContributionEntry {
  feature: string;
  contribution: number;
}

export interface WaterfallPoint {
  feature: string;
  contribution: number;
  cumulative: number;
}

export interface ContributionOptions {
  mode: ExplanationMode;
  sortByAbsolute?: boolean;
  predictionId?: string;
}

export interface ContributionResult {
  model?: ModelMetadata;
  mode: ExplanationMode;
  contributions: ContributionEntry[];
  waterfall: WaterfallPoint[];
  chart: ReturnType<typeof createChartRenderer>;
}

export function buildContributionResult(
  model: ModelMetadata | undefined,
  traces: PredictionRecord[],
  options: ContributionOptions,
): ContributionResult {
  const baseContributions =
    options.mode === 'global'
      ? aggregateGlobalContributions(traces)
      : pickLocalContributions(traces, options.predictionId);

  const contributions = options.sortByAbsolute
    ? [...baseContributions].sort((left, right) => Math.abs(right.contribution) - Math.abs(left.contribution))
    : baseContributions;

  const waterfall = toWaterfall(contributions);
  const chart = createChartRenderer({
    chartId: `${model?.id ?? 'model'}:contribution:${options.mode}`,
    series: waterfall.map((point) => point.contribution),
  });

  return {
    model,
    mode: options.mode,
    contributions,
    waterfall,
    chart,
  };
}

function pickLocalContributions(traces: PredictionRecord[], predictionId?: string): ContributionEntry[] {
  const selected =
    (predictionId ? traces.find((trace) => trace.predictionId === predictionId) : traces[0]) ?? null;
  if (!selected) return [];
  return Object.entries(selected.contributions).map(([feature, contribution]) => ({
    feature,
    contribution,
  }));
}

function aggregateGlobalContributions(traces: PredictionRecord[]): ContributionEntry[] {
  const sums = new Map<string, { sum: number; count: number }>();
  for (const trace of traces) {
    for (const [feature, contribution] of Object.entries(trace.contributions)) {
      const current = sums.get(feature) ?? { sum: 0, count: 0 };
      current.sum += contribution;
      current.count += 1;
      sums.set(feature, current);
    }
  }
  return Array.from(sums.entries()).map(([feature, totals]) => ({
    feature,
    contribution: totals.count === 0 ? 0 : totals.sum / totals.count,
  }));
}

function toWaterfall(entries: ContributionEntry[]): WaterfallPoint[] {
  let cumulative = 0;
  return entries.map((entry) => {
    cumulative += entry.contribution;
    return {
      feature: entry.feature,
      contribution: entry.contribution,
      cumulative,
    };
  });
}
