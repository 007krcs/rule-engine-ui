# @platform/persistence-dal

Storage abstraction layer for RuleFlow config persistence.

## Features

- Provider-neutral DAL interface (`getConfig`, `saveConfig`, `listVersions`, lifecycle transitions)
- Lifecycle enforcement in one place:
  - `Draft -> Submitted -> Approved -> Deprecated -> Deleted`
- Adapters:
  - `InMemoryDalAdapter`
  - `DemoFileDalAdapter` (with file lock for concurrent writers)
  - `MongoDalAdapter` (tenant-scoped queries/checks)
  - `PostgresDalAdapter` (bridges existing enterprise repository)
- Migration CLI:
  - `pnpm --filter @platform/persistence-dal migrate -- --from json|postgres|mongodb --to json|postgres|mongodb --tenantId <id> [--file <path>] [--fromUri <uri>] [--toUri <uri>] [--mongoDbName <db>]`

## Notes

- MongoDB adapter loads `mongodb` dynamically at runtime. Install it in the workspace where Mongo persistence is used.
