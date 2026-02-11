# React Highcharts Demo Adapter

Inline bar chart adapter for `highcharts.chart`.

Purpose
Provide a small, dependency-free chart rendering option.

Exports
- `registerHighchartsAdapter` to register the adapter

Production adapter
- `@platform/react-highcharts-real-adapter` (Highcharts React integration)

When to modify
Add new chart types or data formatting rules.

When not to touch
Do not remove aria labels or degrade chart accessibility.
