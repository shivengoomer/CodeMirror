# CodeMirror
CodeMirror is a browser extension plus dashboard for tracking recurring coding mistakes across LeetCode, GeeksForGeeks, and HackerRank.
This repository is currently scaffolded for Phase 1 of the master build prompt: project structure, configuration, and tooling only. Business logic starts in Phase 2.

## Structure

```text
extension/   Browser extension built with TypeScript and esbuild
backend/     FastAPI backend with SQLAlchemy, asyncpg, and Alembic
dashboard/   Next.js 14 dashboard
```

## Local Setup

```bash
cp .env.example .env
docker compose up --build
```

Services:

- Backend: `http://localhost:8000`
- Dashboard: `http://localhost:3000`
- Postgres: `localhost:5432`

## Extension Build

```bash
cd extension
npm install
npm run build
```

Load `extension/dist` as an unpacked browser extension after building.
