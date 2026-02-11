# Demo Host Angular

Angular-oriented demo host showing two integration modes.

Purpose
- Execute a flow step and render HTML with `@platform/angular-renderer`
- Demonstrate a Web Component host path with `<ruleflow-page>`

Exports
- `runAngularDemo(target?)` executes runtime + renders HTML output
- `mountRuleflowPage(target?)` registers `<ruleflow-page>` and mounts it

Web Component example
```ts
import { mountRuleflowPage } from './src';

await mountRuleflowPage('#root');
```

When to modify
Add Angular-specific bootstrapping or routing integration.

When not to touch
Do not bypass runtime validation or accessibility checks.
