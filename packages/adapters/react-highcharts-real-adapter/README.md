# React Highcharts Real Adapter

Production adapter for `highcharts.chart` using Highcharts React.

## Install

```bash
pnpm add highcharts highcharts-react-official
```

## Usage

```ts
import { registerHighchartsRealAdapter } from '@platform/react-highcharts-real-adapter';

registerHighchartsRealAdapter();
```

## Notes

- Provide full Highcharts options via `component.props.options` or a numeric series via `component.props.series`.

Exports
- `registerHighchartsRealAdapter`
- `registerHighchartsAdapter` (feature-flagged via `RULEFLOW_REAL_ADAPTERS=1`)
