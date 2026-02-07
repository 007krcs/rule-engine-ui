# React Renderer

Generic renderer for UISchema with a plugin registry.

## Registering an Adapter

1. Create a package that depends on `@platform/react-renderer`.
2. Implement a render function that accepts a `UIComponent` and `AdapterContext`.
3. Call `registerAdapter('your-prefix.', renderFn)` once at app startup.
4. Use `adapterHint` values like `your-prefix.widget` in UISchema.

Example:

```ts
import { registerAdapter } from '@platform/react-renderer';

registerAdapter('acme.', (component, ctx) => {
  return <div aria-label={component.accessibility.ariaLabel}>Acme Widget</div>;
});
```

Adapters should respect `component.accessibility.ariaLabel` and attach
`ctx.events.onClick/onChange/onSubmit` to relevant UI events.
