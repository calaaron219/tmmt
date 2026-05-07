"use client";

import { useTransition } from "react";
import { deleteTask, updateTaskStatus } from "./actions";
import type { Task } from "@tmmt/db";

const PRIORITY_STYLE: Record<
  "LOW" | "MEDIUM" | "HIGH",
  { label: string; className: string }
> = {
  LOW: { label: "Low", className: "bg-gray-100 text-gray-600" },
  MEDIUM: { label: "Med", className: "bg-blue-50 text-blue-700" },
  HIGH: { label: "High", className: "bg-red-50 text-red-700" },
};

function formatDue(d: Date | null): string | null {
  if (!d) return null;
  const due = new Date(d);
  const now = new Date();
  const diffDays = Math.floor(
    (due.getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) /
      (24 * 60 * 60 * 1000)
  );
  if (diffDays < 0) return `${Math.abs(diffDays)}d overdue`;
  if (diffDays === 0) return "Due today";
  if (diffDays === 1) return "Due tomorrow";
  if (diffDays < 7) return `Due in ${diffDays}d`;
  return due.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatEstimate(min: number | null): string | null {
  if (!min) return null;
  if (min < 60) return `${min}m`;
  const hours = Math.floor(min / 60);
  const rem = min % 60;
  return rem === 0 ? `${hours}h` : `${hours}h ${rem}m`;
}

export function TaskList({ tasks }: { tasks: Task[] }) {
  if (tasks.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center">
        <p className="text-base text-gray-700">No tasks here.</p>
        <p className="mt-1 text-sm text-gray-500">
          Add one above to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <ul className="divide-y divide-gray-100">
        {tasks.map((t) => (
          <TaskRow key={t.id} task={t} />
        ))}
      </ul>
    </div>
  );
}

function TaskRow({ task }: { task: Task }) {
  const [isPending, startTransition] = useTransition();
  const isDone = task.status === "DONE";
  const isCanceled = task.status === "CANCELED";
  const dueLabel = !isDone && !isCanceled ? formatDue(task.dueAt) : null;
  const estimateLabel = formatEstimate(task.estimateMinutes);

  function toggleDone() {
    startTransition(async () => {
      await updateTaskStatus({
        id: task.id,
        status: isDone ? "TODO" : "DONE",
      });
    });
  }

  function handleDelete() {
    if (!confirm(`Delete "${task.title}"?`)) return;
    startTransition(async () => {
      await deleteTask(task.id);
    });
  }

  const isOverdue =
    !isDone &&
    !isCanceled &&
    task.dueAt &&
    new Date(task.dueAt) < new Date(new Date().toDateString());

  return (
    <li
      className={`flex items-start justify-between gap-3 px-4 py-3 transition ${
        isPending ? "opacity-50" : ""
      }`}
    >
      <div className="flex items-start gap-3 min-w-0 flex-1">
        <button
          type="button"
          onClick={toggleDone}
          disabled={isPending || isCanceled}
          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition ${
            isDone
              ? "border-gray-900 bg-gray-900 text-white"
              : "border-gray-300 hover:border-gray-500"
          } disabled:opacity-50`}
          aria-label={isDone ? "Mark as not done" : "Mark as done"}
        >
          {isDone ? "✓" : ""}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`text-base ${
                isDone || isCanceled
                  ? "text-gray-400 line-through"
                  : "text-gray-900 font-medium"
              }`}
              title={task.description ?? undefined}
            >
              {task.title}
            </span>
            {!isDone && !isCanceled && (
              <span
                className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium ${PRIORITY_STYLE[task.priority].className}`}
              >
                {PRIORITY_STYLE[task.priority].label}
              </span>
            )}
          </div>
          {(dueLabel || estimateLabel) && (
            <div className="mt-1 flex items-center gap-2 text-sm text-gray-600">
              {dueLabel && (
                <span className={isOverdue ? "text-red-700 font-medium" : ""}>
                  {dueLabel}
                </span>
              )}
              {dueLabel && estimateLabel && <span>·</span>}
              {estimateLabel && <span>{estimateLabel}</span>}
            </div>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={handleDelete}
        disabled={isPending}
        className="text-gray-400 hover:text-red-600 transition text-base leading-none px-1"
        aria-label="Delete task"
      >
        ✕
      </button>
    </li>
  );
}
