import Link from "next/link";
import { ImportWizard } from "./import-wizard";

export default function ImportPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Import CSV
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            Upload a bank CSV. We&apos;ll parse it in your browser and
            preview before anything is saved.
          </p>
        </div>
        <Link
          href="/app/money"
          className="text-sm font-medium text-gray-700 hover:text-gray-900 transition"
        >
          ← Back to money
        </Link>
      </div>

      <ImportWizard />
    </div>
  );
}
