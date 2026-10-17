# Church platform architecture audit and phase-one implementation plan

## 1. Repository architecture snapshot

### Server
- Entry point: `server/src/server.js` starts the Express app and bootstraps database readiness, Telegram bot startup, and the daily verse scheduler.
- Application definition: `server/src/app.js` wires core middleware and route groups for notifications, auth, users, public content, admin, events, campaigns, and Telegram.
- Auth and session model:
  - `server/src/middleware/requireUser.js` validates a signed JWT in the `church_session` cookie or `Authorization` header.
  - It loads the user’s active roles and permission codes from `users`, `user_roles`, `roles`, `role_permissions`, and `permissions`.
  - `server/src/controllers/authController.js` handles registration, login, password reset, email verification, and session creation.
- RBAC foundation:
  - `server/src/migrations/001_permissions_roles.sql` creates `permissions`, `roles`, `role_permissions`, `users`, and `user_roles`.
  - `server/src/services/roleAssignmentPolicy.js` enforces protected-owner and admin assignment rules.
  - `server/src/routes/adminRoutes.js` and `server/src/middleware/requirePermission.js` apply per-route permission enforcement.
- Database readiness and shared service layer: `server/src/config/db.js` centralizes PostgreSQL connectivity, user queries, and the initial schema bootstrap.

### Client
- `client/src/app/router.jsx` defines public, auth, member, organization, and admin routes.
- `client/src/layouts/*` and `client/src/pages/*` show a real multi-section church app structure already in place.
- Public pages include home, events, ministries, sermons, campaigns, giving, contact, and Bible verses.
- Member pages include profile, notifications, events, giving, and department/bible-study flows.
- Admin pages include members, roles, permissions, departments, staff, events, reports, audits, and settings.

## 2. What already works

The project is not a blank slate. It already contains working infrastructure for:

- PostgreSQL-backed user creation and login.
- Password reset and session handling with JWT cookies.
- Permission-based route guards and role assignment policy logic.
- Public giving-bank details endpoint and protected member giving flows.
- A church-style public/member/admin route structure.
- Basic notification, campaign, event, public verse, and Telegram integrations.
- Automated tests covering RBAC and public giving behavior.

The server test suite is currently green:
- Command run: `cd /home/netsanetdesta/Music/church\ website/server && npm test`
- Result: 9 passing, 0 failing (permission catalog, role-assignment policy, public giving routes, navigation/attendance)

The client builds cleanly:
- Command run: `cd /home/netsanetdesta/Music/church\ website/client && npm run build`
- Result: success (`dist/assets/index-*.css 62.48 kB`, `index-*.js 654 kB gzip 193 kB`). Only a non-blocking chunk-size advisory.

Migrations are idempotent and fully applied:
- `npm run migrate` reports all 9 migrations "already applied".
- The live `church_notifications` database exposes 44 tables (RBAC, departments, programs/locations, events, campaigns/donations, bible verses, notifications, telegram, giving, follow-up, bible study, audit history).

## 2a. Audit risks discovered (do not ignore in later phases)

- **Design-palette mismatch.** The master brief specifies an Aegean-Sky/Scarlet/Sandy-Linen palette (`#1664B0`, `#D21624`, `#EFE8DE`, `#0F172A`, `#64748B`, `#15966B`). The current `client/src/index.css` instead uses a "forest green / ivory / muted gold" palette (`--modern-green: #214b3a`) plus a separate blue "home" palette (`--home-blue: #2878ff`). Only `--home-muted: #64748b` currently matches the brief. A palette migration is a cross-cutting visual change and must be confirmed with the church before a large recolor is attempted.
- **Two migration folders exist.** `server/migrations/` and `server/src/migrations/` both contain SQL and both names appear in `schema_migrations`. `migrate.js` runs only `server/src/migrations/`. The `server/migrations/` set is legacy/reference; do not edit it and do not re-run it against the live database.
- **Secrets in `.env`.** `server/.env` (and a legacy root `.env`) currently hold real SMTP, Telegram, and Postgres values. Secrets are already read through `config/env.js`, so no code change is required — but the files must never be committed. **Guardrail added (Phase 1):** a repo-wide root `.gitignore` now ignores every `.env` variant (`.env`, `.env.*`, `**/.env`, `**/.env.*`) while keeping the committed `.env.example` templates, plus `node_modules/`, build output (`dist/`), logs, coverage, and local `uploads/`. Verified: `server/.env` and root `.env` are ignored; `server/.env.example` is still tracked. The project is not yet a git repo (empty `.git/`), so this file protects the first `git init` + commit. Before any shared/deploy step, rotate the exposed SMTP password and Telegram bot token because they have already existed in plaintext on disk.

## 3. What is still missing or incomplete relative to the master project prompt

The repo implements the core foundation, but several major features from the full church-platform brief remain incomplete or only scaffolded:

- Notification Studio and template management are not yet a complete, permissioned admin workflow.
- Department eligibility and recommendation rules are not yet implemented as a full backend policy layer.
- Prayer requests, pastoral follow-up, and new-Christian registration workflows are not uniformly modeled across routes, services, and UI.
- There are no complete admin tools for notification template creation, preview, audience targeting, and safe test/live dispatch separation.
- The permission model is present but not yet aligned to the full granular catalog requested in the project brief.
- Several public/member/admin pages exist, but they are not yet fully wired to a complete church-domain data model and business rules.
- Financial workflows, approval pipelines, and audit records are partial rather than a full finance governance model.
- Telegram and email delivery are present as infrastructure, but the full message-template system, channel previews, and duplicate-safe dispatch logic are not fully implemented.

## 4. Safest implementation order

This is the minimal-risk order for the remaining work:

### Phase 1 (current): repository audit and guardrails
- confirm the existing RBAC, auth, and database foundations
- document the architecture and identify the gaps
- keep runtime behavior unchanged
- validate the baseline test suite

### Phase 2: permissions and database foundation
- align permission naming with the church-domain plan
- add missing seed data and migration-safe permission entries
- strengthen audit logging for privileged actions
- protect owner/admin assignment invariants with explicit checks

### Phase 3: public and member experience
- improve public home and navigation coherence
- add member notifications center and profile consistency
- connect department eligibility, public program pages, and member-facing state

### Phase 4: staff and admin dashboards
- add permission-aware admin navigation and role-scoped screens
- finish staff/role management and department management under authorization gates

### Phase 5: Notification Studio
- add template gallery, message editor, safe preview flows, audience selection, and do-not-dispatch live messaging until validation succeeds

### Phase 6: real delivery and giving flow
- complete email and Telegram send paths, logs, and failure handling
- finish giving record review and approvals with audit trails

### Phase 7: pastoral workflows and future teaching modules
- implement prayer request and follow-up flows
- keep discipleship modules clearly marked as future work until the backend is ready

## 5. Recommended next engineering step

The safest next move is to continue with Phase 2 and add a centralized, explicit church permission catalog and migration-safe authorization foundation, instead of jumping straight into UI-only features. That preserves the current working system and tightens the domain rules before layering in more complex modules.
