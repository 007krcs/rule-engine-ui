# Config Registry

In-memory registry that stores tenant-scoped configuration bundles and supports activation, promotion, and rollback.

Purpose
Stores versioned bundles per tenant, enforces tenant isolation, and records versioning events.

Exports
- `ConfigRegistry` in-memory registry with activation and rollback
- `createBundle` helper for consistent bundle metadata

When to modify
Extend lifecycle rules, add persistence adapters, or enrich audit events.

When not to touch
Do not bypass tenant checks or relax status guards in production paths.
