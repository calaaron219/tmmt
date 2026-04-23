# TMOS — AI Assistant Context

> This file is for AI assistants. Auto-loaded by Claude Code in this repo.
> Evergreen knowledge. Session-specific state lives in `docs/handoff-*.md`.
> Keep this file under 200 lines.

## What this project is

TMOS (Time & Money Operating System) is an **event-driven AI agent system** for
personal finance and time management. It's not a budgeting app or a todo app —
it's a decision engine where every change becomes an event, agents reason over
it, and tools execute the outcome. Core loop: `Event → Agent → Decision → Action → Log`.

Full 8-phase plan: `~/.claude/plans/golden-percolating-dewdrop.md`

## Stack

| Layer | Tech | Notes |
| ----- | ---- | ----- |
| Frontend | Next.js 16 (App Router) + React 19 + Tailwind 4 + TypeScript | |
| Backend | NestJS 11 + TypeScript (unused until Phase 4) | |
| Database | PostgreSQL (Railway) | Public URL for local + Vercel, internal for Railway services |
| Queue | Redis + BullMQ | Not wired yet (Phase 4) |
| AI | Anthropic Claude, swappable via LlmProvider | Phase 2+ |
| Auth | Auth.js v5 beta + @auth/prisma-adapter, JWT strategy | Edge-compatible |
| ORM | Prisma 6 | postinstall auto-runs `prisma generate` |
| CSV | papaparse | Client-side parse, only typed rows sent to server |
| Validation | zod | Schemas in @tmmt/shared |
| Package manager | pnpm 10 with workspaces | |
| Hosting | Vercel (web) + Railway (api, postgres, redis) | |

## Repo layout

```
apps/
  web/          Next.js frontend. All Phase 1 CRUD lives here via Server Actions.
  api/          NestJS scaffold. Serves "Hello World!" — unused until Phase 4.
packages/
  db/           Prisma schema + shared client. Has postinstall: prisma generate.
  shared/       zod schemas, constants. Imported by web and (later) api.
docs/           Manual setup guides + session handoffs.
.github/
  workflows/    CI: lint + typecheck + prisma validate.
```

## Key files to read first

1. `packages/db/prisma/schema.prisma` — data model (11 tables, 5 enums)
2. `apps/web/src/auth.ts` — Auth.js config
3. `apps/web/src/app/app/money/actions.ts` — Server Action patterns
4. `apps/web/src/lib/categorizer.ts` — rules engine (Phase 2 adds AI fallback)
5. `~/.claude/plans/golden-percolating-dewdrop.md` — full 8-phase plan

## Architectural decisions (non-obvious)

- **Next.js 16 renamed `middleware.ts` → `proxy.ts`.** Use `proxy.ts`. Auth.js docs still show middleware — don't follow those.
- **Phase 1-3 uses Server Actions, not NestJS REST.** Cross-service JWT verification was too much complexity for simple CRUD. NestJS comes online in Phase 4 for BullMQ workers that can't run on Vercel.
- **Money stored as `Int` cents**, never float. Amount $12.34 → 1234. Avoids rounding bugs.
- **JWT session strategy** (not database) so `auth()` works in edge runtime for `proxy.ts`. Prisma adapter still populates User/Account on sign-in.
- **Rules before LLM.** Categorizer checks keyword rules first (free, deterministic). AI is the fallback for rules misses (Phase 2).
- **User-scoped everything.** Every DB write includes `userId`. Every query filters by `userId`. No shared data across users.

## Coding conventions

- **Every Server Action starts with `await requireUser()`** (in `apps/web/src/app/app/money/actions.ts`).
- **Every write is user-scoped:** `prisma.x.deleteMany({ where: { id, userId } })`, never `deleteMany({ where: { id } })`.
- **Every user input validated with zod** at the server boundary.
- **No `any` types.** Ever.
- **zod schemas live in `@tmmt/shared`** so both web and api reference the same definition.
- **`revalidatePath(...)` after mutations** so Server Components refetch.

## UI / UX conventions

- **Mobile-first.** Test at 375px viewport.
- **Text hierarchy:**
  - `text-xs` — captions only
  - `text-sm` — secondary info, labels, button text
  - `text-base` (16px) — body content, form inputs (prevents iOS zoom)
  - `text-lg/2xl/3xl` — headings
- **Color hierarchy:**
  - `text-gray-900` — primary text
  - `text-gray-700` — labels, nav links
  - `text-gray-600` — secondary info (dates, hints)
  - `text-gray-500` — tertiary
  - `text-gray-400` — placeholders, decorative
- **Income green, expense gray-900.** `+` prefix for income, `-` for expense.
- **Empty states must guide the user** to the next action.
- **Every destructive button uses `confirm()`** (Phase 7 replaces with real dialogs).
- **Loading states via `useTransition`** — disable buttons, swap text to "Saving…" / "Deleting…".

## Git workflow (strict)

- **Never commit to `main`.** Branch names: `feat/phase-N/description`, `fix/...`, `chore/...`, `docs/...`.
- **Squash-merge only.** History stays clean.
- **3 gates before merge:**
  1. CI green (lint + typecheck + prisma validate)
  2. Claude self-review — goes in PR body under `## Review Notes (Gate 2)`
  3. Human review + preview deploy check
- **Delete merged branches:** `git branch -d <branch>` after pulling main.
- **Commits** use co-authored-by footer:
  ```
  Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
  ```
- **PR body template:** Summary · What's new · Key decisions · Review Notes (Gate 2) · Local verification · Test plan.

## Environment / secrets

- `.env` — git-ignored. Real dev secrets + Railway's **public** `DATABASE_URL` (e.g. `*.proxy.rlwy.net:XXXXX`).
- `.env.example` — committed template. **Never put real secret values here.** Revert it immediately if a real value slips in.
- **Vercel env vars** — production values. Set via dashboard → Settings → Environment Variables. Must use Railway's **public** DATABASE_URL (Vercel can't reach Railway's internal network).
- **Railway env vars** — API service uses `${{Postgres.DATABASE_URL}}` (internal hostname, fast). Database services expose both internal + public URLs.

## Quick commands

```bash
# Setup (one-time)
pnpm install                              # installs + runs prisma generate

# Dev
pnpm --filter @tmmt/web dev               # frontend at localhost:3000
pnpm --filter @tmmt/api start:dev         # backend at localhost:3001 (not used yet)

# Database
pnpm --filter @tmmt/db exec prisma studio # browser DB explorer at :5555
# (Always prefix with: unset NODE_OPTIONS && set -a && . ./.env && set +a)

# Migrations
pnpm --filter @tmmt/db exec prisma migrate dev --name <name>   # create + apply
pnpm --filter @tmmt/db exec prisma migrate deploy              # apply existing (prod)

# Validation
pnpm typecheck                            # all 4 workspaces
pnpm --filter @tmmt/web lint              # eslint
pnpm --filter @tmmt/web build             # production build
```

## Hosting

- **Frontend:** Vercel. Auto-deploys on push to any branch. Production = `main`.
- **Backend (NestJS):** Railway. Deploys from monorepo root. Build: `pnpm install --frozen-lockfile && pnpm --filter @tmmt/api build`. Start: `node apps/api/dist/main.js`.
- **Postgres + Redis:** Railway. Migrations applied manually from local (for now); future: `prisma migrate deploy` in CI.

## User context (Aaron)

- Beginner at AI-agent-assisted end-to-end projects
- Deep JavaScript/TS background; light Python; solid Git; comfortable with SQL
- Teaching mode: **explain what/why before each change, wait for the user to read**
- Prefers pragmatic choices over "textbook correct"
- Solo project; no other collaborators

## Current phase

See latest `docs/handoff-*.md` for active-state snapshot (current branch, in-progress PR, next task).
