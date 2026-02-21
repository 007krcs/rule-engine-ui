import { eventBus } from '@platform/runtime';
import {
  bollingerBands,
  ema,
  macd,
  rsi,
  sma,
  type BollingerPoint,
  type MacdPoint,
} from './FinancialIndicators';

export type IndicatorType = 'SMA' | 'EMA' | 'RSI' | 'MACD' | 'BOLLINGER';

export type IndicatorConfig = {
  type: IndicatorType;
  period?: number;
  fastPeriod?: number;
  slowPeriod?: number;
  signalPeriod?: number;
  stdDev?: number;
};

export type ChartHooks = {
  onBrush?: (range: { start: number; end: number }) => void;
  onDrillDown?: (payload: { index: number; value: number }) => void;
  onLegendToggle?: (payload: { seriesName: string; visible: boolean }) => void;
  onCrosshairMove?: (payload: { index: number; value: number }) => void;
};

export type ChartRendererInput = {
  chartId: string;
  series: number[];
  indicators?: IndicatorConfig[];
  hooks?: ChartHooks;
};

export type ChartRendererOutput = {
  baseSeries: number[];
  overlays: Array<{ id: string; values: Array<number | null> }>;
  panels: Array<{ id: string; values: Array<number | MacdPoint | BollingerPoint | null> }>;
  emitBrush: (start: number, end: number) => void;
  emitDrillDown: (index: number) => void;
  emitLegendToggle: (seriesName: string, visible: boolean) => void;
  emitCrosshairMove: (index: number) => void;
};

export function createChartRenderer(input: ChartRendererInput): ChartRendererOutput {
  const overlays: ChartRendererOutput['overlays'] = [];
  const panels: ChartRendererOutput['panels'] = [];

  for (const indicator of input.indicators ?? []) {
    if (indicator.type === 'SMA') {
      overlays.push({
        id: `SMA(${indicator.period ?? 20})`,
        values: sma(input.series, indicator.period ?? 20),
      });
    } else if (indicator.type === 'EMA') {
      overlays.push({
        id: `EMA(${indicator.period ?? 20})`,
        values: ema(input.series, indicator.period ?? 20),
      });
    } else if (indicator.type === 'BOLLINGER') {
      const bands = bollingerBands(input.series, indicator.period ?? 20, indicator.stdDev ?? 2);
      overlays.push({
        id: `BOLLINGER.middle`,
        values: bands.map((point) => point?.middle ?? null),
      });
      overlays.push({
        id: `BOLLINGER.upper`,
        values: bands.map((point) => point?.upper ?? null),
      });
      overlays.push({
        id: `BOLLINGER.lower`,
        values: bands.map((point) => point?.lower ?? null),
      });
    } else if (indicator.type === 'RSI') {
      panels.push({
        id: `RSI(${indicator.period ?? 14})`,
        values: rsi(input.series, indicator.period ?? 14),
      });
    } else if (indicator.type === 'MACD') {
      panels.push({
        id: `MACD`,
        values: macd(
          input.series,
          indicator.fastPeriod ?? 12,
          indicator.slowPeriod ?? 26,
          indicator.signalPeriod ?? 9,
        ),
      });
    }
  }

  return {
    baseSeries: input.series,
    overlays,
    panels,
    emitBrush: (start, end) => {
      const payload = { chartId: input.chartId, start, end };
      eventBus.publish('onBrush', payload);
      input.hooks?.onBrush?.({ start, end });
    },
    emitDrillDown: (index) => {
      const value = input.series[index] ?? 0;
      const payload = { chartId: input.chartId, index, value };
      eventBus.publish('onDrillDown', payload);
      input.hooks?.onDrillDown?.({ index, value });
    },
    emitLegendToggle: (seriesName, visible) => {
      const payload = { chartId: input.chartId, seriesName, visible };
      eventBus.publish('onLegendToggle', payload);
      input.hooks?.onLegendToggle?.({ seriesName, visible });
    },
    emitCrosshairMove: (index) => {
      const value = input.series[index] ?? 0;
      const payload = { chartId: input.chartId, index, value };
      eventBus.publish('onCrosshairMove', payload);
      input.hooks?.onCrosshairMove?.({ index, value });
    },
  };
}
