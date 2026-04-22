import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { APP_NAME, APP_DESCRIPTION } from "@tmmt/shared";

export default async function Home() {
  const session = await auth();
  if (session?.user) {
    redirect("/app");
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-6">
      <div className="w-full max-w-xl space-y-8 text-center">
        <div className="space-y-3">
          <h1 className="text-4xl font-semibold tracking-tight">{APP_NAME}</h1>
          <p className="text-lg text-gray-500">{APP_DESCRIPTION}</p>
        </div>
        <Link
          href="/login"
          className="inline-flex items-center justify-center rounded-md bg-gray-900 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-gray-800"
        >
          Get started
        </Link>
      </div>
    </main>
  );
}
