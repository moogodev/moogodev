import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError, formatBytes, type Me, type Project } from "../lib/api";

// Product updates shown on the dashboard. Kept as a constant until there is a
// real changelog endpoint to read from.
const UPDATES: { date: string; title: string }[] = [
  { date: "Oct 2026", title: "Spreadsheet-style table editor with inline editing" },
  { date: "Oct 2026", title: "Per-project buckets with a 256 MB quota" },
  { date: "Sep 2026", title: "Email and password sign-in with password reset" },
];

export default function Dashboard() {
  const [me, setMe] = useState<Me | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [account, listing] = await Promise.all([api.me(), api.projects()]);
        if (cancelled) return;
        setMe(account);
        setProjects(listing.projects);
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof ApiError ? cause.message : "Could not load your account.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const recent = projects.slice(0, 4);

  return (
    <div className="page-shell">
      <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
      <p className="mt-0.5 text-[0.85rem] text-muted">
        {me ? me.user.email : " "}
      </p>

      {error && (
        <div
          role="alert"
          className="mt-4 rounded-md border border-amber/40 bg-amber/10 px-3 py-2 text-[0.85rem] text-amber"
        >
          {error}
        </div>
      )}

      <dl className="mt-6 grid grid-cols-1 divide-y divide-edge border-y border-edge sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <Stat
          label="Projects"
          value={loading ? "—" : `${me?.usage.project_count ?? 0} / ${me?.max_projects ?? 2}`}
          hint="Free plan"
        />
        {/* The total across every project, deliberately not measured against the
            limit. That limit is enforced per project, so an account-wide total
            divided by it would imply a ceiling the server does not apply. */}
        <Stat
          label="Database in use"
          value={loading ? "—" : formatBytes(me?.usage.database_bytes ?? 0)}
          hint={loading ? "" : `${formatBytes(me?.max_db_bytes ?? 0)} allowed per project`}
        />
        <Stat label="Plan" value="Free" hint="No billing, nothing expires" />
      </dl>

      <div className="mt-8 grid gap-10 md:grid-cols-2">
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[0.9rem] font-semibold">Recent projects</h2>
            <Link to="/app/projects" className="text-[0.8rem] text-accent hover:underline">
              View all
            </Link>
          </div>

          {loading ? (
            <p className="text-[0.85rem] text-faint">Loading…</p>
          ) : recent.length === 0 ? (
            <p className="text-[0.85rem] text-muted">
              No projects yet.{" "}
              <Link to="/app/projects" className="text-accent hover:underline">
                Create one
              </Link>
              .
            </p>
          ) : (
            <ul className="border-t border-edge">
              {recent.map((project) => (
                <li key={project.id} className="border-b border-edge">
                  <Link
                    to={`/app/projects/${project.id}/database`}
                    className="flex items-center justify-between gap-3 py-2.5 transition-colors hover:text-accent"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[0.86rem] font-medium">
                        {project.name}
                      </span>
                      <span className="block font-mono text-[0.72rem] text-faint">
                        {project.id}
                      </span>
                    </span>
                    <span className="flex-shrink-0 text-[0.78rem] text-muted">
                      {formatBytes(project.database_bytes)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-[0.9rem] font-semibold">What&apos;s new</h2>
          <ul className="border-t border-edge">
            {UPDATES.map((update) => (
              <li key={update.title} className="border-b border-edge py-2.5">
                <span className="text-[0.86rem]">{update.title}</span>
                <span className="ml-2 text-[0.75rem] text-faint">{update.date}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="px-1 py-3 sm:px-6 sm:first:pl-1">
      <dt className="text-[0.72rem] uppercase font-bold tracking-wider text-faint">{label}</dt>
      <dd className="mt-1 text-[1.05rem] font-medium">{value}</dd>
      {hint && <dd className="text-[0.75rem] text-faint">{hint}</dd>}
    </div>
  );
}
