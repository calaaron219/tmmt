"use client";

import { useState, useTransition } from "react";
import type { Project } from "@tmmt/db";
import { createTask } from "./actions";
import type { TaskPriority } from "@tmmt/shared";

export function QuickAddForm({ projects }: { projects: Project[] }) {
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("MEDIUM");
  const [dueAt, setDueAt] = useState("");
  const [estimate, setEstimate] = useState("");
  const [projectId, setProjectId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim()) {
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

    startTransition(async () => {
      try {
        await createTask({
          title: title.trim(),
          priority,
          estimateMinutes,
          dueAt: dueAt ? new Date(dueAt) : null,
          projectId: projectId === "" ? null : projectId,
        });
        setTitle("");
        setDueAt("");
        setEstimate("");
        setPriority("MEDIUM");
        setProjectId("");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not save");
      }
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 rounded-lg border border-gray-200 bg-white p-4"
    >
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="What needs doing?"
        disabled={isPending}
        className="w-full rounded border border-gray-300 px-3 py-2 text-base text-gray-900 placeholder:text-gray-400 focus:border-gray-900 focus:outline-none"
      />
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value as TaskPriority)}
          disabled={isPending}
          className="rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-900 focus:border-gray-900 focus:outline-none"
        >
          <option value="LOW">Low</option>
          <option value="MEDIUM">Medium</option>
          <option value="HIGH">High</option>
        </select>
        {projects.length > 0 && (
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            disabled={isPending}
            className="rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-900 focus:border-gray-900 focus:outline-none"
            aria-label="Project"
          >
            <option value="">No project</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.icon ? `${p.icon} ` : ""}
                {p.name}
              </option>
            ))}
          </select>
        )}
        <input
          type="date"
          value={dueAt}
          onChange={(e) => setDueAt(e.target.value)}
          disabled={isPending}
          className="rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-900 focus:border-gray-900 focus:outline-none"
        />
        <input
          type="number"
          inputMode="numeric"
          min="1"
          value={estimate}
          onChange={(e) => setEstimate(e.target.value)}
          placeholder="Est. min"
          disabled={isPending}
          className="w-24 rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-gray-900 focus:outline-none"
        />
        <button
          type="submit"
          disabled={isPending}
          className="ml-auto rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-gray-800 disabled:opacity-50"
        >
          {isPending ? "Saving…" : "Add task"}
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
