import { signIn, auth } from "@/auth";
import { redirect } from "next/navigation";
import { APP_NAME } from "@tmmt/shared";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const session = await auth();
  if (session?.user) {
    redirect("/app");
  }

  const { callbackUrl } = await searchParams;
  const redirectTo = callbackUrl ?? "/app";

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-gray-50">
      <div className="w-full max-w-sm space-y-6 rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">
            Welcome to {APP_NAME}
          </h1>
          <p className="text-sm text-gray-500">
            Sign in to track your time and money.
          </p>
        </div>

        <div className="space-y-3">
          <form
            action={async () => {
              "use server";
              await signIn("github", { redirectTo });
            }}
          >
            <button
              type="submit"
              className="flex w-full items-center justify-center gap-2 rounded-md bg-gray-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-gray-800"
            >
              Continue with GitHub
            </button>
          </form>

          <form
            action={async () => {
              "use server";
              await signIn("google", { redirectTo });
            }}
          >
            <button
              type="submit"
              className="flex w-full items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-900 transition hover:bg-gray-50"
            >
              Continue with Google
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
