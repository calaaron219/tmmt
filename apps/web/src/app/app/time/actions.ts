"use server";

import { auth } from "@/auth";
import { prisma } from "@tmmt/db";
import {
  createTaskInputSchema,
  listTasksFilterSchema,
  updateTaskStatusInputSchema,
  type CreateTaskInput,
  type ListTasksFilter,
  type UpdateTaskStatusInput,
} from "@tmmt/shared";
import { revalidatePath } from "next/cache";

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  return session.user.id;
}

// Default: return TODO + IN_PROGRESS only. Pass { includeDone: true } to
// also include completed tasks (UI uses this for the "Show completed"
// toggle).
export async function listTasks(rawFilters: unknown = {}) {
  const userId = await requireUser();
  const filters: ListTasksFilter = listTasksFilterSchema.parse(rawFilters);

  const where: {
    userId: string;
    status?: { in: ("TODO" | "IN_PROGRESS" | "DONE" | "CANCELED")[] };
  } = { userId };

  if (filters.status) {
    where.status = { in: [filters.status] };
  } else if (!filters.includeDone) {
    where.status = { in: ["TODO", "IN_PROGRESS"] };
  }

  return prisma.task.findMany({
    where,
    // Two-key sort: open before done, then by dueAt nulls-last, then newest first.
    orderBy: [{ status: "asc" }, { dueAt: "asc" }, { createdAt: "desc" }],
    take: 200,
  });
}

export async function createTask(raw: CreateTaskInput) {
  const userId = await requireUser();
  const input = createTaskInputSchema.parse(raw);

  const task = await prisma.task.create({
    data: {
      userId,
      title: input.title,
      description: input.description ?? null,
      priority: input.priority,
      estimateMinutes: input.estimateMinutes ?? null,
      dueAt: input.dueAt ?? null,
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
