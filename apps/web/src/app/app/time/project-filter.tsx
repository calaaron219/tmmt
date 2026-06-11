import Link from "next/link";
import type { Project } from "@tmmt/db";

// Chips: All · No project · <each project>. Server-rendered, links round-trip
// through ?project= so deep-linking & back/forward work.
export function ProjectFilter({
  projects,
  selected,
  includeDone,
}: {
  projects: Project[];
  selected: string;
  includeDone: boolean;
}) {
  function href(value: string) {
    const params = new URLSearchParams();
    if (includeDone) params.set("show", "all");
    if (value !== "all") params.set("project", value);
    const qs = params.toString();
    return qs ? `/app/time?${qs}` : "/app/time";
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Chip href={href("all")} active={selected === "all"} label="All" />
      <Chip
        href={href("none")}
        active={selected === "none"}
        label="No project"
      />
      {projects.map((p) => (
        <Chip
          key={p.id}
          href={href(p.id)}
          active={selected === p.id}
          label={p.name}
          color={p.color}
        />
      ))}
    </div>
  );
}

function Chip({
  href,
  active,
  label,
  color,
}: {
  href: string;
  active: boolean;
  label: string;
  color?: string;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition ${
        active
          ? "border-gray-900 bg-gray-900 text-white"
          : "border-gray-200 bg-white text-gray-700 hover:border-gray-400"
      }`}
    >
      {color && (
        <span
          className="h-2 w-2 rounded-full"
          style={{ backgroundColor: color }}
          aria-hidden="true"
        />
      )}
      {label}
    </Link>
  );
}
