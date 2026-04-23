# TMOS — Time & Money Operating System

An event-driven AI agent system for personal finance and time management.

**Core loop:** `Event → Agent → Decision → Action → Log`

## What is this?

TMOS is not a budgeting app. It's not a todo app. It's a decision engine that continuously
monitors your finances and schedule, reasons over changes using AI agents, and takes actions
— with human approval for anything risky.

## Live

| Environment | URL |
| ----------- | --- |
| Web (Vercel) | https://tmmt-web.vercel.app |
| API (Railway) | https://tmmt-production.up.railway.app/ |
| Project board | https://github.com/users/calaaron219/projects/1 |
| Issues | https://github.com/calaaron219/tmmt/issues |

## Stack

| Layer | Tech |
| ----- | ---- |
| Frontend | Next.js 16, React 19, TypeScript, Tailwind 4 |
| Backend (Phase 4+) | NestJS 11, TypeScript |
| Database | PostgreSQL (Railway) |
| Queue / Events (Phase 4+) | Redis + BullMQ |
| AI (Phase 2+) | Anthropic Claude (tool calling), swappable via `LlmProvider` |
| Tool exposure (Phase 5+) | MCP server |
| Auth | Auth.js v5 (GitHub + Google OAuth, JWT sessions) |
| Data layer | Prisma 6 ORM |
| Hosting | Vercel (web) + Railway (api, worker, DB, Redis) |
| Package manager | pnpm 10 (workspaces) |

## Monorepo structure

```
apps/
  web/      — Next.js frontend (Vercel) — active
  api/      — NestJS backend + BullMQ worker (Railway) — online in Phase 4
  mcp/      — MCP server (Phase 5+)
packages/
  db/       — Prisma schema + shared client
  shared/   — shared types, zod schemas, tool contracts
docs/       — setup guides + session handoffs
CLAUDE.md   — AI-assistant context (auto-loaded by Claude Code)
```

## Getting started

```bash
# 1. Install (also runs prisma generate via postinstall)
pnpm install

# 2. Copy env template and fill in real values in .env
cp .env.example .env

# 3. Start dev server
pnpm --filter @tmmt/web dev      # http://localhost:3000
```

See [`docs/phase-1-auth-setup.md`](./docs/phase-1-auth-setup.md) for OAuth app registration + DB migration steps.

## Development

```bash
pnpm --filter @tmmt/web dev      # Next.js only (port 3000)
pnpm --filter @tmmt/api start:dev # NestJS (port 3001, unused until Phase 4)
pnpm lint                         # ESLint across all workspaces
pnpm typecheck                    # TypeScript check across all workspaces

# DB browser (pull env first)
unset NODE_OPTIONS && set -a && . ./.env && set +a && \
  pnpm --filter @tmmt/db exec prisma studio
```

## Roadmap

Full plan in the local planning doc. High-level phases:

| Phase | Focus | Status |
| ----- | ----- | ------ |
| 0 | Monorepo scaffolding, CI, Vercel + Railway | ✅ Shipped |
| 1 | Auth + Money CRUD + CSV import | ✅ Shipped |
| 2 | AI categorizer, subscriptions, anomalies, budgets | Next |
| 3 | Tasks, routines, calendar, AI day planner | |
| 4 | Event-driven architecture (BullMQ core) | |
| 5 | Agent + tool calling + MCP server | |
| 6 | Cross-domain automation (time ↔ money) | |
| 7 | Dashboard, transparency UI, v1.0 polish | |

Each phase is tracked as an epic on the [project board](https://github.com/users/calaaron219/projects/1).

### Phase 1 — shipped features

- [x] GitHub + Google OAuth (protected `/app/*` routes)
- [x] Transaction CRUD with Income/Expense types and categories
- [x] 11 default categories seeded on first action
- [x] Rule-based categorizer (Starbucks → Coffee, Uber → Transportation, etc.)
- [x] Category management UI (add, edit, delete, color swatches, emoji)
- [x] CSV import (drag-drop, client-side parse, column auto-detection)
- [x] Mobile-responsive UI (375px viewport tested)

## Code review & deploy process

Every PR goes through **3 gates** before merging to `main`:

1. **CI (GitHub Actions)** — lint + typecheck + prisma validate (must be green)
2. **Claude self-review** — security, code quality, UX checklist. Notes go in the PR body under `## Review Notes (Gate 2)`
3. **Human review** — final approval, preview deployment check on desktop + mobile

Branches follow `feat/phase-N/description` (also `fix/…`, `chore/…`, `docs/…`). Merges are squashed. Merged branches are deleted.

## AI-assistant context

This repo uses a two-tier AI context system:

- **[`CLAUDE.md`](./CLAUDE.md)** — evergreen project knowledge (stack, conventions, commands). Auto-loaded by Claude Code.
- **`docs/handoff-*.md`** — point-in-time session snapshots with "next session's goal".

For future sessions, start with: _"read CLAUDE.md and the latest `docs/handoff-*.md`, then continue"_.

## Engineering principles

1. **Everything is an event** — no hard-coded flows; even manual UI actions go through the bus (Phase 4+)
2. **Log every AI decision** — `AgentLog` table is the debugging lifeline
3. **Structured outputs** — zod-validated tool inputs/outputs, low temperature
4. **Rules before LLM** — deterministic rules run first; agent is the fallback
5. **Human approval for risky actions** — anything touching money or calendar defaults to requires-approval
