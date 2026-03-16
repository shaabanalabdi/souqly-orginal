# Souqly TODO / Progress Tracker

## Last Update
- Date: 2026-03-12
- Status: Active
- Resume From: `B-01l`

## How To Use
1. Start from `Resume Queue`.
2. Execute the first `IN_PROGRESS` task, or first `TODO` task.
3. After completion: mark it `DONE`, then update `Last Update` and `Resume From`.
4. Append a concise line in `Session Log`.

---

## Milestone Snapshot

### Core Platform
- [x] Auth + sessions + reset/verify
- [x] Geo (countries/cities)
- [x] Categories + attributes
- [x] Listings CRUD + media upload (S3)
- [x] Favorites + saved searches
- [x] Realtime chat + offers + unread count
- [x] Deals + reviews
- [x] Reports + moderation
- [x] Admin dashboard + moderation + audit logs

### Notifications & Trust
- [x] Realtime in-app notifications (`platform:notification`)
- [x] Instant saved-search alerts (in-app + email)
- [x] Daily/weekly saved-search digest (scheduler + manual run)
- [x] Digest status + history + filters + sort + CSV export + pagination

### Recent High-Priority Additions
- [x] Digest duration metrics + duration sort/filter
- [x] Anti-fraud phase 1 + blacklist management UI
- [x] Featured listings basics
- [x] SEO landing + structured data basics
- [x] Legal/compliance pages (Terms/Privacy)

---

## Resume Queue

### B-01: Post-Launch Extensions
- Priority: P3
- Status: IN_PROGRESS
- Completed Slices:
  - `B-01a`: Dialect-aware search expansion (backend) - DONE
  - `B-01b`: Store subscriptions foundation (plans/subscribe/cancel + frontend page + tests) - DONE
  - `B-01c`: Business profile self-service (backend endpoints + frontend page + tests) - DONE
  - `B-01d`: Escrow workflow foundation (deal-level hold/release/refund + UI + tests) - DONE
  - `B-01e`: Escrow dispute lifecycle + admin resolution workflow + provider webhook hooks - DONE
  - `B-01f`: Role model + authorization policies (hybrid model, migration-compatible) - DONE
  - `B-01g`: Phone verification via WhatsApp OTP (request/confirm + UI + tests) - DONE
  - `B-01h`: OAuth foundation (Google/Facebook social login + linking + UI hooks + tests) - DONE
  - `B-01i`: Identity verification workflow (user request + admin resolution + UI + tests) - DONE
  - `B-01j`: Escrow webhook event ledger + idempotency hardening - DONE
  - `B-01k`: Authorization cutover cleanup (staffRole-only runtime authorization) - DONE
- Next Slice: `B-01l` (pending scope definition)
- Goal: Continue post-launch expansion without opening uncontrolled tracks.

### Planned Next Queue (Detailed)

- `B-01l`: Role contract finalization
  - remove legacy `set_role` action path
  - enforce `staffRole`-only authorization contract
  - update API/docs/tests to remove role-input dependencies
- `B-02a`: Map UX completion
  - list/map toggle
  - near-me + distance filter
  - marker clustering
- `B-02b`: SEO hardening
  - sitemap
  - robots
  - canonical/meta strategy
- `B-02c`: Notification persistence hardening
  - durable notification storage
  - read/unread sync APIs
- `B-02d`: Escrow/payment ops tooling
  - webhook ledger admin view
  - failed webhook replay flow
- `B-03a`: Security hardening closure
  - CSRF/session/rate-limit/auth hardening verification
  - pre-release security checklist
- `B-03b`: CI/CD and deployment automation
  - PR/staging/prod pipelines
  - deployment + rollback runbooks
- `B-03c`: Missing dedicated modules
  - support
  - currencies management
  - analytics foundation

---

## Session Log

- 2026-03-11:
  - Added saved-search digest scheduler + manual run API + status/history endpoints.
  - Added Admin digest controls, filters, export, and pagination.
  - Validation run: backend build/lint/test and frontend lint/build all green.

- 2026-03-12:
  - Completed `A-01` to `A-06` slices (digest metrics, anti-fraud, blacklist, featured, SEO landing, legal pages).
  - Completed `B-01a`: dialect-aware search expansion.
  - Completed `B-01b`: store subscriptions foundation.
  - Completed `B-01c`: business profile self-service.
  - Completed `B-01d`: escrow hold/release/refund foundation.
  - Validation run after `B-01d`: backend lint/build/test (`105/105`) and frontend lint/build all green.
  - Completed `B-01e`: dispute lifecycle + admin resolution + escrow webhooks.
  - Backend:
    - added dispute endpoints on deals (`open`, `review`, `resolve`)
    - added public webhook endpoint `POST /api/v1/payments/escrow/webhook`
    - implemented provider event handlers for `escrow.held`, `escrow.released`, `escrow.refunded`, `dispute.opened`, `dispute.resolved`
  - Frontend:
    - extended Deals page/service/types with dispute actions (`open` / `review` / `resolve`)
  - Added tests in `deal.test.ts` for dispute + webhook scenarios.
  - Validation run after `B-01e`: backend lint/build/test (`109/109`) and frontend lint/build all green.
  - Completed `B-01f`: hybrid role model (`accountType` + `staffRole`) with legacy `role` compatibility.
  - Added craftsman profile backend module and frontend page.
  - Updated auth token/session payload, admin moderation policies, and role-aware UI guards.
  - Validation run after `B-01f`: backend build + test (`113/113`) and frontend build all green.
  - Completed `B-01g`: WhatsApp OTP phone verification.
  - Backend:
    - added `POST /api/v1/auth/phone-verification/request`
    - added `POST /api/v1/auth/phone-verification/confirm`
    - added provider-agnostic `shared/utils/whatsapp.ts` (mock-first delivery)
    - extended `/auth/me` response with `phone`
  - Frontend:
    - added phone verification section in `PreferencesPage`
    - added auth API calls for OTP request/confirm
    - added `refreshUser()` in auth store for post-verification sync
  - Validation run after `B-01g`: backend lint/build/test (`117/117`) and frontend lint/build all green.
  - Completed `B-01h`: OAuth foundation (Google/Facebook) with social login endpoints, linking flow, and frontend/store integration.
  - Backend:
    - added `POST /api/v1/auth/oauth/google`
    - added `POST /api/v1/auth/oauth/facebook`
    - implemented OAuth profile resolution (mock-first + provider fetch path), account create/link logic, and shared login response flow
  - Frontend:
    - extended auth service/store with Google/Facebook OAuth login methods
    - added OAuth foundation actions in login page for end-to-end local/testing validation
  - Validation run after `B-01h`: backend lint/build/test (`120/120`) and frontend lint/build all green.
  - Completed `B-01i`: Identity verification workflow.
  - Backend:
    - added Prisma identity verification model/status fields + manual migration script
    - added `GET /api/v1/verification/identity/me`
    - added `POST /api/v1/verification/identity/request`
    - added `GET /api/v1/admin/identity-verifications`
    - added `PATCH /api/v1/admin/identity-verifications/:id` (admin-only resolution)
    - extended `/auth/me` payload with `identityVerificationStatus` and `identityVerifiedAt`
  - Frontend:
    - added `verification.service.ts`
    - added identity verification section in `PreferencesPage`
    - added identity verification queue + resolve actions in `AdminPage`
  - Validation run after `B-01i`: backend lint/build/test (`125/125`) and frontend lint/build all green.
  - Completed `B-01j`: Escrow webhook event ledger + idempotency hardening.
  - Backend:
    - added `EscrowWebhookEvent` model + `EscrowWebhookEventStatus` enum
    - added manual migration `2026-03-12_b01j_escrow_webhook_ledger.sql`
    - upgraded `processEscrowWebhook` to persist events and enforce hard dedup by `eventId`
    - added failure status persistence (`FAILED` + failure code/message)
  - Tests:
    - extended `deal.test.ts` with duplicate webhook event scenario
  - Validation run after `B-01j`: backend lint/build/test (`126/126`) and frontend lint/build all green.
  - Completed `B-01k`: authorization cutover cleanup (staffRole-only runtime authorization).
  - Backend:
    - `authorize` middleware now enforces `StaffRole` policies only
    - `resolveStaffRole` now resolves from `staffRole` directly for runtime policy checks
    - deals actor contract no longer requires legacy `role`
    - reports moderator notification recipients now filtered by `staffRole` only
  - Frontend:
    - removed legacy `role` fallback checks from `ProtectedRoute`, `AppLayout`, `DealsPage`, and `AdminPage`
  - Validation run after `B-01k`: backend lint/build/test (`126/126`) and frontend lint/build all green.
