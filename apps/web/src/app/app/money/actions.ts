"use server";

import { auth } from "@/auth";
import { prisma } from "@tmmt/db";
import {
  createTransactionInputSchema,
  listTransactionsFilterSchema,
  createCategoryInputSchema,
  updateCategoryInputSchema,
  upsertBudgetInputSchema,
  type CreateTransactionInput,
  type ListTransactionsFilter,
  type CreateCategoryInput,
  type UpdateCategoryInput,
  type UpsertBudgetInput,
} from "@tmmt/shared";
import { categorize } from "@/lib/categorizer";
import { aiCategorizer } from "@/lib/ai-categorizer";
import { ensureDefaultCategories } from "@/lib/default-categories";
import { revalidatePath } from "next/cache";

// Small helper so every action starts the same way: check auth, ensure
// default categories exist, return userId.
async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  await ensureDefaultCategories(session.user.id);
  return session.user.id;
}

export async function listTransactions(rawFilters: unknown = {}) {
  const userId = await requireUser();
  const filters: ListTransactionsFilter =
    listTransactionsFilterSchema.parse(rawFilters);

  const where: {
    userId: string;
    categoryId?: string;
    type?: "INCOME" | "EXPENSE";
    occurredAt?: { gte: Date; lt: Date };
  } = { userId };

  if (filters.categoryId) where.categoryId = filters.categoryId;
  if (filters.type) where.type = filters.type;

  if (filters.month) {
    const [year, month] = filters.month.split("-").map(Number);
    where.occurredAt = {
      gte: new Date(year, month - 1, 1),
      lt: new Date(year, month, 1),
    };
  }

  return prisma.transaction.findMany({
    where,
    include: { category: true },
    orderBy: { occurredAt: "desc" },
    take: 200,
  });
}

export async function listCategories() {
  const userId = await requireUser();
  return prisma.category.findMany({
    where: { userId },
    orderBy: [{ kind: "asc" }, { name: "asc" }],
  });
}

// Count of this user's transactions with no categoryId. Used to show
// the "AI-categorize remaining" prompt on the money page.
export async function countUncategorized() {
  const userId = await requireUser();
  return prisma.transaction.count({
    where: { userId, categoryId: null },
  });
}

export async function createTransaction(raw: CreateTransactionInput) {
  const userId = await requireUser();
  const input = createTransactionInputSchema.parse(raw);

  // If the user didn't pick a category, try rules first; if no rule
  // fires, fall back to the AI categorizer. Both are best-effort —
  // either failing just leaves the txn uncategorized.
  let categoryId = input.categoryId ?? null;
  let categorizationSource: "MANUAL" | "RULES" | "AI" = "MANUAL";
  let confidence: number | null = null;

  if (!categoryId) {
    const categories = await prisma.category.findMany({
      where: { userId, kind: input.type },
      select: { id: true, name: true, kind: true },
    });
    categoryId = categorize(input.rawDescription, categories);
    if (categoryId) categorizationSource = "RULES";

    if (!categoryId) {
      const aiResult = await aiCategorizer.categorize({
        rawDescription: input.rawDescription,
        merchant: input.merchant ?? null,
        amountCents: input.amountCents,
        type: input.type,
        availableCategories: categories.map((c) => ({
          id: c.id,
          name: c.name,
        })),
      });
      if (aiResult.categoryId) {
        categoryId = aiResult.categoryId;
        categorizationSource = "AI";
        confidence = aiResult.confidence;
      }
    }
  } else {
    // Defensive: make sure the category belongs to this user.
    const owned = await prisma.category.findFirst({
      where: { id: categoryId, userId },
      select: { id: true },
    });
    if (!owned) {
      throw new Error("Category not found");
    }
  }

  const txn = await prisma.transaction.create({
    data: {
      userId,
      amountCents: input.amountCents,
      type: input.type,
      categoryId,
      occurredAt: input.occurredAt,
      rawDescription: input.rawDescription,
      merchant: input.merchant ?? null,
      note: input.note ?? null,
      source: "MANUAL",
      categorizationSource,
      confidence,
    },
  });

  revalidatePath("/app/money");
  return txn;
}

export async function deleteTransaction(id: string) {
  const userId = await requireUser();
  // Scope the delete to the current user — can't delete someone else's txn
  // by guessing an id.
  const result = await prisma.transaction.deleteMany({
    where: { id, userId },
  });
  if (result.count === 0) {
    throw new Error("Transaction not found");
  }
  revalidatePath("/app/money");
}

// ─── Category mutations ──────────────────────────────────

export async function createCategory(raw: CreateCategoryInput) {
  const userId = await requireUser();
  const input = createCategoryInputSchema.parse(raw);

  // Prisma will throw P2002 if (userId, name) already exists — catch
  // and surface a friendlier message.
  try {
    const category = await prisma.category.create({
      data: {
        userId,
        name: input.name,
        color: input.color,
        kind: input.kind,
        icon: input.icon ?? null,
      },
    });
    revalidatePath("/app/money/categories");
    revalidatePath("/app/money");
    return category;
  } catch (e) {
    if (
      e instanceof Error &&
      "code" in e &&
      (e as { code?: string }).code === "P2002"
    ) {
      throw new Error(`A category named "${input.name}" already exists`);
    }
    throw e;
  }
}

export async function updateCategory(
  id: string,
  raw: UpdateCategoryInput
) {
  const userId = await requireUser();
  const input = updateCategoryInputSchema.parse(raw);

  // Confirm ownership first
  const owned = await prisma.category.findFirst({
    where: { id, userId },
    select: { id: true },
  });
  if (!owned) {
    throw new Error("Category not found");
  }

  try {
    const category = await prisma.category.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.color !== undefined && { color: input.color }),
        ...(input.kind !== undefined && { kind: input.kind }),
        ...(input.icon !== undefined && { icon: input.icon }),
      },
    });
    revalidatePath("/app/money/categories");
    revalidatePath("/app/money");
    return category;
  } catch (e) {
    if (
      e instanceof Error &&
      "code" in e &&
      (e as { code?: string }).code === "P2002"
    ) {
      throw new Error(`A category named "${input.name}" already exists`);
    }
    throw e;
  }
}

// ─── CSV import ──────────────────────────────────────────

export type ImportRowInput = {
  amountCents: number;
  type: "INCOME" | "EXPENSE";
  occurredAt: Date;
  rawDescription: string;
  merchant?: string | null;
};

const MAX_IMPORT_ROWS = 1000;

// Batch-create transactions from a parsed CSV. Runs the rules-based
// categorizer on each row (using the user's categories of the right kind).
// Returns a summary the UI can show.
export async function bulkCreateTransactions(rows: ImportRowInput[]) {
  const userId = await requireUser();

  if (rows.length === 0) {
    throw new Error("Nothing to import");
  }
  if (rows.length > MAX_IMPORT_ROWS) {
    throw new Error(
      `Too many rows (${rows.length}). Max ${MAX_IMPORT_ROWS} per import.`
    );
  }

  // Fetch user's categories once; categorizer reuses this list.
  const categories = await prisma.category.findMany({
    where: { userId },
    select: { id: true, name: true, kind: true },
  });

  const categoriesByKind = {
    INCOME: categories.filter((c) => c.kind === "INCOME"),
    EXPENSE: categories.filter((c) => c.kind === "EXPENSE"),
  };

  let autoCategorized = 0;
  const data = rows.map((row) => {
    const categoryId = categorize(
      row.rawDescription,
      categoriesByKind[row.type]
    );
    if (categoryId) autoCategorized++;

    return {
      userId,
      amountCents: row.amountCents,
      type: row.type,
      categoryId,
      occurredAt: row.occurredAt,
      rawDescription: row.rawDescription,
      merchant: row.merchant ?? null,
      source: "CSV" as const,
      // CSV import is rules-only; AI fallback is opt-in via the bulk
      // "AI-categorize remaining" action. Uncategorized rows record as
      // MANUAL so the user can later trigger AI on them deliberately.
      categorizationSource: (categoryId ? "RULES" : "MANUAL") as
        | "RULES"
        | "MANUAL",
    };
  });

  const result = await prisma.transaction.createMany({ data });

  revalidatePath("/app/money");
  return {
    imported: result.count,
    autoCategorized,
    uncategorized: result.count - autoCategorized,
  };
}

// ─── Bulk AI categorization ──────────────────────────────

// Cap per click — keeps Gemini cost predictable. User can click again
// for the next batch if they have more than this.
const MAX_AI_BATCH = 50;

// Find all of this user's transactions that don't have a category, run
// each through the AI categorizer, and update the ones the model is
// confident about. Returns a summary the UI can show.
export async function aiCategorizeUncategorized() {
  const userId = await requireUser();

  const uncategorized = await prisma.transaction.findMany({
    where: { userId, categoryId: null },
    orderBy: { occurredAt: "desc" },
    take: MAX_AI_BATCH,
  });

  if (uncategorized.length === 0) {
    return { processed: 0, categorized: 0, remaining: 0 };
  }

  const categories = await prisma.category.findMany({
    where: { userId },
    select: { id: true, name: true, kind: true },
  });
  const categoriesByKind = {
    INCOME: categories.filter((c) => c.kind === "INCOME"),
    EXPENSE: categories.filter((c) => c.kind === "EXPENSE"),
  };

  let categorized = 0;
  // Sequential to stay under Gemini free-tier RPM and keep the cost
  // predictable. ~50 rows × ~1s each = manageable. If this gets slow
  // we can add bounded parallelism later.
  for (const txn of uncategorized) {
    const aiResult = await aiCategorizer.categorize({
      rawDescription: txn.rawDescription,
      merchant: txn.merchant,
      amountCents: txn.amountCents,
      type: txn.type,
      availableCategories: categoriesByKind[txn.type].map((c) => ({
        id: c.id,
        name: c.name,
      })),
    });
    if (aiResult.categoryId) {
      await prisma.transaction.update({
        where: { id: txn.id },
        data: {
          categoryId: aiResult.categoryId,
          categorizationSource: "AI",
          confidence: aiResult.confidence,
        },
      });
      categorized++;
    }
  }

  // Count how many uncategorized are still left so the UI can show
  // "categorize next batch" if needed.
  const remaining = await prisma.transaction.count({
    where: { userId, categoryId: null },
  });

  revalidatePath("/app/money");
  return {
    processed: uncategorized.length,
    categorized,
    remaining,
  };
}

export async function deleteCategory(id: string) {
  const userId = await requireUser();
  // deleteMany scoped by userId guards against deleting another user's
  // category. Schema has onDelete: SetNull for Transaction.category, so
  // transactions tagged with this category become uncategorized.
  const result = await prisma.category.deleteMany({
    where: { id, userId },
  });
  if (result.count === 0) {
    throw new Error("Category not found");
  }
  revalidatePath("/app/money/categories");
  revalidatePath("/app/money");
}

// ─── Budgets ─────────────────────────────────────────────

// Convert "YYYY-MM" to the first-of-month DateTime used by the unique
// constraint. UTC anchoring so reads/writes match regardless of TZ.
function monthToDate(month: string): Date {
  const [year, m] = month.split("-").map(Number);
  return new Date(Date.UTC(year, m - 1, 1));
}

// Returns the previous "YYYY-MM" (e.g. "2026-05" → "2026-04"). Used
// by the UI to show "copy from previous month" prompts.
function previousMonth(month: string): string {
  const [year, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(year, m - 2, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export type BudgetRow = {
  categoryId: string;
  name: string;
  color: string;
  icon: string | null;
  monthlyLimitCents: number | null;
  spentCents: number;
};

// Returns one row per expense category for the given month, joined with
// the user's budget (if any) and aggregate spend on EXPENSE transactions
// in that category for that month.
//
// Spend definition: SUM(amountCents) WHERE type='EXPENSE'. Refunds entered
// as INCOME on an expense category are NOT subtracted — see
// docs/decisions/phase-2-budgets.md decision 4.
export async function listBudgetsWithSpend(month: string): Promise<{
  rows: BudgetRow[];
  hasPreviousMonthBudgets: boolean;
  previousMonth: string;
}> {
  const userId = await requireUser();

  if (!/^\d{4}-\d{2}$/.test(month)) {
    throw new Error("Invalid month — use YYYY-MM");
  }

  const monthStart = monthToDate(month);
  const monthEnd = new Date(monthStart);
  monthEnd.setUTCMonth(monthEnd.getUTCMonth() + 1);

  const prevMonth = previousMonth(month);
  const prevMonthStart = monthToDate(prevMonth);

  const [categories, budgets, spendByCategory, prevBudgetCount] =
    await Promise.all([
      prisma.category.findMany({
        where: { userId, kind: "EXPENSE" },
        orderBy: { name: "asc" },
        select: { id: true, name: true, color: true, icon: true },
      }),
      prisma.budget.findMany({
        where: { userId, month: monthStart },
      }),
      prisma.transaction.groupBy({
        by: ["categoryId"],
        where: {
          userId,
          type: "EXPENSE",
          categoryId: { not: null },
          occurredAt: { gte: monthStart, lt: monthEnd },
        },
        _sum: { amountCents: true },
      }),
      prisma.budget.count({
        where: { userId, month: prevMonthStart },
      }),
    ]);

  const budgetByCategory = new Map(budgets.map((b) => [b.categoryId, b]));
  const spendByCategoryMap = new Map(
    spendByCategory.map((s) => [s.categoryId, s._sum.amountCents ?? 0])
  );

  const rows: BudgetRow[] = categories.map((c) => ({
    categoryId: c.id,
    name: c.name,
    color: c.color,
    icon: c.icon,
    monthlyLimitCents: budgetByCategory.get(c.id)?.monthlyLimitCents ?? null,
    spentCents: spendByCategoryMap.get(c.id) ?? 0,
  }));

  return {
    rows,
    hasPreviousMonthBudgets: prevBudgetCount > 0,
    previousMonth: prevMonth,
  };
}

export async function upsertBudget(raw: UpsertBudgetInput) {
  const userId = await requireUser();
  const input = upsertBudgetInputSchema.parse(raw);

  // Confirm the category belongs to this user (and is EXPENSE — we
  // don't budget income categories).
  const category = await prisma.category.findFirst({
    where: { id: input.categoryId, userId },
    select: { id: true, kind: true },
  });
  if (!category) {
    throw new Error("Category not found");
  }
  if (category.kind !== "EXPENSE") {
    throw new Error("Only expense categories can have budgets");
  }

  const monthStart = monthToDate(input.month);

  const budget = await prisma.budget.upsert({
    where: {
      userId_categoryId_month: {
        userId,
        categoryId: input.categoryId,
        month: monthStart,
      },
    },
    update: { monthlyLimitCents: input.monthlyLimitCents },
    create: {
      userId,
      categoryId: input.categoryId,
      month: monthStart,
      monthlyLimitCents: input.monthlyLimitCents,
    },
  });

  revalidatePath("/app/money/budgets");
  return budget;
}

export async function deleteBudget(categoryId: string, month: string) {
  const userId = await requireUser();
  if (!/^\d{4}-\d{2}$/.test(month)) {
    throw new Error("Invalid month — use YYYY-MM");
  }

  const monthStart = monthToDate(month);
  const result = await prisma.budget.deleteMany({
    where: { userId, categoryId, month: monthStart },
  });

  if (result.count === 0) {
    throw new Error("Budget not found");
  }
  revalidatePath("/app/money/budgets");
}

// Copies all budgets from the previous month into the given month
// (skips categories that already have a budget for the target month).
// Used by the "no budgets yet" prompt.
export async function copyBudgetsFromPreviousMonth(month: string) {
  const userId = await requireUser();
  if (!/^\d{4}-\d{2}$/.test(month)) {
    throw new Error("Invalid month — use YYYY-MM");
  }

  const monthStart = monthToDate(month);
  const prevMonthStart = monthToDate(previousMonth(month));

  const [prevBudgets, existingThisMonth] = await Promise.all([
    prisma.budget.findMany({ where: { userId, month: prevMonthStart } }),
    prisma.budget.findMany({
      where: { userId, month: monthStart },
      select: { categoryId: true },
    }),
  ]);

  const existingCategoryIds = new Set(
    existingThisMonth.map((b) => b.categoryId)
  );
  const toCopy = prevBudgets.filter(
    (b) => !existingCategoryIds.has(b.categoryId)
  );

  if (toCopy.length === 0) {
    return { copied: 0 };
  }

  const result = await prisma.budget.createMany({
    data: toCopy.map((b) => ({
      userId,
      categoryId: b.categoryId,
      month: monthStart,
      monthlyLimitCents: b.monthlyLimitCents,
    })),
  });

  revalidatePath("/app/money/budgets");
  return { copied: result.count };
}
