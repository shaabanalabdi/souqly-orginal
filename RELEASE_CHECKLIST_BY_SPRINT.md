# Souqly Release Checklist By Sprint

Date: 2026-03-19
Scope: Sprint 0 to Sprint 8

## Usage
1. Duplicate this checklist for each sprint branch/tag.
2. Mark each item as done only with evidence (PR link, job URL, test report).
3. A sprint is releasable only if all gates pass.

## Global Definition of Done
- [ ] Backend lint/build/test pass in CI.
- [ ] Frontend lint/build pass in CI.
- [ ] API contracts updated for changed endpoints.
- [ ] Audit logs present for privileged actions.
- [ ] i18n impact validated for Arabic and English.
- [ ] Security checks rerun for changed surfaces.
- [ ] Changelog and tracker updated.

## Sprint 0 - Platform Foundation
- [ ] CI pipeline executes required quality gates.
- [ ] Structured logging with correlation IDs enabled.
- [ ] Seed data for countries/cities/categories/subcategories/attributes is deterministic.
- [ ] Docker/dev stack startup documented and verified on clean machine.

## Sprint 1 - Auth RBAC Identity Core
- [ ] staffRole-only authorization paths verified.
- [ ] Legacy role mutation paths removed or blocked.
- [ ] Refresh token rotation and revocation validated.
- [ ] Auth failure-rate monitoring and alerts configured.

## Sprint 2 - Listings and Moderation
- [ ] Listing validation matrix passes (title/description/price/images/location/attributes).
- [ ] INDIVIDUAL monthly quota enforcement tested at boundary (49, 50, 51).
- [ ] STORE subscription enforcement tested for ACTIVE and EXPIRED states.
- [ ] Moderation actions require reason and write immutable audit entries.

## Sprint 3 - Search Map Discovery
- [ ] URL-synced filter state tested for reload/share.
- [ ] Map/list toggle keeps active filters.
- [ ] Nearby search behavior tested for granted/denied geolocation.
- [ ] Query performance benchmark captured for high-cardinality filters.

## Sprint 4 - Realtime Chat Offers Notifications
- [ ] Thread uniqueness guaranteed under concurrent creation attempts.
- [ ] Message send retry/reconnect behavior tested.
- [ ] Offer and phone request permission/rate-limit checks pass.
- [ ] Notification persistence and unread counters consistent across sessions/devices.

## Sprint 5 - Trust Safety Verification
- [ ] OTP TTL and retry limits validated.
- [ ] ID verification moderation workflow validated end-to-end.
- [ ] Reports abuse protections validated (cooldown/rate-limit).
- [ ] Trust score recomputation triggers validated for key events.

## Sprint 6 - Store Craftsman Subscription
- [ ] Business profile required fields validated by country rules.
- [ ] Subscription entitlement checks block unauthorized publish/feature flows.
- [ ] Craftsman profile constraints validated (profession/experience/portfolio).
- [ ] Public store/craftsman pages verified for mobile and desktop.

## Sprint 7 - Deals Escrow Disputes
- [ ] Deal state-machine transition tests pass (including invalid transitions).
- [ ] Monetary endpoints require Idempotency-Key and return idempotent responses.
- [ ] Ledger entries created for hold/release/refund operations.
- [ ] Dispute queue and resolution actions fully auditable.

## Sprint 8 - Admin Security Go-Live
- [ ] Admin config versioning and rollback flow validated.
- [ ] Security closure checklist completed and signed off.
- [ ] Staging to production deployment with rollback drill executed.
- [ ] Backups, PITR, and restore drill evidence attached.

## Release Exit Criteria
- [ ] No unresolved P0 incidents.
- [ ] No unresolved critical security findings.
- [ ] All migration scripts applied and verified in staging.
- [ ] Webhook failure handling and replay process validated.
- [ ] On-call runbook updated with current escalation matrix.