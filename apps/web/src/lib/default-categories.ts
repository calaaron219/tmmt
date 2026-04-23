import { prisma } from "@tmmt/db";

// Sensible starter set for a new user. Matches the canonical names used
// by the rule-based categorizer in lib/categorizer.ts.
const DEFAULTS = [
  // Expense
  { name: "Groceries", color: "#22c55e", kind: "EXPENSE" as const, icon: "🛒" },
  { name: "Dining", color: "#f97316", kind: "EXPENSE" as const, icon: "🍽️" },
  { name: "Coffee", color: "#a16207", kind: "EXPENSE" as const, icon: "☕" },
  { name: "Transportation", color: "#0ea5e9", kind: "EXPENSE" as const, icon: "🚗" },
  { name: "Gas", color: "#ea580c", kind: "EXPENSE" as const, icon: "⛽" },
  { name: "Shopping", color: "#ec4899", kind: "EXPENSE" as const, icon: "🛍️" },
  { name: "Entertainment", color: "#a855f7", kind: "EXPENSE" as const, icon: "🎬" },
  { name: "Utilities", color: "#64748b", kind: "EXPENSE" as const, icon: "💡" },
  { name: "Rent", color: "#ef4444", kind: "EXPENSE" as const, icon: "🏠" },
  // Income
  { name: "Salary", color: "#10b981", kind: "INCOME" as const, icon: "💰" },
  { name: "Other income", color: "#84cc16", kind: "INCOME" as const, icon: "✨" },
];

// Idempotent: only creates categories if the user has none yet.
export async function ensureDefaultCategories(userId: string): Promise<void> {
  const existing = await prisma.category.count({ where: { userId } });
  if (existing > 0) return;

  await prisma.category.createMany({
    data: DEFAULTS.map((c) => ({ ...c, userId })),
  });
}
