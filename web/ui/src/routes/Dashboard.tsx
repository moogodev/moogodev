import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError, formatBytes, type Me, type Project } from "../lib/api";

// Product updates, each a slug of the mini-blog. The title opens the full
// post (news.<domain>/<slug>), not just the changelog front page, so a reader
// lands on the entry they clicked.
// Cross-origin on purpose: a plain <a> is the honest way to leave the
// dashboard for another site, where SPA routing does not apply.
const UPDATES: { date: string; title: string; slug: string }[] = [
  {
    date: "Oct 2026",
    title: "Spreadsheet-style table editor with inline editing",
    slug: "spreadsheet-table-editor",
  },
  {
    date: "Oct 2026",
    title: "Per-project buckets with a 256 MB quota",
    slug: "per-project-buckets",
  },
  {
    date: "Sep 2026",
    title: "Email and password sign-in with password reset",
    slug: "email-password-signin",
  },
];

// newsOrigin is where the changelog lives: news.<domain> in production, the
// local news binary on :8081 when the dashboard runs on localhost. The news
// service is always a separate origin, so every link below is an <a>, never
// a client-side route.
function newsOrigin(): string {
  const { protocol, hostname } = window.location;
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return `${protocol}//${hostname}:8081`;
  }
  return "https://news.moogo.dev";
}

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
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[0.9rem] font-semibold">What&apos;s new</h2>
            <a
              href={newsOrigin()}
              className="text-[0.8rem] text-accent hover:underline"
            >
              See all
            </a>
          </div>
          <ul className="border-t border-edge">
            {UPDATES.map((update) => (
              <li key={update.title} className="border-b border-edge">
                <a
                  href={`${newsOrigin()}/${update.slug}`}
                  className="flex items-baseline justify-between gap-3 py-2.5 transition-colors hover:text-accent"
                >
                  <span className="min-w-0 truncate text-[0.86rem]">{update.title}</span>
                  <span className="flex-shrink-0 text-[0.75rem] text-faint">{update.date}</span>
                </a>
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
