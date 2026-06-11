import Link from "next/link";
import { getActiveTimer, listProjects, listTasks } from "./actions";
import { ActiveTimerBanner } from "./active-timer-banner";
import { ProjectFilter } from "./project-filter";
import { QuickAddForm } from "./quick-add-form";
import { TaskList } from "./task-list";

export default async function TimePage({
  searchParams,
}: {
  searchParams: Promise<{ show?: string; project?: string }>;
}) {
  const { show, project } = await searchParams;
  const includeDone = show === "all";

  // "none" filters to project-less tasks; a cuid filters to that project; "all"
  // (or absent) means no filter. listTasks validates the value via zod.
  const projectFilter =
    project === "none" || (project && project !== "all") ? project : undefined;

  const [tasks, activeTimer, projects] = await Promise.all([
    listTasks({ includeDone, projectId: projectFilter }),
    getActiveTimer(),
    listProjects(),
  ]);

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
              ? projectFilter
                ? "No tasks in this view."
                : "No tasks yet. Add your first below."
              : `${openCount} open task${openCount === 1 ? "" : "s"}`}
          </p>
        </div>
        <div className="flex items-center gap-4 text-sm font-medium">
          <Link
            href="/app/time/projects"
            className="text-gray-700 hover:text-gray-900 transition"
          >
            Projects
          </Link>
          <Link
            href={includeDone ? "/app/time" : "/app/time?show=all"}
            className="text-gray-700 hover:text-gray-900 transition"
          >
            {includeDone ? "Hide completed" : "Show completed"}
          </Link>
        </div>
      </div>

      {activeTimer && <ActiveTimerBanner active={activeTimer} />}

      <QuickAddForm projects={projects} />

      {projects.length > 0 && (
        <ProjectFilter
          projects={projects}
          selected={projectFilter ?? "all"}
          includeDone={includeDone}
        />
      )}

      <TaskList tasks={tasks} />
    </div>
  );
}
