import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft } from "../components/icons";
import { HomeLink } from "../components/HomeLink";
import { SiteLayout } from "../components/Layout";
import { api, ApiError } from "../lib/api";

type State = "ready" | "downloading" | "done" | "failed";

const buttonClass =
  "inline-flex items-center justify-center rounded-lg bg-accent-strong px-5 py-3 font-semibold text-accent-ink transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50";

// BackupDownload is the page an emailed backup link opens.
//
// The link deliberately points at the site and not at the API. A mail scanner
// follows the links in a message on its own, so a link that downloaded on load
// would be spent before the owner ever saw it. This page loads instead, holds
// the token in memory, and redeems it only when the button is pressed — the
// download is a POST the page makes, which a scanner that merely fetches the
// link never does.
export default function BackupDownload() {
  const [params] = useSearchParams();
  // The token is read once, into state, and then dropped from the address bar:
  // the query string is otherwise kept in browser history and sent as the
  // Referer of any link followed from here.
  const [token] = useState(() => params.get("token") ?? "");

  const [state, setState] = useState<State>("ready");
  const [error, setError] = useState<string | null>(null);
  const [retryable, setRetryable] = useState(false);

  useEffect(() => {
    if (token && window.location.search) {
      window.history.replaceState(null, "", "/backup-download");
    }
  }, [token]);

  async function download() {
    setState("downloading");
    setError(null);
    setRetryable(false);
    try {
      const { blob, filename } = await api.publicBackupDownload(token);
      saveBlob(blob, filename);
      setState("done");
    } catch (cause) {
      setError(reason(cause));
      // A network failure never reached the server, so the token is untouched
      // and a retry can still succeed. Every other failure means the token is
      // spent or unusable.
      setRetryable(cause instanceof ApiError && cause.status === 0);
      setState("failed");
    }
  }

  if (!token) {
    return (
      <Panel title="Link incomplete">
        <p className="mb-6 text-muted">
          This download link is incomplete. Open the backup from the project's
          Backups tab instead.
        </p>
        <Link to="/login" className={buttonClass}>
          Go to sign in
        </Link>
      </Panel>
    );
  }

  if (state === "done") {
    return (
      <Panel title="Download started">
        <p className="mb-6 text-muted">
          The snapshot is on its way to your downloads. This link has now been
          used and will not work again. The backup stays listed in the project's
          Backups tab.
        </p>
        <Link to="/login" className={buttonClass}>
          Go to sign in
        </Link>
      </Panel>
    );
  }

  if (state === "failed") {
    return (
      <Panel title="Download failed">
        {error && (
          <div
            role="alert"
            className="mb-5 rounded-lg border border-amber/40 bg-amber/10 px-4 py-3 text-[0.92rem] text-amber"
          >
            {error}
          </div>
        )}
        {retryable ? (
          <button type="button" onClick={download} className={buttonClass}>
            Try again
          </button>
        ) : (
          <Link to="/login" className={buttonClass}>
            Go to sign in
          </Link>
        )}
      </Panel>
    );
  }

  return (
    <Panel title="Your backup is ready">
      <p className="mb-6 text-muted">
        Press the button to download the database snapshot. The link can be used
        once, so save the file somewhere safe.
      </p>
      <button
        type="button"
        onClick={download}
        disabled={state === "downloading"}
        className={buttonClass}
      >
        {state === "downloading" ? "Preparing…" : "Download backup"}
      </button>
    </Panel>
  );
}

// Panel is the single-column card the page states share, so each state reads as
// the same page with a different body.
function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <SiteLayout>
      <section className="py-16 sm:py-20">
        <div className="mx-auto w-full max-w-[440px] px-6">
          <div className="surface rounded-2xl p-6 text-center sm:p-8">
            <h1 className="mb-2 text-[clamp(1.6rem,3vw,2rem)] font-semibold tracking-tight">
              {title}
            </h1>
            {children}
          </div>
          <p className="mt-6 text-center">
            <HomeLink className="text-[0.9rem] text-faint hover:text-foreground">
              <ArrowLeft className="inline w-4 h-4 align-middle" /> Back to the landing page
            </HomeLink>
          </p>
        </div>
      </section>
    </SiteLayout>
  );
}

// saveBlob hands the bytes to the browser so it owns the disk write and the
// progress UI, the same way an ordinary download link would.
function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Revoke on the next tick: doing it synchronously can cancel the download in
  // some browsers before it has started.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

// reason turns a failed download into a sentence the owner can act on.
function reason(cause: unknown): string {
  if (!(cause instanceof ApiError)) {
    return "The download could not be started. Please try again.";
  }
  if (cause.status === 0) {
    return cause.message;
  }
  switch (cause.code) {
    case "invalid_token":
      return "This download link is no longer valid. It has already been used, or it has expired. Open the backup from the project's Backups tab to download it again.";
    case "backups_disabled":
      return "Backups are not enabled on this server.";
    case "missing_token":
      return "This download link is incomplete.";
    default:
      return "The download could not be started. Please try again.";
  }
}
