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
      className="rounded-lg border border-gray-200 bg-white p-5 space-y-4"
    >
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setType("EXPENSE")}
          className={`flex-1 rounded-md px-3 py-2 text-sm font-semibold transition ${
            type === "EXPENSE"
              ? "bg-gray-900 text-white"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          Expense
        </button>
        <button
          type="button"
          onClick={() => setType("INCOME")}
          className={`flex-1 rounded-md px-3 py-2 text-sm font-semibold transition ${
            type === "INCOME"
              ? "bg-gray-900 text-white"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          Income
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-sm font-medium text-gray-700">
            Amount ($)
          </span>
          <input
            name="amount"
            type="number"
            step="0.01"
            min="0.01"
            required
            placeholder="0.00"
            className="mt-1.5 w-full rounded-md border border-gray-300 px-3 py-2.5 text-base text-gray-900"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-gray-700">Date</span>
          <input
            name="date"
            type="date"
            required
            defaultValue={today}
            className="mt-1.5 w-full rounded-md border border-gray-300 px-3 py-2.5 text-base text-gray-900"
          />
        </label>
      </div>

      <label className="block">
        <span className="text-sm font-medium text-gray-700">Description</span>
        <input
          name="description"
          type="text"
          required
          placeholder="e.g. Starbucks"
          maxLength={500}
          className="mt-1.5 w-full rounded-md border border-gray-300 px-3 py-2.5 text-base text-gray-900"
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium text-gray-700">Category</span>
        <span className="block text-xs text-gray-500 mt-0.5">
          Leave blank to auto-detect from the description
        </span>
        <select
          name="categoryId"
          defaultValue=""
          className="mt-1.5 w-full rounded-md border border-gray-300 px-3 py-2.5 text-base text-gray-900"
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
        className="w-full rounded-md bg-gray-900 px-4 py-3 text-base font-semibold text-white transition hover:bg-gray-800 disabled:opacity-50"
      >
        {isPending ? "Saving…" : "Add transaction"}
      </button>
    </form>
  );
}
