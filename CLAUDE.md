@AGENTS.md

# Huskyteers Portal

Team communication app for FTC 19516 The Huskyteers: leaders assign tasks, members check them off (leader review makes them official), members ask leaders questions, email notifications.

Read `docs/CONVENTIONS.md` before changing code — it defines roles/permissions, the checklist state machine, the service/query/action layering, UI kit, and test patterns.

- UI is English only.
- Local Postgres: `npm run db:start` (port 54329). Don't reset or drop the dev database.
- Checks: `npm run typecheck`, `npm run lint`, `npm test`.
