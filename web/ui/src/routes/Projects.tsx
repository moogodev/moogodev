import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError, formatBytes, type Me, type Project } from "../lib/api";
import CreateProjectModal from "../components/CreateProjectModal";

// BUCKET_QUOTA_BYTES is the object storage allowance for one project.
//
// It is a constant here because the server does not report it: /api/me carries
// the database quota but no bucket quota, and the bucket listing that does
// report one is per project. Every bucket response confirms the same 256 MB, so
// this matches the server. If the quota ever becomes configurable it belongs in
// the /api/me response alongside max_db_bytes rather than here.
const BUCKET_QUOTA_BYTES = 256 * 1024 * 1024;

// The list renders in the order the endpoint returns it, which is newest first.
// There is no search or sort control: the plan allows two projects, and a filter
// box for two items is a control that costs more room than it saves. If the
// project cap ever rises past the point of scanning, this is where to add it
// back.
export default function Projects() {
  const [me, setMe] = useState<Me | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [account, listing] = await Promise.all([api.me(), api.projects()]);
      setMe(account);
      setProjects(listing.projects);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Could not load your projects.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCreated = useCallback((project: Project) => {
    setProjects((current) => [project, ...current]);
    setMe((current) =>
      current
        ? {
            ...current,
            usage: { ...current.usage, project_count: current.usage.project_count + 1 },
          }
        : current,
    );
    // The modal stays open on purpose: the secret key is shown exactly once on
    // the step that follows creation.
  }, []);

  const disabled = me !== null && me.usage.project_count >= me.max_projects;

  const totalDbBytes = projects.reduce((sum, project) => sum + project.database_bytes, 0);
  const totalBucketBytes = projects.reduce((sum, project) => sum + (project.storage_bytes ?? 0), 0);
  const maxDbBytes = me?.max_db_bytes ?? 0;
  // The bucket allowance is a fixed 256 MB per project and is not exposed on
  // /api/me, so it is derived from the project count rather than hard-coded
  // per project. See BUCKET_QUOTA_BYTES.
  const maxBucketBytes = BUCKET_QUOTA_BYTES * Math.max(1, projects.length);
  const paused = projects.filter((project) => project.status === "paused").length;
  const projectCount = me?.usage.project_count ?? 0;
  const maxProjects = me?.max_projects ?? 2;
  const projectPercent = toPercent(projectCount / (maxProjects || 1));
  const dbCapacity = maxDbBytes * Math.max(1, projects.length);
  const dbPercentRatio = dbCapacity ? totalDbBytes / dbCapacity : 0;
  const bucketRatio = maxBucketBytes ? totalBucketBytes / maxBucketBytes : 0;
  const dbPercent = toPercent(dbPercentRatio);
  const bucketPercent = toPercent(bucketRatio);

  return (
    <div className="page-shell">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Projects</h1>
          <p className="mt-0.5 text-[0.85rem] text-muted">
            Each project gets its own SQLite database and object storage.
          </p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          disabled={disabled}
          className="cursor-pointer rounded-md bg-accent-strong px-3.5 py-2 text-[0.82rem] font-semibold text-accent-ink transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
        >
          New project
        </button>
      </div>

      {disabled && (
        <p className="mb-5 rounded-lg border border-amber/40 bg-amber/10 px-4 py-3 text-[0.85rem] font-medium text-amber">
          You are on the free plan and have used all {me?.max_projects} project slots.
          Delete one to make room for another.
        </p>
      )}

      {/* Usage summary. Database and bucket are separate cells because they are
          separate quotas with separate ceilings, and lumping them into one
          "storage" number hides which one is filling up.

          Both totals accumulate across every project. Each project has its own
          allowance, so the denominator is the per-project limit multiplied by
          the project count: two projects means two allowances to fill. */}
      <dl className="mb-6 grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-edge bg-edge sm:grid-cols-3">
        <Summary
          label="Projects"
          value={`${projectCount} / ${maxProjects}`}
          percent={projectPercent}
          left={`${Math.max(0, maxProjects - projectCount)} left`}
          hint={paused > 0 ? `${paused} paused` : undefined}
          ratio={projectCount / (maxProjects || 1)}
        />
        <Summary
          label="Database"
          value={formatBytes(totalDbBytes)}
          percent={dbPercent}
          left={`${formatBytes(Math.max(0, maxDbBytes * Math.max(1, projects.length) - totalDbBytes))} left`}
          hint={`${formatBytes(maxDbBytes)} × ${projects.length || 0} project${projects.length === 1 ? "" : "s"}`}
          ratio={dbPercentRatio}
        />
        <Summary
          label="Bucket"
          value={formatBytes(totalBucketBytes)}
          percent={bucketPercent}
          left={`${formatBytes(Math.max(0, maxBucketBytes - totalBucketBytes))} left`}
          hint={`256 MB × ${projects.length || 0} project${projects.length === 1 ? "" : "s"}`}
          ratio={bucketRatio}
        />
      </dl>

      {error && (
        <div
          role="alert"
          className="mb-4 rounded-md border border-amber/40 bg-amber/10 px-3 py-2 text-[0.85rem] text-amber"
        >
          {error}
        </div>
      )}

      {/* Project grid */}
      {loading ? (
        <p className="py-16 text-center text-[0.88rem] text-faint">Loading…</p>
      ) : projects.length === 0 ? (
        <EmptyState onCreate={() => setModalOpen(true)} />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} maxDbBytes={maxDbBytes} />
          ))}
        </ul>
      )}

      <CreateProjectModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={handleCreated}
        disabled={disabled}
        maxProjects={me?.max_projects ?? 2}
        currentCount={me?.usage.project_count ?? 0}
      />
    </div>
  );
}

// barWidth maps a 0..1 ratio onto a fixed set of Tailwind width classes.
//
// A width needs to be a real percentage, which would mean an inline style
// attribute, and the server sends `style-src 'self'` with no 'unsafe-inline'.
// The CSP blocks those. Quantizing to 5% steps keeps the bar accurate enough to
// read while staying in the stylesheet.
function barWidth(ratio: number): string {
  const steps = [
    "w-0", "w-[5%]", "w-[10%]", "w-[15%]", "w-[20%]", "w-[25%]", "w-[30%]",
    "w-[35%]", "w-[40%]", "w-[45%]", "w-[50%]", "w-[55%]", "w-[60%]",
    "w-[65%]", "w-[70%]", "w-[75%]", "w-[80%]", "w-[85%]", "w-[90%]",
    "w-[95%]", "w-full",
  ];
  const clamped = Math.max(0, Math.min(1, ratio));
  return steps[Math.round(clamped * (steps.length - 1))];
}

// toPercent renders a 0..1 ratio as a whole-number percentage.
//
// Sub-1% usage would otherwise round to "0%", which reads as "nothing is being
// used" rather than "a little is". One decimal is kept below 10% for the same
// reason: the early months of a database are exactly when the number is small
// and the owner is watching it.
function toPercent(ratio: number): string {
  const percent = Math.max(0, Math.min(1, ratio)) * 100;
  if (percent > 0 && percent < 1) {
    return "<1%";
  }
  if (percent < 10) {
    return `${percent.toFixed(1)}%`;
  }
  return `${Math.round(percent)}%`;
}

// Summary is one cell of the usage strip.
//
// The bar shows how full a quota is; the percentage says it in numbers; "left"
// answers the question the other two raise, which is how much room remains. A
// metric with no ceiling (bucket storage is per project) has no percentage to
// show, so it takes a note instead of a fake bar.
function Summary({
  label,
  value,
  hint,
  percent,
  left,
  note,
  ratio,
}: {
  label: string;
  value: string;
  hint?: string;
  percent?: string;
  left?: string;
  note?: string;
  ratio?: number;
}) {
  return (
    <div className="bg-background px-4 py-3">
      <dt className="text-[0.72rem] font-bold uppercase tracking-wider text-faint">
        {label}
      </dt>
      <dd className="mt-1 flex flex-wrap items-baseline gap-x-2 text-[1.05rem] font-semibold text-foreground">
        {value}
        {percent && (
          <span className="text-[0.8rem] font-medium text-muted">{percent} used</span>
        )}
      </dd>
      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[0.75rem]">
        {hint && <span className="text-muted">{hint}</span>}
        {left && <span className="font-medium text-foreground">{left}</span>}
      </div>
      {note && <p className="mt-0.5 text-[0.75rem] text-faint">{note}</p>}
      {ratio !== undefined && (
        <div
          className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-panel-raised"
          role="presentation"
        >
          <div
            className={`h-full rounded-full ${ratio >= 0.9 ? "bg-amber" : "bg-accent"} ${barWidth(ratio)}`}
          />
        </div>
      )}
    </div>
  );
}

function ProjectCard({
  project,
  maxDbBytes,
}: {
  project: Project;
  maxDbBytes: number;
}) {
  const [copied, setCopied] = useState(false);
  const paused = project.status === "paused";
  // Each card is measured against the single allowance that applies to it,
  // which is the same denominator the quota is enforced with on the server.
  const dbRatio = maxDbBytes ? project.database_bytes / maxDbBytes : 0;
  const bucketRatio = project.storage_bytes ? project.storage_bytes / BUCKET_QUOTA_BYTES : 0;

  const handleCopyId = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(project.id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked; the id is selectable on screen.
    }
  }, [project.id]);

  return (
    <li
      className={`group relative flex flex-col rounded-xl border bg-background transition-colors hover:border-hover-edge ${
        paused ? "border-red/40" : "border-edge"
      }`}
    >
      {/* The card is one big target. The link is an overlay rather than a
          wrapper because a real <button> for Copy lives inside the card, and
          nesting a button inside an anchor is invalid HTML that also fires the
          navigation when Copy is clicked. The overlay covers the card, and Copy
          is raised above it with z-10 so it stays independently clickable. */}
      <Link
        to={`/app/projects/${project.id}/database`}
        className="absolute inset-0 z-0 rounded-xl focus-visible:outline-none"
        aria-label={`Open ${project.name}`}
      />
      <div className="pointer-events-none relative z-[1] flex flex-1 flex-col p-5">
        {/* Header: name and status are what identify the card, so they get the
            most weight and nothing competes with them. */}
        <div className="flex items-start justify-between gap-3">
          <span className="min-w-0 text-base font-semibold leading-tight text-foreground transition-colors group-hover:text-accent">
            <span className="block truncate">{project.name}</span>
          </span>
          <StatusDot status={project.status} />
        </div>

        {paused && (
          <p className="mt-3 rounded-md bg-red/10 px-2.5 py-1.5 text-[0.78rem] font-medium text-red">
            Queries and uploads are refused while paused.
          </p>
        )}

        {/* The two quotas, side by side. They are the numbers a project is
            actually judged by, and they share one baseline so the two bars are
            comparable by eye instead of being stacked in separate blocks. */}
        <div className="mt-5 grid grid-cols-2 gap-4">
          <Meter
            label="Database"
            used={formatBytes(project.database_bytes)}
            quota={formatBytes(maxDbBytes)}
            ratio={dbRatio}
          />
          <Meter
            label="Bucket"
            used={formatBytes(project.storage_bytes ?? 0)}
            quota={formatBytes(BUCKET_QUOTA_BYTES)}
            ratio={bucketRatio}
          />
        </div>

        {/* Everything else is reference rather than a live metric, so it goes in
            one quiet footer instead of competing with the meters above. */}
        <div className="mt-auto flex items-center justify-between gap-3 border-t border-edge pt-4">
          <div className="flex min-w-0 items-center gap-2">
            <code className="min-w-0 truncate font-mono text-[0.72rem] text-muted">
              {project.secret_key_prefix}…
            </code>
            <button
              type="button"
              onClick={handleCopyId}
              title="Copy project id"
              className="pointer-events-auto relative z-10 shrink-0 cursor-pointer rounded border border-edge px-1.5 py-0.5 text-[0.68rem] font-semibold text-muted transition-colors hover:border-hover-edge hover:bg-hover-bg hover:text-foreground"
            >
              {copied ? "Copied" : "Copy id"}
            </button>
          </div>
          <span className="shrink-0 text-[0.72rem] text-faint">
            {relativeTime(project.updated_at)}
          </span>
        </div>
      </div>
    </li>
  );
}

// Meter is one quota on a card: the label, what is used against what, and a bar.
//
// The percentage is only shown once there is something to report, because
// "0% used" on an empty database is noise rather than information.
function Meter({
  label,
  used,
  quota,
  ratio,
}: {
  label: string;
  used: string;
  quota: string;
  ratio: number;
}) {
  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[0.7rem] font-bold uppercase tracking-wider text-faint">
          {label}
        </span>
        {ratio > 0 && (
          <span className="text-[0.7rem] font-semibold text-muted">
            {toPercent(ratio)} used
          </span>
        )}
      </div>
      <p className="mt-1 truncate text-[0.9rem] font-semibold text-foreground">{used}</p>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-panel-raised">
        <div
          className={`h-full rounded-full ${ratio >= 0.9 ? "bg-amber" : "bg-accent"} ${barWidth(ratio)}`}
        />
      </div>
      <p className="mt-1 truncate text-[0.7rem] text-faint">of {quota}</p>
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const tone =
    status === "ready"
      ? "bg-accent"
      : status === "failed"
        ? "bg-amber"
        : status === "paused"
          ? "bg-red"
          : "bg-faint";
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 text-[0.75rem] font-semibold capitalize text-muted`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${tone}`} />
      {status}
    </span>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="rounded-xl border border-dashed border-edge-strong px-6 py-16 text-center">
      <p className="text-[0.95rem] font-semibold text-foreground">No projects yet</p>
      <p className="mx-auto mt-1 max-w-[42ch] text-[0.85rem] text-muted">
        A project gives you a SQLite database and a bucket, reachable over HTTP with
        a key you keep in your own environment.
      </p>
      <button
        onClick={onCreate}
        className="mt-5 cursor-pointer rounded-md bg-accent-strong px-3.5 py-2 text-[0.82rem] font-semibold text-accent-ink transition-colors hover:bg-accent"
      >
        New project
      </button>
    </div>
  );
}

// relativeTime describes how long ago an ISO timestamp was, in the coarse units
// that fit on one line. It falls back to an absolute date past a month, where
// "60 days ago" stops being more useful than the date itself.
function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) {
    return "—";
  }
  const seconds = Math.round((Date.now() - then) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}
