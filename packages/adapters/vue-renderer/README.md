# Vue Renderer

Framework-agnostic HTML renderer for Vue hosts.

Purpose
Render `UISchema` to HTML and optionally mount into a DOM target.

Exports
- `renderVue` to generate HTML or mount into a target element

When to modify
Add Vue-specific bindings or component hydration.

When not to touch
Do not bypass accessibility checks or tenant isolation logic in host code.
