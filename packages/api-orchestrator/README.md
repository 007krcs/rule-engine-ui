# API Orchestrator

Declarative request/response mapping for external APIs with safe transforms and trace output.

Purpose
Builds HTTP requests from UI/runtime data and maps responses back into data and context.

Exports
- `callApi` to execute mapped API calls

When to modify
Add new transform functions, enrich error handling, or support new API protocols.

When not to touch
Do not introduce `eval`-style transforms or unsafe path writes.
