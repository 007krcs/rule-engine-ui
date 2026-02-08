# Angular Renderer

Framework-agnostic HTML renderer for Angular hosts.

Purpose
Render `UISchema` to HTML and optionally mount into a DOM target.

Exports
- `renderAngular` to generate HTML or mount into a target element

When to modify
Add Angular-specific bindings or host integration logic.

When not to touch
Do not bypass accessibility checks or tenant isolation logic in host code.
