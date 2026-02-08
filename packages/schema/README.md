# Schema

TypeScript types and JSON schemas for UI, rules, flow, API mappings, and execution context.

Purpose
Define the canonical configuration contracts used across the platform.

Exports
- TypeScript types in `src/types.ts`
- JSON schemas in `schemas/`
- Example configs in `examples/`

When to modify
Add or evolve configuration fields with versioned schema updates.

When not to touch
Do not change schema fields without updating validators and examples.
