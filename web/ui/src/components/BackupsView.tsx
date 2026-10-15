// BackupsView is the card shown on the Backups tab of ProjectDetail.
//
// It lists the off-site copies of the project's database and lets the owner
// take one now or restore an older one. The two mutating actions are the whole
// point of the tab, so the confirmation for a restore names the exact backup
// and says plainly what will happen to the current data.

import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  api,
  ApiError,
  formatBytes,
  type Backup,
  type BackupsResponse,
} from "../lib/api";
import { kindLabel } from "../lib/backupKind";
import ConfirmDialog from "./ConfirmDialog";

export default function BackupsView({ projectId }: { projectId: string }) {
  const [data, setData] = useState<BackupsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [restoring, setRestoring] = useState<Backup | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [deleting, setDeleting] = useState<Backup | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const listing = await api.listBackups(projectId);
      setData(listing);
    } catch (cause) {
      setLoadError(cause instanceof ApiError ? cause.message : "Could not load backups.");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleBackupNow = useCallback(async () => {
    setIsBackingUp(true);
    setActionError(null);
    setNotice(null);
    try {
      const result = await api.createBackup(projectId);
      setNotice(result.message);
      await load();
    } catch (cause) {
      setActionError(cause instanceof ApiError ? cause.message : "Could not start the backup.");
    } finally {
      setIsBackingUp(false);
    }
  }, [projectId, load]);

  const handleRestore = useCallback(async () => {
    if (!restoring) return;
    setIsRestoring(true);
    setActionError(null);
    setNotice(null);
    try {
      const result = await api.restoreBackup(projectId, restoring.id);
      setNotice(result.message);
      setRestoring(null);
      await load();
    } catch (cause) {
      setActionError(cause instanceof ApiError ? cause.message : "Could not restore the backup.");
    } finally {
      setIsRestoring(false);
    }
  }, [projectId, restoring, load]);

  const handleDelete = useCallback(async () => {
    if (!deleting) return;
    setIsDeleting(true);
    setActionError(null);
    setNotice(null);
    try {
      await api.deleteBackup(projectId, deleting.id);
      setNotice("Backup deleted.");
      setDeleting(null);
      await load();
    } catch (cause) {
      setActionError(cause instanceof ApiError ? cause.message : "Could not delete the backup.");
    } finally {
      setIsDeleting(false);
    }
  }, [projectId, deleting, load]);

  if (loading && !data) {
    return <p className="text-muted">Loading backups…</p>;
  }

  if (loadError && !data) {
    return (
      <div
        role="alert"
        className="rounded-lg border border-amber/40 bg-amber/10 px-4 py-3 text-sm text-amber"
      >
        {loadError}
      </div>
    );
  }

  // The feature is off server-side. There is nothing to list and nothing the
  // owner can do from here, so the panel explains that rather than offering
  // buttons that would answer 503.
  if (data && !data.enabled) {
    return (
      <div className="rounded-xl border border-edge bg-panel p-6">
        <h2 className="text-lg font-semibold text-foreground">Database backups</h2>
        <p className="mt-2 max-w-[52em] text-sm text-muted">
          Off-site backups are not enabled on this server, so there is nothing to show here.
          An operator enables them by setting the <code>MOOGO_BACKUP_*</code> environment
          variables.
        </p>
      </div>
    );
  }

  const backups = data?.backups ?? [];
  const state = data?.state;
  // The newest stored backup, not the scheduler's freshness clock: a tick that
  // finds nothing changed advances the clock without uploading anything, and
  // showing that timestamp as "Last backup" would name a time with no object
  // behind it.
  const newest = backups[0];

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-edge bg-panel p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Database backups</h2>
            <p className="mt-1 max-w-[52em] text-sm text-muted">
              Copies of this project's database, kept off-site. A snapshot is taken about once
              a day when the database has changed, and you can take one whenever you like.
            </p>
          </div>
          <button
            type="button"
            onClick={handleBackupNow}
            disabled={isBackingUp}
            className="cursor-pointer rounded-lg bg-accent-strong px-4 py-2 text-sm font-semibold text-accent-ink transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isBackingUp ? "Backing up…" : "Back up now"}
          </button>
        </div>

        {state ? (
          <dl className="mt-4 grid grid-cols-1 gap-3 border-t border-edge pt-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="text-muted">Last backup</dt>
              <dd className="mt-0.5 font-medium text-foreground">
                {newest ? new Date(newest.created_at).toLocaleString() : "Never"}
              </dd>
            </div>
            <div>
              <dt className="text-muted">Last size</dt>
              <dd className="mt-0.5 font-medium text-foreground">
                {newest ? formatBytes(newest.size_bytes) : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-muted">Status</dt>
              <dd className="mt-0.5 font-medium text-foreground">
                {state.consecutive_failures > 0
                  ? `${state.consecutive_failures} failed attempt${state.consecutive_failures === 1 ? "" : "s"}`
                  : newest
                    ? "Healthy"
                    : "No backups yet"}
              </dd>
            </div>
            <div>
              <dt className="text-muted">Last verified</dt>
              <dd className="mt-0.5 font-medium text-foreground">
                {state.last_verified_at
                  ? new Date(state.last_verified_at).toLocaleString()
                  : "Not yet checked"}
              </dd>
            </div>
          </dl>
        ) : null}

        {state && state.consecutive_failures > 0 && state.last_error ? (
          <p className="mt-4 rounded-lg border border-amber/40 bg-amber/10 px-3 py-2 text-sm text-amber">
            The most recent backup did not finish: {state.last_error}
          </p>
        ) : null}

        {state && state.last_verify_error ? (
          <p className="mt-4 rounded-lg border border-amber/40 bg-amber/10 px-3 py-2 text-sm text-amber">
            The last integrity check of your newest backup failed: {state.last_verify_error}
          </p>
        ) : null}
      </div>

      {notice ? (
        <div
          role="status"
          className="rounded-lg border border-accent/40 bg-accent/10 px-4 py-3 text-sm text-foreground"
        >
          {notice}
        </div>
      ) : null}

      {actionError ? (
        <div
          role="alert"
          className="rounded-lg border border-amber/40 bg-amber/10 px-4 py-3 text-sm text-amber"
        >
          {actionError}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-edge bg-panel">
        {backups.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-muted">
            No backups yet. One will be taken automatically, or you can take one now.
          </p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-edge text-xs uppercase tracking-wide text-muted">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">Reason</th>
                <th scope="col" className="px-4 py-3 font-medium">Taken</th>
                <th scope="col" className="px-4 py-3 font-medium">Size</th>
                <th scope="col" className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {backups.map((backup) => (
                <tr key={backup.id} className="border-b border-edge last:border-b-0">
                  <td className="px-4 py-3 font-medium text-foreground">
                    {kindLabel(backup.kind)}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {new Date(backup.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-muted">{formatBytes(backup.size_bytes)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setNotice(null);
                          setActionError(null);
                          setRestoring(backup);
                        }}
                        className="cursor-pointer rounded-lg border border-edge-strong px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:border-hover-edge hover:bg-hover-bg hover:text-foreground"
                      >
                        Restore
                      </button>
                      <a
                        href={api.backupDownloadUrl(projectId, backup.id)}
                        className="rounded-lg border border-edge-strong px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:border-hover-edge hover:bg-hover-bg hover:text-foreground"
                      >
                        Download
                      </a>
                      <button
                        type="button"
                        onClick={() => {
                          setNotice(null);
                          setActionError(null);
                          setDeleting(backup);
                        }}
                        className="cursor-pointer rounded-lg border border-edge-strong px-3 py-1.5 text-sm font-medium text-amber transition-colors hover:border-amber/40 hover:bg-amber/20"
                      >
                        Delete
                      </button>
                      <Link
                        to={`/app/projects/${projectId}/backups/${backup.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-lg border border-edge-strong px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:border-hover-edge hover:bg-hover-bg hover:text-foreground"
                      >
                        Open
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <ConfirmDialog
        open={restoring !== null}
        title="Restore this backup?"
        tone="danger"
        confirmLabel="Restore"
        busy={isRestoring}
        onConfirm={() => void handleRestore()}
        onCancel={() => {
          if (!isRestoring) setRestoring(null);
        }}
        description={
          <>
            The project's database will be replaced with this backup from{" "}
            {restoring ? new Date(restoring.created_at).toLocaleString() : ""}. The current
            database is saved as a backup first, so this can be undone by restoring that
            copy.
          </>
        }
      />

      <ConfirmDialog
        open={deleting !== null}
        title="Delete this backup?"
        tone="danger"
        confirmLabel="Delete"
        busy={isDeleting}
        onConfirm={() => void handleDelete()}
        onCancel={() => {
          if (!isDeleting) setDeleting(null);
        }}
        description={
          <>
            The backup from {deleting ? new Date(deleting.created_at).toLocaleString() : ""} will
            be removed permanently. This cannot be undone.
            {deleting && deleting.kind !== "pre_restore"
              ? " If it is the most recent backup, the copy used for a one-click restore is removed with it; the next backup recreates it."
              : ""}
          </>
        }
      />
    </div>
  );
}
