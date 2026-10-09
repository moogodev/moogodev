import { useCallback, useEffect, useState } from "react";
import { Link, useParams, useLocation, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import {
  api,
  ApiError,
  type Project,
} from "../lib/api";
import SQLConsole from "../components/SQLConsole";
import TableBrowser from "../components/TableBrowser";
import SchemaVisualizer from "../components/SchemaVisualizer";
import BucketView from "../components/BucketView";
import BucketSettingsPage from "../components/BucketSettingsPage";
import ProjectSettings from "../components/ProjectSettings";

type Tab = "database" | "bucket" | "settings";
type DatabaseTab = "sql" | "tables" | "visual";

// readDatabaseTab turns the query string into the sub-tab to open. The visual
// canvas is deep-linkable from the sidebar, so "?tab=visual" has to survive a
// reload, and anything unrecognised falls back to the editor rather than a
// blank panel.
function readDatabaseTab(params: URLSearchParams): DatabaseTab {
  const tab = params.get("tab");
  return tab === "visual" ? "visual" : tab === "tables" ? "tables" : "sql";
}

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [databaseTab, setDatabaseTab] = useState<DatabaseTab>(() => readDatabaseTab(searchParams));
  const [refreshKey, setRefreshKey] = useState(0);
  const navigate = useNavigate();

  // The query string stays authoritative for the sub-tab too: a sidebar link
  // to ?tab=visual must land on the canvas even when this component is already
  // mounted on /database with the editor open.
  useEffect(() => {
    setDatabaseTab(readDatabaseTab(searchParams));
  }, [searchParams]);

  const selectDatabaseTab = useCallback(
    (tab: DatabaseTab) => {
      setDatabaseTab(tab);
      // Other query keys — today "?table=" — are carried across the switch:
      // leaving Tables and coming back should restore the open table. The SQL
      // editor keeps its clean URL by dropping only the tab key itself.
      const next = new URLSearchParams(searchParams);
      if (tab === "sql") next.delete("tab");
      else next.set("tab", tab);
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  useEffect(() => {
    if (!id) return;
    const projectId = id;
    let cancelled = false;
    async function load() {
      setLoading(true);
      setLoadError(null);
      try {
        const listing = await api.projects();
        const found = listing.projects.find((item) => item.id === projectId) ?? null;
        if (cancelled) return;
        setProject(found);
      } catch (cause) {
        if (!cancelled) {
          setLoadError(cause instanceof ApiError ? cause.message : "Could not load the project.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [id]);

  const isPaused = project?.status === "paused";

  // The URL is the single source of truth for which tab is open.
  //
  // Deriving this from local state instead leaves two bugs behind: the address
  // bar keeps saying /database after you switch to the bucket, and a link to
  // /bucket opens the database panel because the state never saw the path.
  //
  // The bucket settings page has to be recognised before the settings tab, and it
  // cannot be recognised by the tail of the path: /bucket/settings ends with
  // "/settings", exactly like the project's own settings tab, and matching on
  // that would open the project settings when a link to bucket settings was
  // clicked.
  const isBucketSettings = location.pathname.endsWith("/bucket/settings");
  const activeTab: Tab = isBucketSettings || location.pathname.endsWith("/bucket")
    ? "bucket"
    : location.pathname.endsWith("/settings")
      ? "settings"
      : "database";

  const goToTab = useCallback(
    (tab: Tab) => {
      navigate(`/app/projects/${id}/${tab}`);
    },
    [id, navigate],
  );

  // ProjectSettings calls these after pause/resume/rotate/delete.
  const handleProjectUpdated = useCallback((updated: Project) => {
    setProject(updated);
  }, []);

  const handleProjectDeleted = useCallback(() => {
    navigate("/app");
  }, [navigate]);

  // Redirect root project path to database tab
  if (!loading && project && location.pathname === `/app/projects/${id}`) {
    return <Navigate to={`/app/projects/${id}/database`} replace />;
  }

  return (
    <div className="page-shell">
        {loading && <p className="text-muted">Loading project…</p>}

        {!loading && loadError && (
          <div
            role="alert"
            className="mb-6 rounded-lg border border-amber/40 bg-amber/10 px-4 py-3 text-sm text-amber"
          >
            {loadError}
          </div>
        )}

        {!loading && !loadError && !project && (
          <div className="rounded-xl border border-edge bg-panel px-6 py-10 text-center">
            <p className="text-lg font-semibold text-foreground">Project not found</p>
            <p className="mt-1 text-sm text-muted">
              It may have been deleted, or the link is wrong.
            </p>
            <Link
              to="/app"
              className="mt-5 inline-block cursor-pointer rounded-lg bg-accent-strong px-4 py-2 text-sm font-semibold text-accent-ink transition-colors hover:bg-accent"
            >
              Back to projects
            </Link>
          </div>
        )}

        {!loading && project && (
          <>
            <nav aria-label="Breadcrumb" className="mb-4">
              <ol className="flex flex-wrap items-center gap-1.5 text-[0.82rem] font-medium text-muted">
                <li>
                  <Link
                    to="/app"
                    className="rounded transition-colors hover:text-foreground"
                  >
                    Moogo
                  </Link>
                </li>
                <li aria-hidden="true" className="select-none text-faint">
                  /
                </li>
                <li>
                  <Link
                    to="/app/projects"
                    className="rounded transition-colors hover:text-foreground"
                  >
                    Projects
                  </Link>
                </li>
                <li aria-hidden="true" className="select-none text-faint">
                  /
                </li>
                {/* The current page is not a link. A breadcrumb that links to
                    where you already are invites a pointless reload. */}
                <li aria-current="page" className="max-w-[32ch] truncate text-foreground">
                  {project.name}
                </li>
              </ol>
            </nav>

            {/* Title row. The breadcrumb above already names the project, so this
                row carries only the status, set beside the name as a dot plus the
                word rather than a badge in its own right. */}
            <div className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-2">
              <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
              <StatusDot status={project.status} />
              <button
                type="button"
                onClick={() => goToTab("settings")}
                className="ml-auto cursor-pointer rounded-lg border border-edge-strong px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:border-hover-edge hover:bg-hover-bg hover:text-foreground"
              >
                Settings
              </button>
            </div>

            

            {/* Tabs */}
            <div
              role="tablist"
              aria-label="Project sections"
              className="mb-5 mt-5 flex gap-1 border-b border-edge"
            ><TabButton active={activeTab === "database"} onClick={() => goToTab("database")}>
                Database
              </TabButton>
              <TabButton active={activeTab === "bucket"} onClick={() => goToTab("bucket")}>
                Bucket
              </TabButton>
              <TabButton active={activeTab === "settings"} onClick={() => goToTab("settings")}>
                Settings
              </TabButton>
            </div>

            {activeTab === "settings" ? (
              <div className="rounded-xl border border-edge bg-panel p-6">
                <ProjectSettings
                  project={project}
                  onProjectUpdated={handleProjectUpdated}
                  onProjectDeleted={handleProjectDeleted}
                />
              </div>
            ) : isPaused ? (
              <div className="rounded-xl border border-dashed border-edge-strong px-6 py-12 text-center">
                <p className="text-lg font-semibold text-foreground">This project is paused</p>
                <p className="mx-auto mt-1 max-w-[38em] text-sm text-muted">
                  Queries and bucket operations are refused while it is paused. The data is
                  untouched — resume it to pick up where you left off.
                </p>
                <button
                  type="button"
                  onClick={() => goToTab("settings")}
                  className="mt-5 cursor-pointer rounded-lg bg-accent-strong px-4 py-2 text-sm font-semibold text-accent-ink transition-colors hover:bg-accent"
                >
                  Resume in Settings
                </button>
              </div>
            ) : activeTab === "database" ? (
              <>
                {/* The sub-tab is a control group, so it earns a filled
                    background rather than an outline. An outline here would sit
                    directly on top of the console's own input border and read
                    as one more box in a stack of them. */}
                <div className="mb-5 inline-flex rounded-lg bg-panel-raised p-1">
                  <SubTab active={databaseTab === "sql"} onClick={() => selectDatabaseTab("sql")}>
                    SQL Editor
                  </SubTab>
                  <SubTab active={databaseTab === "tables"} onClick={() => selectDatabaseTab("tables")}>
                    Tables
                  </SubTab>
                  <SubTab active={databaseTab === "visual"} onClick={() => selectDatabaseTab("visual")}>
                    Visual
                  </SubTab>
                </div>

                {databaseTab === "visual" ? (
                  <SchemaVisualizer projectId={project.id} refreshKey={refreshKey} />
                ) : databaseTab === "sql" ? (
                  <SQLConsole
                    projectId={project.id}
                    onExecuted={() => setRefreshKey((current) => current + 1)}
                  />
                ) : (
                  <TableBrowser projectId={project.id} refreshKey={refreshKey} />
                )}
              </>
            ) : isBucketSettings ? (
              // Bucket settings replaces the object browser rather than covering
              // it, so the bucket being edited has to be named somewhere that
              // survives a reload: the query string carries it.
              //
              // It sits below the paused check on purpose. These are bucket
              // operations, and a paused project refuses every one of them, so a
              // form that could only ever fail is not worth showing.
              <BucketSettingsPage projectId={project.id} />
            ) : (
              // No wrapper card here. The bucket view brings its own panels, so
              // a border and a background around them draw a frame inside a
              // frame, and the page ends up looking like a box inside a box.
              <BucketView
                projectId={project.id}
                refreshKey={refreshKey}
                onRefresh={() => setRefreshKey((current) => current + 1)}
              />
            )}
          </>
        )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`-mb-px cursor-pointer border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
        active
          ? "border-accent-strong text-foreground"
          : "border-transparent text-muted hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function SubTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`cursor-pointer rounded-md border px-4 py-1.5 text-sm font-semibold transition-colors ${
        active
          ? "border-accent/45 bg-background text-foreground"
          : "border-transparent text-muted hover:bg-hover-bg hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

// StatusDot renders the project status as a coloured dot beside the name.
//
// The colour is the message and the word repeats it, so the state is legible
// without relying on colour alone: green for ready, red for paused, amber for a
// project that failed to provision.
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
    <span className="inline-flex items-center gap-1.5 text-sm font-medium text-muted">
      <span className={`h-2 w-2 rounded-full ${tone}`} />
      {status}
    </span>
  );
}
