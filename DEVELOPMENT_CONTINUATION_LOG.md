# Souqly Development Continuation Log

Last updated: 2026-03-19
Reference PRD: Souqly PRD v9.0 Master Final

## Purpose

This file is the handoff log for continuing Souqly development from another machine without losing context.
It records what has already been implemented, what was verified, what changed from earlier assumptions, and what remains next.

## Source Of Truth

- Product scope is now aligned to PRD v9.0.
- Launch is communication-first and trust-first.
- No internal money handling at launch.
- Deals document agreement only.
- Search in MVP is MySQL-oriented.
- Listing lifecycle must support `DRAFT`, `PENDING`, `ACTIVE`, `REJECTED`, `EXPIRED`, `SOLD`, `ARCHIVED`.
- Individual monthly listing limit must be configurable from admin/system config.

## Major Work Already Completed

### 1. Launch realignment to PRD v9.0

- Reverted datasource assumptions to `MySQL` in `backend/prisma/schema.prisma`.
- Added `fullTextIndex` preview feature for MySQL full-text support.
- Listing statuses aligned to:
  - `DRAFT`
  - `PENDING`
  - `ACTIVE`
  - `REJECTED`
  - `EXPIRED`
  - `SOLD`
  - `ARCHIVED`
- Deal statuses aligned to include `RATED`.
- Internal escrow flows were disabled at launch via feature flag default.
- Launch behavior now treats deals as agreement documentation, not money holding.

### 2. Auth / security / entitlement fixes

- Registration no longer trusts frontend-selected commercial account privileges.
- Optional auth support was added for listing details visibility decisions.
- Access token persistence in frontend local storage was removed.
- CSRF/idempotency headers were wired through backend CORS policy.
- Content sanitization was added and reused in sensitive backend flows.

### 3. Listings lifecycle and policy fixes

- Individual monthly quota is now loaded from admin/system config helper with launch fallback `10`.
- Store publishing is no longer blocked by subscription in launch mode.
- Craftsman publishing remains restricted to service categories.
- Listing deletion was converted to archiving.
- Contact visibility default is now `APPROVAL` for both phone and WhatsApp.
- Contact approval flow now exists in chat and affects listing contact visibility.

### 4. Communication and negotiation

- Phone request approval workflow was implemented end-to-end.
- Chat typing indicator was implemented with socket support.
- Persistent notifications were added for more deal/dispute events.
- Public seller/user profile support was expanded.

### 5. Verification / media / profile fixes

- Verification documents are now expected from managed uploads rather than arbitrary external URLs.
- Store analytics were wired into runtime events instead of remaining schema-only.
- Craftsman leads tracking was implemented in runtime.

### 6. This session: next PRD alignment pass

- Separate listing-level `phoneNumber` and `whatsappNumber` support was added to backend validation and service logic.
- Listing details now reveal listing-specific contact numbers instead of always falling back to the user phone.
- Expired listings are now reconciled before reads and list operations.
- `POST /api/v1/listings/:id/renew` was added.
- Frontend `My Listings` now includes an `EXPIRED` tab and renew action.
- Frontend create/edit listing flows now send listing-level phone and WhatsApp numbers.
- Search now attempts MySQL full-text candidate filtering with safe fallback to dialect-aware contains search.

### 7. This session: draft/publish and scheduler pass

- Added backend support for `saveAsDraft` during listing creation.
- Added `POST /api/v1/listings/:id/publish` for explicit `DRAFT -> ACTIVE/PENDING` publishing.
- Draft publishing now applies entitlement checks and anti-fraud evaluation at publish time.
- Draft updates no longer auto-promote status during edit.
- Added recurring listing expiration scheduler in `backend/src/shared/jobs/listingExpiration.job.ts`.
- Wired the scheduler into backend startup in `backend/src/server.ts`.
- Frontend create listing flow now exposes `Save as Draft`.
- Frontend `My Listings` now includes a `DRAFT` tab with a publish action.

## Key Files Touched

### Backend

- `backend/prisma/schema.prisma`
- `backend/src/shared/jobs/listingExpiration.job.ts`
- `backend/src/modules/listings/listing.validation.ts`
- `backend/src/modules/listings/listing.service.ts`
- `backend/src/modules/listings/listing.controller.ts`
- `backend/src/modules/listings/listing.routes.ts`
- `backend/src/modules/chats/chat.service.ts`
- `backend/src/modules/chats/chat.controller.ts`
- `backend/src/modules/chats/chat.routes.ts`
- `backend/src/modules/deals/deal.controller.ts`
- `backend/src/modules/deals/deal.service.ts`
- `backend/src/shared/config/systemConfig.ts`
- `backend/src/shared/middleware/authenticate.ts`
- `backend/src/shared/utils/sanitize.ts`

### Frontend

- `frontend/src/types/domain.ts`
- `frontend/src/services/listings.service.ts`
- `frontend/src/services/chats.service.ts`
- `frontend/src/pages/CreateListingPage.tsx`
- `frontend/src/pages/EditListingPage.tsx`
- `frontend/src/pages/MyListingsPage.tsx`
- `frontend/src/pages/ChatPage.tsx`
- `frontend/src/pages/DealsPage.tsx`
- `frontend/src/pages/AdminPage.tsx`

## Verification Completed So Far

### Backend

- `npm run db:generate`
- `npm run build`
- `npm test -- --runInBand`

Current last verified backend result:

- Build: passing
- Tests: `131/131` passing
- Listing expiration scheduler integrated: yes

### Frontend

- `npm run build`

Current last verified frontend result:

- Build: passing

## Current Known Gaps

These are not all blockers, but they are the main remaining PRD-alignment items.

### High-value next items

1. Expand draft support from current explicit save/publish to fuller autosave and partial-step recovery.
2. Add explicit renew/expire UX polish beyond the current `My Listings` tabs.
3. Ensure search ranking is closer to production expectations on top of current full-text candidate filtering.
4. Revisit document encoding issues in some legacy UI files if they appear outside terminal rendering.
5. Refresh older docs that still reflect pre-v9 assumptions.

### Broader remaining items from earlier rounds

1. Some documentation files still reflect older assumptions and need refresh.
2. External payment/provider integration remains intentionally out of launch scope.
3. Some large service files still need deeper modular cleanup if a later refactor pass is planned.

## Resume Commands On Another Machine

From repository root:

```powershell
cd backend
npm install
npm run db:generate
npm run build
npm test -- --runInBand

cd ..\\frontend
npm install
npm run build
```

## Recommended Next Work Order

1. Expand draft persistence beyond the current full-form save to true multi-step autosave.
2. Add admin-configurable listing duration if that policy should move out of the 30-day launch default.
3. Improve search ordering/relevance on top of the current MySQL full-text candidate filtering.
4. Refresh this file after each verified milestone.

## Notes

- The working tree is intentionally dirty because this project is mid-refactor.
- Do not reset unrelated files.
- Keep using the PRD v9.0 as the final product scope reference.
