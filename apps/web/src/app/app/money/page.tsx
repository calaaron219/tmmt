import Link from "next/link";
import {
  countUncategorized,
  listCategories,
  listTransactions,
} from "./actions";
import { AiCategorizeButton } from "./ai-categorize-button";
import { QuickAddForm } from "./quick-add-form";
import { TransactionList } from "./transaction-list";

export default async function MoneyPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month } = await searchParams;
  const [categories, transactions, uncategorizedCount] = await Promise.all([
    listCategories(),
    listTransactions({ month }),
    countUncategorized(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Money</h1>
          <p className="mt-1 text-sm text-gray-600">
            {transactions.length === 0
              ? "No transactions yet. Add your first below."
              : `${transactions.length} transaction${transactions.length === 1 ? "" : "s"}`}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/app/money/import"
            className="text-sm font-medium text-gray-700 hover:text-gray-900 transition"
          >
            Import CSV →
          </Link>
          <Link
            href="/app/money/categories"
            className="text-sm font-medium text-gray-700 hover:text-gray-900 transition"
          >
            Manage categories →
          </Link>
        </div>
      </div>

      <QuickAddForm categories={categories} />

      <AiCategorizeButton uncategorizedCount={uncategorizedCount} />

      <TransactionList transactions={transactions} />
    </div>
  );
}
