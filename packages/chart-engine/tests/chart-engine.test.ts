import { describe, expect, it, vi } from 'vitest';
import { eventBus } from '@platform/runtime';
import { createChartRenderer } from '../src/ChartRenderer';
import { bollingerBands, ema, macd, rsi, sma } from '../src/FinancialIndicators';

describe('chart-engine indicators', () => {
  const values = [10, 11, 12, 11, 10, 13, 15, 14, 16, 18, 17, 19, 20];

  it('computes SMA/EMA/RSI', () => {
    const sma5 = sma(values, 5);
    const ema5 = ema(values, 5);
    const rsi5 = rsi(values, 5);
    expect(sma5.length).toBe(values.length);
    expect(ema5.length).toBe(values.length);
    expect(rsi5.length).toBe(values.length);
    expect(sma5[4]).not.toBeNull();
    expect(ema5[4]).not.toBeNull();
    expect(rsi5[5]).not.toBeNull();
  });

  it('computes MACD and Bollinger Bands', () => {
    const macdResult = macd(values);
    const bands = bollingerBands(values, 5, 2);
    expect(macdResult.length).toBe(values.length);
    expect(bands.length).toBe(values.length);
    const firstBand = bands.find((entry) => entry !== null);
    expect(firstBand?.upper).toBeGreaterThan(firstBand?.middle ?? 0);
    expect(firstBand?.lower).toBeLessThan(firstBand?.middle ?? 0);
  });
});

describe('chart-engine events', () => {
  it('emits hooks and EventBus events for interaction hooks', () => {
    const onBrush = vi.fn();
    const onDrillDown = vi.fn();
    const onLegendToggle = vi.fn();
    const onCrosshairMove = vi.fn();
    const brushListener = vi.fn();
    const drillListener = vi.fn();
    const legendListener = vi.fn();
    const crosshairListener = vi.fn();
    eventBus.subscribe('onBrush', brushListener);
    eventBus.subscribe('onDrillDown', drillListener);
    eventBus.subscribe('onLegendToggle', legendListener);
    eventBus.subscribe('onCrosshairMove', crosshairListener);

    const renderer = createChartRenderer({
      chartId: 'revenue',
      series: [2, 7, 4, 9],
      hooks: { onBrush, onDrillDown, onLegendToggle, onCrosshairMove },
    });

    renderer.emitBrush(1, 3);
    renderer.emitDrillDown(2);
    renderer.emitLegendToggle('Revenue', false);
    renderer.emitCrosshairMove(1);

    expect(onBrush).toHaveBeenCalledWith({ start: 1, end: 3 });
    expect(onDrillDown).toHaveBeenCalledWith({ index: 2, value: 4 });
    expect(onLegendToggle).toHaveBeenCalledWith({ seriesName: 'Revenue', visible: false });
    expect(onCrosshairMove).toHaveBeenCalledWith({ index: 1, value: 7 });

    expect(brushListener).toHaveBeenCalled();
    expect(drillListener).toHaveBeenCalled();
    expect(legendListener).toHaveBeenCalled();
    expect(crosshairListener).toHaveBeenCalled();
  });
});
