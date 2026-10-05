import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  api,
  ApiError,
  encodeKey,
  fileBadge,
  formatBytes,
  type Bucket,
  type BucketObject,
  type ObjectQuery,
} from "../lib/api";
import { acceptFor, describePolicy, policyAllows } from "../lib/media";
import { describeSize } from "../lib/sizes";
import ObjectPreview from "./ObjectPreview";

interface BucketViewProps {
  projectId: string;
  refreshKey: number;
  onRefresh: () => void;
}

const PAGE_SIZE = 100;

// Sortable columns. "key" is the default because an object browser is read by
// name far more often than by size.
const COLUMNS: { id: NonNullable<ObjectQuery["order"]>; label: string }[] = [
  { id: "key", label: "Name" },
  { id: "size", label: "Size" },
  { id: "created", label: "Uploaded" },
  { id: "updated", label: "Modified" },
];

interface Listing {
  objects: BucketObject[];
  total: number;
  used: number;
  quota: number;
}

const EMPTY: Listing = { objects: [], total: 0, used: 0, quota: 0 };

function messageOf(cause: unknown): string {
  return cause instanceof ApiError ? cause.message : "Something went wrong.";
}

// rejectionReason explains why a file cannot go into this bucket, or null when it
// can. It is a convenience for the user, not the enforcement point.
//
// A file whose type the browser could not determine arrives as "", which the
// classifier sorts into "file" like any other unknown type. That is allowed only
// when the bucket takes files or anything: refusing every undetermined upload
// would block clients that send no Content-Type at all, and the server has the
// real header anyway.
function rejectionReason(file: File, bucket: Bucket): string | null {
  if (!policyAllows(bucket.allowed_types, file.type)) {
    return `“${file.name}” is not one of the ${describePolicy(bucket.allowed_types)} this bucket accepts.`;
  }
  const cap = bucket.max_object_size_bytes;
  if (cap > 0 && file.size > cap) {
    return `“${file.name}” is ${formatBytes(file.size)}, over this bucket’s ${describeSize(cap)} limit.`;
  }
  // The bucket's own quota is checked here too. The server refuses the upload
  // either way, but the user gets the name of the file that will not fit rather
  // than a number of bytes on a status code.
  const free = bucket.quota_bytes - bucket.size_bytes;
  if (free > 0 && file.size > free) {
    return `“${file.name}” is ${formatBytes(file.size)}, and this bucket has only ${formatBytes(free)} left.`;
  }
  return null;
}

// BucketView is the object browser: a bucket list on the left, one bucket's
// objects on the right.
//
// The split is the whole reason the two are separate. Before this, every bucket's
// objects came back in one flat list, so a project with a large default bucket
// made every other bucket impossible to look at.
export default function BucketView({
  projectId,
  refreshKey,
  onRefresh,
}: BucketViewProps) {
  const [buckets, setBuckets] = useState<Bucket[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [order, setOrder] = useState<NonNullable<ObjectQuery["order"]>>("key");
  const [dir, setDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(0);
  const [listing, setListing] = useState<Listing>(EMPTY);
  const [listingError, setListingError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [preview, setPreview] = useState<BucketObject | null>(null);
  const [newBucket, setNewBucket] = useState("");
  const [dragging, setDragging] = useState(false);

  const fileInput = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);

  // --- bucket list ---

  const loadBuckets = useCallback(async () => {
    try {
      const response = await api.dashboardBuckets(projectId);
      setBuckets(response.buckets);
      setSelected((current) => {
        // Keep the current selection when it still exists, so a reload does not
        // throw the user back to the first bucket.
        if (current && response.buckets.some((bucket) => bucket.name === current)) {
          return current;
        }
        return response.buckets[0]?.name ?? null;
      });
      setListingError(null);
    } catch (cause) {
      setBuckets([]);
      setListingError(messageOf(cause));
    }
  }, [projectId]);

  useEffect(() => {
    void loadBuckets();
  }, [loadBuckets, refreshKey]);

  const selectedBucket = useMemo(
    () => buckets?.find((bucket) => bucket.name === selected) ?? null,
    [buckets, selected],
  );

  // --- object listing ---

  const query = useMemo<ObjectQuery>(
    () => ({
      bucket: selected ?? undefined,
      search: search.trim() || undefined,
      order,
      dir,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    }),
    [selected, search, order, dir, page],
  );

  const loadObjects = useCallback(async () => {
    if (!selected) {
      setListing(EMPTY);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const response = await api.dashboardBucketList(projectId, query);
      setListing({
        objects: response.objects,
        total: response.total,
        used: response.storage_used_bytes,
        quota: response.quota_bytes,
      });
      setListingError(null);
    } catch (cause) {
      setListing({ ...EMPTY });
      setListingError(messageOf(cause));
    } finally {
      setLoading(false);
    }
  }, [projectId, query, selected]);

  useEffect(() => {
    void loadObjects();
  }, [loadObjects]);

  // Any filter change invalidates the current page number, or a search from page
  // three would land on an empty page and look like the search found nothing.
  useEffect(() => {
    setPage(0);
  }, [selected, search, order, dir]);

  // --- actions ---

  const announce = useCallback((text: string) => {
    setNotice(text);
    window.setTimeout(() => setNotice(null), 2500);
  }, []);

  const refreshAll = useCallback(async () => {
    await Promise.all([loadBuckets(), loadObjects()]);
    onRefresh();
  }, [loadBuckets, loadObjects, onRefresh]);

  const upload = useCallback(
    async (files: File[], bucket: Bucket) => {
      // The server enforces the policy, but the server can only answer with a
      // status code. A rejected file is named here before it is sent, so a user
      // dropping twelve images into an images-only bucket is told which one is
      // the problem instead of watching eleven succeed and one fail.
      const rejected = files.filter((file) => rejectionReason(file, bucket));
      const accepted = files.filter((file) => !rejectionReason(file, bucket));
      if (accepted.length === 0) {
        announce(rejectionReason(files[0], bucket) ?? "That file cannot be uploaded here.");
        return;
      }
      if (rejected.length > 0) {
        announce(
          `Skipped ${rejected.length} ${rejected.length === 1 ? "file" : "files"}: ${rejectionReason(rejected[0], bucket)}`,
        );
      }

      setBusy("upload");
      let failed = 0;
      let reason = "";
      for (const file of accepted) {
        try {
          await api.dashboardBucketUpload(
            projectId,
            file.name,
            file,
            file.type || "application/octet-stream",
            bucket.name,
          );
        } catch (cause) {
          failed += 1;
          reason = messageOf(cause);
        }
      }
      setBusy(null);
      if (failed > 0) {
        // A server-side refusal wins over the earlier note: it is the answer to
        // the question the user actually asked.
        announce(failed === accepted.length ? reason : `Uploaded ${accepted.length - failed}, ${failed} failed. ${reason}`);
      } else if (rejected.length === 0) {
        announce(
          `Uploaded ${accepted.length} ${accepted.length === 1 ? "file" : "files"}.`,
        );
      }
      await refreshAll();
    },
    [announce, projectId, refreshAll],
  );

  const togglePublic = useCallback(
    async (object: BucketObject) => {
      setBusy(object.id);
      try {
        const response = await api.dashboardSetObjectPublic(
          projectId,
          object.key,
          !object.is_public,
        );
        // The preview drawer holds the old row, so it is updated from the
        // response rather than left showing a public URL that 404s.
        setPreview((current) => (current && current.id === object.id ? response.object : current));
        setListing((current) => ({
          ...current,
          objects: current.objects.map((row) =>
            row.id === object.id ? response.object : row,
          ),
        }));
        announce(response.object.is_public ? "Published." : "Made private.");
        await loadBuckets();
      } catch (cause) {
        announce(messageOf(cause));
      } finally {
        setBusy(null);
      }
    },
    [announce, loadBuckets, projectId],
  );

  const rename = useCallback(
    async (object: BucketObject) => {
      const next = window.prompt("New key", object.key);
      if (next === null || next.trim() === "" || next === object.key) {
        return;
      }
      setBusy(object.id);
      try {
        await api.dashboardRenameObject(projectId, object.key, next.trim());
        announce(`Renamed to ${next.trim()}.`);
        await refreshAll();
      } catch (cause) {
        announce(messageOf(cause));
      } finally {
        setBusy(null);
      }
    },
    [announce, projectId, refreshAll],
  );

  const remove = useCallback(
    async (object: BucketObject) => {
      if (!window.confirm(`Delete "${object.key}"? This cannot be undone.`)) {
        return;
      }
      setBusy(object.id);
      try {
        await api.dashboardBucketDelete(projectId, object.key);
        announce(`Deleted ${object.key}.`);
        await refreshAll();
      } catch (cause) {
        announce(messageOf(cause));
      } finally {
        setBusy(null);
      }
    },
    [announce, projectId, refreshAll],
  );

  const createBucket = useCallback(
    async (name: string) => {
      setBusy("bucket");
      try {
        const response = await api.dashboardCreateBucket(projectId, name);
        setNewBucket("");
        await loadBuckets();
        setSelected(response.bucket.name);
        announce(`Created bucket "${response.bucket.name}".`);
      } catch (cause) {
        announce(messageOf(cause));
      } finally {
        setBusy(null);
      }
    },
    [announce, loadBuckets, projectId],
  );

  const deleteBucket = useCallback(
    async (bucket: Bucket) => {
      const suffix =
        bucket.object_count === 1 ? "1 object" : `${bucket.object_count} objects`;
      const warning =
        bucket.object_count > 0
          ? `Delete "${bucket.name}" and its ${suffix}? This cannot be undone.`
          : `Delete the empty bucket "${bucket.name}"?`;
      if (!window.confirm(warning)) {
        return;
      }
      setBusy("bucket");
      try {
        await api.dashboardDeleteBucket(projectId, bucket.id);
        await loadBuckets();
        announce(`Deleted bucket "${bucket.name}".`);
      } catch (cause) {
        announce(messageOf(cause));
      } finally {
        setBusy(null);
      }
    },
    [announce, loadBuckets, projectId],
  );

  const copy = useCallback(
    async (label: string, value: string) => {
      try {
        await navigator.clipboard.writeText(value);
        announce(`${label} copied.`);
      } catch {
        // Clipboard access needs a secure context, and the dashboard is
        // reachable over plain HTTP in local development. Falling back to a
        // selectable prompt beats silently doing nothing.
        window.prompt("Copy this:", value);
      }
    },
    [announce],
  );

  // --- drag and drop ---

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      dragDepth.current = 0;
      setDragging(false);
      const files = Array.from(event.dataTransfer.files);
      if (files.length > 0 && selectedBucket) {
        void upload(files, selectedBucket);
      }
    },
    [selectedBucket, upload],
  );

  const pages = Math.max(1, Math.ceil(listing.total / PAGE_SIZE));

  return (
    <div
      className="grid grid-cols-1 gap-4 lg:grid-cols-[15rem_1fr]"
      onDragEnter={(event) => {
        event.preventDefault();
        dragDepth.current += 1;
        setDragging(true);
      }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={() => {
        // dragleave fires for every child the pointer crosses, so a counter is
        // what keeps the highlight from flickering on the way in.
        dragDepth.current -= 1;
        if (dragDepth.current <= 0) {
          dragDepth.current = 0;
          setDragging(false);
        }
      }}
      onDrop={onDrop}
    >
      <BucketSidebar
        buckets={buckets}
        selected={selected}
        busy={busy === "bucket"}
        onSelect={setSelected}
        onCreate={createBucket}
        onDelete={deleteBucket}
        newBucket={newBucket}
        setNewBucket={setNewBucket}
      />

      <div className="min-w-0">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              disabled={!selected || busy === "upload"}
              className="cursor-pointer rounded-lg border border-edge-strong px-4 py-2 text-sm font-medium text-foreground transition-colors hover:border-faint hover:bg-panel disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy === "upload" ? "Uploading…" : "Upload files"}
            </button>
            <input
              ref={fileInput}
              type="file"
              multiple
              // The picker filters to what the bucket accepts, so a user who set
              // "images only" cannot pick a video to begin with.
              accept={selectedBucket ? acceptFor(selectedBucket.allowed_types) : undefined}
              className="sr-only"
              onChange={(event) => {
                const files = Array.from(event.target.files ?? []);
                if (files.length > 0 && selectedBucket) {
                  void upload(files, selectedBucket);
                }
                event.target.value = "";
              }}
            />
            {/* A link, not a button that opens a dialog. Bucket settings is a
                page with its own URL, which means it can be linked to, reloaded,
                and reached with the back button like everything else here. */}
            <Link
              to={`/app/projects/${projectId}/bucket/settings${selectedBucket ? `?bucket=${encodeURIComponent(selectedBucket.name)}` : ""}`}
              aria-disabled={!selectedBucket}
              className={`rounded-lg border border-edge-strong px-4 py-2 text-sm text-muted transition-colors hover:border-faint hover:bg-panel ${
                selectedBucket
                  ? "cursor-pointer"
                  : "pointer-events-none opacity-50"
              }`}
            >
              Bucket settings
            </Link>
            <button
              type="button"
              onClick={() => void refreshAll()}
              className="cursor-pointer rounded-lg border border-edge-strong px-4 py-2 text-sm text-muted transition-colors hover:border-faint hover:bg-panel"
            >
              Refresh
            </button>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name"
              aria-label="Search objects"
              className="w-44 rounded-lg border border-edge-strong bg-panel px-3 py-2 text-sm text-foreground placeholder:text-faint focus:border-accent-strong"
            />
            <select
              value={`${order}:${dir}`}
              onChange={(event) => {
                const [nextOrder, nextDir] = event.target.value.split(":");
                setOrder(nextOrder as NonNullable<ObjectQuery["order"]>);
                setDir(nextDir as "asc" | "desc");
              }}
              aria-label="Sort objects"
              className="cursor-pointer rounded-lg border border-edge-strong bg-panel px-2.5 py-2 text-sm text-foreground"
            >
              {COLUMNS.map((column) => (
                <option key={column.id} value={`${column.id}:asc`}>
                  {column.label} ↑
                </option>
              ))}
              {COLUMNS.map((column) => (
                <option key={`${column.id}-desc`} value={`${column.id}:desc`}>
                  {column.label} ↓
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Two numbers, because they answer two different questions. The bucket's
            own quota is what runs out first and is what a user uploading here is
            about to hit; the project's total is why the remaining room can be
            smaller than the bucket's, and is the number that explains an upload
            refused with a bucket-specific message. */}
            {selectedBucket && (
              <p className="mt-1.5 text-xs text-faint">
                Accepts {describePolicy(selectedBucket.allowed_types)}
                {selectedBucket.max_object_size_bytes > 0 && (
                  <> · up to {describeSize(selectedBucket.max_object_size_bytes)} per file</>
                )}
                {selectedBucket.is_public && <> · new uploads are public</>}
              </p>
            )}

        {notice && (
          <p
            role="status"
            className="mb-4 rounded-lg border border-edge bg-panel px-3 py-2 text-sm text-foreground"
          >
            {notice}
          </p>
        )}

        {dragging && (
          <div className="mb-4 rounded-xl border-2 border-dashed border-accent-strong bg-panel px-4 py-8 text-center text-sm font-medium text-accent-strong">
            Drop the files to upload them to “{selected}”
          </div>
        )}

        {listingError && (
          <p
            role="alert"
            className="rounded-lg border border-amber/40 bg-amber/10 px-4 py-3 text-sm text-amber"
          >
            {listingError}
          </p>
        )}

        {!listingError && loading && (
          <div className="rounded-lg border border-edge bg-panel p-8 text-center text-muted">
            Loading…
          </div>
        )}

        {!listingError && !loading && listing.objects.length === 0 && (
          <div className="rounded-xl border border-dashed border-edge px-6 py-12 text-center">
            <svg
              className="mx-auto mb-4 h-12 w-12 text-muted"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M2 6a2 2 0 012-2h12a2 2 0 012 2v8a2 2 0 01-2 2h-2.5l-1 1h-5l-1-1H4a2 2 0 01-2-2V6z" />
              <path d="M6 10a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1z" />
            </svg>
            <p className="text-lg font-semibold">
              {search ? "Nothing matches that search" : "No objects yet"}
            </p>
            <p className="mt-1 text-muted">
              {search
                ? "Try a shorter search, or clear it to see everything."
                : "Drag files here, or use Upload files."}
            </p>
          </div>
        )}

        {!listingError && listing.objects.length > 0 && (
          <ObjectTable
            objects={listing.objects}
            busy={busy}
            onPreview={setPreview}
            onTogglePublic={togglePublic}
            onRename={rename}
            onDelete={remove}
            onCopy={copy}
          />
        )}

        {listing.total > PAGE_SIZE && (
          <div className="mt-4 flex items-center justify-between text-sm text-muted">
            <span>
              {(page * PAGE_SIZE + 1).toLocaleString()}–
              {Math.min((page + 1) * PAGE_SIZE, listing.total).toLocaleString()} of{" "}
              {listing.total.toLocaleString()}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(0, current - 1))}
                disabled={page === 0}
                className="cursor-pointer rounded-md border border-edge px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Previous
              </button>
              <span>
                {page + 1} / {pages}
              </span>
              <button
                type="button"
                onClick={() => setPage((current) => current + 1)}
                disabled={page + 1 >= pages}
                className="cursor-pointer rounded-md border border-edge px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {preview && (
        <ObjectPreview
          object={preview}
          onClose={() => setPreview(null)}
          onOpenPublic={() => preview.public_url && window.open(preview.public_url, "_blank")}
        />
      )}
    </div>
  );
}

function BucketSidebar({
  buckets,
  selected,
  busy,
  onSelect,
  onCreate,
  onDelete,
  newBucket,
  setNewBucket,
}: {
  buckets: Bucket[] | null;
  selected: string | null;
  busy: boolean;
  onSelect: (name: string) => void;
  onCreate: (name: string) => void;
  onDelete: (bucket: Bucket) => void;
  newBucket: string;
  setNewBucket: (value: string) => void;
}) {
  return (
    <aside className="rounded-xl border border-edge bg-panel p-3">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-faint">Buckets</h3>
        <span className="text-xs text-faint">{buckets?.length ?? 0}</span>
      </div>

      {buckets === null && <p className="px-2 py-3 text-sm text-muted">Loading…</p>}

      {buckets !== null && buckets.length === 0 && (
        <p className="px-2 py-3 text-sm text-muted">No buckets yet.</p>
      )}

      <ul className="space-y-0.5">
        {buckets?.map((bucket) => (
          <li key={bucket.id}>
            <div
              className={`group flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 transition-colors ${
                bucket.name === selected
                  ? "bg-panel-raised text-foreground"
                  : "text-muted hover:bg-panel-raised"
              }`}
            >
              <button
                type="button"
                onClick={() => onSelect(bucket.name)}
                className="min-w-0 flex-1 cursor-pointer text-left"
              >
                <span className="block truncate text-sm font-medium">{bucket.name}</span>
                <span className="block text-xs text-faint">
                  {bucket.object_count} {bucket.object_count === 1 ? "object" : "objects"}
                  {" · "}
                  {formatBytes(bucket.size_bytes)}
                </span>
              </button>
              <button
                type="button"
                onClick={() => onDelete(bucket)}
                aria-label={`Delete bucket ${bucket.name}`}
                disabled={busy}
                className="shrink-0 cursor-pointer rounded px-1.5 py-1 text-xs text-faint opacity-0 transition-opacity hover:text-amber focus-visible:opacity-100 disabled:opacity-40 group-hover:opacity-100"
              >
                ✕
              </button>
            </div>
          </li>
        ))}
      </ul>

      <form
        className="mt-3 border-t border-edge pt-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (newBucket.trim()) {
            onCreate(newBucket.trim());
          }
        }}
      >
        <input
          value={newBucket}
          onChange={(event) => setNewBucket(event.target.value)}
          placeholder="New bucket name"
          aria-label="New bucket name"
          className="w-full rounded-md border border-edge-strong bg-panel-raised px-2.5 py-1.5 text-sm text-foreground placeholder:text-faint focus:border-accent-strong"
        />
        <button
          type="submit"
          disabled={busy || newBucket.trim() === ""}
          className="mt-2 w-full cursor-pointer rounded-md border border-edge-strong px-2.5 py-1.5 text-sm text-foreground transition-colors hover:bg-panel-raised disabled:cursor-not-allowed disabled:opacity-50"
        >
          Create bucket
        </button>
      </form>
    </aside>
  );
}

function ObjectTable({
  objects,
  busy,
  onPreview,
  onTogglePublic,
  onRename,
  onDelete,
  onCopy,
}: {
  objects: BucketObject[];
  busy: string | null;
  onPreview: (object: BucketObject) => void;
  onTogglePublic: (object: BucketObject) => void;
  onRename: (object: BucketObject) => void;
  onDelete: (object: BucketObject) => void;
  onCopy: (label: string, value: string) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-edge">
      <table className="w-full border-collapse text-left text-sm">
        <thead className="bg-panel-raised">
          <tr>
            <th className="whitespace-nowrap border-b border-edge px-4 py-3 font-semibold text-foreground">
              Name
            </th>
            <th className="whitespace-nowrap border-b border-edge px-4 py-3 font-semibold text-foreground">
              Size
            </th>
            <th className="whitespace-nowrap border-b border-edge px-4 py-3 font-semibold text-foreground">
              Visibility
            </th>
            <th className="whitespace-nowrap border-b border-edge px-4 py-3 font-semibold text-foreground">
              Uploaded
            </th>
            <th className="whitespace-nowrap border-b border-edge px-4 py-3 font-semibold text-foreground">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {objects.map((object) => (
            <tr
              key={object.id}
              className="odd:bg-panel even:bg-panel/40 border-b border-edge/60"
            >
              <td className="px-4 py-3">
                <button
                  type="button"
                  onClick={() => onPreview(object)}
                  className="flex cursor-pointer items-center gap-2.5 text-left"
                >
                  <span className="shrink-0 rounded border border-edge bg-panel-raised px-1.5 py-0.5 font-mono text-[0.65rem] text-muted">
                    {fileBadge(object)}
                  </span>
                  <span className="truncate font-mono text-foreground">
                    {object.key}
                  </span>
                </button>
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-muted">
                {formatBytes(object.size_bytes)}
              </td>
              <td className="whitespace-nowrap px-4 py-3">
                <button
                  type="button"
                  onClick={() => onTogglePublic(object)}
                  disabled={busy === object.id}
                  title={
                    object.is_public
                      ? "Reachable without a credential"
                      : "Only reachable with a credential"
                  }
                  className={`cursor-pointer rounded-full border px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${
                    object.is_public
                      ? "border-accent/40 bg-accent/10 text-accent-strong hover:bg-accent/20"
                      : "border-edge text-muted hover:bg-panel-raised"
                  }`}
                >
                  {object.is_public ? "Public" : "Private"}
                </button>
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-muted">
                {new Date(object.created_at).toLocaleDateString()}
              </td>
              <td className="whitespace-nowrap px-4 py-3">
                <div className="flex items-center gap-1">
                  {object.is_public && (
                    <RowAction
                      label="Copy URL"
                      onClick={() => onCopy("Public URL", object.public_url)}
                    />
                  )}
                  <RowAction label="Copy key" onClick={() => onCopy("Key", encodeKey(object.key))} />
                  <RowAction
                    label="Rename"
                    onClick={() => onRename(object)}
                    disabled={busy === object.id}
                  />
                  <RowAction
                    label="Delete"
                    onClick={() => onDelete(object)}
                    disabled={busy === object.id}
                    tone="warn"
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RowAction({
  label,
  onClick,
  disabled,
  tone,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: "warn";
}) {
  const idle = tone === "warn" ? "text-amber" : "text-muted";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`cursor-pointer rounded-md px-2 py-1.5 text-xs transition-colors hover:bg-panel-raised disabled:cursor-not-allowed disabled:opacity-50 ${idle} hover:text-foreground`}
    >
      {label}
    </button>
  );
}