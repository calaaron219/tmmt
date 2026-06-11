"use client";

import { useState, useTransition } from "react";
import type { Project } from "@tmmt/db";
import { createProject, updateProject, deleteProject } from "../actions";

const PRESET_COLORS = [
  "#3b82f6", "#6366f1", "#8b5cf6", "#a855f7", "#d946ef",
  "#ec4899", "#f43f5e", "#ef4444", "#f97316", "#eab308",
  "#84cc16", "#22c55e", "#10b981", "#14b8a6", "#06b6d4",
  "#0ea5e9", "#64748b", "#a16207",
];

export function ProjectManager({
  initialProjects,
}: {
  initialProjects: Project[];
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);

  return (
    <div className="space-y-6">
      {showNewForm ? (
        <ProjectForm
          mode="create"
          onDone={() => setShowNewForm(false)}
          onCancel={() => setShowNewForm(false)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setShowNewForm(true)}
          className="w-full rounded-lg border border-dashed border-gray-300 bg-white px-4 py-4 text-base font-medium text-gray-700 transition hover:border-gray-400 hover:bg-gray-50"
        >
          + Add project
        </button>
      )}

      {initialProjects.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-500">
          None yet. Create one above to start grouping your tasks.
        </div>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {initialProjects.map((p) =>
            editingId === p.id ? (
              <li key={p.id} className="sm:col-span-2 lg:col-span-3">
                <ProjectForm
                  mode="edit"
                  project={p}
                  onDone={() => setEditingId(null)}
                  onCancel={() => setEditingId(null)}
                />
              </li>
            ) : (
              <ProjectCard
                key={p.id}
                project={p}
                onEdit={() => setEditingId(p.id)}
              />
            )
          )}
        </ul>
      )}
    </div>
  );
}

function ProjectCard({
  project,
  onEdit,
}: {
  project: Project;
  onEdit: () => void;
}) {
  return (
    <li
      className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3.5 transition hover:shadow-sm"
      style={{ borderLeftColor: project.color, borderLeftWidth: 4 }}
    >
      <span className="text-2xl" aria-hidden="true">
        {project.icon ?? "•"}
      </span>
      <span
        className="text-base font-medium text-gray-900 flex-1 truncate"
        title={project.name}
      >
        {project.name}
      </span>
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

function ProjectForm({
  mode,
  project,
  onDone,
  onCancel,
}: {
  mode: "create" | "edit";
  project?: Project;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(project?.name ?? "");
  const [icon, setIcon] = useState(project?.icon ?? "");
  const [color, setColor] = useState(project?.color ?? PRESET_COLORS[0]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      try {
        if (mode === "create") {
          await createProject({
            name: name.trim(),
            color,
            icon: icon.trim() || null,
          });
        } else if (project) {
          await updateProject(project.id, {
            name: name.trim(),
            color,
            icon: icon.trim() || null,
          });
        }
        onDone();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  }

  async function handleDelete() {
    if (!project) return;
    if (
      !confirm(
        `Delete "${project.name}"? Tasks in this project will become project-less.`
      )
    )
      return;
    setError(null);
    startTransition(async () => {
      try {
        await deleteProject(project.id);
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
      style={{ borderLeftColor: color, borderLeftWidth: 4 }}
    >
      <div className="grid grid-cols-[auto_1fr] gap-2">
        <input
          type="text"
          value={icon}
          onChange={(e) => setIcon(e.target.value)}
          placeholder="🎯"
          maxLength={2}
          className="w-14 text-center rounded-md border border-gray-300 px-2 py-2.5 text-xl"
          aria-label="Icon or emoji"
        />
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={50}
          placeholder="Project name"
          className="rounded-md border border-gray-300 px-3 py-2.5 text-base text-gray-900"
        />
      </div>

      <div>
        <p className="text-sm font-medium text-gray-700 mb-2">Color</p>
        <div className="flex flex-wrap gap-1.5">
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className={`h-7 w-7 rounded-full transition ${
                color === c
                  ? "ring-2 ring-offset-2 ring-gray-900"
                  : "hover:scale-110"
              }`}
              style={{ backgroundColor: c }}
              aria-label={`Color ${c}`}
            />
          ))}
        </div>
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
              ? "Add project"
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
