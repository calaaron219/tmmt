"use client";

import { useState, useTransition } from "react";
import { aiCategorizeUncategorized } from "./actions";

type Result = {
  processed: number;
  categorized: number;
  remaining: number;
};

export function AiCategorizeButton({
  uncategorizedCount,
}: {
  uncategorizedCount: number;
}) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (uncategorizedCount === 0 && !result) return null;

  function handleClick() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await aiCategorizeUncategorized();
        setResult(res);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm">
          {result ? (
            <span className="text-gray-700">
              ✨ Categorized {result.categorized} of {result.processed}.
              {result.remaining > 0 ? (
                <> {result.remaining} still uncategorized.</>
              ) : (
                <> All caught up.</>
              )}
            </span>
          ) : (
            <span className="text-gray-700">
              {uncategorizedCount} uncategorized transaction
              {uncategorizedCount === 1 ? "" : "s"}.
            </span>
          )}
        </div>
        {(uncategorizedCount > 0 || (result && result.remaining > 0)) && (
          <button
            type="button"
            onClick={handleClick}
            disabled={isPending}
            className="rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-gray-800 disabled:opacity-50"
          >
            {isPending ? "Categorizing…" : "✨ Categorize with AI"}
          </button>
        )}
      </div>
      {error && (
        <p className="mt-2 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}
