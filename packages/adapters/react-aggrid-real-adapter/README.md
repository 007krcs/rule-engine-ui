# React AG Grid Real Adapter

Production adapter for `aggrid.table` using AG Grid React.

## Install

```bash
pnpm add ag-grid-react ag-grid-community
```

## Usage

```ts
import { registerAgGridRealAdapter } from '@platform/react-aggrid-real-adapter';

registerAgGridRealAdapter();
```

## Notes

- Import the AG Grid theme CSS in your host app:

```ts
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
```

- Use `component.props.themeClassName` to override the theme class.
- `component.props.columns` matches the demo schema and is converted to AG Grid column definitions.

Exports
- `registerAgGridRealAdapter`
- `registerAgGridAdapter` (feature-flagged via `RULEFLOW_REAL_ADAPTERS=1`)
