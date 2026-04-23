// Rule-based transaction categorizer (Phase 1).
// Given a transaction description and the user's categories,
// returns the best-matching category id, or null if no rule matches.
//
// Phase 2 will add an AI fallback that runs when this returns null.

type CategoryLite = { id: string; name: string; kind: "INCOME" | "EXPENSE" };

// Keyword → canonical category name. Matching is case-insensitive
// substring. First matching rule wins, so order matters — more specific
// rules should come before broader ones.
const RULES: Array<{ keywords: string[]; category: string }> = [
  // Food
  { keywords: ["starbucks", "dunkin", "peet", "blue bottle"], category: "Coffee" },
  {
    keywords: ["whole foods", "trader joe", "safeway", "kroger", "wegmans", "aldi"],
    category: "Groceries",
  },
  {
    keywords: ["mcdonald", "chipotle", "sweetgreen", "doordash", "uber eats", "grubhub", "restaurant"],
    category: "Dining",
  },
  // Transport
  { keywords: ["uber", "lyft", "taxi"], category: "Transportation" },
  { keywords: ["shell", "chevron", "exxon", "bp gas"], category: "Gas" },
  // Shopping
  { keywords: ["amazon", "target", "walmart", "costco"], category: "Shopping" },
  // Subscriptions / entertainment
  { keywords: ["netflix", "spotify", "hulu", "disney+", "apple tv", "hbo"], category: "Entertainment" },
  // Utilities
  { keywords: ["comcast", "xfinity", "verizon", "at&t", "t-mobile"], category: "Utilities" },
  // Income
  { keywords: ["payroll", "direct deposit", "salary"], category: "Salary" },
];

export function categorize(
  description: string,
  availableCategories: CategoryLite[]
): string | null {
  const lower = description.toLowerCase();
  for (const rule of RULES) {
    if (rule.keywords.some((keyword) => lower.includes(keyword))) {
      const match = availableCategories.find(
        (c) => c.name.toLowerCase() === rule.category.toLowerCase()
      );
      if (match) return match.id;
    }
  }
  return null;
}
