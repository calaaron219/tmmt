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
  type CreateTaskInput,
  type ListTasksFilter,
  type StartTimerInput,
  type UpdateTaskStatusInput,
  type CreateProjectInput,
  type UpdateProjectInput,
} from "@tmmt/shared";
import type { Task, Project } from "@tmmt/db";
import { revalidatePath } from "next/cache";

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
