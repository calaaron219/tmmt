"use client";

import { useState, useTransition } from "react";
import { createTransaction } from "./actions";
import type { Category } from "@tmmt/db";

export function QuickAddForm({ categories }: { categories: Category[] }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState<"INCOME" | "EXPENSE">("EXPENSE");

  const relevantCategories = categories.filter((c) => c.kind === type);

  async function action(formData: FormData) {
    setError(null);

    const amount = formData.get("amount") as string;
    const description = formData.get("description") as string;
    const categoryId = formData.get("categoryId") as string;
    const date = formData.get("date") as string;

    const amountCents = Math.round(parseFloat(amount) * 100);
    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      setError("Enter a positive amount");
      return;
    }

    startTransition(async () => {
      try {
        await createTransaction({
          amountCents,
          type,
          categoryId: categoryId || null,
          occurredAt: new Date(date),
          rawDescription: description,
          merchant: null,
          note: null,
        });
        // Reset the form by resetting state — the parent will re-render
        // with the new transaction thanks to revalidatePath().
        const form = document.getElementById(
          "quick-add-form"
        ) as HTMLFormElement | null;
        form?.reset();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <form
      id="quick-add-form"
      action={action}
      className="rounded-lg border border-gray-200 bg-white p-4 space-y-3"
    >
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setType("EXPENSE")}
          className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition ${
            type === "EXPENSE"
              ? "bg-gray-900 text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          Expense
        </button>
        <button
          type="button"
          onClick={() => setType("INCOME")}
          className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition ${
            type === "INCOME"
              ? "bg-gray-900 text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          Income
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-xs font-medium text-gray-600">Amount ($)</span>
          <input
            name="amount"
            type="number"
            step="0.01"
            min="0.01"
            required
            placeholder="0.00"
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-gray-600">Date</span>
          <input
            name="date"
            type="date"
            required
            defaultValue={today}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </label>
      </div>

      <label className="block">
        <span className="text-xs font-medium text-gray-600">Description</span>
        <input
          name="description"
          type="text"
          required
          placeholder="e.g. Starbucks"
          maxLength={500}
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </label>

      <label className="block">
        <span className="text-xs font-medium text-gray-600">
          Category (optional — auto-detected if blank)
        </span>
        <select
          name="categoryId"
          defaultValue=""
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">Auto-categorize</option>
          {relevantCategories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.icon ? `${c.icon} ` : ""}
              {c.name}
            </option>
          ))}
        </select>
      </label>

      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-md bg-gray-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-gray-800 disabled:opacity-50"
      >
        {isPending ? "Saving…" : "Add transaction"}
      </button>
    </form>
  );
}
