# React Renderer

Adapter registry and renderer for `UISchema` using React.

Purpose
Resolve `adapterHint` prefixes to registered React render functions and enforce accessibility at runtime.

Exports
- `registerAdapter` to register a prefix-based renderer
- `RenderPage` to render a full UI schema

When to modify
Add new adapter registration patterns or layout rendering behavior.

When not to touch
Do not relax accessibility checks or change adapter prefix resolution without migration.
