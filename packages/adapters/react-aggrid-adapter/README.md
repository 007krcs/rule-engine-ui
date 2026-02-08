# React AG-Grid Adapter

Table adapter that renders `aggrid.table` using plain HTML tables.

Purpose
Provide a lightweight table rendering path without external grid dependencies.

Exports
- `registerAgGridAdapter` to register the table adapter

When to modify
Add new table features such as row selection or column formatting.

When not to touch
Do not bypass accessibility labeling for table components.
