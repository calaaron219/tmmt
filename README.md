# TMOS — Time & Money Operating System

An event-driven AI agent system for personal finance and time management.

**Core loop:** `Event → Agent → Decision → Action → Log`

## What is this?

TMOS is not a budgeting app. It's not a todo app. It's a decision engine that continuously
monitors your finances and schedule, reasons over changes using AI agents, and takes actions
— with human approval for anything risky.

## Live

| Environment | URL                                       |
| ----------- | ----------------------------------------- |
| Web (Vercel)| _Add your Vercel URL here_                |
| API (Railway)| https://tmmt-production.up.railway.app/  |
| Project board| https://github.com/users/calaaron219/projects/1 |
| Issues      | https://github.com/calaaron219/tmmt/issues|

## Stack

| Layer           | Tech                                             |
| --------------- | ------------------------------------------------ |
| Frontend        | Next.js 15, TypeScript, Tailwind, shadcn/ui      |
| Backend         | NestJS, TypeScript                               |
| Database        | PostgreSQL (Railway)                             |
| Queue / Events  | Redis + BullMQ                                   |
| AI              | Anthropic Claude (tool calling), swappable       |
| Tool exposure   | MCP server (Phase 5+)                            |
| Auth            | Auth.js (GitHub + Google OAuth)                  |
| Hosting         | Vercel (web) + Railway (api, worker, DB, Redis)  |
| Package manager | pnpm 10 (workspaces)                             |

## Monorepo structure

```
apps/
  web/      — Next.js frontend (Vercel)
  api/      — NestJS backend + BullMQ worker (Railway)
  mcp/      — MCP server (Phase 5+)
packages/
  db/       — Prisma schema + client (shared)
  shared/   — shared types, zod schemas, tool contracts
```

## Getting started

```bash
# Install dependencies
pnpm install

# Copy env template and fill in values
cp .env.example .env

# Generate Prisma client
pnpm --filter @tmmt/db exec prisma generate

# Start both apps in dev mode
pnpm dev
```

## Development

```bash
pnpm dev:web     # Next.js only (port 3000)
pnpm dev:api     # NestJS only (port 3001)
pnpm dev         # Both in parallel
pnpm lint        # ESLint across all workspaces
pnpm typecheck   # TypeScript check across all workspaces
pnpm test        # Run all tests
```

## Roadmap

Full plan lives in the planning doc (local). High-level phases:

| Phase | Focus                                          | Status      |
| ----- | ---------------------------------------------- | ----------- |
| 0     | Monorepo scaffolding, CI, Vercel + Railway     | ✅ Shipped  |
| 1     | Auth + Money CRUD + CSV import                 | Next        |
| 2     | AI categorizer, subscriptions, anomalies       |             |
| 3     | Tasks, routines, calendar, AI day planner      |             |
| 4     | Event-driven architecture (BullMQ core)        |             |
| 5     | Agent + tool calling + MCP server              |             |
| 6     | Cross-domain automation (time ↔ money)         |             |
| 7     | Dashboard, transparency UI, v1.0 polish        |             |

Each phase is tracked as an epic on the [project board](https://github.com/users/calaaron219/projects/1).

## Code review & deploy process

Every PR goes through **3 gates** before merging to `main`:

1. **CI (GitHub Actions)** — lint + typecheck + prisma validate + tests (must be green)
2. **Claude self-review** — security, code quality, agent/UX checklist with review notes in the PR body
3. **Human review** — final approval, preview deployment check on desktop + mobile

Branches follow `feat/phase-N/description`. Merges are squashed. See the plan doc for the full checklist.

## Engineering principles

1. **Everything is an event** — no hard-coded flows; even manual UI actions go through the bus
2. **Log every AI decision** — `AgentLog` table is the debugging lifeline
3. **Structured outputs** — zod-validated tool inputs/outputs, low temperature
4. **Rules before LLM** — deterministic rules run first; agent is the fallback
5. **Human approval for risky actions** — anything touching money or calendar defaults to requires-approval
