// LLM provider contracts shared across web + api.
// The interface is provider-agnostic so the implementation can swap
// (Gemini → Claude → OpenAI) without touching callers.

export type CategorizationCategory = {
  id: string;
  name: string;
};

export type CategorizationRequest = {
  rawDescription: string;
  merchant?: string | null;
  amountCents: number;
  type: "INCOME" | "EXPENSE";
  availableCategories: CategorizationCategory[];
};

export type CategorizationResult = {
  // null when the model wasn't confident or no key is configured.
  categoryId: string | null;
  // 0..1, calibrated by the model itself — treat as advisory.
  confidence: number;
  reasoning?: string;
};

export interface LlmCategorizer {
  categorize(req: CategorizationRequest): Promise<CategorizationResult>;
}

// ─── Day planner ─────────────────────────────────────────
// Sibling interface to LlmCategorizer (not a replacement). Phase 3 PR #6.
// One method per interface keeps them easy to swap, mock, and reason about;
// the underlying SDK + auth config is shared. See
// docs/decisions/phase-3-time-system.md decision #4.

export type PlannerTask = {
  id: string;
  title: string;
  priority: "LOW" | "MEDIUM" | "HIGH";
  // Minutes the user estimated for this task. Null means "unknown".
  estimateMinutes: number | null;
  // ISO date string (YYYY-MM-DD) or null.
  dueOn: string | null;
  // Total minutes already tracked against this task (a hint to the model
  // that some progress has been made).
  trackedMinutes: number;
  projectName: string | null;
};

export type PlannerExistingBlock = {
  // Local times on the target day as "HH:MM" (24h, UTC). The planner UI
  // operates in UTC, matching the rest of the calendar.
  startHhMm: string;
  endHhMm: string;
  title: string;
};

export type PlanningRequest = {
  // ISO date (YYYY-MM-DD) for "the day being planned" — always today, in UTC.
  date: string;
  // Working window for the day, as "HH:MM"–"HH:MM" (UTC). The model
  // must keep all proposed blocks inside this window.
  workingHoursStart: string; // e.g. "09:00"
  workingHoursEnd: string; // e.g. "17:00"
  openTasks: PlannerTask[];
  existingBlocks: PlannerExistingBlock[];
};

export type ProposedBlock = {
  // The task to schedule, or null for a free-form block (e.g. "lunch").
  // The model chooses from the openTasks list; the action validates
  // ownership before persisting.
  taskId: string | null;
  title: string;
  // Local times on the planned day as "HH:MM" (24h, UTC). The action
  // converts these to absolute UTC Date objects before persisting.
  startHhMm: string;
  endHhMm: string;
  // One short sentence — surfaced in the proposal preview so the user
  // can sanity-check why the model placed this block.
  reasoning: string;
};

export type PlanningResult = {
  // Empty when no key is configured, the model errored, or it found
  // nothing worth scheduling. The caller treats null/empty as "show a
  // friendly empty-state message" — never a hard error.
  proposals: ProposedBlock[];
  // Optional one-liner the model uses to summarize the plan
  // (e.g. "Focused morning on the design doc; lighter afternoon").
  summary?: string;
};

export interface LlmPlanner {
  planDay(req: PlanningRequest): Promise<PlanningResult>;
}
