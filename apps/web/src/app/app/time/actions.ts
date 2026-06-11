"use server";

import { auth } from "@/auth";
import { prisma } from "@tmmt/db";
import {
  createTaskInputSchema,
  listTasksFilterSchema,
  startTimerInputSchema,
  updateTaskStatusInputSchema,
  createProjectInputSchema,
  updateProjectInputSchema,
  createRoutineInputSchema,
  updateRoutineInputSchema,
  createTimeBlockInputSchema,
  updateTimeBlockInputSchema,
  listBlocksFilterSchema,
  type CreateTaskInput,
  type ListTasksFilter,
  type StartTimerInput,
  type UpdateTaskStatusInput,
  type CreateProjectInput,
  type UpdateProjectInput,
  type CreateRoutineInput,
  type UpdateRoutineInput,
  type CreateTimeBlockInput,
  type UpdateTimeBlockInput,
  type ListBlocksFilter,
} from "@tmmt/shared";
import type { Task, Project, Routine, TimeBlock } from "@tmmt/db";
import type {
  PlannerExistingBlock,
  PlannerTask,
  ProposedBlock,
} from "@tmmt/shared";
import { revalidatePath } from "next/cache";
import { aiPlanner } from "@/lib/ai-planner";

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  return session.user.id;
}

// Task row augmented with the per-task tracked-time info the UI needs.
// `trackedSeconds` is the sum of completed entries; `isActive` is true if
// the current running timer (if any) is on this task. `project` is the
// minimal project info needed to render the color accent + label.
export type TaskWithTracking = Task & {
  trackedSeconds: number;
  isActive: boolean;
  project: Pick<Project, "id" | "name" | "color" | "icon"> | null;
};

// Default: return TODO + IN_PROGRESS only. Pass { includeDone: true } to
// also include completed tasks (UI uses this for the "Show completed"
// toggle). Returns tasks augmented with tracked-time totals + active flag.
export async function listTasks(
  rawFilters: unknown = {}
): Promise<TaskWithTracking[]> {
  const userId = await requireUser();
  const filters: ListTasksFilter = listTasksFilterSchema.parse(rawFilters);

  const where: {
    userId: string;
    status?: { in: ("TODO" | "IN_PROGRESS" | "DONE" | "CANCELED")[] };
    projectId?: string | null;
  } = { userId };

  if (filters.status) {
    where.status = { in: [filters.status] };
  } else if (!filters.includeDone) {
    where.status = { in: ["TODO", "IN_PROGRESS"] };
  }

  if (filters.projectId === "none") {
    where.projectId = null;
  } else if (filters.projectId) {
    where.projectId = filters.projectId;
  }

  const [tasks, completedSums, active] = await Promise.all([
    prisma.task.findMany({
      where,
      // Two-key sort: open before done, then by dueAt nulls-last, then newest first.
      orderBy: [{ status: "asc" }, { dueAt: "asc" }, { createdAt: "desc" }],
      include: {
        project: { select: { id: true, name: true, color: true, icon: true } },
      },
      take: 200,
    }),
    prisma.timeEntry.groupBy({
      by: ["taskId"],
      where: { userId, endedAt: { not: null } },
      _sum: { durationSeconds: true },
    }),
    prisma.timeEntry.findFirst({
      where: { userId, endedAt: null },
      select: { taskId: true },
    }),
  ]);

  const sumByTask = new Map(
    completedSums.map((s) => [s.taskId, s._sum.durationSeconds ?? 0])
  );

  return tasks.map((t) => ({
    ...t,
    trackedSeconds: sumByTask.get(t.id) ?? 0,
    isActive: active?.taskId === t.id,
  }));
}

export async function createTask(raw: CreateTaskInput) {
  const userId = await requireUser();
  const input = createTaskInputSchema.parse(raw);

  // Defensive: if a projectId was passed, confirm it belongs to this user.
  if (input.projectId) {
    const owned = await prisma.project.findFirst({
      where: { id: input.projectId, userId },
      select: { id: true },
    });
    if (!owned) {
      throw new Error("Project not found");
    }
  }

  const task = await prisma.task.create({
    data: {
      userId,
      title: input.title,
      description: input.description ?? null,
      priority: input.priority,
      estimateMinutes: input.estimateMinutes ?? null,
      dueAt: input.dueAt ?? null,
      projectId: input.projectId ?? null,
    },
  });

  revalidatePath("/app/time");
  return task;
}

// Status update sets completedAt when transitioning to DONE; clears it
// when leaving DONE (e.g. user reopens a task).
export async function updateTaskStatus(raw: UpdateTaskStatusInput) {
  const userId = await requireUser();
  const input = updateTaskStatusInputSchema.parse(raw);

  // Confirm ownership first; updateMany scoped by userId would silently
  // succeed-with-zero-rows on a bad id.
  const owned = await prisma.task.findFirst({
    where: { id: input.id, userId },
    select: { id: true, status: true },
  });
  if (!owned) {
    throw new Error("Task not found");
  }

  const completedAt =
    input.status === "DONE"
      ? owned.status === "DONE"
        ? undefined // already done; preserve original completedAt
        : new Date()
      : input.status === "CANCELED"
        ? null
        : null;

  const task = await prisma.task.update({
    where: { id: input.id },
    data: {
      status: input.status,
      ...(completedAt !== undefined && { completedAt }),
    },
  });

  revalidatePath("/app/time");
  return task;
}

export async function deleteTask(id: string) {
  const userId = await requireUser();
  const result = await prisma.task.deleteMany({
    where: { id, userId },
  });
  if (result.count === 0) {
    throw new Error("Task not found");
  }
  revalidatePath("/app/time");
}

// ─── Time tracking ───────────────────────────────────────

export type ActiveTimer = {
  id: string;
  taskId: string;
  taskTitle: string;
  startedAt: Date;
};

// Returns the single running timer for this user, or null. Used by the
// page header to render the active-timer banner.
export async function getActiveTimer(): Promise<ActiveTimer | null> {
  const userId = await requireUser();
  const entry = await prisma.timeEntry.findFirst({
    where: { userId, endedAt: null },
    include: { task: { select: { id: true, title: true } } },
    orderBy: { startedAt: "desc" },
  });
  if (!entry) return null;
  return {
    id: entry.id,
    taskId: entry.task.id,
    taskTitle: entry.task.title,
    startedAt: entry.startedAt,
  };
}

// Starts a timer on the given task. If another timer is running, stops it
// first (decision 2.1 — single active timer). Returns info about what was
// stopped (if anything) so the UI can show a "stopped X (12m)" toast.
export async function startTimer(raw: StartTimerInput): Promise<{
  stopped: { taskTitle: string; durationSeconds: number } | null;
}> {
  const userId = await requireUser();
  const input = startTimerInputSchema.parse(raw);

  // Confirm the task belongs to this user.
  const task = await prisma.task.findFirst({
    where: { id: input.taskId, userId },
    select: { id: true },
  });
  if (!task) {
    throw new Error("Task not found");
  }

  // Atomic two-step in a transaction: stop any running timer for this user,
  // then start the new one. Without the transaction, a fast double-click
  // could leave two rows with endedAt = null.
  const stopped = await prisma.$transaction(async (tx) => {
    const running = await tx.timeEntry.findFirst({
      where: { userId, endedAt: null },
      include: { task: { select: { title: true } } },
    });

    let stoppedSummary: { taskTitle: string; durationSeconds: number } | null =
      null;
    if (running) {
      const endedAt = new Date();
      const durationSeconds = Math.max(
        0,
        Math.round((endedAt.getTime() - running.startedAt.getTime()) / 1000)
      );
      await tx.timeEntry.update({
        where: { id: running.id },
        data: { endedAt, durationSeconds },
      });
      stoppedSummary = {
        taskTitle: running.task.title,
        durationSeconds,
      };
    }

    await tx.timeEntry.create({
      data: { userId, taskId: input.taskId },
    });

    return stoppedSummary;
  });

  revalidatePath("/app/time");
  return { stopped };
}

// ─── Projects ────────────────────────────────────────────

export async function listProjects(): Promise<Project[]> {
  const userId = await requireUser();
  return prisma.project.findMany({
    where: { userId },
    orderBy: { name: "asc" },
  });
}

export async function createProject(raw: CreateProjectInput) {
  const userId = await requireUser();
  const input = createProjectInputSchema.parse(raw);

  try {
    const project = await prisma.project.create({
      data: {
        userId,
        name: input.name,
        color: input.color,
        icon: input.icon ?? null,
      },
    });
    revalidatePath("/app/time/projects");
    revalidatePath("/app/time");
    return project;
  } catch (e) {
    if (
      e instanceof Error &&
      "code" in e &&
      (e as { code?: string }).code === "P2002"
    ) {
      throw new Error(`A project named "${input.name}" already exists`);
    }
    throw e;
  }
}

export async function updateProject(id: string, raw: UpdateProjectInput) {
  const userId = await requireUser();
  const input = updateProjectInputSchema.parse(raw);

  const owned = await prisma.project.findFirst({
    where: { id, userId },
    select: { id: true },
  });
  if (!owned) {
    throw new Error("Project not found");
  }

  try {
    const project = await prisma.project.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.color !== undefined && { color: input.color }),
        ...(input.icon !== undefined && { icon: input.icon }),
      },
    });
    revalidatePath("/app/time/projects");
    revalidatePath("/app/time");
    return project;
  } catch (e) {
    if (
      e instanceof Error &&
      "code" in e &&
      (e as { code?: string }).code === "P2002"
    ) {
      throw new Error(`A project named "${input.name}" already exists`);
    }
    throw e;
  }
}

// Schema FK is onDelete: SetNull, so tasks survive — they just become
// project-less. Matches the Category → Transaction pattern.
export async function deleteProject(id: string) {
  const userId = await requireUser();
  const result = await prisma.project.deleteMany({
    where: { id, userId },
  });
  if (result.count === 0) {
    throw new Error("Project not found");
  }
  revalidatePath("/app/time/projects");
  revalidatePath("/app/time");
}

// ─── Routines ────────────────────────────────────────────

export async function listRoutines(): Promise<Routine[]> {
  const userId = await requireUser();
  return prisma.routine.findMany({
    where: { userId },
    orderBy: { title: "asc" },
  });
}

export async function createRoutine(raw: CreateRoutineInput) {
  const userId = await requireUser();
  const input = createRoutineInputSchema.parse(raw);

  if (input.projectId) {
    const owned = await prisma.project.findFirst({
      where: { id: input.projectId, userId },
      select: { id: true },
    });
    if (!owned) {
      throw new Error("Project not found");
    }
  }

  try {
    const routine = await prisma.routine.create({
      data: {
        userId,
        title: input.title,
        description: input.description ?? null,
        priority: input.priority,
        estimateMinutes: input.estimateMinutes ?? null,
        projectId: input.projectId ?? null,
      },
    });
    revalidatePath("/app/time/routines");
    revalidatePath("/app/time");
    return routine;
  } catch (e) {
    if (
      e instanceof Error &&
      "code" in e &&
      (e as { code?: string }).code === "P2002"
    ) {
      throw new Error(`A routine named "${input.title}" already exists`);
    }
    throw e;
  }
}

export async function updateRoutine(id: string, raw: UpdateRoutineInput) {
  const userId = await requireUser();
  const input = updateRoutineInputSchema.parse(raw);

  const owned = await prisma.routine.findFirst({
    where: { id, userId },
    select: { id: true },
  });
  if (!owned) {
    throw new Error("Routine not found");
  }

  if (input.projectId) {
    const ownedProject = await prisma.project.findFirst({
      where: { id: input.projectId, userId },
      select: { id: true },
    });
    if (!ownedProject) {
      throw new Error("Project not found");
    }
  }

  try {
    const routine = await prisma.routine.update({
      where: { id },
      data: {
        ...(input.title !== undefined && { title: input.title }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.priority !== undefined && { priority: input.priority }),
        ...(input.estimateMinutes !== undefined && {
          estimateMinutes: input.estimateMinutes,
        }),
        ...(input.projectId !== undefined && { projectId: input.projectId }),
      },
    });
    revalidatePath("/app/time/routines");
    revalidatePath("/app/time");
    return routine;
  } catch (e) {
    if (
      e instanceof Error &&
      "code" in e &&
      (e as { code?: string }).code === "P2002"
    ) {
      throw new Error(`A routine named "${input.title}" already exists`);
    }
    throw e;
  }
}

// Schema FK is onDelete: SetNull on Task.routineId, so historical tasks
// generated by this routine survive — they just lose the back-pointer.
export async function deleteRoutine(id: string) {
  const userId = await requireUser();
  const result = await prisma.routine.deleteMany({
    where: { id, userId },
  });
  if (result.count === 0) {
    throw new Error("Routine not found");
  }
  revalidatePath("/app/time/routines");
  revalidatePath("/app/time");
}

// Lazy generator. Called from /app/time page load. Per decision #3 in
// docs/decisions/phase-3-time-system.md: no background worker yet, so
// generation happens inline. `lastGeneratedFor` is set to today's UTC
// midnight; routines with a `lastGeneratedFor >= today` are skipped.
//
// Idempotency: the WHERE clause filters out already-generated routines,
// and the per-routine update inside the transaction makes a fast double-
// load (e.g. two tabs) safe — the second pass finds nothing to do.
//
// Returns the count of tasks created so the page can show a small
// "Generated N routine task(s)" hint if it's the first load of the day.
async function ensureTodayRoutineTasks(userId: string): Promise<number> {
  // Today's UTC midnight. UTC chosen because TimeEntry/Task timestamps
  // are stored in UTC; a "day" boundary in the user's local TZ would
  // need a per-user TZ column we don't have yet (deferred to Phase 4).
  const now = new Date();
  const todayUtc = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );

  const due = await prisma.routine.findMany({
    where: {
      userId,
      OR: [{ lastGeneratedFor: null }, { lastGeneratedFor: { lt: todayUtc } }],
    },
  });

  if (due.length === 0) return 0;

  // Per-routine transaction: create the task and stamp lastGeneratedFor
  // together so a crash mid-loop can't leave a routine with the stamp
  // bumped but no task. Sequential, not Promise.all — keeps the loop
  // simple and ~10 routines is well within page-load latency budget.
  let created = 0;
  for (const r of due) {
    await prisma.$transaction(async (tx) => {
      // Defensive re-check inside the tx: if a parallel page-load already
      // bumped this routine, skip without creating a duplicate task.
      const fresh = await tx.routine.findUnique({
        where: { id: r.id },
        select: { lastGeneratedFor: true },
      });
      if (fresh?.lastGeneratedFor && fresh.lastGeneratedFor >= todayUtc) {
        return;
      }

      await tx.task.create({
        data: {
          userId,
          title: r.title,
          description: r.description,
          priority: r.priority,
          estimateMinutes: r.estimateMinutes,
          projectId: r.projectId,
          routineId: r.id,
        },
      });
      await tx.routine.update({
        where: { id: r.id },
        data: { lastGeneratedFor: todayUtc },
      });
      created++;
    });
  }
  return created;
}

// Wrapper exported for the page. Pulled out so the page doesn't need to
// know about the `userId` plumbing.
export async function ensureTodayRoutineTasksForUser(): Promise<number> {
  const userId = await requireUser();
  return ensureTodayRoutineTasks(userId);
}

// ─── Calendar time blocks ────────────────────────────────

// A TimeBlock joined with the minimal task + project info the calendar
// needs for color resolution and the "open task" link on the popover.
export type TimeBlockWithTask = TimeBlock & {
  task:
    | (Pick<Task, "id" | "title"> & {
        project: Pick<Project, "id" | "color" | "name"> | null;
      })
    | null;
};

// Parses "YYYY-MM-DD" as the UTC midnight of that calendar date. Used
// for week-window bounds; pairs with how the calendar serializes dates.
function parseUtcMidnight(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

// Lists all blocks that overlap the 7-day window [weekOf, weekOf + 7).
// Cross-day blocks aren't allowed at create-time, so any block whose
// startsAt is in the window will also have its endsAt in the window.
export async function listBlocksForWeek(
  raw: ListBlocksFilter
): Promise<TimeBlockWithTask[]> {
  const userId = await requireUser();
  const filter = listBlocksFilterSchema.parse(raw);

  const start = parseUtcMidnight(filter.weekOf);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 7);

  return prisma.timeBlock.findMany({
    where: {
      userId,
      startsAt: { gte: start, lt: end },
    },
    include: {
      task: {
        select: {
          id: true,
          title: true,
          project: { select: { id: true, color: true, name: true } },
        },
      },
    },
    orderBy: { startsAt: "asc" },
  });
}

// Shared validation: block must fit inside a single calendar day
// (no midnight crossing in v1) and must be ≥ 5 minutes long.
function validateBlockBounds(startsAt: Date, endsAt: Date) {
  if (endsAt <= startsAt) {
    throw new Error("End time must be after start time");
  }
  const minMinutes = 5;
  if ((endsAt.getTime() - startsAt.getTime()) / 60000 < minMinutes) {
    throw new Error(`Block must be at least ${minMinutes} minutes long`);
  }
  // "Same day" in UTC; the calendar uses UTC for the day boundary too.
  const sameDayUtc =
    startsAt.getUTCFullYear() === endsAt.getUTCFullYear() &&
    startsAt.getUTCMonth() === endsAt.getUTCMonth() &&
    startsAt.getUTCDate() === endsAt.getUTCDate();
  if (!sameDayUtc) {
    throw new Error("Block cannot cross midnight (v1 limit)");
  }
}

export async function createTimeBlock(raw: CreateTimeBlockInput) {
  const userId = await requireUser();
  const input = createTimeBlockInputSchema.parse(raw);

  validateBlockBounds(input.startsAt, input.endsAt);

  if (input.taskId) {
    const owned = await prisma.task.findFirst({
      where: { id: input.taskId, userId },
      select: { id: true },
    });
    if (!owned) {
      throw new Error("Task not found");
    }
  }

  const block = await prisma.timeBlock.create({
    data: {
      userId,
      taskId: input.taskId ?? null,
      title: input.title,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      color: input.color ?? null,
    },
  });

  revalidatePath("/app/time/calendar");
  return block;
}

export async function updateTimeBlock(id: string, raw: UpdateTimeBlockInput) {
  const userId = await requireUser();
  const input = updateTimeBlockInputSchema.parse(raw);

  const existing = await prisma.timeBlock.findFirst({
    where: { id, userId },
  });
  if (!existing) {
    throw new Error("Block not found");
  }

  const nextStartsAt = input.startsAt ?? existing.startsAt;
  const nextEndsAt = input.endsAt ?? existing.endsAt;
  validateBlockBounds(nextStartsAt, nextEndsAt);

  if (input.taskId) {
    const owned = await prisma.task.findFirst({
      where: { id: input.taskId, userId },
      select: { id: true },
    });
    if (!owned) {
      throw new Error("Task not found");
    }
  }

  const block = await prisma.timeBlock.update({
    where: { id },
    data: {
      ...(input.taskId !== undefined && { taskId: input.taskId }),
      ...(input.title !== undefined && { title: input.title }),
      ...(input.startsAt !== undefined && { startsAt: input.startsAt }),
      ...(input.endsAt !== undefined && { endsAt: input.endsAt }),
      ...(input.color !== undefined && { color: input.color }),
    },
  });

  revalidatePath("/app/time/calendar");
  return block;
}

export async function deleteTimeBlock(id: string) {
  const userId = await requireUser();
  const result = await prisma.timeBlock.deleteMany({
    where: { id, userId },
  });
  if (result.count === 0) {
    throw new Error("Block not found");
  }
  revalidatePath("/app/time/calendar");
}

// ─── AI day planner ──────────────────────────────────────

// Working window the planner targets. Narrower than the calendar grid
// (6am–10pm) on purpose: most users want the plan inside roughly a
// workday. Configurable later via user prefs (Phase 4+).
const PLANNER_START_HHMM = "09:00";
const PLANNER_END_HHMM = "18:00";

// Returns YYYY-MM-DD (UTC) for "today".
function todayUtcYmd(): string {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  )
    .toISOString()
    .slice(0, 10);
}

function hhmm(d: Date): string {
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(
    d.getUTCMinutes()
  ).padStart(2, "0")}`;
}

export type PlanProposalView = {
  date: string;
  workingHoursStart: string;
  workingHoursEnd: string;
  proposals: (ProposedBlock & {
    // Project color (resolved via the linked task) so the proposal
    // preview can use the same accent as the calendar.
    color: string | null;
  })[];
  summary?: string;
};

// Gathers today's context, calls the LLM, returns the proposed plan.
// Does NOT persist — that's applyPlan's job, gated by an explicit user
// click. Keeping the read action side-effect-free makes it easy to
// retry / re-roll without surprises.
export async function planMyDay(): Promise<PlanProposalView> {
  const userId = await requireUser();
  const date = todayUtcYmd();

  // Today's UTC window for the existingBlocks lookup.
  const startOfDay = new Date(`${date}T00:00:00.000Z`);
  const endOfDay = new Date(startOfDay);
  endOfDay.setUTCDate(endOfDay.getUTCDate() + 1);

  const [tasks, blocks, completedSums] = await Promise.all([
    prisma.task.findMany({
      where: { userId, status: { in: ["TODO", "IN_PROGRESS"] } },
      include: {
        project: { select: { id: true, name: true, color: true } },
      },
      orderBy: [{ priority: "desc" }, { dueAt: "asc" }],
      take: 50,
    }),
    prisma.timeBlock.findMany({
      where: {
        userId,
        startsAt: { gte: startOfDay, lt: endOfDay },
      },
      orderBy: { startsAt: "asc" },
    }),
    prisma.timeEntry.groupBy({
      by: ["taskId"],
      where: { userId, endedAt: { not: null } },
      _sum: { durationSeconds: true },
    }),
  ]);

  const trackedByTask = new Map(
    completedSums.map((s) => [s.taskId, s._sum.durationSeconds ?? 0])
  );

  const plannerTasks: PlannerTask[] = tasks.map((t) => ({
    id: t.id,
    title: t.title,
    priority: t.priority,
    estimateMinutes: t.estimateMinutes,
    dueOn: t.dueAt ? t.dueAt.toISOString().slice(0, 10) : null,
    trackedMinutes: Math.round((trackedByTask.get(t.id) ?? 0) / 60),
    projectName: t.project?.name ?? null,
  }));

  const existingBlocks: PlannerExistingBlock[] = blocks.map((b) => ({
    startHhMm: hhmm(b.startsAt),
    endHhMm: hhmm(b.endsAt),
    title: b.title,
  }));

  const result = await aiPlanner.planDay({
    date,
    workingHoursStart: PLANNER_START_HHMM,
    workingHoursEnd: PLANNER_END_HHMM,
    openTasks: plannerTasks,
    existingBlocks,
  });

  // Decorate each proposal with the color it'll get when persisted.
  // Cheaper to resolve here than re-query when the user clicks Apply.
  const taskById = new Map(tasks.map((t) => [t.id, t]));
  const proposalsWithColor = result.proposals.map((p) => ({
    ...p,
    color: p.taskId
      ? (taskById.get(p.taskId)?.project?.color ?? null)
      : null,
  }));

  return {
    date,
    workingHoursStart: PLANNER_START_HHMM,
    workingHoursEnd: PLANNER_END_HHMM,
    proposals: proposalsWithColor,
    summary: result.summary,
  };
}

// Persists the proposals the user accepted as real TimeBlock rows.
// Input is the array of accepted proposals (the UI may have dropped
// some before calling). Validation here is the same as createTimeBlock
// (ownership + bounds), per-row — drops anything that fails rather
// than nuking the whole apply.
export async function applyPlan(
  raw: { date: string; proposals: ProposedBlock[] }
): Promise<{ created: number; skipped: number }> {
  const userId = await requireUser();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw.date)) {
    throw new Error("Invalid date — use YYYY-MM-DD");
  }
  const proposals = Array.isArray(raw.proposals) ? raw.proposals : [];
  if (proposals.length === 0) {
    return { created: 0, skipped: 0 };
  }

  const [y, m, d] = raw.date.split("-").map(Number);
  const dayStart = new Date(Date.UTC(y, m - 1, d));

  // Pre-fetch the set of valid task ids once. Per-row .findFirst would
  // be N queries for nothing — a single in: query handles ownership.
  const candidateTaskIds = proposals
    .map((p) => p.taskId)
    .filter((id): id is string => id !== null);
  const ownedTaskIds = new Set(
    candidateTaskIds.length > 0
      ? (
          await prisma.task.findMany({
            where: { id: { in: candidateTaskIds }, userId },
            select: { id: true },
          })
        ).map((t) => t.id)
      : []
  );

  let created = 0;
  let skipped = 0;

  for (const p of proposals) {
    if (!/^\d{2}:\d{2}$/.test(p.startHhMm) || !/^\d{2}:\d{2}$/.test(p.endHhMm)) {
      skipped++;
      continue;
    }
    if (p.taskId !== null && !ownedTaskIds.has(p.taskId)) {
      skipped++;
      continue;
    }
    const [sh, sm] = p.startHhMm.split(":").map(Number);
    const [eh, em] = p.endHhMm.split(":").map(Number);
    const startsAt = new Date(dayStart);
    startsAt.setUTCHours(sh, sm, 0, 0);
    const endsAt = new Date(dayStart);
    endsAt.setUTCHours(eh, em, 0, 0);

    if (endsAt <= startsAt) {
      skipped++;
      continue;
    }
    // Drop anything outside the day or shorter than the calendar's
    // 5-min minimum — same invariant validateBlockBounds enforces.
    if ((endsAt.getTime() - startsAt.getTime()) / 60000 < 5) {
      skipped++;
      continue;
    }

    try {
      await prisma.timeBlock.create({
        data: {
          userId,
          taskId: p.taskId ?? null,
          title: p.title.slice(0, 200),
          startsAt,
          endsAt,
          color: null, // inherits task → project color in the UI
        },
      });
      created++;
    } catch {
      skipped++;
    }
  }

  revalidatePath("/app/time/calendar");
  return { created, skipped };
}

// Stops the user's currently-running timer (no-op if there isn't one).
// Returns the stopped entry's duration so the UI can show it.
export async function stopActiveTimer(): Promise<{
  stopped: { taskTitle: string; durationSeconds: number } | null;
}> {
  const userId = await requireUser();

  const stopped = await prisma.$transaction(async (tx) => {
    const running = await tx.timeEntry.findFirst({
      where: { userId, endedAt: null },
      include: { task: { select: { title: true } } },
    });
    if (!running) return null;

    const endedAt = new Date();
    const durationSeconds = Math.max(
      0,
      Math.round((endedAt.getTime() - running.startedAt.getTime()) / 1000)
    );
    await tx.timeEntry.update({
      where: { id: running.id },
      data: { endedAt, durationSeconds },
    });
    return { taskTitle: running.task.title, durationSeconds };
  });

  revalidatePath("/app/time");
  return { stopped };
}
