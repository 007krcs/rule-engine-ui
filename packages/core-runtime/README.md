# Core Runtime

Orchestrates flow transitions, rule evaluation, and API calls into a single step.

Purpose
Executes a single runtime event and returns updated state plus trace data.

Exports
- `executeStep` to run flow + rules + API orchestration

When to modify
Add new runtime actions, validation modes, or tracing hooks.

When not to touch
Avoid bypassing validation or trace logging in regulated environments.
