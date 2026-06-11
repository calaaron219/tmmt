# Phase 3 — Railway trial expiration: stay vs. migrate

> Captured at the moment of the call so future-us has the reasoning when the
> hosting bill changes shape (e.g. costs creep up, free tier of an
> alternative gets better, or Railway changes its plans).
> Last updated: 2026-06-11.

## Context

The Railway free trial used during Phase 0 → Phase 3 was expiring. To keep
the deployed backend (NestJS API), Postgres, and Redis services running, a
decision was needed: continue with Railway on a paid plan, or migrate one or
more services to an alternative provider.

This decision affects: deployment topology, env-var wiring (Vercel's
`DATABASE_URL` points at Railway's public Postgres URL), the cost line,
and the friction of the next deploy.

---

## Decision: **Keep Railway. Subscribe to the Hobby plan.**

---

## Options considered

- **A. Stay on Railway — Hobby plan.** All three services (NestJS API,
  Postgres, Redis) continue to run on Railway. One bill, one dashboard,
  no env-var or DNS changes needed.
- **B. Migrate Postgres to a managed provider** (Supabase / Neon free
  tier), keep Redis + API on a free-tier compute host (Render, Fly.io).
  Possibly free at low usage, multiple dashboards, multiple env updates.
- **C. Migrate everything off Railway** (Fly.io or Render for API,
  Supabase for Postgres, Upstash for Redis). Cheapest at this scale,
  but the most rewiring.

---

## Reasoning

**Pros of A (staying):**
- Zero migration work. The current setup already deploys cleanly:
  NestJS builds from the monorepo root, Postgres uses the internal
  `${{Postgres.DATABASE_URL}}` ref, Vercel uses the public URL. Moving
  any of these means rewriting that wiring and re-testing the path.
- One dashboard, one bill, one set of credentials to manage. For a solo
  project this is meaningful overhead avoided.
- Internal networking between services (API → Postgres, API → Redis) is
  already fast and free of egress charges. Splitting across providers
  reintroduces egress + auth.
- Railway's variable references (`${{Postgres.DATABASE_URL}}`) are a
  feature we're already using. Replicating that pattern across providers
  is possible but adds glue.

**Cons of A:**
- It costs money where the alternatives might be free at our scale.
  Hobby is a predictable monthly line, not zero.

**Pros of B and C (migration):**
- Lower steady-state cost, possibly $0 at current usage.
- Each provider is best-in-class for its niche (Supabase / Neon for
  Postgres, Upstash for Redis, Fly / Render for compute).

**Cons of B and C:**
- A weekend of rewiring across providers, plus the risk of subtle
  regressions in env-var handling, internal-vs-public hostnames, and
  CI/deploy scripts. None of this delivers user-facing value — pure
  infrastructure churn.
- Larger surface area to debug when something breaks: which dashboard
  is the failure in?
- Locks in the migration *before* we know what Phase 4 (BullMQ workers)
  needs — Phase 4 may push us toward a setup that's easier on Railway
  anyway (single-project workers + Redis colocated).

The deciding question was *"is the cost saving worth a weekend of
infra work that produces no user-facing progress right now?"* — No.
Pay the Hobby line, keep momentum on Phase 3 → Phase 4 features.

---

## Revisit when

- Monthly cost on Railway grows beyond the Hobby plan's included usage
  (e.g. Postgres storage spikes after CSV imports, or Redis memory
  inflates from queued jobs). Re-run the comparison with real numbers.
- A required feature isn't supported on Railway (e.g. a managed cron
  primitive we'd otherwise need to hand-roll).
- Phase 4 (BullMQ workers) clarifies the topology and one of the
  alternative providers turns out to be a much better fit (e.g.
  Fly.io machines for ephemeral worker processes).
- An alternative provider's free tier expands to comfortably cover
  Phase 6+ usage, while Railway's pricing model changes against us.

---

## Implications captured

- **No env-var changes.** Vercel still reads Railway's public
  `DATABASE_URL`. Railway services still reference each other via
  `${{Postgres.DATABASE_URL}}` etc.
- **No CLAUDE.md edit needed.** The hosting section already states
  Postgres + Redis live on Railway; no plan tier was named there.
- **No code change.** This is a billing/plan decision, not a config
  change.
