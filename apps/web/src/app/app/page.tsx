import { auth } from "@/auth";
import Link from "next/link";

export default async function AppHome() {
  const session = await auth();
  const name = session?.user?.name?.split(" ")[0] ?? "there";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Hi, {name}!</h1>
        <p className="mt-1 text-gray-500">
          Welcome back to TMOS. More modules land each phase.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Link
          href="/app/money"
          className="group rounded-lg border border-gray-200 bg-white p-5 transition hover:border-gray-400 hover:shadow-sm"
        >
          <div className="text-2xl">💰</div>
          <h2 className="mt-2 font-medium">Money</h2>
          <p className="mt-1 text-sm text-gray-500">
            Track expenses, income, and budgets.
          </p>
        </Link>

        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-5 opacity-50">
          <div className="text-2xl">⏱</div>
          <h2 className="mt-2 font-medium">Time</h2>
          <p className="mt-1 text-sm text-gray-500">Coming in Phase 3.</p>
        </div>
      </div>
    </div>
  );
}
