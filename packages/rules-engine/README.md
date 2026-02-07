# Rules Engine

Safe, deterministic evaluator for the Rules DSL from `@platform/schema`.

## Usage

```ts
import { evaluateRules } from '@platform/rules-engine';

const result = evaluateRules({
  rules,
  context,
  data,
});
```

## Behavior

- Filters by scope (tenant, country, roles)
- Sorts by priority desc then ruleId asc
- Applies actions in order
- No `eval`, `Function`, or dynamic code execution
- Enforces timeouts, max rules, and max condition depth

## Output

`evaluateRules` returns `{ data, context, trace }` with:

- `rulesConsidered`
- `rulesMatched`
- `conditionResults`
- `actionsApplied`
- `events`
- `errors`

## Predicate Mode

Use `evaluateCondition` to evaluate guard conditions without actions.
