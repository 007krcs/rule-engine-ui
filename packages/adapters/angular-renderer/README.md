# Angular Renderer

Framework-agnostic HTML renderer starter for Angular hosts.

Purpose
Render `UISchema` to HTML and optionally mount into a DOM target.

Exports
- `RenderPageAngular` for stateful rendering (`dispatchEvent` API for `onChange`/`onClick`/`onSubmit`)
- `renderAngular` convenience wrapper for one-shot HTML rendering
- adapter registry helpers: `createAdapterRegistry`, `registerAdapter`, `isAdapterRegistered`, `listRegisteredAdapterPrefixes`

Roadmap Starter Scope
- Supports platform subset: `platform.textField`, `platform.button`, `platform.select`, `platform.section`, `platform.table`
- Evaluates per-component rules (`visibleWhen`, `disabledWhen`, `requiredWhen`, `setValueWhen`)
- Resolves bindings for data/context/computed paths

Known Limitations
- Output is plain HTML string (no Angular component hydration in this package yet)
- Event execution is host-driven through `dispatchEvent` (no automatic DOM listeners)
- Layout support is basic section/grid/stack/tabs, intended to prove renderer portability first

When to modify
Add Angular-specific bindings or host integration logic.

When not to touch
Do not bypass accessibility checks or tenant isolation logic in host code.
