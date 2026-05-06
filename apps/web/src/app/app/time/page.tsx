import Link from "next/link";
import { listTasks } from "./actions";
import { QuickAddForm } from "./quick-add-form";
import { TaskList } from "./task-list";

export default async function TimePage({
  searchParams,
}: {
  searchParams: Promise<{ show?: string }>;
}) {
  const { show } = await searchParams;
  const includeDone = show === "all";

  const tasks = await listTasks({ includeDone });

  const openCount = tasks.filter(
    (t) => t.status === "TODO" || t.status === "IN_PROGRESS"
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Time</h1>
          <p className="mt-1 text-sm text-gray-600">
            {tasks.length === 0
              ? "No tasks yet. Add your first below."
              : `${openCount} open task${openCount === 1 ? "" : "s"}`}
          </p>
        </div>
        <Link
          href={includeDone ? "/app/time" : "/app/time?show=all"}
          className="text-sm font-medium text-gray-700 hover:text-gray-900 transition"
        >
          {includeDone ? "Hide completed" : "Show completed"}
        </Link>
      </div>

      <QuickAddForm />

      <TaskList tasks={tasks} />
    </div>
  );
}
