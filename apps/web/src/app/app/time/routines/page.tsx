import Link from "next/link";
import { listProjects, listRoutines } from "../actions";
import { RoutineManager } from "./routine-manager";

export default async function RoutinesPage() {
  const [routines, projects] = await Promise.all([
    listRoutines(),
    listProjects(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Routines</h1>
          <p className="mt-1 text-sm text-gray-600">
            Tasks that generate every day. {routines.length} total.
          </p>
        </div>
        <Link
          href="/app/time"
          className="text-sm font-medium text-gray-700 hover:text-gray-900 transition"
        >
          ← Back to time
        </Link>
      </div>

      <RoutineManager initialRoutines={routines} projects={projects} />
    </div>
  );
}
