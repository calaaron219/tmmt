# Phase 3 PR #3 — Projects design decisions

> Captured at merge time so the reasoning lives next to the schema, not
> just in the PR body where it gets buried. If you find yourself
> questioning one of these, reread the *Reasoning* section before
> changing the code.
> Last updated: 2026-06-11.

## Context

Phase 3 PR #3 adds the `Project` model so tasks can be grouped (work,
side projects, study, etc.). Per the cross-cutting decisions in
`phase-3-time-system.md` (Decision 1), Projects shipped as their own PR
*after* task CRUD and time tracking — not folded into PR #1.

Five decisions were made during implementation. All accepted as
described. The thread: **mirror Phase 1's category pattern, keep
project-less tasks visually neutral, defer features that aren't
load-bearing yet.**

---

## Decision 1 — Mirror `Category` shape vs. invent a project-specific schema

### Options considered

- **A. Mirror `Category`** — `id, userId, name, color, icon?, createdAt,
  updatedAt` with `@@unique([userId, name])`. Same UI scaffolding
  (color picker preset, emoji input, card grid).
- **B. Project-specific shape** — add fields like `archivedAt`,
  `sortOrder`, `defaultPriority`, `clientName`, etc.

### Decision: **A**

### Reasoning

The Category model has earned its shape over Phase 1: presets + emoji +
unique-per-user works in practice. Reusing the same shape for Projects
means the user learns the pattern once (color, emoji, name), the review
is small (the diff is mostly file-copy + rename), and we don't ship
fields whose UX is undefined.

B was rejected because every field on that list ("archive", "sort
order", "default priority") is something we'd guess at without usage
data. Cheaper to add later from a real signal than carry dead fields.

### Revisit when

- Sort order matters because alphabetical isn't what the user wants
  → add `sortOrder` + a drag handle.
- Archiving comes up because a finished project clutters the picker
  → add `archivedAt` + filter out of the picker by default.
- Clear UX signal for any of the "project-specific" fields rejected
  here.

---

## Decision 2 — Visual accent: subtle 3px left border vs. project-colored cards

### Options considered

- **A. Subtle 3px colored left border** on task rows that have a
  project. No border at all when `projectId` is null.
- **B. Project-colored card** (full background tint, or stronger
  border + color band).
- **C. No visual cue** — only a small text label.

### Decision: **A** (explicitly discussed and chosen in-session before
implementation)

### Reasoning

A keeps the list visually flat as the default. Project-less tasks
look exactly the same as before — the user's existing tasks don't
suddenly feel "wrong" or "incomplete" when this PR ships. Tasks that
*are* grouped get a thin color cue that's noticeable without dominating
the row.

B was rejected because it makes project-less tasks look broken by
contrast. Two visual modes ("colored card" vs. "white card") creates
a hierarchy the user didn't ask for.

C was rejected because color is the highest-bandwidth signal in a long
list — a label alone is easy to scan past. The 3px border is the
minimum that's still readable.

### Revisit when

- After real use, the 3px border is either invisible or too loud at
  375px → tune to 2px or 4px.
- Multiple projects per task ever becomes a thing → A breaks down
  (you can't show two colors on one border); revisit the cue then.

---

## Decision 3 — URL filter: `projectId="none"` literal vs. separate `noProject=true` param

### Options considered

- **A. Reserve `"none"`** as a filter value alongside real cuid project
  ids. URL: `?projectId=none` for "tasks with no project",
  `?projectId=ckxx...` for a specific one.
- **B. Separate boolean** `?noProject=true` for the project-less case;
  `projectId` only carries real ids.

### Decision: **A**

### Reasoning

A keeps the filter as a single URL param the chips can swap into.
Every chip is `<Link href={?projectId=X}>` and the active chip is
just a string-equality check — no special-case for "no project."

B is fine but it doubles the URL surface (`projectId` AND
`noProject`), forces the action to handle a mutually-exclusive pair,
and the UI has to know not to set both. More code, no visible benefit.

The reserved literal `"none"` is enforced in the zod schema so a
typo'd cuid can't accidentally match the "no project" branch.

### Revisit when

- We add more "absence" filters that all need their own literal
  (`"any"`, `"unassigned"`, etc.) → consider a more structured
  filter shape. Not currently in sight.

---

## Decision 4 — Defer per-task project re-assignment after creation

### Options considered

- **A. Defer** — projects can be assigned at task creation time only.
  To change a task's project, delete + recreate (or leave it).
- **B. Include in this PR** — small edit form (or inline dropdown)
  on each task row.

### Decision: **A (Defer)**

### Reasoning

Mirrors the scope discipline used in PR #2 (deferred stopped-entry
editing). Adding a per-task edit modal pulls in: a dropdown on every
row OR a modal trigger + form + validation + error states + tests.
50-100 lines of UI for a feature whose pain isn't yet measured.

The cost of deferring is bounded: users planning to add a project to
existing tasks can do so in Prisma Studio in the short term, or wait
for the planned task-edit modal in a later PR (likely Phase 7 polish,
or bundled with a richer task detail view).

### Revisit when

- Reassigning tasks between projects becomes a weekly need
  → ship a focused "task detail / edit" PR that handles project,
  priority, due date, and estimate together.

---

## Decision 5 — Migration: hand-rolled SQL vs. wake Railway and run `migrate dev`

### Options considered

- **A. Hand-roll** the migration SQL to match what `prisma migrate
  dev` would emit; verify by running `prisma migrate deploy` against
  the live DB.
- **B. Wait for / wake Railway**, run `prisma migrate dev` locally
  against the actual Postgres, let Prisma emit the SQL.

### Decision: **A**

### Reasoning

Railway's Hobby tier was idle and the project was paused during
authoring. Waking it just to author a migration adds wait time. The
schema diff was small (one new table + one new column + one new
index), and the emitted SQL follows a known shape we've seen in
prior migrations. Verifying with `prisma migrate deploy` against the
real DB at the end gives the same safety: Prisma rejects any drift
between schema, migration, and DB state.

B is the textbook path and would be the right call if the schema
diff were larger or touched constraints we hadn't seen before.

### Revisit when

- Any future migration touches: cross-table FKs, generated columns,
  Postgres-specific types (jsonb, vector), check constraints, or
  multi-statement transformations. Use `prisma migrate dev` for
  those.
- We have CI deploy automation that runs migrations
  (planned for Phase 7) — at that point we don't author migrations
  by hand at all.

---

## Implementation summary (pinned to these decisions)

- **Schema:** `Project { id, userId, name, color, icon?, ... }` +
  `Task.projectId String? @ onDelete: SetNull` + index on
  `(userId, projectId)`. Migration `20260611210914_phase_3_projects`
  applied to live Railway DB.
- **UI:** `/app/time/projects` mirrors `/app/money/categories`.
  Task rows show a 3px colored left border *only* when a project is
  assigned.
- **Filter:** single `projectId` URL param, `"none"` reserved for
  project-less tasks. Chips are server-rendered links.
- **Out of scope:** archiving, sort order, per-task project
  reassignment after creation, multiple projects per task.
