import Link from "next/link";
import { listCategories } from "../actions";
import { CategoryManager } from "./category-manager";

export default async function CategoriesPage() {
  const categories = await listCategories();

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Categories</h1>
          <p className="mt-1 text-sm text-gray-500">
            Organize your transactions. {categories.length} total.
          </p>
        </div>
        <Link
          href="/app/money"
          className="text-sm text-gray-500 hover:text-gray-900 transition"
        >
          ← Back to money
        </Link>
      </div>

      <CategoryManager initialCategories={categories} />
    </div>
  );
}
