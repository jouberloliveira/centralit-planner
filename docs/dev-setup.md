# Dev Setup

This is the long-form companion to the [Quickstart](../README.md#quickstart). It covers environment variables, the Postgres dev container, seeding, and the test workflow.

---

## Prerequisites

- **Node.js ≥ 20** (the API uses native `node:` modules and `crypto.randomUUID()` defaults).
- **pnpm ≥ 9** — `corepack enable && corepack prepare pnpm@9.15.4 --activate` is the easiest install path.
- **Docker** (or any Postgres 16 you already trust). The supplied `docker-compose.yml` boots Postgres 16-alpine with credentials `planner:planner` against database `planner` on `localhost:5432`.

Optional but recommended:

- **jq** + **curl** for the worked-example flows in [docs/api.md](api.md).
- **Prisma Studio** (`pnpm --filter @centralit/api db:studio`) for quick DB inspection.

---

## First-time setup

```bash
git clone https://github.com/<org>/centralit-planner.git
cd centralit-planner
pnpm install
```

`pnpm install` runs `prisma generate` for `@centralit/api` as a `postinstall` hook, so the typed Prisma client is available immediately.

### Start Postgres

```bash
docker compose up -d postgres
docker compose ps   # status: healthy
```

The container is named `centralit-planner-postgres` and the volume `centralit-planner-pgdata`. Delete the volume to start over:

```bash
docker compose down
docker volume rm centralit-planner-pgdata
```

### Configure the API

```bash
cp apps/api/.env.example apps/api/.env
```

Open `apps/api/.env` and adjust the values for your environment.

| Variable         | Required | Default                                                            | Notes                                                                                                                                                                              |
| ---------------- | :------: | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`   |    ✅    | `postgresql://planner:planner@localhost:5432/planner?schema=public` | Standard Prisma connection string. Match whatever you have docker-compose pointing at.                                                                                             |
| `PORT`           |          | `3001`                                                             | HTTP port for the Fastify server.                                                                                                                                                  |
| `HOST`           |          | `0.0.0.0`                                                          | Bind host. Use `127.0.0.1` to keep it loopback-only on shared dev boxes.                                                                                                           |
| `JWT_SECRET`     |    ✅    | _(empty in example)_                                               | **Must be ≥ 32 characters.** Generate with `openssl rand -base64 48`. In production, refuses values containing `change/default/example/placeholder` (see `apps/api/src/env.ts`).   |
| `JWT_EXPIRES_IN` |          | `7d`                                                               | Standard `ms`-style duration (e.g. `30m`, `12h`, `1d`).                                                                                                                            |
| `CORS_ORIGIN`    |    ✅    | _(comma-separated allow-list)_                                     | `*` is **forbidden** because the API sends credentials. Example: `CORS_ORIGIN="http://localhost:5173"`. Multiple origins: `"a.example,b.example"`.                                 |
| `LOG_LEVEL`      |          | `info`                                                             | `fatal`/`error`/`warn`/`info`/`debug`/`trace`/`silent`. `info` and below use pino-pretty in non-production.                                                                        |
| `NODE_ENV`       |          | `development`                                                      | `development`/`test`/`production`. `production` adds the JWT-secret hardening checks above.                                                                                        |

### Run migrations + seed

```bash
pnpm --filter @centralit/api db:migrate    # prisma migrate dev (interactive)
pnpm --filter @centralit/api db:seed       # demo project + work items
```

The seed (`apps/api/prisma/seed.ts`) recreates a demo project `ACME` ("Acme Web Redesign") with a small epic/feature/story/task tree. Re-running the seed wipes the work items, projects, and users tables first.

### Run the API + Web

In two terminals:

```bash
# Terminal 1
pnpm --filter @centralit/api dev
# tsx watch → http://localhost:3001
# Swagger UI at http://localhost:3001/docs
# Health probe at http://localhost:3001/health

# Terminal 2
pnpm --filter @centralit/web dev
# Vite → http://localhost:5173
```

The web app expects the API origin to be set in its own `.env` (typically `VITE_API_URL=http://localhost:3001`). Adjust `CORS_ORIGIN` on the API to match.

---

## Common workflows

### Reset the database

```bash
pnpm --filter @centralit/api db:reset   # prisma migrate reset --force
pnpm --filter @centralit/api db:seed
```

### Open Prisma Studio

```bash
pnpm --filter @centralit/api db:studio
# http://localhost:5555
```

### Create a new migration

After editing `apps/api/prisma/schema.prisma`:

```bash
pnpm --filter @centralit/api db:migrate    # prompts for a name; writes a new migration folder
```

For deploy-only environments (CI, prod), use `db:migrate:deploy` — it runs pending migrations without prompting.

### Regenerate the Prisma client only

```bash
pnpm --filter @centralit/api db:generate
```

---

## Testing

The API uses [Vitest](https://vitest.dev). Tests assume a Postgres available at `DATABASE_URL` — use the docker-compose Postgres or override `DATABASE_URL` in `apps/api/.env.test` if you want a separate test DB.

```bash
pnpm --filter @centralit/api test          # single run
pnpm --filter @centralit/api test:watch    # watch mode
```

Where to find them:

- `apps/api/tests/api.test.ts` — happy-path integration coverage across auth, projects, work-items, and the move endpoint.
- `apps/api/tests/idor.test.ts` — object-level authorization regressions from CEN-21.

The web workspace exposes `pnpm --filter @centralit/web typecheck` and `pnpm --filter @centralit/web build` for quick CI smoke; component tests are not wired up yet (tracked under the UI epic).

Whole-monorepo gates from the root:

```bash
pnpm lint
pnpm typecheck
pnpm build
pnpm format:check
```

CI runs the same four commands (see `.github/workflows/`).

---

## Troubleshooting

| Symptom                                                                 | Likely cause / fix                                                                                                |
| ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `Environment variable not found: DATABASE_URL`                          | Missing `apps/api/.env` — copy from `.env.example`.                                                               |
| `JWT_SECRET must be ≥32 chars and never defaulted`                      | `JWT_SECRET` empty or too short. `openssl rand -base64 48` and paste the result.                                  |
| `CORS_ORIGIN=* is forbidden ...`                                        | Replace `*` with the explicit web origin (e.g. `http://localhost:5173`). Multiple origins are comma-separated.    |
| `buildApp: corsOrigin must be a non-empty allow-list`                   | Same as above — `CORS_ORIGIN` resolved to an empty list after trimming.                                           |
| `ECONNREFUSED 127.0.0.1:5432` on `db:migrate`                           | Postgres container not running. `docker compose up -d postgres` and wait for `docker compose ps` to show healthy. |
| `P2002 unique constraint` on register                                   | Email already exists. Use a fresh one or delete the row via Prisma Studio.                                        |
| 401 from `/auth/me` immediately after login                             | Missing `Authorization: Bearer <token>` header — TanStack Query needs the token wired into the axios interceptor. |
| Web shows CORS errors despite a correct `CORS_ORIGIN`                   | Browser caches preflight; hard-reload or restart the API after editing `CORS_ORIGIN`.                             |
| `relation "work_items" does not exist`                                  | Migrations haven't run. `pnpm --filter @centralit/api db:migrate`.                                                |

If you hit something not listed here, file an issue (or PR a row).

---

## Production checklist

Not strictly part of dev setup, but worth noting once you ship:

- `NODE_ENV=production` enables the stricter JWT secret refusal (see `apps/api/src/env.ts`).
- Pin `CORS_ORIGIN` to the production web origin only.
- Run `db:migrate:deploy` (not `db:migrate dev`) on prod databases.
- Keep `pino` JSON logging on (the dev `pino-pretty` transport is bypassed in production).
- Front the API with a TLS-terminating reverse proxy; the API itself speaks plain HTTP.
