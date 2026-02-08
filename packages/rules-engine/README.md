# Rules Engine

Deterministic rules evaluator with scoped rules and trace output.

Purpose
Evaluates rule conditions against context and data, applies actions, and emits trace logs.

Exports
- `evaluateRules` to apply rules
- `evaluateCondition` for predicate evaluation

When to modify
Add new rule operators or action types.

When not to touch
Do not add dynamic code execution or non-deterministic behavior.
