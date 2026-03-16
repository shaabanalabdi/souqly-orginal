# Souqly Repository Status

Last updated: 2026-03-12

## Canonical Scope

- Active project root: `souqly/`
- Active backend path: `backend/`
- Active frontend path: `frontend/`
- Active infra path: `nginx/`

## Cleanup Decisions

- Legacy nested `souqly/souqly/` directory was a workspace duplicate and has been removed.
- Development continues only at the repository root level (`backend/`, `frontend/`, `nginx/`).
- No `backend2` / `frontend2` directories exist in the current workspace tree.

## Removed Inside Active Frontend

- `frontend/src/App.module.scss` (unused template file)
- `frontend/src/assets/react.svg` (unused template file)

## Validation Baseline

Run from active project paths:

```bash
# backend
cd backend
npm run lint
npm run build
npm test -- --runInBand

# frontend
cd ../frontend
npm run lint
npm run build
```

Current baseline status: passing (109/109 backend tests).

## Resume Point

- Product backlog resume task: `B-01f` from `TODO_PROGRESS.md` (post-escrow stabilization scope selection).
