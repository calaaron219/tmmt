import Link from "next/link";

function shiftMonth(month: string, delta: number): string {
  const [year, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(year, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function MonthNav({
  month,
  formatted,
}: {
  month: string;
  formatted: string;
}) {
  const prev = shiftMonth(month, -1);
  const next = shiftMonth(month, 1);

  return (
    <div className="flex items-center justify-center gap-4 rounded-lg border border-gray-200 bg-white px-4 py-2.5">
      <Link
        href={`/app/money/budgets?month=${prev}`}
        className="text-sm font-medium text-gray-700 hover:text-gray-900 transition"
      >
        ← {formatMonthShort(prev)}
      </Link>
      <span className="text-base font-semibold tabular-nums text-gray-900 min-w-[140px] text-center">
        {formatted}
      </span>
      <Link
        href={`/app/money/budgets?month=${next}`}
        className="text-sm font-medium text-gray-700 hover:text-gray-900 transition"
      >
        {formatMonthShort(next)} →
      </Link>
    </div>
  );
}

function formatMonthShort(month: string): string {
  const [year, m] = month.split("-").map(Number);
  return new Date(Date.UTC(year, m - 1, 1)).toLocaleDateString("en-US", {
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  });
}
