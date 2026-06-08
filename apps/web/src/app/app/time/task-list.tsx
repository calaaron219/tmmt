"use client";

import { useTransition } from "react";
import {
  deleteTask,
  startTimer,
  stopActiveTimer,
  updateTaskStatus,
  type TaskWithTracking,
} from "./actions";

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

// Compact "Xh Ym" / "Xm" / "Xs" for accumulated tracked time. Server-rendered
// only — the live ticker lives in active-timer-banner.tsx.
function formatTrackedSeconds(seconds: number): string | null {
  if (seconds <= 0) return null;
  if (seconds < 60) return `${seconds}s`;
  const totalMinutes = Math.floor(seconds / 60);
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const hours = Math.floor(totalMinutes / 60);
  const rem = totalMinutes % 60;
  return rem === 0 ? `${hours}h` : `${hours}h ${rem}m`;
}

export function TaskList({ tasks }: { tasks: TaskWithTracking[] }) {
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

function TaskRow({ task }: { task: TaskWithTracking }) {
  const [isPending, startTransition] = useTransition();
  const isDone = task.status === "DONE";
  const isCanceled = task.status === "CANCELED";
  const dueLabel = !isDone && !isCanceled ? formatDue(task.dueAt) : null;
  const estimateLabel = formatEstimate(task.estimateMinutes);
  const trackedLabel = formatTrackedSeconds(task.trackedSeconds);

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

  function toggleTimer() {
    startTransition(async () => {
      if (task.isActive) {
        await stopActiveTimer();
      } else {
        await startTimer({ taskId: task.id });
      }
    });
  }

  const isOverdue =
    !isDone &&
    !isCanceled &&
    task.dueAt &&
    new Date(task.dueAt) < new Date(new Date().toDateString());

  const overEstimate =
    task.estimateMinutes != null &&
    task.trackedSeconds > task.estimateMinutes * 60;

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
          {(dueLabel || estimateLabel || trackedLabel) && (
            <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm text-gray-600">
              {dueLabel && (
                <span className={isOverdue ? "text-red-700 font-medium" : ""}>
                  {dueLabel}
                </span>
              )}
              {dueLabel && (estimateLabel || trackedLabel) && <span>·</span>}
              {estimateLabel && <span>Est. {estimateLabel}</span>}
              {estimateLabel && trackedLabel && <span>·</span>}
              {trackedLabel && (
                <span className={overEstimate ? "text-red-700 font-medium" : ""}>
                  Tracked {trackedLabel}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1">
        {!isDone && !isCanceled && (
          <button
            type="button"
            onClick={toggleTimer}
            disabled={isPending}
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm transition ${
              task.isActive
                ? "bg-red-50 text-red-700 hover:bg-red-100"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            } disabled:opacity-50`}
            aria-label={task.isActive ? "Stop timer" : "Start timer"}
            title={task.isActive ? "Stop timer" : "Start timer"}
          >
            {task.isActive ? "■" : "▶"}
          </button>
        )}
        <button
          type="button"
          onClick={handleDelete}
          disabled={isPending}
          className="text-gray-400 hover:text-red-600 transition text-base leading-none px-1"
          aria-label="Delete task"
        >
          ✕
        </button>
      </div>
    </li>
  );
}
