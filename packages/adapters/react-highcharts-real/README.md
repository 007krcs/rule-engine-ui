# @platform/react-highcharts-real

Production Highcharts adapter for RuleFlow React renderer.

Install
```bash
pnpm add @platform/react-highcharts-real highcharts highcharts-react-official
```

Usage
```ts
import { registerHighchartsRealAdapter } from '@platform/react-highcharts-real';

registerHighchartsRealAdapter();
```

Use `adapterHint: "highcharts.chart"` with:
- `component.props.config` (preferred)
- `component.props.options` (fallback)
