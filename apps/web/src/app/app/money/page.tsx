import { listCategories, listTransactions } from "./actions";
import { QuickAddForm } from "./quick-add-form";
import { TransactionList } from "./transaction-list";

export default async function MoneyPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month } = await searchParams;
  const [categories, transactions] = await Promise.all([
    listCategories(),
    listTransactions({ month }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Money</h1>
          <p className="mt-1 text-sm text-gray-500">
            {transactions.length === 0
              ? "No transactions yet. Add your first below."
              : `${transactions.length} transaction${transactions.length === 1 ? "" : "s"}`}
          </p>
        </div>
      </div>

      <QuickAddForm categories={categories} />

      <TransactionList transactions={transactions} />
    </div>
  );
}
