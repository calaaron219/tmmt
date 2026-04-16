# TMOS — Time & Money Operating System

An event-driven AI agent system for personal finance and time management.

**Core loop:** `Event → Agent → Decision → Action → Log`

## What is this?

TMOS is not a budgeting app. It's not a todo app. It's a decision engine that continuously
monitors your finances and schedule, reasons over changes using AI agents, and takes actions
— with human approval for anything risky.

## Stack

| Layer         | Tech                                          |
| ------------- | --------------------------------------------- |
| Frontend      | Next.js 15, TypeScript, Tailwind, shadcn/ui   |
| Backend       | NestJS, TypeScript                             |
| Database      | PostgreSQL (Railway)                           |
| Queue / Events| Redis + BullMQ                                |
| AI            | Anthropic Claude (tool calling)                |
| Auth          | Auth.js (GitHub + Google OAuth)                |
| Hosting       | Vercel (web) + Railway (api, worker, DB, Redis)|

## Monorepo structure

```
apps/
  web/      — Next.js frontend
  api/      — NestJS backend + BullMQ worker
packages/
  db/       — Prisma schema + client (shared)
  shared/   — shared types, zod schemas, tool contracts
```

## Getting started

```bash
# Install dependencies
pnpm install

# Copy env template
cp .env.example .env

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
