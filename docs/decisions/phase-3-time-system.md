# Phase 3 — Time System design decisions

> Captured before implementation so the rationale for each choice is preserved.
> If you find yourself questioning a decision later, reread the *Reasoning*
> section before changing the code.
> Last updated: 2026-05-06.

## Context

Phase 3 builds the Time half of TMOS — task management, time tracking, routines,
a week-view calendar, and an AI day planner. This phase is split into 6 PRs;
this doc records the cross-cutting decisions made before PR #1.

| PR | Scope |
| --- | --- |
| 1 | Schema + task CRUD (`/app/time`) |
| 2 | Time tracking (`TimeEntry` + start/stop timer) |
| 3 | Projects (`Project` model + filter) |
| 4 | Routines (`Routine` model + lazy generation) |
| 5 | Calendar / time blocks (`TimeBlock` + week grid) |
| 6 | AI day planner (Gemini-powered) |

---

## Decision 1 — Projects: own PR vs. fold into PR #1

### Options considered

- **A. Own PR (PR #3)** — Tasks ship without projects. `Project` model added later; `Task.projectId` is nullable.
- **B. Fold into PR #1** — Tasks + Projects shipped together. PR #1 gets bigger.

### Decision: **A**

### Reasoning

Pros of A: PR #1 stays small and reviewable, schema migration is minimal, tasks
are usable on day one without forcing the user to set up projects, and project
support can be added incrementally without breaking changes.

Pros of B: complete mental model in one PR, no awkward "tasks without grouping"
phase.

The PR #1 → tasks-only path matches Phase 1's PR #11 pattern (transactions
shipped without categories first). Users can capture tasks immediately;
project organization is additive.

### Revisit when

- N/A — projects ship in PR #3 regardless. Decision is just about ordering.

---

## Decision 2 — Calendar library: `react-big-calendar` vs. simple grid

### Options considered

- **A. `react-big-calendar`** — well-known calendar library; built-in week/day/month views, drag-drop, event handling.
- **B. Custom simple grid** — hand-rolled 7-column × hourly grid, server-rendered with absolute positioning for time blocks.

### Decision: **B for v1, A as a planned future swap**

### Reasoning

`react-big-calendar` is the right long-term answer once we have multiple views,
drag-drop, recurring rule visualization, and resource booking. But:
- Adds ~30 kB to the bundle
- Has its own theming layer that fights Tailwind
- Has its own date-handling conventions
- Onboarding cost: a day of fighting its API to get our colors / row heights
  / event renderers right

For PR #5 (week calendar v1), a custom grid is ~150 lines and ships in hours.
v1 only needs: 7-column grid, hour rows, click to add a block, drag to resize.
That's well within hand-rolled territory.

The plan: hand-roll v1 → ship → use it for ~1 month → swap to RBC when we hit
the first feature that's clearly easier in RBC (likely drag-drop reschedule
across days, or month view).

### Revisit when

- We need any of: month view, multi-day drag-drop, multiple calendars
  overlaid (e.g. Google Calendar import), or drag-to-reschedule across days
- Calendar features stop fitting in <300 lines
- We hit a bug in our hand-rolled date math we'd rather not own

---

## Decision 3 — Routine generation: lazy on-page-load vs. background cron

### Options considered

- **A. Lazy generation** — when a user hits `/app/time`, check if today's
  routine tasks have been generated; if not, generate them inline.
- **B. Background cron (BullMQ)** — a daily job at midnight generates the
  next day's routine tasks for all users.

### Decision: **A** (lazy)

### Reasoning

We don't have a worker yet — that's Phase 4. Adding one now to support routine
generation would couple Phase 3 to Phase 4 timing.

Lazy generation is fine for a single-user app with low routine volume
(~5-10 routines):
- Cost: one extra read per `/app/time` page load (cheap)
- Idempotent: a "generated for date X" flag on `Routine` prevents duplicates
- Self-healing: if generation fails, next page load retries

Cons:
- First page load each day pays the generation latency (likely <100ms for
  10 routines, so unnoticeable)
- Doesn't work if the user never opens `/app/time` (routine task for that day
  is missed) — but that's probably the right behavior anyway: no point
  generating a task no one's going to see

When BullMQ comes online in Phase 4, we'll convert this to a daily cron with
a `generateRoutineTasks(userId, date)` action — same code, different trigger.

### Revisit when

- Phase 4 (BullMQ + worker) ships → migrate to a daily cron that calls the
  same `generateRoutineTasks` action on a schedule.
- Multiple users with different time zones → cron has to be per-user-TZ-aware.
- Routine task counts grow such that page-load latency is noticeable
  (>200ms).

---

## Decision 4 — AI day planner: Gemini reuse vs. new provider setup

### Options considered

- **A. Reuse the Gemini setup** from Phase 2's AI categorizer. Extend the
  existing `LlmProvider` pattern with a `planDay` method (or a new
  `LlmPlanner` interface).
- **B. New provider setup** — separate model selection, separate prompt
  shaping, separate file.

### Decision: **A**

### Reasoning

The Phase 2 AI categorizer already established:
- `GEMINI_API_KEY` env var
- `gemini-2.5-flash` as the model
- Vercel AI SDK + `generateObject` for structured output
- `LlmCategorizer` interface in `@tmmt/shared`

Extending this with a `LlmPlanner` interface (sibling, not replacement) lets
us reuse the entire setup. Day planning is structurally similar: input =
context (tasks, routines, deadlines), output = structured JSON (schedule).

Rejected: A more general `LlmProvider` interface with both `categorize` and
`planDay` methods. Keeping the interfaces narrow (one method each) makes them
easier to swap, mock, and reason about. They share the underlying SDK
configuration, not the type signatures.

### Revisit when

- Day planning requires multi-turn conversation (e.g. "what did you mean by
  block X?") — we'd need to break out of `generateObject` into a streaming
  `generateText` setup.
- Cost / latency on Flash becomes a problem → swap to Gemini Pro or Claude
  for this specific workflow.

---

## Implementation summary (pinned to these decisions)

- **PR #1 (this PR):** `Task` model + CRUD only. No `Project`, no `TimeEntry`,
  no calendar. Mirrors Phase 1's PR #11 pattern.
- **PR #3:** `Project` model added separately; `Task.projectId` becomes
  populated.
- **PR #5:** Hand-rolled week grid for the calendar; `react-big-calendar`
  marked as a future swap.
- **PR #4:** Routine task generation runs lazily on `/app/time` page load,
  guarded by an idempotency flag.
- **PR #6:** AI day planner adds an `LlmPlanner` interface alongside the
  existing `LlmCategorizer`; reuses Gemini config.
