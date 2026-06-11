"use client";

import { useState, useTransition } from "react";
import { applyPlan, planMyDay, type PlanProposalView } from "../actions";

// One-button affordance + result panel for "Plan my day".
// Click → server gathers context + calls Gemini → renders proposal cards
// → user clicks Apply (persists) or Discard (drops the proposal).
export function PlanMyDay() {
  const [proposal, setProposal] = useState<PlanProposalView | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function runPlan() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await planMyDay();
        setProposal(result);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not plan your day");
      }
    });
  }

  function discard() {
    setProposal(null);
    setError(null);
  }

  function apply() {
    if (!proposal) return;
    setError(null);
    const payload = {
      date: proposal.date,
      proposals: proposal.proposals.map((p) => ({
        taskId: p.taskId,
        title: p.title,
        startHhMm: p.startHhMm,
        endHhMm: p.endHhMm,
        reasoning: p.reasoning,
      })),
    };
    startTransition(async () => {
      try {
        const summary = await applyPlan(payload);
        setProposal(null);
        // The server has revalidated /app/time/calendar; Next will
        // re-render the WeekGrid with the new blocks on the next tick.
        if (summary.skipped > 0) {
          setError(
            `Added ${summary.created}, skipped ${summary.skipped} (overlap or validation)`
          );
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not apply plan");
      }
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={runPlan}
          disabled={isPending}
          className="rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-gray-800 disabled:opacity-50"
        >
          {isPending && !proposal ? "Planning…" : "Plan my day"}
        </button>
        {proposal && (
          <span className="text-sm text-gray-600">
            {proposal.proposals.length} block
            {proposal.proposals.length === 1 ? "" : "s"} proposed
          </span>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      {proposal && (
        <div className="rounded-lg border border-dashed border-gray-300 bg-amber-50/40 p-3 space-y-3">
          {proposal.summary && (
            <p className="text-sm text-gray-700 italic">{proposal.summary}</p>
          )}

          {proposal.proposals.length === 0 ? (
            <p className="text-sm text-gray-600">
              No proposals to add right now. Either no open tasks fit the
              working window ({proposal.workingHoursStart}–
              {proposal.workingHoursEnd}), or there&apos;s already a packed
              calendar for today.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {proposal.proposals.map((p, i) => (
                <li
                  key={i}
                  className="rounded-md border border-gray-200 bg-white px-3 py-2"
                  style={
                    p.color
                      ? { borderLeftColor: p.color, borderLeftWidth: 3 }
                      : undefined
                  }
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-sm font-medium text-gray-900 truncate">
                      {p.title}
                    </span>
                    <span className="shrink-0 text-xs text-gray-600">
                      {p.startHhMm}–{p.endHhMm}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-gray-600">{p.reasoning}</p>
                </li>
              ))}
            </ul>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={apply}
              disabled={isPending || proposal.proposals.length === 0}
              className="rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-gray-800 disabled:opacity-50"
            >
              {isPending ? "Applying…" : "Apply all"}
            </button>
            <button
              type="button"
              onClick={discard}
              disabled={isPending}
              className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
            >
              Discard
            </button>
            <button
              type="button"
              onClick={runPlan}
              disabled={isPending}
              className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
              title="Re-roll the plan"
            >
              Re-plan
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
