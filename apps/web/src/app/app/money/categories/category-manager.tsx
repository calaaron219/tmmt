"use client";

import { useState, useTransition } from "react";
import type { Category } from "@tmmt/db";
import {
  createCategory,
  updateCategory,
  deleteCategory,
} from "../actions";

const PRESET_COLORS = [
  "#22c55e", "#10b981", "#14b8a6", "#06b6d4", "#0ea5e9",
  "#3b82f6", "#6366f1", "#8b5cf6", "#a855f7", "#d946ef",
  "#ec4899", "#f43f5e", "#ef4444", "#f97316", "#eab308",
  "#84cc16", "#64748b", "#a16207",
];

export function CategoryManager({
  initialCategories,
}: {
  initialCategories: Category[];
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);

  const expense = initialCategories.filter((c) => c.kind === "EXPENSE");
  const income = initialCategories.filter((c) => c.kind === "INCOME");

  return (
    <div className="space-y-6">
      {showNewForm ? (
        <CategoryForm
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
          + Add category
        </button>
      )}

      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-600">
          Expense ({expense.length})
        </h2>
        <CategoryGroup
          categories={expense}
          editingId={editingId}
          onEdit={setEditingId}
          onCancelEdit={() => setEditingId(null)}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-600">
          Income ({income.length})
        </h2>
        <CategoryGroup
          categories={income}
          editingId={editingId}
          onEdit={setEditingId}
          onCancelEdit={() => setEditingId(null)}
        />
      </section>
    </div>
  );
}

function CategoryGroup({
  categories,
  editingId,
  onEdit,
  onCancelEdit,
}: {
  categories: Category[];
  editingId: string | null;
  onEdit: (id: string) => void;
  onCancelEdit: () => void;
}) {
  if (categories.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-500">
        None yet.
      </div>
    );
  }
  return (
    <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {categories.map((c) =>
        editingId === c.id ? (
          <li key={c.id} className="sm:col-span-2 lg:col-span-3">
            <CategoryForm
              mode="edit"
              category={c}
              onDone={onCancelEdit}
              onCancel={onCancelEdit}
            />
          </li>
        ) : (
          <CategoryCard key={c.id} category={c} onEdit={() => onEdit(c.id)} />
        )
      )}
    </ul>
  );
}

function CategoryCard({
  category,
  onEdit,
}: {
  category: Category;
  onEdit: () => void;
}) {
  return (
    <li
      className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3.5 transition hover:shadow-sm"
      style={{ borderLeftColor: category.color, borderLeftWidth: 4 }}
    >
      <span className="text-2xl" aria-hidden="true">
        {category.icon ?? "•"}
      </span>
      <span
        className="text-base font-medium text-gray-900 flex-1 truncate"
        title={category.name}
      >
        {category.name}
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

function CategoryForm({
  mode,
  category,
  onDone,
  onCancel,
}: {
  mode: "create" | "edit";
  category?: Category;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(category?.name ?? "");
  const [icon, setIcon] = useState(category?.icon ?? "");
  const [color, setColor] = useState(category?.color ?? PRESET_COLORS[0]);
  const [kind, setKind] = useState<"INCOME" | "EXPENSE">(
    category?.kind ?? "EXPENSE"
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      try {
        if (mode === "create") {
          await createCategory({
            name: name.trim(),
            color,
            kind,
            icon: icon.trim() || null,
          });
        } else if (category) {
          await updateCategory(category.id, {
            name: name.trim(),
            color,
            kind,
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
    if (!category) return;
    if (
      !confirm(
        `Delete "${category.name}"? Transactions tagged with this category will become uncategorized.`
      )
    )
      return;
    setError(null);
    startTransition(async () => {
      try {
        await deleteCategory(category.id);
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
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setKind("EXPENSE")}
          className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition ${
            kind === "EXPENSE"
              ? "bg-gray-900 text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          Expense
        </button>
        <button
          type="button"
          onClick={() => setKind("INCOME")}
          className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition ${
            kind === "INCOME"
              ? "bg-gray-900 text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          Income
        </button>
      </div>

      <div className="grid grid-cols-[auto_1fr] gap-2">
        <input
          type="text"
          value={icon}
          onChange={(e) => setIcon(e.target.value)}
          placeholder="💰"
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
          placeholder="Category name"
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
              ? "Add category"
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
