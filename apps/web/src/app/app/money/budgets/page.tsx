import Link from "next/link";
import { listBudgetsWithSpend } from "../actions";
import { BudgetRow } from "./budget-row";
import { MonthNav } from "./month-nav";
import { CopyPreviousMonthPrompt } from "./copy-previous-month-prompt";

function currentMonth(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

function formatMonth(month: string): string {
  const [year, m] = month.split("-").map(Number);
  return new Date(Date.UTC(year, m - 1, 1)).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export default async function BudgetsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month: monthParam } = await searchParams;
  const month =
    monthParam && /^\d{4}-\d{2}$/.test(monthParam) ? monthParam : currentMonth();

  const { rows, hasPreviousMonthBudgets, previousMonth } =
    await listBudgetsWithSpend(month);

  const hasAnyBudgetThisMonth = rows.some((r) => r.monthlyLimitCents !== null);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Budgets</h1>
          <p className="mt-1 text-sm text-gray-600">
            Set monthly spending caps per category.
          </p>
        </div>
        <Link
          href="/app/money"
          className="text-sm font-medium text-gray-700 hover:text-gray-900 transition"
        >
          ← Back to Money
        </Link>
      </div>

      <MonthNav month={month} formatted={formatMonth(month)} />

      {!hasAnyBudgetThisMonth && hasPreviousMonthBudgets && (
        <CopyPreviousMonthPrompt
          month={month}
          previousMonth={previousMonth}
          previousFormatted={formatMonth(previousMonth)}
        />
      )}

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center">
          <p className="text-base text-gray-700">No expense categories yet.</p>
          <p className="mt-1 text-sm text-gray-500">
            <Link
              href="/app/money/categories"
              className="font-medium text-gray-700 underline underline-offset-2 hover:text-gray-900"
            >
              Add a category
            </Link>{" "}
            first to start budgeting.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <ul className="divide-y divide-gray-100">
            {rows.map((row) => (
              <BudgetRow key={row.categoryId} row={row} month={month} />
            ))}
          </ul>
        </div>
      )}

      <p className="text-xs text-gray-500">
        Spent = total of expense transactions in this category for the month.
        Refunds (income on an expense category) are not subtracted.
      </p>
    </div>
  );
}
