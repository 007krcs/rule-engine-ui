# React AG Grid Demo Adapter

Demo table adapter that renders `aggrid.table` using plain HTML tables.

Purpose
Provide a lightweight table rendering path without external grid dependencies.

Exports
- `registerAgGridAdapter` to register the table adapter

Production adapter
- `@platform/react-aggrid-real-adapter` (AG Grid React integration)

When to modify
Add new table features such as row selection or column formatting.

When not to touch
Do not bypass accessibility labeling for table components.
