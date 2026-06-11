import { z } from "zod";

// Mirror Prisma's TaskStatus / TaskPriority enums by hand.
export const taskStatusSchema = z.enum([
  "TODO",
  "IN_PROGRESS",
  "DONE",
  "CANCELED",
]);
export type TaskStatus = z.infer<typeof taskStatusSchema>;

export const taskPrioritySchema = z.enum(["LOW", "MEDIUM", "HIGH"]);
export type TaskPriority = z.infer<typeof taskPrioritySchema>;

// Input for creating a task. estimateMinutes optional; due date optional.
export const createTaskInputSchema = z.object({
  title: z.string().min(1).max(200).trim(),
  description: z.string().max(2000).optional().nullable(),
  priority: taskPrioritySchema.default("MEDIUM"),
  estimateMinutes: z.number().int().positive().max(60 * 24).optional().nullable(),
  dueAt: z.coerce.date().optional().nullable(),
  projectId: z.string().cuid().optional().nullable(),
});
export type CreateTaskInput = z.infer<typeof createTaskInputSchema>;

// List filters. Default behavior in the action: return TODO + IN_PROGRESS.
export const listTasksFilterSchema = z.object({
  status: taskStatusSchema.optional(),
  // "include DONE" toggle for the UI; cheaper than passing all 4 statuses.
  includeDone: z.boolean().optional(),
  // Filter by project. The literal "none" matches tasks with no project;
  // a cuid matches that specific project; omitted means "any".
  projectId: z.union([z.literal("none"), z.string().cuid()]).optional(),
});
export type ListTasksFilter = z.infer<typeof listTasksFilterSchema>;

// Status update — separate from a generic "update task" because status
// changes drive completedAt timestamp logic on the server.
export const updateTaskStatusInputSchema = z.object({
  id: z.string().cuid(),
  status: taskStatusSchema,
});
export type UpdateTaskStatusInput = z.infer<typeof updateTaskStatusInputSchema>;

// ─── Time entries ────────────────────────────────────────
// Starting a timer requires a task. (Decision 2.2 — task-required for v1.)
export const startTimerInputSchema = z.object({
  taskId: z.string().cuid(),
});
export type StartTimerInput = z.infer<typeof startTimerInputSchema>;

// ─── Projects ────────────────────────────────────────────
// Projects group tasks. Schema mirrors Category (name + color + optional icon).
export const createProjectInputSchema = z.object({
  name: z.string().min(1).max(50).trim(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Must be hex like #3b82f6"),
  icon: z.string().max(10).optional().nullable(),
});
export type CreateProjectInput = z.infer<typeof createProjectInputSchema>;

export const updateProjectInputSchema = createProjectInputSchema.partial();
export type UpdateProjectInput = z.infer<typeof updateProjectInputSchema>;
