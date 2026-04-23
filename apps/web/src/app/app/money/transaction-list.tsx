"use client";

import { useTransition } from "react";
import { deleteTransaction } from "./actions";
import type { Transaction, Category } from "@tmmt/db";

type TransactionWithCategory = Transaction & {
  category: Category | null;
};

function formatAmount(cents: number, type: "INCOME" | "EXPENSE") {
  const dollars = cents / 100;
  const formatted = dollars.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
  return type === "INCOME" ? `+${formatted}` : `-${formatted}`;
}

function formatDate(d: Date) {
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function TransactionList({
  transactions,
}: {
  transactions: TransactionWithCategory[];
}) {
  if (transactions.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center">
        <p className="text-base text-gray-700">
          No transactions for this period.
        </p>
        <p className="mt-1 text-sm text-gray-500">
          Add one above or import a CSV to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <ul className="divide-y divide-gray-100">
        {transactions.map((t) => (
          <TransactionRow key={t.id} txn={t} />
        ))}
      </ul>
    </div>
  );
}

function TransactionRow({ txn }: { txn: TransactionWithCategory }) {
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    if (!confirm("Delete this transaction?")) return;
    startTransition(async () => {
      await deleteTransaction(txn.id);
    });
  }

  return (
    <li
      className={`flex items-center justify-between gap-3 px-4 py-4 transition ${
        isPending ? "opacity-50" : ""
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span
            className="text-base font-medium text-gray-900 truncate"
            title={txn.rawDescription}
          >
            {txn.rawDescription}
          </span>
          {txn.category && (
            <span
              className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
              style={{
                backgroundColor: `${txn.category.color}20`,
                color: txn.category.color,
              }}
            >
              {txn.category.icon ? `${txn.category.icon} ` : ""}
              {txn.category.name}
            </span>
          )}
        </div>
        <div className="mt-1 text-sm text-gray-600">
          {formatDate(txn.occurredAt)}
          {txn.merchant ? ` · ${txn.merchant}` : ""}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span
          className={`text-base font-semibold tabular-nums ${
            txn.type === "INCOME" ? "text-green-700" : "text-gray-900"
          }`}
        >
          {formatAmount(txn.amountCents, txn.type)}
        </span>
        <button
          type="button"
          onClick={handleDelete}
          disabled={isPending}
          className="text-gray-400 hover:text-red-600 transition text-base leading-none px-1"
          aria-label="Delete transaction"
        >
          ✕
        </button>
      </div>
    </li>
  );
}
