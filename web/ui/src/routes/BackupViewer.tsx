// BackupViewer is the read-only browser for one stored backup.
//
// It is a page of its own rather than a tab, because opening a backup is a
// separate act from managing the project it came from: the link is shareable,
// a reload lands on the same table, and closing it returns to the Backups tab
// without disturbing whatever was open there. The whole database is browsed
// with the same TableBrowser the live Tables tab uses, handed a read-only
// source, so nothing here can write and no second grid has to be maintained.

import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  api,
  ApiError,
  backupSource,
  formatBytes,
  type Backup,
  type Project,
} from "../lib/api";
import TableBrowser from "../components/TableBrowser";
import { kindLabel } from "../lib/backupKind";

export default function BackupViewer() {
  const { id, backupId } = useParams<{ id: string; backupId: string }>();
  const [backup, setBackup] = useState<Backup | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!id || !backupId) return;
    const projectId = id;
    const wanted = backupId;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setLoadError(null);
      try {
        // The backup names itself and the project names the breadcrumb. They
        // are independent reads, so they go out together rather than in turn.
        const [found, listing] = await Promise.all([
          api.getBackup(projectId, wanted),
          api.projects(),
        ]);
        if (cancelled) return;
        setBackup(found);
        setProject(listing.projects.find((item) => item.id === projectId) ?? null);
      } catch (cause) {
        if (!cancelled) {
          setLoadError(
            cause instanceof ApiError ? cause.message : "Could not open the backup.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [id, backupId]);

  // One stable source for the life of the page. It has to be memoized: the
  // browser's effects key off it, and a fresh object each render would re-run
  // every schema read.
  const source = useMemo(
    () => (id && backupId ? backupSource(id, backupId) : undefined),
    [id, backupId],
  );

  const backToBackups = `/app/projects/${id}/backups`;

  return (
    <div className="page-shell">
      <nav aria-label="Breadcrumb" className="mb-4">
        <ol className="flex flex-wrap items-center gap-1.5 text-[0.82rem] font-medium text-muted">
          <li>
            <Link to="/app" className="rounded transition-colors hover:text-foreground">
              Moogo
            </Link>
          </li>
          <li aria-hidden="true" className="select-none text-faint">
            /
          </li>
          <li>
            <Link to="/app/projects" className="rounded transition-colors hover:text-foreground">
              Projects
            </Link>
          </li>
          <li aria-hidden="true" className="select-none text-faint">
            /
          </li>
          <li>
            <Link to={backToBackups} className="rounded transition-colors hover:text-foreground">
              {project?.name ?? "Backups"}
            </Link>
          </li>
          <li aria-hidden="true" className="select-none text-faint">
            /
          </li>
          <li aria-current="page" className="text-foreground">
            Backup
          </li>
        </ol>
      </nav>

      {loading && <p className="text-muted">Loading backup…</p>}

      {!loading && loadError && (
        <div
          role="alert"
          className="rounded-lg border border-amber/40 bg-amber/10 px-4 py-3 text-sm text-amber"
        >
          {loadError}
        </div>
      )}

      {!loading && !loadError && backup && (
        <>
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">
                Backup from {new Date(backup.created_at).toLocaleString()}
              </h1>
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[0.82rem] text-muted">
                <span className="rounded-full border border-edge-strong px-2 py-0.5 font-medium">
                  {kindLabel(backup.kind)}
                </span>
                <span>{formatBytes(backup.size_bytes)}</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                to={backToBackups}
                className="rounded-lg border border-edge-strong px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:border-hover-edge hover:bg-hover-bg hover:text-foreground"
              >
                Back to backups
              </Link>
              <a
                href={api.backupDownloadUrl(id as string, backupId as string)}
                className="rounded-lg border border-edge-strong px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:border-hover-edge hover:bg-hover-bg hover:text-foreground"
              >
                Download
              </a>
            </div>
          </div>

          <p className="mb-4 rounded-lg border border-edge bg-panel px-4 py-3 text-sm text-muted">
            A read-only view of the database as it was when this backup was taken. Rows can be
            read and paged through; nothing here can be changed.
          </p>

          <TableBrowser projectId={id as string} refreshKey={0} source={source} readOnly />
        </>
      )}
    </div>
  );
}
