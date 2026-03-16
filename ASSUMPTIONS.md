# Souqly Assumptions

## Architecture

- Modular monolith for fast delivery and clear module boundaries.
- Prisma ORM is mandatory for data access (no raw SQL queries in services).
- MySQL 8 is the primary database, Redis 7 for cache and ephemeral auth state.

## Data Model

- Primary keys use `Int @id @default(autoincrement())` as defined in `schema.prisma`.
- Listings are soft-deleted via `status = DELETED`.
- Escrow foundation is in scope for deal-level lifecycle and webhook-driven state updates.

## Authentication and Security

- Password hashing uses bcrypt with 12 rounds.
- Access token lifetime is 15 minutes, refresh token lifetime is 7 days.
- Refresh tokens are expected to be stored in HTTP-only cookies.
- Secrets are loaded from environment variables only.

## Frontend

- React 18 + Vite 5 + TypeScript.
- Arabic is default locale, RTL by default.
- All user-facing copy must come from i18n translation files.

## Infrastructure

- Docker Compose for local development.
- Nginx reverse proxy in containerized deployments.

## Escrow and Disputes

- `B-01e` is implemented inside the `deals` module to keep scope constrained and avoid introducing a new payments module before stabilization.
- Public provider webhook endpoint is mounted at app level (`/api/v1/payments/escrow/webhook`) to bypass cross-router auth middleware interception.
- Webhook requests require `x-escrow-webhook-secret` matching `ESCROW_WEBHOOK_SECRET`.
- Webhook idempotency is enforced by unique `eventId` persistence in `escrow_webhook_events`.
- Admin resolution actions for disputes are constrained to:
  - `release_escrow`
  - `refund_escrow`
  - `close_no_escrow`

## Escrow Webhook Ledger (B-01j)

- Every incoming webhook event is persisted with original JSON payload in `escrow_webhook_events`.
- `eventId` is unique and used as hard deduplication key.
- Processing states:
  - `RECEIVED`
  - `PROCESSED`
  - `FAILED`
- Duplicate events return success response with `applied=false` and `deduplicated=true` without reapplying mutations.
- Failed processing attempts persist `failureCode` and `failureMessage` to improve operational debugging and replay analysis.

## Role Model and Authorization (B-01f)

- The project adopts a hybrid role model:
  - `accountType` for business identity (`INDIVIDUAL`, `STORE`, `CRAFTSMAN`)
  - `staffRole` for platform permissions (`NONE`, `MODERATOR`, `ADMIN`)
- Legacy `role` is kept temporarily for migration compatibility and external contract stability.
- Access control decisions now use `staffRole` only at runtime (backend middleware + frontend guards).
- Legacy `role` remains in payload/contracts for compatibility, but is not part of authorization decisions.
- Auth tokens now carry `accountType` and `staffRole` along with legacy `role`.
- Business profile updates force `accountType=STORE`; craftsman profile updates force `accountType=CRAFTSMAN`.
- Admin moderation supports both new actions (`set_staff_role`, `set_account_type`) and legacy `set_role` until full migration cleanup.
- Manual SQL migration script for existing environments is tracked at:
  - `backend/prisma/manual_migrations/2026-03-12_b01f_role_model.sql`

## Phone Verification (B-01g)

- Phone verification is implemented as authenticated self-verification with two-step OTP:
  - request OTP (`/auth/phone-verification/request`)
  - confirm OTP (`/auth/phone-verification/confirm`)
- OTP validity is 10 minutes and delivery channel is WhatsApp.
- WhatsApp delivery is currently mock-first via `WHATSAPP_PROVIDER=mock` and is designed to be replaced by a real provider adapter later.
- Pending phone verification intent is stored in Redis per user (`phone_verify_pending:<userId>`), and `phoneVerifiedAt` is set only after successful OTP confirmation.

## OAuth Foundation (B-01h)

- OAuth is implemented with a mock-first strategy for local/dev/test to keep delivery unblocked before final provider SDK integration.
- `OAUTH_MOCK_MODE` controls behavior:
  - `true`: request payload can provide `email/fullName/providerUserId` directly (no external provider call)
  - `false`: backend validates provider tokens against Google/Facebook APIs
- Social login links to existing users by verified email when provider-id is not linked yet.
- New social accounts created through OAuth are marked with `emailVerifiedAt` immediately because provider identity is treated as verified in this phase.
- OAuth login reuses the same session/cookie contract as password login.

## Identity Verification Workflow (B-01i)

- Identity verification is modeled as an explicit request lifecycle instead of a single boolean flag.
- User status is stored on `users` as `identityVerificationStatus` (`NONE`, `PENDING`, `VERIFIED`, `REJECTED`) plus `identityVerifiedAt` for trust/badge display.
- Detailed submissions are stored in `identity_verification_requests` to keep review traceability (`documentType`, masked number, URLs, notes, reviewer fields).
- Submission is blocked when user status is `PENDING` or `VERIFIED`.
- Resolution actions are `approve` and `reject`; approval sets user status to `VERIFIED`, rejection sets status to `REJECTED`.
- Admin resolution endpoint is restricted to `StaffRole.ADMIN` (moderators can view queue but cannot resolve).
