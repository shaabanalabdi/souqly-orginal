# Souqly Sprint 1 Execution Pack

Date: 2026-03-19
Sprint: 1 (Auth RBAC Identity Core)
Duration: 10 working days
Goal: finalize staffRole-only authorization contract and harden auth/session security for production readiness.

## Sprint Objective
- Remove legacy role decision paths from runtime authorization.
- Keep API behavior backward-compatible where needed, but deprecate legacy role input usage.
- Harden refresh-token lifecycle and revocation behavior.
- Ship with tests, docs, and rollout safeguards.

## Scope In
- Backend authorization middleware and policy checks.
- Admin user moderation action contract updates.
- Session/refresh token hardening.
- Contract and architecture documentation sync.
- Regression tests for auth and admin role/account flows.

## Scope Out
- New product features unrelated to auth/RBAC.
- Payment, map UX, SEO hardening.
- Notification persistence redesign.

## Detailed Stories

### S1-01 StaffRole-only authorization contract
Description:
Migrate any remaining runtime authorization behavior to staffRole-only checks and block legacy role mutation paths.

Acceptance Criteria:
- All authorization middleware decisions use staffRole and ownership checks only.
- No runtime code path grants moderator/admin privileges based on legacy role.
- Admin role/account mutation endpoint no longer accepts legacy set_role action.
- Existing tests for admin moderation and protected routes pass after migration.

Implementation Tasks:
- Scan backend modules for legacy role checks in policies, services, and controllers.
- Replace remaining role-based checks with staffRole + accountType policies.
- Remove set_role branch from admin moderation action schema/handler.
- Keep safe output compatibility (if needed) but prevent role-based input decisions.
- Add migration-safe deprecation warnings to API docs.

Test Plan:
- Unit: authorization middleware decision matrix by staffRole/accountType.
- Integration: ADMIN can mutate user role/account; MODERATOR cannot mutate roles.
- Regression: protected endpoints deny access when staffRole=NONE.

Definition of Done:
- Lint/build/tests pass.
- No legacy role-input authorization path remains.

### S1-02 Session and token security hardening
Description:
Strengthen refresh token rotation and revocation behavior to prevent replay and stale-session abuse.

Acceptance Criteria:
- Refresh token rotation is enforced on every refresh call.
- Old refresh token chain is invalid after logout or password change.
- Revocation events are auditable and correlated by user/session.

Implementation Tasks:
- Validate refresh token rotation in auth service.
- Ensure logout/password-change invalidates session records consistently.
- Add structured log events for token refresh/revoke/failure.
- Add abuse guard checks for repeated invalid refresh attempts.

Test Plan:
- Integration: refresh token rotates; old token rejected.
- Integration: logout invalidates refresh flow.
- Integration: password change invalidates active refresh tokens.

Definition of Done:
- Security acceptance tests pass.
- Logs provide traceable events with correlation IDs.

### S1-03 Auth contract documentation sync
Description:
Synchronize docs and endpoint contracts to reflect finalized staffRole-first model.

Acceptance Criteria:
- API docs no longer instruct clients to use legacy role input paths.
- Architecture and assumptions docs reflect staffRole runtime policy.
- Changelog and progress trackers contain Sprint 1 updates.

Implementation Tasks:
- Update API contract docs for admin moderation and auth payloads.
- Update architecture/assumptions docs for role model language.
- Add migration notes for consumers depending on legacy fields.

Test Plan:
- Documentation consistency check against implemented endpoints.
- Manual review of auth payload examples.

Definition of Done:
- Docs merged with implementation changes.

## Dependency Graph
1. S1-01 must complete before S1-03 final docs freeze.
2. S1-02 can run in parallel with S1-01 but requires final auth payload review before close.
3. Regression test suite is the release gate for all stories.

## Day-by-Day Plan
1. Day 1: code scan and inventory of remaining legacy role checks.
2. Day 2: remove set_role input contract path and update validators.
3. Day 3: patch middleware/services to staffRole-only behavior.
4. Day 4: refresh-token rotation/revocation hardening.
5. Day 5: add/adjust integration tests.
6. Day 6: stabilize failures and edge-case handling.
7. Day 7: docs synchronization.
8. Day 8: full validation run (lint/build/test backend + lint/build frontend).
9. Day 9: staging verification and smoke checks.
10. Day 10: release readiness review and closure notes.

## Risks and Mitigation
- Risk: hidden legacy role dependency breaks admin workflows.
Mitigation: search-and-test matrix over all admin endpoints.

- Risk: session invalidation regressions lock out legitimate users.
Mitigation: explicit integration tests for refresh/logout/password change flows.

- Risk: docs drift from behavior.
Mitigation: enforce docs update checklist in PR template for auth/admin changes.

## Sprint 1 Exit Checklist
- [ ] All Sprint 1 stories meet acceptance criteria.
- [ ] Backend lint/build/test pass.
- [ ] Frontend lint/build pass.
- [ ] Staging smoke tests pass.
- [ ] No P0/P1 security regression introduced.
- [ ] Changelog and progress trackers updated.
