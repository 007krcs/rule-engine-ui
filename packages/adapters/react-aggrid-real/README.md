# @platform/react-aggrid-real

Production AG Grid adapter for RuleFlow React renderer.

Install
```bash
pnpm add @platform/react-aggrid-real ag-grid-react ag-grid-community
```

Usage
```ts
import { registerAgGridRealAdapter } from '@platform/react-aggrid-real';

registerAgGridRealAdapter();
```

Use `adapterHint: "aggrid.table"` with:
- `component.props.columnDefs`
- `component.props.rowData`
