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

- **PR #1:** `Task` model + CRUD only. No `Project`, no `TimeEntry`,
  no calendar. Mirrors Phase 1's PR #11 pattern.
- **PR #2 (this PR):** `TimeEntry` model + start/stop timer per task; see
  the "PR #2 — Time tracking" section below for the 6 sub-decisions.
- **PR #3:** `Project` model added separately; `Task.projectId` becomes
  populated.
- **PR #5:** Hand-rolled week grid for the calendar; `react-big-calendar`
  marked as a future swap.
- **PR #4:** Routine task generation runs lazily on `/app/time` page load,
  guarded by an idempotency flag.
- **PR #6:** AI day planner adds an `LlmPlanner` interface alongside the
  existing `LlmCategorizer`; reuses Gemini config.

---

# PR #2 — Time tracking sub-decisions

Six decisions debated up-front for the time-tracking PR. All accepted as
recommended. The thread of these decisions: **ship a small, opinionated v1
with mostly-reversible choices**.

## Decision 2.1 — Single active timer vs. multiple

### Options

- **A. Single** — at any moment, the user has 0 or 1 running TimeEntry.
  Starting a new timer auto-stops the running one with a brief toast.
- **B. Multiple** — any number of TimeEntries can be running concurrently.

### Decision: **A (Single)**

### Reasoning

Pros of A: one source of truth ("what am I working on?" has one answer),
matches reality (humans focus on one thing), cleaner data (no overlapping
intervals on the same user), simpler UI (one banner suffices), industry default
(Toggl, Harvest, Clockify, Things 3).

Cons of A: edge case where time genuinely belongs to two tasks (e.g. "this
meeting was both project A planning AND team mentoring") forces a pick.
Forgot-to-stop scenario leaves a stale long-running entry.

Rejected B because "which timer am I really tracking?" decision fatigue is
real, and 5 simultaneously-running timers is almost always a bug (forgot to
stop). UI surface bloats and aggregations get harder.

### Revisit when

- Idle-detection / forgot-to-stop recovery becomes a frequent pain point
  → Phase 7 polish work.
- Need genuine concurrent attribution → add a "split this entry across two
  tasks" feature, not a "multiple active timers" mode.

---

## Decision 2.2 — Task-required vs. ad-hoc (nullable taskId)

### Options

- **A. Task-required** — `taskId String` NOT NULL. Must create a task first
  to start tracking time. Per-task "start timer" button.
- **B. Ad-hoc allowed** — `taskId String?` nullable. Global "start free-form
  timer" button; user labels after stopping.

### Decision: **A (Task-required) for v1**

### Reasoning

Pros of A: clean schema (every entry has a parent), forces intentionality
(you can't accumulate 3h of unnamed "stuff"), better reports (every minute
bucketed), fewer UI states (no orphan "(no task)" entries).

Cons of A: friction for unplanned interruptions ("phone call from Mom" — must
create a task first), encourages task spam (one-off throwaway tasks).

Rejected B because: two UI patterns (per-task + global) doubles design surface,
NULL branches in every aggregation query, untyped time accumulates in a "(no
task)" bucket nobody categorizes later.

This is **reversible cheaply**: making `taskId` nullable later is a 1-line
schema change. Going the other direction (non-nullable after NULL data exists)
requires a backfill or data loss. Start strict.

### Revisit when

- Friction in tracking interruptions becomes a daily annoyance → relax to
  nullable OR add a "Quick task" button on the timer banner that creates a
  stub task + starts a timer in one click (middle-ground).

---

## Decision 2.3 — Live ticker for the active timer

### Options

- **A. Client-side `setInterval`** every second on the running entry only.
  Stopped entries server-rendered.
- **B. Server-rendered only** — elapsed time as it was at last render. No
  live update.

### Decision: **A (Client-side tick on the running timer only)**

### Reasoning

A "feels alive" — watching seconds count up reinforces "yes, I'm tracking
this". Cost is trivial (~10 lines of `useEffect` + `setInterval`), no server
load (the tick is purely client compute against `startedAt`). Each tick is
computed from the absolute `startedAt` timestamp so interval drift self-corrects.

B feels broken — "is the timer actually running? It says 14m and hasn't
moved..." Defeats the point of having a timer at all.

### Revisit when

- If the per-second tick feels hyperactive after sustained use → drop to
  per-minute ticking (Toggl free tier does this).
- Battery drain on mobile becomes a real complaint → throttle on
  `visibilitychange` to pause ticks when tab is backgrounded.

---

## Decision 2.4 — Where to show "tracked total"

### Options

- **A. Below priority/due row, same metadata line** — *"Due tomorrow · Est. 30m · Tracked 14m"*
- **B. Separate row below the title** with its own clock icon.
- **C. Hover/expand only** — hidden until the user explicitly looks.

### Decision: **A (Same metadata row)**

### Reasoning

A: no new visual surface, co-locates related info (estimate ↔ tracked is the
"did I take longer than I thought?" pairing), enables easy contrast styling
when tracked > estimate. Mobile crunch is solvable with label trimming
("Due tom · 30m · 47m").

B: vertical space cost on every row, list less scannable. Most rows have 0
tracked time, so the row would be empty most of the time (hidden conditionally
adds layout complexity).

C: hidden = forgotten. The whole point is surfacing "you've already spent 47m
on this 30m task" so the user notices the overrun.

### Revisit when

- The metadata row wraps unacceptably at 375px width → swap to B (taller row)
  rather than C (hiding the info).
- Time tracking grows multi-session features (e.g. "last session: 12m on May 8")
  that need more space → consider a per-task expand-on-hover detail view.

---

## Decision 2.5 — Edit a stopped entry's start/end after the fact

### Options

- **A. Defer** — entries are immutable once stopped. To fix a wrong entry,
  delete and re-create (manual entry mode would be needed — also deferred).
- **B. Include in this PR** — small edit form per entry, recompute duration.

### Decision: **A (Defer)**

### Reasoning

Smaller PR scope, simpler data model, forces good habits (stop the timer when
you actually stop working). Forgot-to-stop is real and painful, but the
recovery cost (delete the bad entry, lose the data) is bounded — better than
shipping half-baked editing.

B adds 50-100 lines of date/time picker UI, validation, error states, plus
edge cases (overlapping edits, midnight spans, audit trail).

### Revisit when

- Forgot-to-stop / wrong-time edits become a weekly need → ship a focused
  "manual time entry + edit" PR (likely Phase 3 PR #2.5 or a Phase 7 polish
  item). Bundle with idle-detection.

---

## Decision 2.6 — Daily total ("you've tracked 4h today") in page header

### Options

- **A. Defer** — no daily total in v1.
- **B. Include** — header shows summed duration of today's entries.

### Decision: **A (Defer)**

### Reasoning

Format-guessing risk: "4h"? "4h 12m"? "4h 12m on 3 tasks"? "4h tracked,
est. 5h remaining today"? The right framing depends on how you actually use
the page, which won't be clear until 1-2 weeks of real usage.

Page header is already getting tall (header + quick-add + active-timer banner
+ list). Adding another summary row pushes the task list below the fold on
smaller screens.

B is cheap to add later (just `SUM(durationSeconds)` filtered to today). Once
added, it's hard to remove if it turns out to be noise. Wait for the usage
signal.

### Revisit when

- After 1-2 weeks of real time-tracking usage, the question "how much did
  I actually work today?" comes up regularly → ship a daily-total chip in
  the page header with the exact framing that answers your real question.
