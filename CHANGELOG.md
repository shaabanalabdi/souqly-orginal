# Changelog

All notable changes to this project will be documented in this file.

## [0.2.11] - 2026-03-12

### Added
- Post-launch slice `B-01k`: authorization cutover cleanup to reduce legacy `role` dependency in runtime decisions.

### Changed
- Backend authorization middleware now accepts only `StaffRole` policies and evaluates only normalized `staffRole`.
- `resolveStaffRole` runtime policy resolution now uses `staffRole` directly (`NONE` fallback) instead of legacy `role`.
- Deals actor contract no longer requires legacy `role` for escrow/dispute privileged actions.
- Reports moderation queue notifications now target moderators/admins by `staffRole` only.
- Frontend authorization guards (`ProtectedRoute`, `AppLayout`, `DealsPage`, `AdminPage`) now rely on `staffRole` only.
- Validation run after `B-01k`:
  - backend `lint`/`build`/`test` passed (`126/126`)
  - frontend `lint`/`build` passed

## [0.2.10] - 2026-03-12

### Added
- Post-launch slice `B-01j`: escrow webhook event ledger + hard idempotency.
- New Prisma model and enum:
  - `EscrowWebhookEvent`
  - `EscrowWebhookEventStatus` (`RECEIVED`, `PROCESSED`, `FAILED`)
- New manual migration script:
  - `backend/prisma/manual_migrations/2026-03-12_b01j_escrow_webhook_ledger.sql`
- Extended webhook test coverage in `backend/src/__tests__/deal.test.ts`:
  - ledger-backed processing success path
  - duplicate event id path (deduplicated response)

### Changed
- `processEscrowWebhook` now registers each event in `escrow_webhook_events` with stored JSON payload.
- Duplicate `eventId` webhook calls are now explicitly deduplicated and return `applied=false` with `deduplicated=true`.
- Webhook events now persist processing outcome (`PROCESSED` / `FAILED`) with failure code/message when applicable.
- Webhook response now includes `deduplicated` flag for observability.

## [0.2.9] - 2026-03-12

### Added
- Post-launch slice `B-01i`: identity verification workflow (user submission + admin resolution).
- New Prisma additions:
  - `IdentityVerificationStatus` enum
  - `identityVerificationStatus` + `identityVerifiedAt` on `users`
  - `identity_verification_requests` model/table
- New manual migration script:
  - `backend/prisma/manual_migrations/2026-03-12_b01i_identity_verification.sql`
- New verification module endpoints:
  - `GET /api/v1/verification/identity/me`
  - `POST /api/v1/verification/identity/request`
- New admin moderation endpoints for identity verification:
  - `GET /api/v1/admin/identity-verifications`
  - `PATCH /api/v1/admin/identity-verifications/:id`
- New backend tests:
  - `backend/src/__tests__/verification.test.ts`
  - extended `backend/src/__tests__/admin.test.ts` with identity verification cases
- New frontend verification service:
  - `frontend/src/services/verification.service.ts`

### Changed
- `auth/me` now includes `identityVerificationStatus` and `identityVerifiedAt` in session payload.
- Preferences page now includes identity verification request flow and status overview.
- Admin console now includes identity verification queue view and approve/reject action form.

## [0.2.8] - 2026-03-12

### Added
- Post-launch slice `B-01h`: OAuth login foundation (Google/Facebook).
- New auth endpoints:
  - `POST /api/v1/auth/oauth/google`
  - `POST /api/v1/auth/oauth/facebook`
- New backend auth tests for OAuth mock-mode create/link/error scenarios.
- `OAUTH_MOCK_MODE` env flag in `backend/.env.example` for provider-free local/testing flow.

### Changed
- Auth service now supports OAuth profile resolution, account linking by email, provider-id binding, and automatic verified-email session issue for social login.
- Auth controller now reuses a common login response path (cookie + access token payload) for password login and OAuth login.
- Frontend auth service/store now support Google/Facebook OAuth login calls.
- Login page now includes OAuth foundation actions (mock-mode compatible) to validate end-to-end integration during development.

## [0.2.7] - 2026-03-12

### Added
- Post-launch slice `B-01g`: phone verification via WhatsApp OTP.
- New authenticated auth endpoints:
  - `POST /api/v1/auth/phone-verification/request`
  - `POST /api/v1/auth/phone-verification/confirm`
- New WhatsApp utility with mock-first provider behavior:
  - `backend/src/shared/utils/whatsapp.ts`

### Changed
- `auth/me` now returns `phone` in current session payload.
- Preferences page now includes phone verification flow (request OTP + confirm OTP).
- Auth store now supports `refreshUser()` to sync session state after verification.
- Added/updated backend tests for OTP flow in `backend/src/__tests__/auth.test.ts`.

## [0.2.6] - 2026-03-12

### Added
- Post-launch slice `B-01f`: role model + authorization policy foundation.
- New user classification fields in Prisma:
  - `accountType` (`INDIVIDUAL`, `STORE`, `CRAFTSMAN`)
  - `staffRole` (`NONE`, `MODERATOR`, `ADMIN`)
- New `CraftsmanProfile` data model and authenticated module:
  - `GET /api/v1/craftsman-profile/me`
  - `PUT /api/v1/craftsman-profile/me`
- New backend auth helper: `backend/src/shared/auth/authorization.ts` for role/staff/account normalization and policy checks.
- New backend tests: `backend/src/__tests__/craftsmanProfile.test.ts`.
- New manual migration script: `backend/prisma/manual_migrations/2026-03-12_b01f_role_model.sql`.

### Changed
- JWT access token payload and request auth context now include `accountType` and `staffRole` with legacy `role` compatibility.
- Admin authorization now uses `staffRole` policies (with backward compatibility for legacy `role` checks).
- Admin user moderation now supports:
  - `set_staff_role`
  - `set_account_type`
  - legacy `set_role` kept for compatibility
- Listings and deals authorization decisions now use policy helpers instead of direct legacy role checks.
- Business profile upsert now enforces `accountType=STORE` to keep role model consistent.
- Frontend session/domain/admin types updated for `accountType` + `staffRole`.
- Frontend route guards/admin/deals UI updated to respect `staffRole` permissions.
- Frontend now includes a dedicated craftsman profile page and navigation entry.

## [0.2.5] - 2026-03-12

### Added
- Post-launch slice `B-01e`: dispute lifecycle + admin resolution workflow + escrow webhooks handling.
- New dispute endpoints:
  - `POST /api/v1/deals/:id/dispute`
  - `PATCH /api/v1/deals/:id/dispute/review`
  - `PATCH /api/v1/deals/:id/dispute/resolve`
- New public escrow webhook endpoint:
  - `POST /api/v1/payments/escrow/webhook`
- Added backend tests for dispute and webhook flows in `backend/src/__tests__/deal.test.ts`.

### Changed
- Deal service now supports end-to-end dispute lifecycle (`OPEN` -> `UNDER_REVIEW` -> `RESOLVED`) tied to deal/escrow transitions.
- Admin/moderator resolution actions now apply escrow outcomes (`release_escrow`, `refund_escrow`, `close_no_escrow`) with consistent deal status updates.
- Escrow webhook processing now updates deal escrow status and dispute states based on provider events.
- Frontend deals service/types/page now include dispute actions (open/review/resolve) for operational moderation flow.

## [0.2.4] - 2026-03-12

### Added
- Post-launch slice `B-01d`: escrow workflow foundation for deals.
- New escrow deal endpoints:
  - `PATCH /api/v1/deals/:id/escrow/hold`
  - `PATCH /api/v1/deals/:id/escrow/release`
  - `PATCH /api/v1/deals/:id/escrow/refund`
- Backend tests for escrow deal actions added in `backend/src/__tests__/deal.test.ts`.

### Changed
- `Deal` domain model now includes escrow state and timestamps (`NONE`, `HELD`, `RELEASED`, `REFUNDED`).
- Deals page now displays escrow status and provides hold/release/refund actions (refund restricted in UI to admin/moderator users).
- Frontend deal service/types updated to support escrow actions and payloads.

## [0.2.3] - 2026-03-12

### Added
- Post-launch slice `B-01c`: business profile self-service flow.
- Backend module: `businessProfiles` with authenticated endpoints:
  - `GET /api/v1/business-profile/me`
  - `PUT /api/v1/business-profile/me`
- Frontend business profile management page: `/business-profile`.
- Frontend API client: `frontend/src/services/businessProfile.service.ts`.
- Backend tests: `backend/src/__tests__/businessProfile.test.ts`.

### Changed
- Subscription UI now links users to the business profile page when they are not eligible for store plans.
- Business profile updates now reset admin verification automatically when core company data changes.

## [0.2.2] - 2026-03-12

### Added
- Post-launch slice `B-01a`: dialect-aware search expansion for listings query (`q`) with Arabic/English alias groups.
- New utility: `backend/src/shared/utils/dialectSearch.ts`.
- New test suite: `backend/src/__tests__/dialectSearch.test.ts`.

### Changed
- Listings search now expands text query terms before building Prisma `OR` filters, improving discoverability for dialect variants (for example: `موبايل` -> `جوال`, `هاتف`).
- Listings API integration test updated to assert alias expansion in generated query filters.

## [0.2.1] - 2026-03-12

### Changed
- Repository normalization completed: `souqly/` is now the single canonical project root used for backend/frontend work.
- Confirmed legacy root `backend/` and `frontend/` files were scaffold placeholders and safe to remove from active flow.

### Removed
- Unused Vite template artifacts from frontend source:
  - `src/App.module.scss`
  - `src/assets/react.svg`

## [0.2.0] - 2026-03-11

### Added
- Backend modules completed: `auth`, `geo`, `categories`, `listings`, `preferences`, `chats`, `deals`, `reports`, `admin`, `media`
- Real image upload endpoint: `POST /api/v1/media/upload` with image optimization (`sharp`) and S3 storage
- Realtime chat socket layer with JWT auth, user rooms, thread rooms, and event broadcasting
- Unread chat count endpoint: `GET /api/v1/chats/unread-count`
- Frontend operational pages for end-to-end flows (auth, listings, chat, deals, preferences, reports, admin)
- Frontend typed API service layer and Zustand auth session store
- Global realtime notifications in top navbar (chat unread counter + toast notifications)
- Platform notification event channel: `platform:notification` for deals/reports/moderation updates
- Admin audit logs endpoint: `GET /api/v1/admin/audit-logs` (with filters + pagination)
- Saved search instant alert dispatcher on active listing creation (in-app realtime + email)
- Saved-search digest dispatcher for `daily` and `weekly` frequencies (in-app + email)
- Background scheduler for saved-search digests using Redis lock/last-run keys
- Redis-backed digest run history retention (configurable via `SAVED_SEARCH_DIGEST_HISTORY_MAX_ITEMS`)
- Admin digest control endpoints:
  - `GET /api/v1/admin/saved-search-digest/status`
  - `GET /api/v1/admin/saved-search-digest/history`
  - `POST /api/v1/admin/saved-search-digest/run`
- Listing anti-fraud phase 1 engine on create flow (blacklist, price anomaly, duplicate text/image, new-account high-value)
- Admin fraud flags endpoint: `GET /api/v1/admin/fraud-flags`
- Admin blacklist management endpoints:
  - `GET /api/v1/admin/blacklist`
  - `POST /api/v1/admin/blacklist`
  - `PATCH /api/v1/admin/blacklist/:id`
  - `DELETE /api/v1/admin/blacklist/:id`
- Featured listing management endpoint: `POST /api/v1/admin/listings/:id/feature`
- SEO landing route: `GET /seo/:countryCode/:cityId/:categorySlug` with listing ItemList JSON-LD
- Legal/compliance pages: `/terms` and `/privacy` (AR/EN-aware content)
- Router shell with protected routes and admin-only route guard

### Changed
- Frontend create-listing flow now supports file upload + S3 URLs instead of manual URLs only
- Chat page now supports live updates from socket events (new messages/offers)
- Chat thread DTO now includes `unreadCount`; navbar and thread list counters use server-side unread aggregation
- Admin/report/deal controllers now emit socket notifications to affected users and moderation queue
- Admin frontend console now displays recent audit log actions table
- Admin console now displays digest scheduler status and manual run controls (daily/weekly/both)
- Admin console now includes digest run history table (scheduler + manual)
- Digest history endpoint now supports date-range filtering (`from`, `to` by completion time)
- Digest history endpoint now supports sort by completion time (`completed_desc` / `completed_asc`)
- Digest history endpoint now supports duration metrics + duration filters (`minDurationMs`, `maxDurationMs`)
- Digest history endpoint now supports sort by run duration (`duration_desc` / `duration_asc`)
- Admin digest history UI now supports frequency/source/date filters + CSV export
- Admin digest history UI now supports completion-time sort selector
- Admin digest history UI now supports duration filters + duration sort selector + duration column
- Admin digest history UI now supports real pagination controls (page/size/next/prev)
- Listing creation now runs anti-fraud checks and auto-forces manual review when signals are detected
- Listing feed now supports featured-first ranking, featured-only filtering, and category-slug filtering
- Admin console now includes featured listing controls, fraud flags view, and blacklist management UI
- Listing details page now emits Product JSON-LD structured data
- Listing creation/moderation activation now triggers background matching against instant saved searches
- Backend server bootstrap now starts/stops saved-search digest scheduler automatically
- Default backend CORS frontend URL fallback updated to `http://localhost:5173`

## [0.1.0] - 2026-03-11

### Added
- Project scaffold: Vite + React 19 + TypeScript frontend
- Project scaffold: Express + TypeScript + Prisma backend
- Docker Compose with MySQL 8 and Redis 7
- Prisma schema with 30+ models covering all modules
- Database seed: 6 currencies, 5 countries, 45+ cities, 15 categories
- Backend: config loader, logger (Winston), Redis service, Prisma service
- Backend: error handler, rate limiter, XSS sanitizer, Joi validator
- Backend: health check endpoint
- Frontend: SCSS design system (variables, mixins, global styles)
- Frontend: i18n setup with Arabic (primary) and English translations
- Documentation: README.md, ASSUMPTIONS.md, CHANGELOG.md
