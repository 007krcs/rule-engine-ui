# Builder Web

React-based schema builder UI and helper functions.

Purpose
Compose `UISchema` components with accessibility metadata and preview the generated JSON.

Exports
- `BuilderApp` React component
- `createBuilderState`, `addComponent`, `updateComponent`, `removeComponent`, `buildSchema`

When to modify
Add new builder panels, component palettes, or validation feedback.

When not to touch
Do not remove accessibility defaults or schema preview output.
