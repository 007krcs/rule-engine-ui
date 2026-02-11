# Web Component Bridge

Custom element wrapper around the React renderer. Useful for Angular/Vue/React hosts.

## Usage

```ts
import { defineRuleflowRendererElement } from '@platform/web-component-bridge';

defineRuleflowRendererElement();
```

```html
<ruleflow-renderer
  ui-schema='{"version":"1.0.0","pageId":"page","layout":{"id":"root","type":"section","componentIds":[]},"components":[]}'
  data='{}'
  context='{"tenantId":"t","userId":"u","role":"user","roles":["user"],"country":"US","locale":"en-US","timezone":"UTC","device":"desktop","permissions":[],"featureFlags":{}}'
></ruleflow-renderer>
```

You can also set `uiSchema`, `data`, and `context` via element properties for richer integration frameworks.
