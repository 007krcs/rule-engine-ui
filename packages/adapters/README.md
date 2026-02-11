# Adapters

This folder contains UI adapter packages for RuleFlow.

RuleFlow is headless and framework-agnostic: the runtime evaluates flows + rules and produces traces, while adapters render UI components based on `adapterHint`.

## How Adapters Work

- A `UISchema` component includes an `adapterHint` like `material.input` or `company.currencyInput`.
- The host app (or product UI) registers adapter handlers for a prefix (example: `material.` or `company.`).
- The renderer selects an adapter by matching the `adapterHint` prefix.

Example (React):

```ts
import { registerAdapter } from '@platform/react-renderer';

registerAdapter('acme.', (component, ctx) => {
  const aria = ctx.i18n.t(component.accessibility.ariaLabelKey);
  return <AcmeWidget aria-label={aria} {...component.props} />;
});
```

## Packages In This Repo

- `react-renderer`: Headless React renderer and adapter registry.
- `react-material-adapter`: Demo adapters for common inputs/layout.
- `react-aggrid-adapter`: Demo table adapter (HTML table fallback).
- `react-highcharts-adapter`: Demo chart adapter (inline SVG).
- `react-d3-adapter`: Custom visualization adapter.
- `react-company-adapter`: Example company integration (`company.currencyInput`, `company.riskBadge`).
- `react-aggrid-real-adapter`: Production AG Grid adapter (peer deps).
- `react-highcharts-real-adapter`: Production Highcharts adapter (peer deps).
- `angular-renderer`: Minimal HTML renderer used for Angular integration demos.
- `vue-renderer`: Minimal HTML renderer used for Vue integration demos.
- `web-component-bridge`: Custom element wrapper for Angular/Vue/React hosts.

## Styling And Theming

Adapters are the seam for "bring your own UI library":

- You can render any component library in your adapter handlers.
- You can inject your CSS framework in the host and keep RuleFlow’s schema contracts unchanged.
- The product app uses first-party CSS variables (see `apps/ruleflow-web/src/app/globals.css`) so themes can be applied by overriding variables.
