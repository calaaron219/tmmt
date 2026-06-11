"use client";

import { useRef, useState, useTransition } from "react";
import { updateTimeBlock, type TimeBlockWithTask } from "../actions";
import { BlockForm } from "./block-form";
import type { TaskWithTracking } from "../actions";

// Grid math. 6am → 10pm = 16 hour rows. 56px per hour gives blocks
// enough vertical room to render their title + time without being
// cramped at the 1-hour minimum.
const START_HOUR = 6;
const END_HOUR = 22;
const HOUR_HEIGHT = 56;
const BODY_HEIGHT = (END_HOUR - START_HOUR) * HOUR_HEIGHT;
const SNAP_MINUTES = 15;

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function ymdToUtc(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function dayDateUtc(weekOfYmd: string, dayIndex: number): Date {
  const monday = ymdToUtc(weekOfYmd);
  monday.setUTCDate(monday.getUTCDate() + dayIndex);
  return monday;
}

// Minutes since the grid's START_HOUR for a given timestamp,
// interpreted in UTC (matches how the day boundary is defined).
function minutesFromGridStart(d: Date): number {
  return (d.getUTCHours() - START_HOUR) * 60 + d.getUTCMinutes();
}

function blockDayIndex(weekOfYmd: string, block: TimeBlockWithTask): number {
  const monday = ymdToUtc(weekOfYmd);
  const blockDate = new Date(
    Date.UTC(
      block.startsAt.getUTCFullYear(),
      block.startsAt.getUTCMonth(),
      block.startsAt.getUTCDate()
    )
  );
  return Math.round((blockDate.getTime() - monday.getTime()) / 86400000);
}

function todayUtcYmd(): string {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  )
    .toISOString()
    .slice(0, 10);
}

function isTodayDayIndex(weekOfYmd: string, dayIndex: number): boolean {
  const dayDate = dayDateUtc(weekOfYmd, dayIndex);
  return dayDate.toISOString().slice(0, 10) === todayUtcYmd();
}

function formatHourLabel(h: number): string {
  if (h === 0) return "12 AM";
  if (h === 12) return "12 PM";
  return h < 12 ? `${h} AM` : `${h - 12} PM`;
}

function formatTimeRange(start: Date, end: Date): string {
  const fmt = (d: Date) => {
    const h = d.getUTCHours();
    const m = d.getUTCMinutes();
    const ampm = h < 12 ? "a" : "p";
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return m === 0 ? `${h12}${ampm}` : `${h12}:${String(m).padStart(2, "0")}${ampm}`;
  };
  return `${fmt(start)}–${fmt(end)}`;
}

// Color resolution: explicit block color → linked task's project color → gray.
function resolveColor(block: TimeBlockWithTask): string {
  return block.color ?? block.task?.project?.color ?? "#64748b";
}

type EditingState =
  | { kind: "new"; dayIndex: number; hour: number }
  | { kind: "edit"; block: TimeBlockWithTask }
  | null;

export function WeekGrid({
  weekOf,
  blocks,
  tasks,
}: {
  weekOf: string;
  blocks: TimeBlockWithTask[];
  tasks: TaskWithTracking[];
}) {
  const [editing, setEditing] = useState<EditingState>(null);
  // While the user drags a resize handle, we track which block + its
  // candidate end time. Local-only — committed on pointerup.
  const [resizing, setResizing] = useState<{
    blockId: string;
    ghostEndsAt: Date;
  } | null>(null);
  const latestEndsAtRef = useRef<Date | null>(null);
  const [, startTransition] = useTransition();

  function handleResizePointerDown(
    e: React.PointerEvent,
    block: TimeBlockWithTask
  ) {
    e.stopPropagation();
    e.preventDefault();
    const startY = e.clientY;
    const startEnds = new Date(block.endsAt);
    latestEndsAtRef.current = startEnds;
    setResizing({ blockId: block.id, ghostEndsAt: startEnds });

    function onMove(ev: PointerEvent) {
      const dy = ev.clientY - startY;
      const dMin = (dy * 60) / HOUR_HEIGHT;
      const proposed = new Date(startEnds.getTime() + dMin * 60000);
      // Snap to SNAP_MINUTES.
      proposed.setUTCMinutes(
        Math.round(proposed.getUTCMinutes() / SNAP_MINUTES) * SNAP_MINUTES,
        0,
        0
      );
      // Constrain to same day + at least startsAt + SNAP_MINUTES.
      const min = new Date(block.startsAt.getTime() + SNAP_MINUTES * 60000);
      const max = new Date(
        Date.UTC(
          block.startsAt.getUTCFullYear(),
          block.startsAt.getUTCMonth(),
          block.startsAt.getUTCDate(),
          END_HOUR,
          0,
          0
        )
      );
      const clamped = proposed < min ? min : proposed > max ? max : proposed;
      latestEndsAtRef.current = clamped;
      setResizing({ blockId: block.id, ghostEndsAt: clamped });
    }
    function onUp() {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      const finalEnds = latestEndsAtRef.current;
      setResizing(null);
      if (finalEnds && finalEnds.getTime() !== block.endsAt.getTime()) {
        startTransition(async () => {
          try {
            await updateTimeBlock(block.id, { endsAt: finalEnds });
          } catch {
            // Server reverts via revalidate; the visual snaps back on next render.
          }
        });
      }
    }
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
  }

  return (
    <>
      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <div className="min-w-[640px]">
          <div className="flex">
            {/* Time labels column */}
            <div className="w-12 shrink-0 border-r border-gray-200">
              <div className="h-9 border-b border-gray-200" />
              <div className="relative" style={{ height: BODY_HEIGHT }}>
                {Array.from({ length: END_HOUR - START_HOUR }).map((_, i) => (
                  <div
                    key={i}
                    className="absolute right-1 text-[10px] text-gray-500"
                    style={{ top: i * HOUR_HEIGHT - 6 }}
                  >
                    {formatHourLabel(START_HOUR + i)}
                  </div>
                ))}
              </div>
            </div>

            {/* 7 day columns */}
            {DAY_LABELS.map((label, dayIndex) => {
              const isToday = isTodayDayIndex(weekOf, dayIndex);
              const dayDate = dayDateUtc(weekOf, dayIndex);
              const dayBlocks = blocks.filter(
                (b) => blockDayIndex(weekOf, b) === dayIndex
              );

              return (
                <div
                  key={dayIndex}
                  className={`flex-1 border-r border-gray-200 last:border-r-0 ${
                    isToday ? "bg-blue-50/40" : ""
                  }`}
                >
                  <div
                    className={`h-9 border-b border-gray-200 px-2 py-1.5 text-center text-xs font-medium ${
                      isToday ? "text-blue-700" : "text-gray-700"
                    }`}
                  >
                    {label}{" "}
                    <span className="text-gray-500">{dayDate.getUTCDate()}</span>
                  </div>
                  <div className="relative" style={{ height: BODY_HEIGHT }}>
                    {/* Hour cells (clickable to create) */}
                    {Array.from({ length: END_HOUR - START_HOUR }).map(
                      (_, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() =>
                            setEditing({
                              kind: "new",
                              dayIndex,
                              hour: START_HOUR + i,
                            })
                          }
                          className="absolute w-full border-b border-gray-100 hover:bg-gray-100/60 transition"
                          style={{ top: i * HOUR_HEIGHT, height: HOUR_HEIGHT }}
                          aria-label={`Add block at ${formatHourLabel(START_HOUR + i)} on ${label}`}
                        />
                      )
                    )}

                    {/* Blocks */}
                    {dayBlocks.map((block) => {
                      const isResizing = resizing?.blockId === block.id;
                      const displayEnds = isResizing
                        ? resizing.ghostEndsAt
                        : block.endsAt;
                      const topMin = minutesFromGridStart(block.startsAt);
                      const heightMin =
                        (displayEnds.getTime() - block.startsAt.getTime()) /
                        60000;
                      const top = (topMin * HOUR_HEIGHT) / 60;
                      const height = Math.max(
                        (HOUR_HEIGHT * SNAP_MINUTES) / 60,
                        (heightMin * HOUR_HEIGHT) / 60
                      );
                      const color = resolveColor(block);
                      return (
                        <button
                          key={block.id}
                          type="button"
                          onClick={() => setEditing({ kind: "edit", block })}
                          className="absolute left-0.5 right-0.5 rounded-md text-left shadow-sm hover:shadow transition overflow-hidden"
                          style={{
                            top,
                            height,
                            backgroundColor: `${color}26`, // ~15% opacity hex suffix
                            borderLeft: `3px solid ${color}`,
                            color: "#111827",
                          }}
                        >
                          <div className="px-1.5 py-1 text-xs font-medium truncate">
                            {block.title}
                          </div>
                          <div className="px-1.5 text-[10px] text-gray-600 truncate">
                            {formatTimeRange(block.startsAt, displayEnds)}
                          </div>
                          {/* Resize handle (bottom edge) */}
                          <div
                            onPointerDown={(e) =>
                              handleResizePointerDown(e, block)
                            }
                            className="absolute inset-x-0 bottom-0 h-2 cursor-ns-resize touch-none"
                            aria-label="Resize block"
                          />
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {editing && (
        <BlockForm
          editing={editing}
          weekOf={weekOf}
          tasks={tasks}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}
