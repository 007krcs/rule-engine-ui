export type Candle = {
  close: number;
  high?: number;
  low?: number;
};

export type MacdPoint = {
  macd: number;
  signal: number;
  histogram: number;
};

export type BollingerPoint = {
  middle: number;
  upper: number;
  lower: number;
};

export function sma(values: number[], period: number): Array<number | null> {
  const p = normalizePeriod(period);
  const out: Array<number | null> = [];
  let rolling = 0;
  for (let i = 0; i < values.length; i += 1) {
    const current = values[i];
    rolling += current ?? 0;
    if (i >= p) {
      const exit = values[i - p];
      rolling -= exit ?? 0;
    }
    if (i < p - 1) {
      out.push(null);
    } else {
      out.push(rolling / p);
    }
  }
  return out;
}

export function ema(values: number[], period: number): Array<number | null> {
  const p = normalizePeriod(period);
  const k = 2 / (p + 1);
  const out: Array<number | null> = [];
  let prev: number | null = null;
  for (let i = 0; i < values.length; i += 1) {
    const value = values[i] ?? 0;
    if (prev === null) {
      prev = value;
      out.push(null);
      continue;
    }
    prev = value * k + prev * (1 - k);
    out.push(i < p - 1 ? null : prev);
  }
  return out;
}

export function rsi(values: number[], period: number): Array<number | null> {
  const p = normalizePeriod(period);
  const out: Array<number | null> = new Array(values.length).fill(null);
  if (values.length < p + 1) return out;

  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= p; i += 1) {
    const current = values[i] ?? 0;
    const previous = values[i - 1] ?? 0;
    const delta = current - previous;
    if (delta >= 0) gain += delta;
    else loss -= delta;
  }

  let avgGain = gain / p;
  let avgLoss = loss / p;
  out[p] = toRsi(avgGain, avgLoss);

  for (let i = p + 1; i < values.length; i += 1) {
    const current = values[i] ?? 0;
    const previous = values[i - 1] ?? 0;
    const delta = current - previous;
    const nextGain = delta > 0 ? delta : 0;
    const nextLoss = delta < 0 ? -delta : 0;
    avgGain = (avgGain * (p - 1) + nextGain) / p;
    avgLoss = (avgLoss * (p - 1) + nextLoss) / p;
    out[i] = toRsi(avgGain, avgLoss);
  }

  return out;
}

export function macd(
  values: number[],
  fastPeriod = 12,
  slowPeriod = 26,
  signalPeriod = 9,
): Array<MacdPoint | null> {
  const fast = ema(values, fastPeriod);
  const slow = ema(values, slowPeriod);
  const macdLine: Array<number | null> = values.map((_, i) =>
    fast[i] !== null && slow[i] !== null ? (fast[i] as number) - (slow[i] as number) : null,
  );
  const compactMacd = macdLine.map((value) => value ?? 0);
  const signal = ema(compactMacd, signalPeriod);

  return values.map((_, i) => {
    const macdValue = macdLine[i];
    const signalValue = signal[i];
    if (macdValue == null || signalValue == null) return null;
    return {
      macd: macdValue,
      signal: signalValue,
      histogram: macdValue - signalValue,
    };
  });
}

export function bollingerBands(
  values: number[],
  period = 20,
  stdDevMultiplier = 2,
): Array<BollingerPoint | null> {
  const p = normalizePeriod(period);
  const middle = sma(values, p);
  return values.map((_, i) => {
    const mid = middle[i];
    if (mid == null || i < p - 1) return null;
    const window = values.slice(i - p + 1, i + 1);
    const variance = window.reduce((sum, value) => sum + Math.pow(value - mid, 2), 0) / p;
    const stdDev = Math.sqrt(variance);
    return {
      middle: mid,
      upper: mid + stdDev * stdDevMultiplier,
      lower: mid - stdDev * stdDevMultiplier,
    };
  });
}

function normalizePeriod(period: number): number {
  const parsed = Math.floor(Number(period));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function toRsi(avgGain: number, avgLoss: number): number {
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}
