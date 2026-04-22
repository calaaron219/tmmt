import { auth } from "@/auth";

export default async function AppHome() {
  const session = await auth();
  const name = session?.user?.name ?? "there";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Hi, {name}!</h1>
        <p className="mt-1 text-gray-500">
          You&apos;re signed in. More features land in PR #3.
        </p>
      </div>

      <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center">
        <p className="text-sm text-gray-500">
          Money tracking, timers, and the dashboard will appear here as
          Phase 1–7 ships.
        </p>
      </div>
    </div>
  );
}
