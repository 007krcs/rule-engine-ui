import styles from './Chart.module.css';
import { buildDummyChartPoints } from './dummy-data';

export type ChartType = 'bar' | 'line';

export interface ChartPoint {
  x: string | number;
  y: number;
}

export interface ChartProps {
  type: ChartType;
  data?: ChartPoint[];
  width?: number;
  height?: number;
  ariaLabel?: string;
  showGrid?: boolean;
  useDummyDataWhenEmpty?: boolean;
}

export function Chart({
  type,
  data = [],
  width = 640,
  height = 240,
  ariaLabel,
  showGrid = true,
  useDummyDataWhenEmpty = true,
}: ChartProps) {
  const resolvedData = data.length > 0 || !useDummyDataWhenEmpty ? data : buildDummyChartPoints(8);

  if (!resolvedData.length) {
    return (
      <div className={styles.chart} role="img" aria-label={ariaLabel ?? 'Empty chart'}>
        <div className={styles.empty}>No data available</div>
      </div>
    );
  }

  const summary = ariaLabel ?? buildSummary(type, resolvedData);
  const padding = 24;
  const maxY = Math.max(0, ...resolvedData.map((point) => point.y));
  const minY = Math.min(0, ...resolvedData.map((point) => point.y));
  const range = maxY - minY || 1;
  const plotWidth = width - padding * 2;
  const plotHeight = height - padding * 2;

  const scaleX = (index: number) =>
    padding + (resolvedData.length === 1 ? plotWidth / 2 : (index / (resolvedData.length - 1)) * plotWidth);
  const scaleY = (value: number) => height - padding - ((value - minY) / range) * plotHeight;

  const path = resolvedData
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${scaleX(index)},${scaleY(point.y)}`)
    .join(' ');

  return (
    <div className={styles.chart} role="img" aria-label={summary} aria-roledescription="chart">
      <svg
        className={styles.svg}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
      >
        <title>{summary}</title>
        {showGrid ? (
          <line
            x1={padding}
            y1={height - padding}
            x2={width - padding}
            y2={height - padding}
            className={styles.gridLine}
          />
        ) : null}
        {type === 'bar' ? renderBars(resolvedData, scaleX, scaleY, plotWidth, padding, height) : null}
        {type === 'line' ? <path d={path} className={styles.line} /> : null}
        {type === 'line'
          ? resolvedData.map((point, index) => (
              <circle
                key={`${point.x}-${index}`}
                cx={scaleX(index)}
                cy={scaleY(point.y)}
                r={3}
                className={styles.dot}
              />
            ))
          : null}
      </svg>
    </div>
  );
}

function renderBars(
  data: ChartPoint[],
  scaleX: (index: number) => number,
  scaleY: (value: number) => number,
  plotWidth: number,
  padding: number,
  height: number,
) {
  const step = plotWidth / data.length;
  const barWidth = Math.max(8, step * 0.6);
  return data.map((point, index) => {
    const x = scaleX(index) - barWidth / 2;
    const y = scaleY(point.y);
    const barHeight = Math.max(0, height - padding - y);
    return (
      <rect
        key={`${point.x}-${index}`}
        x={x}
        y={y}
        width={barWidth}
        height={barHeight}
        className={styles.bar}
      />
    );
  });
}

function buildSummary(type: ChartType, data: ChartPoint[]): string {
  const values = data.map((point) => point.y);
  const max = Math.max(...values);
  const min = Math.min(...values);
  return `${type === 'bar' ? 'Bar' : 'Line'} chart with ${data.length} points. Min ${min}, max ${max}.`;
}
