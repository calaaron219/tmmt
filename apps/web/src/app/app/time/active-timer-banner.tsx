"use client";

import { useEffect, useState, useTransition } from "react";
import { stopActiveTimer, type ActiveTimer } from "./actions";

function formatHMS(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export function ActiveTimerBanner({ active }: { active: ActiveTimer }) {
  // Tick once per second; compute elapsed from the absolute startedAt so
  // drift self-corrects. State is just "now" — derived display below.
  const [now, setNow] = useState(() => Date.now());
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const elapsedSeconds = Math.max(
    0,
    Math.floor((now - new Date(active.startedAt).getTime()) / 1000)
  );

  function handleStop() {
    startTransition(async () => {
      await stopActiveTimer();
    });
  }

  return (
    <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-sm text-green-800">
            <span
              className="inline-block h-2 w-2 rounded-full bg-green-600 animate-pulse"
              aria-hidden="true"
            />
            <span>Tracking</span>
          </div>
          <div className="mt-0.5 flex items-baseline gap-2">
            <span
              className="text-base font-medium text-gray-900 truncate"
              title={active.taskTitle}
            >
              {active.taskTitle}
            </span>
            <span className="text-base font-semibold tabular-nums text-gray-900">
              {formatHMS(elapsedSeconds)}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={handleStop}
          disabled={isPending}
          className="rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-gray-800 disabled:opacity-50"
        >
          {isPending ? "Stopping…" : "Stop"}
        </button>
      </div>
    </div>
  );
}
