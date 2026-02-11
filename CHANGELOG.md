# Changelog

## 2026-02-11

- `ruleflow-web`: added a demo `ConfigStore` provider abstraction with `FileStore` (local), `TmpStore` (`/tmp/.ruleflow-demo-data` for Vercel/serverless), and automatic fallback to `InMemoryStore` when durable writes are unavailable.
- `ruleflow-web`: route handlers now use shared persistence-aware API error handling and no-store responses, and `/api/system/health` now exposes `canWriteToStore` plus active store diagnostics.
