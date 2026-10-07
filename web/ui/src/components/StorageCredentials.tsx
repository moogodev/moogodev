// StorageCredentials manages the credentials that authorize object storage.
//
// It follows the way Cloudflare R2 issues API tokens: a credential is a key pair
// separate from anything else, the secret is shown exactly once, and it can be
// rotated or revoked on its own without disturbing the project's SQL key.
//
// The project secret key cannot appear here at all. It authorizes SQL, and a
// credential scoped to running SELECT has no business being able to overwrite
// every file.

import { useCallback, useEffect, useState } from "react";
import { api, ApiError, type StorageCredential, type StorageCredentialSecret } from "../lib/api";
import ConfirmDialog from "./ConfirmDialog";

interface StorageCredentialsProps {
  projectId: string;
}

export default function StorageCredentials({ projectId }: StorageCredentialsProps) {
  const [credentials, setCredentials] = useState<StorageCredential[]>([]);
  const [limit, setLimit] = useState(5);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The freshly minted secret, shown once and then dropped from state. Keeping
  // it around would mean holding a live credential in a React tree for as long
  // as the tab stays open, for no benefit: the owner has already copied it.
  const [revealed, setRevealed] = useState<StorageCredentialSecret | null>(null);
  const [copied, setCopied] = useState(false);
  // Which shared ConfirmDialog is open and on which credential. Rotating and
  // revoking both go through the modal instead of window.confirm: the native
  // dialog cannot be styled and cannot show which access key id is about to
  // stop working — only that something would be.
  const [confirming, setConfirming] = useState<
    { action: "rotate" | "revoke"; credential: StorageCredential } | null
  >(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.storageCredentials(projectId);
      setCredentials(response.credentials);
      setLimit(response.limit);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Could not load credentials.");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCreate = useCallback(async () => {
    setBusyId("new");
    setError(null);
    try {
      setRevealed(await api.createStorageCredential(projectId, ""));
      await load();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Could not create a credential.");
    } finally {
      setBusyId(null);
    }
  }, [projectId, load]);

  const handleRotate = useCallback((credential: StorageCredential) => {
    setConfirming({ action: "rotate", credential });
  }, []);

  const performRotate = useCallback(
    async (credential: StorageCredential) => {
      setBusyId(credential.id);
      setError(null);
      try {
        setRevealed(await api.rotateStorageCredential(projectId, credential.id));
        await load();
      } catch (cause) {
        setError(cause instanceof ApiError ? cause.message : "Could not rotate the secret.");
      } finally {
        setBusyId(null);
        // Closed on failure as well as success: the error stays visible below,
        // where it outlives the dialog.
        setConfirming(null);
      }
    },
    [projectId, load],
  );

  const handleRevoke = useCallback((credential: StorageCredential) => {
    setConfirming({ action: "revoke", credential });
  }, []);

  const performRevoke = useCallback(
    async (credential: StorageCredential) => {
      setBusyId(credential.id);
      setError(null);
      try {
        await api.revokeStorageCredential(projectId, credential.id);
        await load();
      } catch (cause) {
        setError(cause instanceof ApiError ? cause.message : "Could not revoke the credential.");
      } finally {
        setBusyId(null);
        setConfirming(null);
      }
    },
    [projectId, load],
  );

  const handleCopyRevealed = useCallback(async () => {
    if (!revealed) return;
    const { MOOGO_BUCKET_ENDPOINT, MOOGO_BUCKET_ACCESS_KEY_ID, MOOGO_BUCKET_SECRET_KEY } =
      revealed.env;
    const block = [
      `MOOGO_BUCKET_ENDPOINT=${MOOGO_BUCKET_ENDPOINT}`,
      `MOOGO_BUCKET_ACCESS_KEY_ID=${MOOGO_BUCKET_ACCESS_KEY_ID}`,
      `MOOGO_BUCKET_SECRET_KEY=${MOOGO_BUCKET_SECRET_KEY}`,
    ].join("\n");
    try {
      await navigator.clipboard.writeText(block);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked; the values stay selectable on screen.
    }
  }, [revealed]);

  const activeCount = credentials.filter((credential) => credential.active).length;

  return (
    <div className="space-y-4">
      <p className="text-[0.8rem] font-medium leading-relaxed text-muted">
        A credential authorizes object storage only. Create one per application — a web
        deploy, a mobile build, a backup job — so you can revoke one without touching the
        others or your SQL key. The secret is shown once, at creation and at each rotation.
      </p>

      {/* One-time reveal */}
      {revealed && (
        <div className="rounded-lg border border-accent-strong/40 bg-accent-strong/10 p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-accent">
            New storage credential
          </p>
          <p className="mt-2 text-[0.8rem] font-medium text-muted">
            Put these in your application&apos;s environment now. The secret will not be
            shown again — rotate if you lose it.
          </p>
          <div className="mt-3 space-y-2">
            {Object.entries(revealed.env).map(([name, value]) => (
              <div key={name} className="rounded-lg border border-edge bg-background px-4 py-3">
                <p className="text-xs font-bold uppercase tracking-wider text-muted">
                  {name}
                </p>
                <code className="mt-1 block break-all font-mono text-sm font-medium text-foreground">
                  {value}
                </code>
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={handleCopyRevealed}
              className="cursor-pointer rounded-lg border border-edge-strong px-4 py-2 text-sm font-medium text-foreground transition-colors hover:border-hover-edge"
            >
              {copied ? "Copied" : "Copy all three"}
            </button>
            <button
              type="button"
              onClick={() => setRevealed(null)}
              className="cursor-pointer rounded-lg border border-edge-strong px-4 py-2 text-sm font-semibold text-muted transition-colors hover:border-hover-edge hover:bg-hover-bg hover:text-foreground"
            >
              I have saved it
            </button>
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <p className="text-sm text-muted">Loading credentials…</p>
      ) : credentials.length === 0 ? (
        <p className="rounded-lg border border-dashed border-edge-strong px-4 py-6 text-center text-sm font-medium text-muted">
          No storage credentials yet. Without one, applications cannot reach your bucket.
        </p>
      ) : (
        <ul className="space-y-2">
          {credentials.map((credential) => (
            <li
              key={credential.id}
              className={`flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border px-4 py-2.5 ${
                credential.active ? "border-edge bg-background" : "border-edge bg-panel-raised opacity-60"
              }`}
            >
              <code className="min-w-0 flex-1 truncate font-mono text-sm text-foreground">
                {credential.access_key_id}
              </code>
              <span className="text-xs text-faint">
                secret {credential.secret_key_preview}… ·{" "}
                {credential.revoked_at
                  ? `revoked ${new Date(credential.revoked_at).toLocaleDateString()}`
                  : credential.rotated_at
                    ? `rotated ${new Date(credential.rotated_at).toLocaleDateString()}`
                    : `created ${new Date(credential.created_at).toLocaleDateString()}`}
              </span>

              {credential.active ? (
                <div className="flex shrink-0 gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleRotate(credential)}
                    disabled={busyId === credential.id}
                    title="Issue a new secret. The access key id stays the same."
                    className="cursor-pointer rounded-md border border-edge px-2.5 py-1 text-xs font-semibold text-muted transition-colors hover:border-hover-edge hover:bg-hover-bg hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {busyId === credential.id ? "…" : "Rotate"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRevoke(credential)}
                    disabled={busyId === credential.id}
                    title="Stop working immediately. Your SQL key is unaffected."
                    className="cursor-pointer rounded-md border border-amber/40 px-2.5 py-1 text-xs font-semibold text-amber transition-colors hover:border-amber hover:bg-amber/20 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Revoke
                  </button>
                </div>
              ) : (
                <span className="shrink-0 rounded-md bg-panel-raised px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-muted">
                  revoked
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={handleCreate}
        disabled={busyId !== null || activeCount >= limit}
        className="cursor-pointer rounded-lg border border-edge-strong px-4 py-2 text-sm font-medium text-muted transition-colors hover:border-hover-edge hover:bg-hover-bg hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busyId === "new"
          ? "Creating…"
          : activeCount >= limit
            ? `Limit reached (${activeCount}/${limit}) — revoke one first`
            : "New credential"}
      </button>

      {error && (
        <p role="alert" className="rounded-lg border border-amber/40 bg-amber/10 px-4 py-3 text-sm font-medium text-amber">
          {error}
        </p>
      )}

      <ConfirmDialog
        open={confirming?.action === "rotate"}
        title="Rotate the secret?"
        description="The access key id stays the same, but the current secret stops working immediately."
        detail={confirming?.credential.access_key_id}
        confirmLabel="Rotate secret"
        busy={busyId !== null && busyId === confirming?.credential.id}
        onConfirm={() => {
          if (confirming) void performRotate(confirming.credential);
        }}
        onCancel={() => setConfirming(null)}
      />
      <ConfirmDialog
        open={confirming?.action === "revoke"}
        title="Revoke this credential?"
        description="Anything still using it will lose storage access immediately. Your SQL key is not affected."
        detail={confirming?.credential.access_key_id}
        confirmLabel="Revoke"
        busy={busyId !== null && busyId === confirming?.credential.id}
        onConfirm={() => {
          if (confirming) void performRevoke(confirming.credential);
        }}
        onCancel={() => setConfirming(null)}
      />
    </div>
  );
}
