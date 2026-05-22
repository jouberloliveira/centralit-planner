# Contributing

Thanks for working on Central IT Planner. This document describes how we name branches, write commits, and ship pull requests.

The goal is **small, reviewable, traceable changes**. If something here gets in the way of that, open a PR to change it.

---

## Issue tracker

Work is tracked in the Central IT internal tracker. Issues use the `CEN-` prefix (e.g. `CEN-28`). Every PR should reference at least one issue.

Internal link format: `/CEN/issues/CEN-28` — reviewers will be able to click through directly.

---

## Branches

We work off `dev`. `main` is the deploy target and only receives merges from `dev` (or hotfix branches).

### Branch naming

```
<type>/<issue>-<short-slug>
```

| Type        | When to use                                                                                                  |
| ----------- | ------------------------------------------------------------------------------------------------------------ |
| `feat/`     | New user-visible capability or non-trivial addition.                                                         |
| `fix/`      | Bug fix that changes runtime behaviour.                                                                      |
| `docs/`     | Documentation-only changes (this branch is `docs/cen-28-readme-and-docs`).                                   |
| `chore/`    | Tooling, config, dependency bumps with no behaviour change.                                                  |
| `refactor/` | Internal restructuring with no behaviour change.                                                             |
| `test/`     | Adding or repairing tests only.                                                                              |
| `security/` | Security hardening (e.g. `security/review-cen-14`).                                                          |

Examples that have shipped:

```
feat/db-schema
feat/web-scaffold
fix/cen-19-cors-allowlist
fix/cen-20-jwt-secret
fix/cen-21-idor
security/review-cen-14
docs/cen-28-readme-and-docs
```

Keep slugs short and kebab-case. Lowercase. No trailing dates.

### Lifecycle

1. Open or pick up an issue.
2. Branch off the latest `dev`:
   ```bash
   git switch dev
   git pull --ff-only
   git switch -c feat/cen-XX-short-slug
   ```
3. Work in small commits (see below).
4. Push and open a PR targeting `dev`.
5. Address review feedback in additional commits — don't force-push over published history unless the reviewer asks.
6. Once the PR is merged, delete the remote branch.

---

## Commits

We follow [Conventional Commits](https://www.conventionalcommits.org/) v1.0:

```
<type>(<scope>): <short summary>

<body — wrap at 72 cols, optional but expected for non-trivial changes>
```

### Types

| Type       | Meaning                                              |
| ---------- | ---------------------------------------------------- |
| `feat`     | New feature.                                         |
| `fix`      | Bug fix.                                             |
| `docs`     | Documentation only.                                  |
| `chore`    | Tooling, build, dep bumps.                           |
| `refactor` | Internal change, no behaviour difference.            |
| `test`     | Tests only.                                          |
| `security` | Security-sensitive change (often paired with `fix`). |
| `perf`     | Performance-only change.                             |
| `style`    | Formatting (Prettier already covers most of this).   |

### Scopes

Use the closest unit of code:

- `api`, `web`, `shared`, `db`, `auth`, `ci`, `docs`, `infra`, …

### Real examples from this repo

```
fix(api): object-level authorization on /projects and /work-items (CEN-21)
security(api): require strong JWT_SECRET and forbid dev placeholders in prod (CEN-20)
feat(backend): REST CRUD endpoints + JWT auth (CEN-11)
feat(frontend): app scaffold, routing, design system (CEN-12)
```

### Rules of thumb

- **Imperative mood:** "add login", not "added login" or "adds login".
- **Subject ≤ 72 chars**, no trailing period.
- Reference the issue identifier in either the subject (preferred) or the body footer (`Refs: CEN-28`).
- One logical change per commit. If you have to write the body using "and", consider splitting.
- If the change is for an LLM-driven agent (Paperclip, Claude), add `Co-Authored-By:` lines so the audit trail is clear.

---

## Pull requests

### Before you open one

- `pnpm install` runs clean.
- `pnpm lint` is green.
- `pnpm typecheck` is green.
- `pnpm --filter @centralit/api test` is green (when touching the API).
- `pnpm format:check` is green (run `pnpm format` if not).
- The diff doesn't include `apps/*/dist`, `node_modules`, `.env`, or any other generated/secret file.

### PR shape

- **Target branch:** `dev`. PRs to `main` are reserved for release / hotfix.
- **Title:** mirror the leading commit's subject — Conventional Commit form, with the issue ID.
- **Body** (use this template):

  ```md
  ## Summary

  - <bullet describing the change>
  - <bullet describing why>

  Refs: CEN-XX

  ## Changes

  - <file or area touched> — <one-liner>
  - …

  ## Test plan

  - [ ] `pnpm lint`
  - [ ] `pnpm typecheck`
  - [ ] `pnpm --filter @centralit/api test`
  - [ ] Manual: <what you exercised>

  ## Screenshots / output

  <when relevant>

  ## Risks / rollback

  <call out anything reviewers should double-check, plus rollback steps>
  ```

- **Size:** aim for ≤ 400 lines of diff. Larger PRs need a written reason in the description.
- **Scope:** one issue per PR is the default. Crossing scopes (e.g. fixing two unrelated bugs) is allowed only if you call it out and split commits cleanly.

### Review and merge

- At least one reviewer approval before merge.
- CI must be green.
- The engineer who owns the change self-merges on green CI; don't park `in_review` after approval.
- We prefer **Squash and merge** for branches with messy histories and **Rebase and merge** when the commit history is already clean and meaningful.

### Hotfixes to `main`

For production-critical fixes only:

```bash
git switch -c fix/hotfix-<slug> main
# … fix …
```

Open a PR targeting `main` _and_ a parallel PR targeting `dev` (or the same branch retargeted afterwards) so the trees don't diverge.

---

## Tooling notes

- **Editor:** Prettier + ESLint configurations live at the repo root; most editors pick them up automatically.
- **Pre-commit:** there is no enforced pre-commit hook today. Run the four root scripts (`lint`, `typecheck`, `format:check`, plus the relevant `test`) before pushing.
- **Docs:** if you change behaviour, update `docs/` in the same PR. Stale docs are worse than no docs.
- **Migrations:** never edit an existing migration. Add a new one (`pnpm --filter @centralit/api db:migrate`) and let Prisma name it.

---

## Security

If you discover a vulnerability, do **not** open a public PR or issue describing it. Email the team lead, or file a private issue and tag the security label. See `security/` for the existing STRIDE / OWASP review (CEN-14).

---

## Questions

Open a draft PR with the question in the description, or post in the team channel. We'd rather discuss early than rewrite later.
