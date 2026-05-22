# Central IT Planner

Project management web app (Epics → Features → Stories → Tasks).

## Stack

- **API**: Fastify + TypeScript (`apps/api`)
- **Web**: Vite + React + TypeScript (`apps/web`)
- **Shared**: TypeScript types (`packages/shared`)
- **DB**: PostgreSQL 16 (via Docker Compose)
- **Monorepo**: pnpm workspaces

## Prerequisites

- Node.js ≥ 20
- pnpm ≥ 9
- Docker (for Postgres)

## Quickstart

```bash
pnpm install
docker compose up -d postgres
pnpm --filter @centralit/api dev
pnpm --filter @centralit/web dev
```

## Scripts

- `pnpm build` — build every workspace
- `pnpm lint` — lint every workspace
- `pnpm typecheck` — typecheck every workspace
- `pnpm format` — prettier write
