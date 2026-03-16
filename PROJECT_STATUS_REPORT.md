# Souqly Project Status Report

_Last updated: 2026-03-12_

## 1. Executive Snapshot

Souqly is a modular-monolith marketplace with a strong MVP core already implemented:

- Auth/session baseline
- Geo (countries/cities)
- Categories + dynamic attributes (read/query side)
- Listings CRUD + media upload
- Favorites + saved searches + digest jobs
- Realtime chat + offers + deals + reviews
- Reports + moderation + anti-fraud phase 1
- Admin console foundation
- Escrow foundation (`B-01d`) and dispute/webhook integration (`B-01e`)
- Hybrid role/authorization model foundation (`B-01f`)
- Phone verification via WhatsApp OTP (`B-01g`)
- OAuth social login foundation (`B-01h`)
- Identity verification workflow (`B-01i`)
- Escrow webhook ledger + hard idempotency (`B-01j`)
- Authorization cutover cleanup (`B-01k`)

Current state is production-oriented in structure, but still not 100% production-complete across all PRD requirements.

## 2. Validation Baseline (Current)

- Backend: `npm run lint` PASS
- Backend: `npm run build` PASS
- Backend: `npm test` PASS (`126/126`)
- Frontend: `npm run lint` PASS
- Frontend: `npm run build` PASS

## 3. Module Delivery Status

### 3.1 Implemented (Core)

- `auth`
- `verification` (email/phone/social identity + manual identity workflow)
- `geo`
- `categories`
- `listings`
- `media`
- `preferences` (favorites + saved searches)
- `chats` (threads/messages/offers)
- `deals` (deal flow + reviews + escrow/disputes + webhook ledger)
- `reports`
- `admin`
- `businessProfiles`
- `craftsmanProfiles`
- `subscriptions`

### 3.2 Partial / Needs Hardening

- `trust` (score logic exists, broader UX/policy integration pending)
- `notifications` (realtime in-app exists, persistence/preferences hardening pending)
- `seo` (JSON-LD + SEO landing exists, full SEO suite pending)
- `payments` (escrow-ready + disputes + webhook event ledger done, replay/ops tooling pending)

### 3.3 Not Yet Implemented as Dedicated Modules

- `support`
- dedicated `currencies` management module
- advanced analytics module

## 4. B-01j Completion Summary

### 4.1 Delivered

1. Escrow webhook ledger data model:
   - `EscrowWebhookEvent`
   - `EscrowWebhookEventStatus` (`RECEIVED`, `PROCESSED`, `FAILED`)

2. Hard idempotency in webhook processing:
   - unique `eventId` deduplication
   - duplicate events return success with `applied=false` and `deduplicated=true`

3. Processing observability:
   - raw webhook payload persisted as JSON
   - failure code/message persisted for `FAILED` events

4. Runtime behavior updates:
   - webhook response now includes `deduplicated` flag
   - processed events marked with `processedAt`

5. Quality gates:
   - `deal.test.ts` now covers normal ledger-backed processing and duplicate event handling
   - full backend/frontend validation green

### 4.2 Migration Artifact

- `backend/prisma/manual_migrations/2026-03-12_b01j_escrow_webhook_ledger.sql`

## 5. Remaining Gaps (Post-B-01j)

- Full legacy `role` retirement is still pending at schema/API contract level (runtime authorization already moved to `staffRole` in `B-01k`).
- Map UX (map view, clustering, near-me UX) still pending.
- Full SEO hardening (`sitemap.xml`, `robots.txt`, canonical strategy) still pending.
- CI/CD workflows and production deployment automation still pending.
- Payment ops tooling (webhook replay/inspection dashboard) still pending.

## 6. Scope Lock Reminder

Per current direction, no new tracks should be opened until priority scope is explicitly approved.
This report captures the stabilized post-`B-01j` state and keeps follow-up work focused.

## 7. What Was Completed (Detailed)

### 7.1 Core Foundation

- Architecture and repository normalization to one canonical root.
- Backend modular baseline (`auth`, `geo`, `categories`, `listings`, `media`, `preferences`, `chats`, `deals`, `reports`, `admin`).
- Frontend operational pages and typed API integration layer.
- i18n baseline (`ar` primary + `en` secondary) with RTL/LTR support.
- Dockerized local stack (app + MySQL + Redis) and basic runtime health checks.

### 7.2 Listings / Discovery / Trust-Adjacent Work

- Listings CRUD flow with category attributes and moderation-aware status behavior.
- Media upload pipeline with image optimization and S3-compatible storage integration.
- Favorites + saved-searches + instant alert dispatch.
- Daily/weekly saved-search digest scheduler, status/history APIs, and Admin controls.
- Anti-fraud phase 1 rules and moderation queue visibility.
- Blacklist management (API + Admin UI).
- Featured listings foundation and Admin feature control.

### 7.3 Conversation / Deals / Escrow

- Realtime chat with offers and unread metadata.
- Deals workflow with confirmations and post-deal review basics.
- Escrow baseline (`hold`, `release`, `refund`) via deal-bound workflow.
- Dispute lifecycle with moderation review and resolution actions.
- Public escrow webhook endpoint with secret validation.
- Escrow webhook event ledger and hard idempotency (`eventId` dedup).

### 7.4 Identity / Role / Verification

- Hybrid role model foundation:
  - `accountType` (`INDIVIDUAL`, `STORE`, `CRAFTSMAN`)
  - `staffRole` (`NONE`, `MODERATOR`, `ADMIN`)
- Business profile and craftsman profile self-service flows.
- WhatsApp OTP phone verification (request/confirm).
- OAuth foundation (Google/Facebook, mock-first provider mode).
- Identity verification request/review workflow (user + admin).
- Authorization cutover cleanup (`B-01k`): runtime authorization now uses `staffRole` decisions.

### 7.5 Admin / Compliance / SEO Baseline

- Admin dashboard + reports + moderation + audit log visibility.
- Fraud flags and digest operational views in admin panel.
- Legal pages baseline (`Terms`, `Privacy`).
- SEO landing route and structured data baseline (JSON-LD).

### 7.6 Quality Gates Achieved

- Backend: lint/build/test passing.
- Frontend: lint/build passing.
- Current automated tests include auth, listings, chat, deals, reports, admin, verification, geo, preference, subscriptions, and search utility coverage.

## 8. Remaining Work (Complete and Detailed)

The remaining work is organized in execution order to finish the project in a controlled production path.

### 8.1 Immediate Next Slice: `B-01l` (Role Contract Finalization)

Goal: complete migration from legacy `role` model to clean `accountType + staffRole` contracts.

Steps:

1. Remove legacy moderation action path (`set_role`) from validation/service/controller/frontend forms.
2. Stop accepting `role` as an input filter/action for admin user moderation APIs.
3. Keep compatibility output field temporarily only if required by existing consumers, otherwise deprecate and remove in API contract.
4. Update auth/session DTO contracts to make `staffRole` the sole authorization claim.
5. Update tests that still rely on `role`-first assumptions.
6. Update docs (`API.md`, `ARCHITECTURE.md`, `ASSUMPTIONS.md`, `CHANGELOG.md`, `TODO_PROGRESS.md`).

Acceptance criteria:

- No runtime authorization path depends on `role`.
- No admin action accepts `set_role`.
- Backend tests and frontend build/lint remain green.

### 8.2 Product Gaps Required by PRD (MVP-Complete Path)

#### A) Map UX Completion

1. Implement map-first/list toggle UX on search page.
2. Add near-me behavior and distance filters end-to-end.
3. Add map marker clustering for dense result sets.
4. Ensure country/city defaults and map center follow user geo preference.

Acceptance criteria:

- User can switch list/map without losing active filters.
- Distance filtering works with consistent API behavior.
- Performance remains acceptable with clustered rendering.

#### B) Trust System Integration Hardening

1. Ensure trust score is recalculated on all critical triggers (verification, reviews, deal completion, disputes).
2. Standardize trust display components on profile/listing/store/craftsman surfaces.
3. Validate trust tier transitions and audit visibility for moderation.

Acceptance criteria:

- Trust score/tier shown consistently across required pages.
- Trigger events update trust score deterministically.

#### C) Notification Persistence Hardening

1. Persist in-app notifications beyond realtime socket state (DB-backed or robust Redis strategy).
2. Add read/unread sync endpoints and per-user preference hooks.
3. Ensure alert durability during reconnect/restart scenarios.

Acceptance criteria:

- Notifications survive session refresh and reconnect.
- Read state is consistent between API and UI.

#### D) Payments Ops Tooling (Escrow-Ready)

1. Add admin webhook events view (filter by status/type/date).
2. Add safe replay/reprocess tooling for failed webhook events.
3. Add internal runbook docs for operational dispute and escrow incident handling.

Acceptance criteria:

- Failed webhook events are discoverable and replayable with audit trace.

#### E) SEO Hardening (Production)

1. Generate `sitemap.xml` and `robots.txt`.
2. Add canonical strategy and deterministic metadata generation for listing/city/category pages.
3. Expand schema coverage consistency checks.

Acceptance criteria:

- Crawlable pages expose correct canonical/meta/schema.
- Static SEO assets served correctly in staging/production.

#### F) Security Hardening Closure

1. Verify CSRF posture on cookie-bearing auth endpoints.
2. Verify account lockout and rate limits for auth/otp/oauth endpoints.
3. Verify sanitization and output encoding policy coverage.
4. Add security checklist run before production deploy.

Acceptance criteria:

- Security controls validated by automated and checklist-based QA.

#### G) CI/CD and Deployment Automation

1. Add GitHub Actions workflows:
   - PR checks (lint/build/test).
   - staging deployment pipeline.
   - production release pipeline with approval gate.
2. Add deployment scripts/checklists for Hetzner + Cloudflare.
3. Add backup/restore runbook and monitoring/error tracking setup verification.

Acceptance criteria:

- Reproducible staging deploy from main branch.
- Controlled production release path with rollback notes.

#### H) Dedicated Missing Modules

1. `support` module baseline (tickets/help contact + admin handling).
2. Dedicated `currencies` admin management module (instead of static assumptions).
3. Advanced analytics module foundation (event metrics and admin insights).

Acceptance criteria:

- Modules exist with minimal production-ready API, validation, and admin visibility.

### 8.3 Quality and Testing Expansion Still Needed

1. Add targeted tests for:
   - map/distance/filter behavior
   - role-contract cleanup regressions (`B-01l`)
   - webhook replay tooling
   - notification persistence
2. Expand end-to-end critical flows for staging release gates.
3. Keep baseline: backend lint/build/test and frontend lint/build always green after each slice.

### 8.4 Documentation Completion Still Needed

The following documents must stay synchronized per slice closure:

- `README.md`
- `ARCHITECTURE.md`
- `ERD.md`
- `API.md`
- `ENV.md`
- `DEPLOYMENT.md`
- `ADMIN_GUIDE.md`
- `ASSUMPTIONS.md`
- `CHANGELOG.md`
- `TODO_PROGRESS.md`

## 9. Recommended Final Execution Order

1. `B-01l` Role Contract Finalization.
2. Map UX completion.
3. SEO hardening.
4. Notification persistence hardening.
5. Payments ops tooling (webhook replay/admin ops view).
6. Security hardening closure.
7. CI/CD + staging/prod deployment automation.
8. Missing dedicated modules (`support`, `currencies`, advanced analytics).
9. Final staging QA sweep and production readiness sign-off.
