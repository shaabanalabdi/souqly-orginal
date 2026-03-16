# Souqly Architecture v1

Souqly follows a modular monolith architecture:

- `backend/src/modules/*`: domain modules and HTTP layers
- `backend/src/shared/*`: cross-cutting middleware and utilities
- `frontend/src/*`: application shell, pages, components, services, stores

Infrastructure layout:

- MySQL for primary data
- Redis for caching/rate-limits/OTP state
- Socket.IO for realtime chat
- Nginx as reverse proxy

The codebase is organized to allow future extraction of high-traffic modules
into independent services without changing public API contracts.
