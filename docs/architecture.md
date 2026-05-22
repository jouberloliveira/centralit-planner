# Architecture

Central IT Planner is a small but opinionated three-tier system:

1. A **React SPA** (`apps/web`) talks to a single REST API.
2. A **Fastify API** (`apps/api`) enforces auth, validates payloads, and orchestrates database access.
3. **PostgreSQL 16** stores users, projects, memberships, and the polymorphic `work_items` table.

The shared **Zod schemas** in `packages/shared` are the single source of truth for request/response shapes — both the API (validation + OpenAPI generation) and the web client (forms + React Query) import the same `*Schema` definitions.

---

## System diagram

```mermaid
flowchart LR
    Browser["Browser\n(React SPA)"]
    API["Fastify API\n@fastify/jwt + zod"]
    Prisma["Prisma Client"]
    DB[("PostgreSQL 16")]

    Browser -- "JSON over HTTPS\nAuthorization: Bearer <jwt>" --> API
    API -- "Bcrypt hash + verify" --> API
    API -- "Prisma queries" --> Prisma
    Prisma -- "SQL" --> DB

    subgraph Shared["packages/shared"]
        Z[("Zod schemas\nTypeScript types")]
    end
    Z -.types.-> Browser
    Z -.types.-> API
```

### Trust boundaries

- **Browser ↔ API:** authenticated by short-lived JWT in the `Authorization` header. CORS is a strict allow-list (no `*`); credentials are enabled. See `apps/api/src/app.ts` and `apps/api/src/env.ts`.
- **API ↔ DB:** single connection string in `DATABASE_URL`. Prisma is the only path into the database; raw SQL is restricted to migrations.
- **Object-level authorization:** every project-scoped read/write call funnels through `assertProjectAccess(...)` (`apps/api/src/lib/access.ts`), which checks the caller's `ProjectMembership.role`. This is the IDOR mitigation from CEN-21.

---

## Data model

```mermaid
erDiagram
    USER ||--o{ PROJECT_MEMBERSHIP : "has"
    USER ||--o{ WORK_ITEM : "assigned to"
    PROJECT ||--o{ PROJECT_MEMBERSHIP : "grants"
    PROJECT ||--o{ WORK_ITEM : "contains"
    WORK_ITEM ||--o{ WORK_ITEM : "parent of"

    USER {
      uuid id PK
      string email UK
      string name
      string password_hash
      timestamptz created_at
      timestamptz updated_at
    }
    PROJECT {
      uuid id PK
      string key UK
      string name
      string description
      timestamptz created_at
      timestamptz updated_at
    }
    PROJECT_MEMBERSHIP {
      uuid user_id PK,FK
      uuid project_id PK,FK
      enum role "OWNER | WRITER | READER"
      timestamptz created_at
    }
    WORK_ITEM {
      uuid id PK
      enum type "EPIC | FEATURE | USER_STORY | TASK"
      string title
      string description
      enum status "BACKLOG | TODO | IN_PROGRESS | IN_REVIEW | DONE | CANCELLED"
      enum priority "CRITICAL | HIGH | MEDIUM | LOW"
      jsonb attributes
      uuid project_id FK
      uuid parent_id FK
      uuid assignee_id FK
      timestamptz created_at
      timestamptz updated_at
    }
```

Source of truth: `apps/api/prisma/schema.prisma` (the Prisma schema) and the SQL migrations in `apps/api/prisma/migrations/`.

### Why one polymorphic `work_items` table?

Epics, Features, Stories, and Tasks share 90% of their columns (title, status, priority, assignee, timestamps, project scope) and 100% of their lifecycle. Splitting them into four tables would require:

- Four sets of CRUD endpoints (or runtime dispatch on a discriminator anyway).
- Hand-written `UNION ALL` views for any cross-type list (kanban boards, search).
- Foreign keys per pair (Epic→Feature, Feature→Story, ...), or a polymorphic association with the same `CHECK`-constraint problem.

The single-table approach keeps queries trivial — one `WHERE type = ?` for filters, one self-referential `parent_id` for hierarchy — and the kind-specific rules (Task cannot parent an Epic) are enforced in code:

- Application-level enforcement: `apps/api/src/db/workItems.ts` → `assertParentAllowed()`.
- Database-level enforcement: a CHECK constraint added in the init SQL migration (Prisma does not model CHECKs natively).

### Hierarchy rules

```mermaid
graph TD
    Root((root)) --> Epic[EPIC]
    Root --> Feature[FEATURE]
    Epic --> Feature
    Feature --> Story[USER_STORY]
    Epic --> Story
    Story --> Task[TASK]
    Feature --> Task
    Epic --> Task
```

| Child        | Allowed parents                  |
| ------------ | -------------------------------- |
| `EPIC`       | _none_ (root)                    |
| `FEATURE`    | `EPIC`, or no parent (root)      |
| `USER_STORY` | `FEATURE`, `EPIC`                |
| `TASK`       | `USER_STORY`, `FEATURE`, `EPIC`  |

The matrix lives in `apps/api/src/db/workItems.ts` (`VALID_PARENT_TYPES`). Any move/create that violates it throws `WorkItemParentRuleError`, which the route handlers translate to **HTTP 400** `BAD_REQUEST`.

### Project membership = the access boundary

A user can only see a project (and the work items inside it) if they have a `ProjectMembership` row. The role decides what they can do:

| Role     | List / read project & items | Create / update / delete items | Update project | Delete project |
| -------- | :-------------------------: | :----------------------------: | :------------: | :------------: |
| `READER` |             ✅              |               ❌               |       ❌       |       ❌       |
| `WRITER` |             ✅              |               ✅               |       ✅       |       ❌       |
| `OWNER`  |             ✅              |               ✅               |       ✅       |       ✅       |

Creating a project inserts a membership row with `role = OWNER` for the caller in the same transaction.

---

## Request lifecycle

```mermaid
sequenceDiagram
    autonumber
    participant Client as Browser
    participant Helm as @fastify/helmet
    participant Cors as @fastify/cors
    participant JWT as @fastify/jwt
    participant Auth as requireAuth
    participant Route as Route handler
    participant Access as assertProjectAccess
    participant DB as Prisma → Postgres

    Client->>Helm: HTTP request
    Helm->>Cors: pass-through (security headers)
    Cors->>JWT: pass-through (origin allow-list)
    JWT->>Auth: parse Authorization
    Auth->>Route: req.user = { sub, email }
    Route->>Access: project membership check
    Access->>DB: SELECT role FROM project_memberships
    DB-->>Access: role | null
    Access-->>Route: ok | throws 403 FORBIDDEN
    Route->>DB: query/mutation
    DB-->>Route: row(s)
    Route-->>Client: 2xx JSON + x-request-id
```

Every error is translated by a single `setErrorHandler` (`apps/api/src/app.ts`) into the canonical envelope `{ error: { code, message, details }, requestId }`.

---

## Sequence: create a work item

```mermaid
sequenceDiagram
    autonumber
    participant Web as React Form
    participant API as POST /work-items
    participant Access as assertProjectAccess
    participant Repo as WorkItemRepository
    participant DB as Postgres

    Web->>API: { kind, title, projectId, parentId?, ... } + Bearer JWT
    API->>API: zod parse workItemCreateSchema
    API->>Access: role >= writer for projectId?
    Access->>DB: SELECT role FROM project_memberships WHERE user_id=? AND project_id=?
    DB-->>Access: role
    alt role missing or < writer
        Access-->>API: throw 403 FORBIDDEN
        API-->>Web: 403 { error: { code:"FORBIDDEN" } }
    else role ok
        opt parentId provided
            Repo->>DB: SELECT type, project_id FROM work_items WHERE id=?
            DB-->>Repo: parent row | null
            Repo->>Repo: assertParentAllowed(childKind, parentType)
            alt rule violation
                Repo-->>API: throw 400 BAD_REQUEST
                API-->>Web: 400 { error: { code:"BAD_REQUEST" } }
            end
        end
        opt assigneeId provided
            Repo->>DB: SELECT id FROM users WHERE id=?
            alt missing
                Repo-->>API: throw 404 NOT_FOUND
            end
        end
        Repo->>DB: INSERT INTO work_items (...)
        DB-->>Repo: row
        Repo-->>API: WorkItem
        API-->>Web: 201 WorkItem
    end
```

Key invariants enforced at this step:

- `req.body` matches `workItemCreateSchema` (Zod).
- The caller has `WRITER` (or `OWNER`) on `projectId`.
- If `parentId` is set: the parent exists, belongs to the same project, and the (childKind, parentKind) pair is in `VALID_PARENT_TYPES`.
- If `assigneeId` is set: the user exists.

---

## Sequence: move (reparent) a work item

```mermaid
sequenceDiagram
    autonumber
    participant Web as React UI
    participant API as POST /work-items/:id/move
    participant Access as assertProjectAccess
    participant Repo as WorkItemRepository
    participant DB as Postgres

    Web->>API: { parentId: <uuid | null> } + Bearer JWT
    API->>API: zod parse workItemMoveSchema
    API->>DB: SELECT id, type, project_id FROM work_items WHERE id=?
    DB-->>API: item | null
    alt item missing
        API-->>Web: 404 { error: { code:"NOT_FOUND" } }
    else item found
        API->>Access: role >= writer for item.project_id?
        Access->>DB: SELECT role FROM project_memberships
        DB-->>Access: role
        alt role missing or < writer
            Access-->>API: throw 403 FORBIDDEN
            API-->>Web: 403 { error: { code:"FORBIDDEN" } }
        else
            alt parentId == item.id
                API-->>Web: 400 "Work item cannot be its own parent"
            else parentId is null
                API->>DB: UPDATE work_items SET parent_id=NULL WHERE id=?
                DB-->>API: updated row
                API-->>Web: 200 WorkItem
            else parentId set
                API->>DB: SELECT type, project_id FROM work_items WHERE id=parentId
                DB-->>API: parent | null
                alt parent missing
                    API-->>Web: 404 "Parent not found"
                else parent in different project
                    API-->>Web: 400 "Parent belongs to a different project"
                else
                    API->>Repo: assertParentAllowed(item.type, parent.type)
                    alt rule violation
                        Repo-->>API: throw WorkItemParentRuleError
                        API-->>Web: 400 BAD_REQUEST
                    else ok
                        API->>DB: UPDATE work_items SET parent_id=? WHERE id=?
                        DB-->>API: updated row
                        API-->>Web: 200 WorkItem
                    end
                end
            end
        end
    end
```

Reparenting deliberately uses a dedicated `POST /:id/move` endpoint instead of allowing `parentId` on `PATCH /:id`: it forces every reparent to go through the hierarchy + cross-tenant + self-loop checks above, which would otherwise be easy to skip.

---

## Where to look in the code

| Concern                                | Where                                                        |
| -------------------------------------- | ------------------------------------------------------------ |
| Schemas (request/response)             | `packages/shared/src/index.ts`                               |
| Fastify app + plugins + error handler  | `apps/api/src/app.ts`                                        |
| Boot + graceful shutdown               | `apps/api/src/server.ts`                                     |
| Env validation                         | `apps/api/src/env.ts`                                        |
| Routes                                 | `apps/api/src/routes/{auth,projects,workItems,health}.ts`    |
| Authorization helper                   | `apps/api/src/lib/access.ts`                                 |
| Hierarchy rules + repository           | `apps/api/src/db/workItems.ts`                               |
| Password hashing                       | `apps/api/src/lib/password.ts`                               |
| HTTP error class + factories           | `apps/api/src/lib/errors.ts`                                 |
| DB schema                              | `apps/api/prisma/schema.prisma`                              |
| SQL migrations                         | `apps/api/prisma/migrations/`                                |
| Seed data                              | `apps/api/prisma/seed.ts`                                    |
| Threat model + STRIDE review           | `security/`                                                  |
