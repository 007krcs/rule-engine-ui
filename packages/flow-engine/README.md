# Flow Engine

Finite State Machine executor based on `FlowSchema`.

## Usage

```ts
import { transition } from '@platform/flow-engine';

const result = transition({ flow, stateId, event, context, data });
```

## Behavior

- Deterministic transitions
- Guards evaluated with Rules DSL predicate evaluator
- Resume-safe: stateId is explicit and never inferred from history

## Output

`transition` returns `{ nextStateId, uiPageId, actionsToRun, trace }`.
