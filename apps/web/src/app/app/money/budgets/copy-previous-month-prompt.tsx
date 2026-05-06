"use client";

import { useState, useTransition } from "react";
import { copyBudgetsFromPreviousMonth } from "../actions";

export function CopyPreviousMonthPrompt({
  month,
  previousMonth,
  previousFormatted,
}: {
  month: string;
  previousMonth: string;
  previousFormatted: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [dismissed, setDismissed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (dismissed) return null;

  function handleCopy() {
    setError(null);
    startTransition(async () => {
      try {
        await copyBudgetsFromPreviousMonth(month);
        setDismissed(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not copy");
      }
    });
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-700">
          No budgets set for this month. Copy from {previousFormatted}?
          <span className="hidden sm:inline text-gray-500">
            {" "}
            (You can edit each one after.)
          </span>
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setDismissed(true)}
            disabled={isPending}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            No thanks
          </button>
          <button
            type="button"
            onClick={handleCopy}
            disabled={isPending}
            className="rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-gray-800 disabled:opacity-50"
          >
            {isPending ? "Copying…" : `Copy from ${previousMonth}`}
          </button>
        </div>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
