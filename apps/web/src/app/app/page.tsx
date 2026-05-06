import { auth } from "@/auth";
import Link from "next/link";

export default async function AppHome() {
  const session = await auth();
  const name = session?.user?.name?.split(" ")[0] ?? "there";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">
          Hi, {name}!
        </h1>
        <p className="mt-1 text-base text-gray-600">
          Welcome back to TMOS. More modules land each phase.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Link
          href="/app/money"
          className="group rounded-lg border border-gray-200 bg-white p-5 transition hover:border-gray-400 hover:shadow-sm"
        >
          <div className="text-3xl" aria-hidden="true">
            💰
          </div>
          <h2 className="mt-2 text-lg font-semibold text-gray-900">
            Money
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            Track expenses, income, and budgets.
          </p>
        </Link>

        <Link
          href="/app/time"
          className="group rounded-lg border border-gray-200 bg-white p-5 transition hover:border-gray-400 hover:shadow-sm"
        >
          <div className="text-3xl" aria-hidden="true">
            ⏱
          </div>
          <h2 className="mt-2 text-lg font-semibold text-gray-900">Time</h2>
          <p className="mt-1 text-sm text-gray-600">
            Capture tasks, set priorities, and track due dates.
          </p>
        </Link>
      </div>
    </div>
  );
}
