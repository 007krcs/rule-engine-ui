# Flow Engine

Deterministic finite state machine executor based on `FlowSchema`.

Purpose
Evaluates transitions, applies guards, and returns the next state and actions.

Exports
- `transition` to compute the next state

When to modify
Add new transition actions or guard evaluation behavior.

When not to touch
Do not introduce implicit state changes or history-based inference.
