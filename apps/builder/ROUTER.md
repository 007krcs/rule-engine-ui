# Routing System (Builder app)

- This repository uses the **Next.js App Router** (`apps/builder/src/app/**`) for builder routes. The presence of `app/layout.tsx` and nested `app/builder/.../page.tsx` files confirms App Router is active.
- The Pages Router (`pages/`) is not present for the builder app, so all new routes must be added under `src/app`.
- Redirects should use `next/navigation` helpers (e.g., `redirect()`), and shared UI should be placed in `app/builder/layout.tsx`.
