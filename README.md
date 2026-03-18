# Souqly

Professional classified ads marketplace for Arabic-speaking markets.

## Target Markets

Syria, Iraq, Jordan, Lebanon, Palestine

## Stack

- Frontend: React 18, Vite 5, TypeScript, SCSS Modules, Zustand, i18next
- Backend: Node.js 20, Express 4, TypeScript, Prisma, MySQL 8, Redis 7
- Realtime: Socket.IO 4
- Infra: Docker, Nginx

## Project Structure

```text
souqly/
├── backend/
├── frontend/
├── nginx/
├── docker-compose.yml
├── docker-compose.dev.yml
├── ASSUMPTIONS.md
├── ARCHITECTURE.md
└── CHANGELOG.md
```

`souqly/` is the canonical repository root for active development.
For current cleanup/validation baseline, see `REPO_STATUS.md`.

## Quick Start

### Docker Stack (Recommended)

```bash
docker compose up -d --build
```

App URL: `http://localhost`  
API URL: `http://localhost/api/v1`

### 1) Infrastructure

```bash
docker compose up -d mysql redis
```

### 2) Backend

```bash
cd backend
cp .env.example .env
npm install
npm run db:generate
npm run build
npm run dev
```

Backend URL: `http://localhost:5000`

### 3) Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend URL: `http://localhost:5173`

### 4) Health Check

```bash
curl http://localhost:5000/api/v1/health
```
