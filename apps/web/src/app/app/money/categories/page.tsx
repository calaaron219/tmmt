import Link from "next/link";
import { listCategories } from "../actions";
import { CategoryManager } from "./category-manager";

export default async function CategoriesPage() {
  const categories = await listCategories();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Categories</h1>
          <p className="mt-1 text-sm text-gray-600">
            Organize your transactions. {categories.length} total.
          </p>
        </div>
        <Link
          href="/app/money"
          className="text-sm font-medium text-gray-700 hover:text-gray-900 transition"
        >
          ← Back to money
        </Link>
      </div>

      <CategoryManager initialCategories={categories} />
    </div>
  );
}
