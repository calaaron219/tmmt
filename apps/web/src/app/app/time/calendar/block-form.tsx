"use client";

import { useState, useTransition } from "react";
import {
  createTimeBlock,
  deleteTimeBlock,
  updateTimeBlock,
  type TaskWithTracking,
  type TimeBlockWithTask,
} from "../actions";

type EditingState =
  | { kind: "new"; dayIndex: number; hour: number }
  | { kind: "edit"; block: TimeBlockWithTask };

function ymdToUtc(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function dayDate(weekOf: string, dayIndex: number): Date {
  const monday = ymdToUtc(weekOf);
  monday.setUTCDate(monday.getUTCDate() + dayIndex);
  return monday;
}

// "HH:MM" string (24h, UTC) for time-input pre-fill.
function toHhMm(d: Date): string {
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

// Combines a UTC day date with an "HH:MM" string into a UTC Date.
function combine(dayDate: Date, hhmm: string): Date {
  const [h, m] = hhmm.split(":").map(Number);
  return new Date(
    Date.UTC(
      dayDate.getUTCFullYear(),
      dayDate.getUTCMonth(),
      dayDate.getUTCDate(),
      h,
      m,
      0
    )
  );
}

export function BlockForm({
  editing,
  weekOf,
  tasks,
  onClose,
}: {
  editing: EditingState;
  weekOf: string;
  tasks: TaskWithTracking[];
  onClose: () => void;
}) {
  // Resolve the "day date" anchor for the block.
  const anchor =
    editing.kind === "new"
      ? dayDate(weekOf, editing.dayIndex)
      : new Date(
          Date.UTC(
            editing.block.startsAt.getUTCFullYear(),
            editing.block.startsAt.getUTCMonth(),
            editing.block.startsAt.getUTCDate()
          )
        );

  const initialStart =
    editing.kind === "new"
      ? `${String(editing.hour).padStart(2, "0")}:00`
      : toHhMm(editing.block.startsAt);
  const initialEnd =
    editing.kind === "new"
      ? `${String(editing.hour + 1).padStart(2, "0")}:00`
      : toHhMm(editing.block.endsAt);

  const [title, setTitle] = useState(
    editing.kind === "new" ? "" : editing.block.title
  );
  const [taskId, setTaskId] = useState<string>(
    editing.kind === "new" ? "" : editing.block.taskId ?? ""
  );
  const [startTime, setStartTime] = useState(initialStart);
  const [endTime, setEndTime] = useState(initialEnd);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onPickTask(id: string) {
    setTaskId(id);
    if (!title.trim() && id) {
      const t = tasks.find((x) => x.id === id);
      if (t) setTitle(t.title);
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError("Title is required");
      return;
    }

    const startsAt = combine(anchor, startTime);
    const endsAt = combine(anchor, endTime);
    if (endsAt <= startsAt) {
      setError("End time must be after start time");
      return;
    }

    startTransition(async () => {
      try {
        if (editing.kind === "new") {
          await createTimeBlock({
            taskId: taskId || null,
            title: trimmedTitle,
            startsAt,
            endsAt,
            color: null,
          });
        } else {
          await updateTimeBlock(editing.block.id, {
            taskId: taskId || null,
            title: trimmedTitle,
            startsAt,
            endsAt,
          });
        }
        onClose();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not save");
      }
    });
  }

  function handleDelete() {
    if (editing.kind !== "edit") return;
    if (!confirm(`Delete "${editing.block.title}"?`)) return;
    setError(null);
    startTransition(async () => {
      try {
        await deleteTimeBlock(editing.block.id);
        onClose();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not delete");
      }
    });
  }

  const dayLabel = anchor.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30 p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-xl sm:rounded-xl bg-white p-5 shadow-xl space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            {editing.kind === "new" ? "New block" : "Edit block"}
          </h2>
          <span className="text-sm text-gray-600">{dayLabel}</span>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What's this block for?"
            required
            maxLength={200}
            className="w-full rounded-md border border-gray-300 px-3 py-2.5 text-base text-gray-900 placeholder:text-gray-400"
            autoFocus
          />

          <select
            value={taskId}
            onChange={(e) => onPickTask(e.target.value)}
            className="w-full rounded border border-gray-300 px-2 py-2 text-sm text-gray-900"
          >
            <option value="">No task (free-form block)</option>
            {tasks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>

          <div className="grid grid-cols-2 gap-2">
            <label className="text-sm">
              <span className="text-gray-700">Start</span>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                step={900}
                className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-base text-gray-900"
                required
              />
            </label>
            <label className="text-sm">
              <span className="text-gray-700">End</span>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                step={900}
                className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-base text-gray-900"
                required
              />
            </label>
          </div>

          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800 disabled:opacity-50"
            >
              {isPending
                ? "Saving…"
                : editing.kind === "new"
                  ? "Add block"
                  : "Save changes"}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            >
              Cancel
            </button>
            {editing.kind === "edit" && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={isPending}
                className="rounded-md border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
              >
                Delete
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
