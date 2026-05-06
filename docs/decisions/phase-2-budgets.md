# Phase 2 PR #3 — Budget Tracking design decisions

> Captured before implementation so the rationale for each choice is preserved.
> If you find yourself questioning a decision later, reread the *Reasoning*
> section before changing the code — most of these have a non-obvious tradeoff.
> Last updated: 2026-05-05.

## Context

Phase 2 PR #3 adds monthly per-category spending caps (budgets). The `Budget`
table already exists from Phase 1, so this is pure application code.

Six product/UX decisions were debated before writing any code; the chosen path
in each is recorded below alongside the alternatives we passed on.

---

## Decision 1 — Show all expense categories vs. only budgeted ones

### Options considered

- **A. Show every expense category.** Budgeted rows render a progress bar.
  Unbudgeted rows render an inline "Set limit" input.
- **B. Show only budgeted categories.** A separate `+ Add budget` picker
  surfaces remaining categories.
- **C. Hybrid.** Budgeted categories at top; collapsed "Other categories"
  section below shows unbudgeted spend.

### Decision: **A**

### Reasoning

Pros of A: discoverable (every category visible without hunting), one mental
model ("this is my budget table"), empty state is naturally productive
(every category is a row), inline editing is fast.

Cons of A: visually busy with 15+ categories, "$0 spent" rows for seasonal
categories clutter the view, longer mobile scroll, forces a "Set limit"
interaction even for categories the user doesn't track.

B is the YNAB / Mint pattern and scales better — but requires a two-step
add and creates an awkward empty state on first visit. C is the best long-term
shape but adds two-section design overhead.

At ~10 expense categories today, A's busy-ness doesn't bite and discoverability
matters more in v1 while the user is still learning what to budget.

### Revisit when

- Category count grows past 15 → switch to C in a 1-day follow-up.
- Mobile UX feels cramped → switch to B.
- User reports "shadow spending" (significant spend on unbudgeted categories
  going unnoticed) → C handles this best.

---

## Decision 2 — "Copy last month's budgets" affordance

### Options considered

- **A. Permanent button** on the budgets page header.
- **B. Skip entirely.** User retypes each month.
- **C. Auto-prompt.** When the user navigates to a month with no budgets and
  the previous month had some, show a one-time inline prompt: *"No budgets for
  May yet. [Copy from April] or scroll down to set them manually."* The prompt
  disappears once they act or set anything.

### Decision: **C**

### Reasoning

Monthly budgets are mostly stable (rent, groceries, utilities don't move much),
so re-typing is a high-friction failure mode that kills budgeting tools. But
a permanent button (A) creates always-on UI surface for a once-a-month action
and risks accidental double-clicks ("did it overwrite my edits?").

C is the best UX/code ratio — zero permanent UI, helpful exactly when needed,
self-clearing. The cost is conditional rendering (check "did this month have
budgets" + "did the previous month have budgets").

B is a viable v1 if shipping speed matters — but you'll feel the absence
within ~2 months of monthly check-ins.

### Revisit when

- The auto-prompt rendering logic feels too complex → fall back to A
  (simpler permanent button).
- Multi-user app with widely-varying month-to-month budgets → consider
  B (force deliberate review).

---

## Decision 3 — Income budgets / savings goals

### Options considered

- **A. Add savings goals to this PR** (e.g. "Save $500 from Salary this month").
- **B. Defer to Phase 5** ("Time × Money OS"), which already owns goals and
  hourly rates conceptually.

### Decision: **B**

### Reasoning

Savings goals share UI surface with expense budgets but invert semantics:
*expense budget* is a cap (over = bad), *savings goal* is a floor (under = bad).
The progress bar inverts. This forks the mental model and doubles the UI
surface in this PR.

The current `Budget` model has `categoryId String` (non-null) referencing a
Category of any kind, so structurally adding income budgets later is fine.
But Phase 5's holistic view (hourly rate × time × money) is the right home
for goals — landing them here would make Phase 5 a no-op for that feature.

### Revisit when

- Phase 5 work begins. Goals belong there with the hourly-rate / time-cost
  context.

---

## Decision 4 — What counts as "spent"

### Options considered

- **A. Gross expense.** `SUM(amountCents) WHERE type='EXPENSE' AND
  categoryId=X` for the month.
- **B. Net cash flow.** `SUM(EXPENSE) − SUM(INCOME)` on the same category.
  Refunds entered as INCOME on an expense category reduce the bar.
- **C. Same as A**, but explicit — small `(?)` tooltip near the bar reads
  "Spent = expense transactions in this category. Refunds are not subtracted yet."

### Decision: **A + tooltip from C**

### Reasoning

A is simple, one query, one mental model — and matches what shows on the
transaction list. B is more accurate to true cash flow but introduces
conceptual weirdness (logging INCOME on an expense category is already off-pattern,
since `Category.kind` is INCOME or EXPENSE).

Most users don't categorize refunds — they go to "Misc Income" or get netted
into the original transaction. The refund edge case is theoretical for the
app's current usage.

Adding the tooltip from C makes the rule visible to the user so they can
match their mental model to ours.

### Revisit when

- Refund frequency in real usage exceeds ~5% of transactions → switch to B
  (5-line change in `listBudgetsWithSpend`).

---

## Decision 5 — Cross-month overrun warnings on `/app/money`

### Options considered

- **A. Add a banner** on `/app/money`: *"⚠ 2 categories over budget this
  month — Groceries, Dining"*.
- **B. Skip in this PR.** Users go to `/app/money/budgets` to check status.

### Decision: **B**

### Reasoning

The right shape of an "ambient awareness" UI surface depends on how the user
actually uses budgets. Adding the banner now bakes in a guess (overrun-only?
near-limit warning? per-row chip?) before any usage signal exists.

`/app/money` is also already busy: header links + quick-add + AI categorize
banner + transaction list. Adding another conditional element risks pollution.

Pull model — user opens `/app/money/budgets` deliberately — is the safer
v1 default.

### Revisit when

- After ~1 month of real budget usage. The signal is "did I actually open
  the budgets page when I needed to?" If no, ambient awareness on `/app/money`
  is worth adding. The right form may be a small per-row chip on the
  transaction list, not a top-level banner.

---

## Decision 6 — Where to link Budgets from

### Options considered

- **A. Header link on `/app/money`** alongside "Manage categories →" and
  "Import CSV →".
- **B. Card on `/app` dashboard** alongside Money / Time module cards.
- **C. Build a tab nav** `Transactions | Budgets | Categories | Import`
  on `/app/money`.

### Decision: **A** (with C earmarked for the next sub-feature PR)

### Reasoning

A matches the established pattern (zero new design surface), and the header
currently has 2 links — adding the 3rd doesn't break the layout. B is
conceptually wrong (Budgets is a sub-feature of Money, not a peer).

C is the right long-term shape but premature today. Standard breakpoint for
header → tab nav refactor is 4+ links. The next sub-feature (likely
Subscriptions) is the trigger.

### Revisit when

- Adding the 4th sub-route under `/app/money` (header gets too crowded
  at 4-5 links).
- Mobile width starts dropping the link row to two lines.

---

## Implementation summary (pinned to these decisions)

- Page: `/app/money/budgets`
- Layout: full list of expense categories, inline edit per row
- Auto-prompt: "Copy from previous month" inline banner shown only when
  current month has no budgets and previous month did
- Spent calc: `SUM(amountCents) WHERE type='EXPENSE'` per category per month;
  with `(?)` tooltip
- Nav: header link on `/app/money`
- Out of scope: savings goals, overrun banner on `/app/money`

## Files touched

- `apps/web/src/app/app/money/budgets/page.tsx` (new)
- `apps/web/src/app/app/money/budgets/budget-row.tsx` (new)
- `apps/web/src/app/app/money/budgets/month-nav.tsx` (new)
- `apps/web/src/app/app/money/budgets/copy-previous-month-prompt.tsx` (new)
- `apps/web/src/app/app/money/actions.ts` (edit — add 3-4 actions)
- `apps/web/src/app/app/money/page.tsx` (edit — add header link)
- `packages/shared/src/schemas/money.ts` (edit — add `upsertBudgetInputSchema`)
