// ActivityView is the panel shown on the Activity tab of ProjectDetail.
//
// It lists the requests an application made to the project, newest first, with
// the status and how long each took. It answers two questions: what ran, and
// what it cost. The page is read-only -- there is nothing to do here but look,
// so it carries one control, refresh.

import { useCallback, useEffect, useState } from "react";
import { api, ApiError, type ActivityEntry } from "../lib/api";

export default function ActivityView({ projectId }: { projectId: string }) {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const listing = await api.listActivity(projectId);
      setEntries(listing.activity);
    } catch (cause) {
      setLoadError(cause instanceof ApiError ? cause.message : "Could not load activity.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [projectId]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  const refresh = useCallback(() => {
    setRefreshing(true);
    void load();
  }, [load]);

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-edge bg-panel p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Activity</h2>
            <p className="mt-1 max-w-[62ch] text-sm text-muted">
              Every request your application made to this project, with its method, status
              and how long it took. Kept for seven days.
            </p>
          </div>
          <button
            type="button"
            onClick={refresh}
            disabled={loading || refreshing}
            className="cursor-pointer rounded-lg border border-edge-strong px-4 py-2 text-sm font-medium text-muted transition-colors hover:border-hover-edge hover:bg-hover-bg hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      {loadError ? (
        <div
          role="alert"
          className="rounded-lg border border-amber/40 bg-amber/10 px-4 py-3 text-sm text-amber"
        >
          {loadError}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-edge bg-panel">
        {loading ? (
          <p className="px-6 py-10 text-center text-sm text-muted">Loading activity…</p>
        ) : entries.length === 0 ? (
          <div className="px-6 py-10 text-center">
            <p className="text-sm font-medium text-foreground">No requests recorded yet</p>
            <p className="mx-auto mt-1 max-w-[46ch] text-sm text-muted">
              The log fills in as your application talks to this project. A request made in
              the last seven days will show up here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-edge text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">Method</th>
                  <th scope="col" className="px-4 py-3 font-medium">Path</th>
                  <th scope="col" className="px-4 py-3 font-medium">Status</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Duration</th>
                  <th scope="col" className="px-4 py-3 font-medium">When</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id} className="border-b border-edge last:border-b-0">
                    <td className="px-4 py-3 font-mono text-xs font-medium text-foreground">
                      {entry.method}
                    </td>
                    <td className="max-w-[36ch] truncate px-4 py-3 font-mono text-xs text-muted">
                      {entry.path}
                    </td>
                    <td className={`px-4 py-3 font-mono text-xs font-medium ${statusTone(entry.status)}`}>
                      {entry.status}
                    </td>
                    <td className="px-4 py-3 text-right text-muted">
                      {formatDuration(entry.duration_ms)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted">
                      {new Date(entry.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// statusTone colours the status code the way the rest of the console reads
// state: green for a success, amber for a client error, red for a server error.
// The number carries the meaning on its own; the colour only reinforces it.
function statusTone(status: number): string {
  if (status >= 500) return "text-red";
  if (status >= 400) return "text-amber";
  return "text-accent";
}

// formatDuration renders a millisecond count without inventing precision: a
// sub-millisecond request is "0 ms", not a rounded-up "1 ms".
function formatDuration(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)} s`;
  return `${ms} ms`;
}
