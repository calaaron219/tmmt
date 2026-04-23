import { z } from "zod";

// Transaction type and source enums mirror Prisma's enums. Keeping them in
// sync by hand is fine for now; if we grow many more we can generate them.
export const transactionTypeSchema = z.enum(["INCOME", "EXPENSE"]);
export const transactionSourceSchema = z.enum(["MANUAL", "CSV", "API"]);
export const categoryKindSchema = z.enum(["INCOME", "EXPENSE"]);

// Input for creating a transaction manually from the UI.
// Amount is in cents (Int) to avoid floating-point rounding.
export const createTransactionInputSchema = z.object({
  amountCents: z
    .number()
    .int()
    .positive()
    .max(999_999_999, "Amount is too large"),
  type: transactionTypeSchema,
  categoryId: z.string().cuid().optional().nullable(),
  occurredAt: z.coerce.date(),
  rawDescription: z.string().min(1).max(500),
  merchant: z.string().max(200).optional().nullable(),
  note: z.string().max(1000).optional().nullable(),
});
export type CreateTransactionInput = z.infer<
  typeof createTransactionInputSchema
>;

// Filters for listing transactions.
export const listTransactionsFilterSchema = z.object({
  // "2026-04" format for the month selector, or undefined for all months
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/, "Use YYYY-MM")
    .optional(),
  categoryId: z.string().cuid().optional(),
  type: transactionTypeSchema.optional(),
});
export type ListTransactionsFilter = z.infer<
  typeof listTransactionsFilterSchema
>;

// Category creation — used both by the default-categories helper and (later)
// the category management UI in PR #4.
export const createCategoryInputSchema = z.object({
  name: z.string().min(1).max(50).trim(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Must be hex like #22c55e"),
  kind: categoryKindSchema,
  icon: z.string().max(10).optional().nullable(),
});
export type CreateCategoryInput = z.infer<typeof createCategoryInputSchema>;
