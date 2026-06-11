"use client";

import { useState, useTransition } from "react";
import type { Project, Routine } from "@tmmt/db";
import type { TaskPriority } from "@tmmt/shared";
import { createRoutine, updateRoutine, deleteRoutine } from "../actions";

const PRIORITY_OPTIONS: { value: TaskPriority; label: string }[] = [
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Med" },
  { value: "HIGH", label: "High" },
];

const PRIORITY_STYLE: Record<TaskPriority, string> = {
  LOW: "bg-gray-100 text-gray-600",
  MEDIUM: "bg-blue-50 text-blue-700",
  HIGH: "bg-red-50 text-red-700",
};

export function RoutineManager({
  initialRoutines,
  projects,
}: {
  initialRoutines: Routine[];
  projects: Project[];
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const projectById = new Map(projects.map((p) => [p.id, p]));

  return (
    <div className="space-y-6">
      {showNewForm ? (
        <RoutineForm
          mode="create"
          projects={projects}
          onDone={() => setShowNewForm(false)}
          onCancel={() => setShowNewForm(false)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setShowNewForm(true)}
          className="w-full rounded-lg border border-dashed border-gray-300 bg-white px-4 py-4 text-base font-medium text-gray-700 transition hover:border-gray-400 hover:bg-gray-50"
        >
          + Add routine
        </button>
      )}

      {initialRoutines.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-500">
          None yet. Routines generate a task each day when you open this page.
        </div>
      ) : (
        <ul className="space-y-2">
          {initialRoutines.map((r) =>
            editingId === r.id ? (
              <li key={r.id}>
                <RoutineForm
                  mode="edit"
                  routine={r}
                  projects={projects}
                  onDone={() => setEditingId(null)}
                  onCancel={() => setEditingId(null)}
                />
              </li>
            ) : (
              <RoutineCard
                key={r.id}
                routine={r}
                project={r.projectId ? projectById.get(r.projectId) ?? null : null}
                onEdit={() => setEditingId(r.id)}
              />
            )
          )}
        </ul>
      )}
    </div>
  );
}

function RoutineCard({
  routine,
  project,
  onEdit,
}: {
  routine: Routine;
  project: Project | null;
  onEdit: () => void;
}) {
  return (
    <li
      className="flex items-start justify-between gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3.5 transition hover:shadow-sm"
      style={
        project
          ? { borderLeftColor: project.color, borderLeftWidth: 4 }
          : undefined
      }
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className="text-base font-medium text-gray-900 truncate"
            title={routine.title}
          >
            {routine.title}
          </span>
          <span
            className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium ${PRIORITY_STYLE[routine.priority]}`}
          >
            {routine.priority === "LOW"
              ? "Low"
              : routine.priority === "MEDIUM"
                ? "Med"
                : "High"}
          </span>
        </div>
        {(routine.estimateMinutes || project) && (
          <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm text-gray-600">
            {routine.estimateMinutes && (
              <span>Est. {routine.estimateMinutes}m</span>
            )}
            {routine.estimateMinutes && project && <span>·</span>}
            {project && (
              <span className="inline-flex items-center gap-1">
                {project.icon && (
                  <span aria-hidden="true">{project.icon}</span>
                )}
                <span>{project.name}</span>
              </span>
            )}
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={onEdit}
        className="text-sm font-medium text-gray-500 hover:text-gray-900 transition"
      >
        Edit
      </button>
    </li>
  );
}

function RoutineForm({
  mode,
  routine,
  projects,
  onDone,
  onCancel,
}: {
  mode: "create" | "edit";
  routine?: Routine;
  projects: Project[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(routine?.title ?? "");
  const [description, setDescription] = useState(routine?.description ?? "");
  const [priority, setPriority] = useState<TaskPriority>(
    routine?.priority ?? "MEDIUM"
  );
  const [estimate, setEstimate] = useState(
    routine?.estimateMinutes != null ? String(routine.estimateMinutes) : ""
  );
  const [projectId, setProjectId] = useState<string>(routine?.projectId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError("Title is required");
      return;
    }

    const estimateMinutes = estimate.trim() === "" ? null : Number(estimate);
    if (
      estimateMinutes !== null &&
      (!Number.isFinite(estimateMinutes) || estimateMinutes <= 0)
    ) {
      setError("Estimate must be a positive number of minutes");
      return;
    }

    const payload = {
      title: trimmedTitle,
      description: description.trim() || null,
      priority,
      estimateMinutes,
      projectId: projectId || null,
    };

    startTransition(async () => {
      try {
        if (mode === "create") {
          await createRoutine(payload);
        } else if (routine) {
          await updateRoutine(routine.id, payload);
        }
        onDone();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  }

  async function handleDelete() {
    if (!routine) return;
    if (
      !confirm(
        `Delete "${routine.title}"? Past tasks generated from it stay; new ones won't be created.`
      )
    )
      return;
    setError(null);
    startTransition(async () => {
      try {
        await deleteRoutine(routine.id);
        onDone();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-lg border border-gray-300 bg-white p-4 space-y-3"
    >
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
        maxLength={200}
        placeholder="Routine title (e.g. Morning standup)"
        className="w-full rounded-md border border-gray-300 px-3 py-2.5 text-base text-gray-900 placeholder:text-gray-400"
      />

      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        maxLength={2000}
        rows={2}
        placeholder="Notes (optional)"
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400"
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1">
          {PRIORITY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setPriority(opt.value)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                priority === opt.value
                  ? "bg-gray-900 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <input
          type="number"
          inputMode="numeric"
          min="1"
          value={estimate}
          onChange={(e) => setEstimate(e.target.value)}
          placeholder="Est. min"
          className="w-24 rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-gray-900 focus:outline-none"
        />
        <select
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          className="rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-900 focus:border-gray-900 focus:outline-none"
        >
          <option value="">No project</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.icon ? `${p.icon} ` : ""}
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="flex-1 rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800 disabled:opacity-50"
        >
          {isPending
            ? "Saving…"
            : mode === "create"
              ? "Add routine"
              : "Save changes"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={isPending}
          className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
        >
          Cancel
        </button>
        {mode === "edit" && (
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
  );
}
