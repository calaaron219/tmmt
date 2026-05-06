"use client";

import { useState, useTransition } from "react";
import type { BudgetRow as BudgetRowData } from "../actions";
import { upsertBudget, deleteBudget } from "../actions";

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function progressState(spent: number, limit: number) {
  const pct = limit === 0 ? 0 : (spent / limit) * 100;
  if (pct > 100) {
    return {
      pct: 100,
      barClass: "bg-red-600",
      label: `OVER by ${formatCents(spent - limit)}`,
      labelClass: "text-red-700",
    };
  }
  if (pct >= 80) {
    return {
      pct,
      barClass: "bg-amber-600",
      label: `${Math.round(pct)}%`,
      labelClass: "text-amber-700",
    };
  }
  return {
    pct,
    barClass: "bg-gray-700",
    label: `${Math.round(pct)}%`,
    labelClass: "text-gray-600",
  };
}

export function BudgetRow({
  row,
  month,
}: {
  row: BudgetRowData;
  month: string;
}) {
  const [isEditing, setIsEditing] = useState(row.monthlyLimitCents === null);
  const [draft, setDraft] = useState(
    row.monthlyLimitCents !== null
      ? String(row.monthlyLimitCents / 100)
      : ""
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    setError(null);
    const dollars = Number(draft);
    if (!Number.isFinite(dollars) || dollars <= 0) {
      setError("Enter a positive number");
      return;
    }
    const cents = Math.round(dollars * 100);
    startTransition(async () => {
      try {
        await upsertBudget({
          categoryId: row.categoryId,
          month,
          monthlyLimitCents: cents,
        });
        setIsEditing(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not save");
      }
    });
  }

  function handleDelete() {
    if (!confirm(`Remove the budget for ${row.name}?`)) return;
    startTransition(async () => {
      try {
        await deleteBudget(row.categoryId, month);
        setDraft("");
        setIsEditing(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not remove");
      }
    });
  }

  return (
    <li
      className={`px-4 py-4 transition ${isPending ? "opacity-50" : ""}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span
            className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
            style={{
              backgroundColor: `${row.color}20`,
              color: row.color,
            }}
          >
            {row.icon ? `${row.icon} ` : ""}
            {row.name}
          </span>
        </div>

        {isEditing ? (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">$</span>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="1"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave();
                if (e.key === "Escape") {
                  setIsEditing(false);
                  setError(null);
                  setDraft(
                    row.monthlyLimitCents !== null
                      ? String(row.monthlyLimitCents / 100)
                      : ""
                  );
                }
              }}
              placeholder="Set limit"
              disabled={isPending}
              className="w-24 rounded border border-gray-300 px-2 py-1 text-base text-gray-900 placeholder:text-gray-400 focus:border-gray-900 focus:outline-none"
              autoFocus
            />
            <button
              type="button"
              onClick={handleSave}
              disabled={isPending}
              className="rounded-md bg-gray-900 px-3 py-1 text-sm font-medium text-white transition hover:bg-gray-800 disabled:opacity-50"
            >
              {isPending ? "…" : "Save"}
            </button>
            {row.monthlyLimitCents !== null && (
              <button
                type="button"
                onClick={() => {
                  setIsEditing(false);
                  setError(null);
                  setDraft(String(row.monthlyLimitCents! / 100));
                }}
                disabled={isPending}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Cancel
              </button>
            )}
          </div>
        ) : (
          <BudgetMeta
            row={row}
            onEdit={() => setIsEditing(true)}
            onDelete={handleDelete}
            disabled={isPending}
          />
        )}
      </div>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </li>
  );
}

function BudgetMeta({
  row,
  onEdit,
  onDelete,
  disabled,
}: {
  row: BudgetRowData;
  onEdit: () => void;
  onDelete: () => void;
  disabled: boolean;
}) {
  // Should never render — but guards the type narrow below.
  if (row.monthlyLimitCents === null) return null;

  const state = progressState(row.spentCents, row.monthlyLimitCents);

  return (
    <div className="flex items-center gap-4">
      <div className="hidden sm:block w-40">
        <div className="h-2 w-full rounded-full bg-gray-100">
          <div
            className={`h-2 rounded-full transition-all ${state.barClass}`}
            style={{ width: `${state.pct}%` }}
          />
        </div>
      </div>
      <div className="text-right">
        <div className="text-sm font-medium tabular-nums text-gray-900">
          {formatCents(row.spentCents)} of{" "}
          {formatCents(row.monthlyLimitCents)}
        </div>
        <div className={`text-xs ${state.labelClass}`}>{state.label}</div>
      </div>
      <button
        type="button"
        onClick={onEdit}
        disabled={disabled}
        className="text-sm text-gray-500 hover:text-gray-700"
      >
        Edit
      </button>
      <button
        type="button"
        onClick={onDelete}
        disabled={disabled}
        className="text-gray-400 hover:text-red-600 transition text-sm leading-none px-1"
        aria-label="Remove budget"
      >
        ✕
      </button>
    </div>
  );
}
