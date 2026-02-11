# @platform/component-registry

Headless component registry primitives for RuleFlow.

This package defines:
- A component manifest format (`ComponentRegistryManifest`) for describing what UI components exist for a tenant/company.
- Validation helpers (`validateComponentRegistryManifest`) to keep the product supportive and safe-by-default.
- A small built-in registry (`builtinComponentDefinitions`) that ships with the demo product.

The registry is intentionally framework-agnostic. React/Angular/Vue adapters consume the same `adapterHint` values.

