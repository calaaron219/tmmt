import Link from "next/link";
import { listBlocksForWeek, listTasks } from "../actions";
import { WeekGrid } from "./week-grid";

// Returns YYYY-MM-DD (UTC) of the Monday of the week containing `date`.
// JS getUTCDay: 0=Sun .. 6=Sat. Monday's offset is 1, but we want to
// snap back to the previous Monday, so:
//   diff = (day + 6) % 7  →  Sun=6, Mon=0, Tue=1, ...
function isoMondayUtc(date: Date): string {
  const day = date.getUTCDay();
  const diff = (day + 6) % 7;
  const monday = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - diff)
  );
  return monday.toISOString().slice(0, 10);
}

function addDays(ymd: string, n: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

function formatWeekLabel(weekOf: string): string {
  const [y, m, d] = weekOf.split("-").map(Number);
  const monday = new Date(Date.UTC(y, m - 1, d));
  const sunday = new Date(monday);
  sunday.setUTCDate(sunday.getUTCDate() + 6);
  const fmt = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
  const sameMonth = monday.getUTCMonth() === sunday.getUTCMonth();
  return sameMonth
    ? `${fmt.format(monday)} – ${sunday.getUTCDate()}, ${monday.getUTCFullYear()}`
    : `${fmt.format(monday)} – ${fmt.format(sunday)}, ${sunday.getUTCFullYear()}`;
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const { week } = await searchParams;
  const weekOf =
    week && /^\d{4}-\d{2}-\d{2}$/.test(week) ? week : isoMondayUtc(new Date());

  const [blocks, tasks] = await Promise.all([
    listBlocksForWeek({ weekOf }),
    listTasks({ includeDone: false }),
  ]);

  const prev = addDays(weekOf, -7);
  const next = addDays(weekOf, 7);
  const today = isoMondayUtc(new Date());

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Calendar</h1>
          <p className="mt-1 text-sm text-gray-600">{formatWeekLabel(weekOf)}</p>
        </div>
        <div className="flex items-center gap-2 text-sm font-medium">
          <Link
            href={`/app/time/calendar?week=${prev}`}
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-gray-700 transition hover:bg-gray-50"
            aria-label="Previous week"
          >
            ← Prev
          </Link>
          {weekOf !== today && (
            <Link
              href="/app/time/calendar"
              className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-gray-700 transition hover:bg-gray-50"
            >
              Today
            </Link>
          )}
          <Link
            href={`/app/time/calendar?week=${next}`}
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-gray-700 transition hover:bg-gray-50"
            aria-label="Next week"
          >
            Next →
          </Link>
          <Link
            href="/app/time"
            className="text-gray-700 hover:text-gray-900 transition ml-2"
          >
            ← Back to tasks
          </Link>
        </div>
      </div>

      <WeekGrid weekOf={weekOf} blocks={blocks} tasks={tasks} />
    </div>
  );
}
