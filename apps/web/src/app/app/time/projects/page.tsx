import Link from "next/link";
import { listProjects } from "../actions";
import { ProjectManager } from "./project-manager";

export default async function ProjectsPage() {
  const projects = await listProjects();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Projects</h1>
          <p className="mt-1 text-sm text-gray-600">
            Group your tasks. {projects.length} total.
          </p>
        </div>
        <Link
          href="/app/time"
          className="text-sm font-medium text-gray-700 hover:text-gray-900 transition"
        >
          ← Back to time
        </Link>
      </div>

      <ProjectManager initialProjects={projects} />
    </div>
  );
}
