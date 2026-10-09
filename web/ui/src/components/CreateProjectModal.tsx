import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError, type Project } from "../lib/api";
import { apiOrigin } from "../lib/origin";

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (project: Project) => void;
  disabled: boolean;
  maxProjects: number;
  currentCount: number;
}

export default function CreateProjectModal({
  isOpen,
  onClose,
  onCreated,
  disabled,
  maxProjects,
  currentCount,
}: CreateProjectModalProps) {
  const [step, setStep] = useState<"form" | "key">("form");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [secretKey, setSecretKey] = useState<string | null>(null);
  const [created, setCreated] = useState<Project | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const navigate = useNavigate();

  // The three values, derived once so the rows on screen, the clipboard
  // paste and the downloaded file cannot drift apart: whatever leaves the
  // modal is exactly what was read in it. Memoized because the copy and
  // download callbacks hold on to it across renders.
  const envEntries: Array<[string, string]> = useMemo(() => {
    if (!created || !secretKey) return [];
    return [
      ["MOOGO_PROJECT_URL", `${apiOrigin()}/p/${created.id}`],
      ["MOOGO_PROJECT_ID", created.id],
      ["MOOGO_SECRET_KEY", secretKey],
    ];
  }, [created, secretKey]);

  useEffect(() => {
    if (isOpen) {
      setStep("form");
      setName("");
      setError(null);
      setSecretKey(null);
      setCreated(null);
    }
  }, [isOpen]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Give the project a name.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const project = await api.createProject(name.trim());
      onCreated(project);
      setCreated(project);
      setSecretKey(project.secret_key ?? null);
      setStep("key");
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Could not create the project.");
    } finally {
      setBusy(false);
    }
  }, [name, onCreated]);

  const handleDone = useCallback(() => {
    onClose();
    // The button says "open", so it opens: straight to the database view,
    // the same target the project card behind the modal links to.
    if (created) navigate(`/app/projects/${created.id}/database`);
  }, [onClose, created, navigate]);

  const handleCopyAll = useCallback(async () => {
    if (envEntries.length === 0) return;
    const lines = envEntries.map(([key, value]) => `${key}=${value}`).join("\n");
    try {
      await navigator.clipboard.writeText(lines);
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
    } catch {
      // Clipboard unavailable; every value stays selectable on screen.
    }
  }, [envEntries]);

  const handleDownloadJSON = useCallback(() => {
    if (!created || envEntries.length === 0) return;
    // Three short lines, so the blob approach the database backup avoids
    // (it would buffer the whole file with no progress) costs nothing here.
    const body = `${JSON.stringify(Object.fromEntries(envEntries), null, 2)}\n`;
    const url = URL.createObjectURL(new Blob([body], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `moogo-${slugify(created.name)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }, [created, envEntries]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      {/* The form only needs a name field, but the created step has to fit a
          project URL, a UUID, and a full secret key without any of them
          scrolling sideways. The width steps up per screen rather than forcing
          one column to serve both. */}
      <div
        className={`w-full surface-raised p-6 ${
          step === "form" ? "max-w-md" : "max-w-3xl"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {step === "form" ? (
          <>
            <h2 className="mb-1 text-lg font-semibold">Create project</h2>
            <p className="mb-6 text-sm text-muted">
              {currentCount} of {maxProjects} projects used
            </p>
            <form onSubmit={handleSubmit}>
              {disabled && (
                <p className="mb-4 text-sm text-amber">
                  You have reached the free limit ({maxProjects} projects). Delete a project to create another.
                </p>
              )}
              {error && (
                <p className="mb-4 text-sm text-amber" role="alert">
                  {error}
                </p>
              )}
              <label className="flex flex-col gap-2">
                <span className="text-sm text-muted">Project name</span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="my-side-project"
                  disabled={disabled || busy}
                  className="rounded-lg border border-edge-strong bg-panel px-3 py-2.5 text-foreground placeholder:text-faint focus:border-accent-strong focus:outline-none disabled:opacity-50"
                  autoFocus
                />
              </label>
              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 cursor-pointer rounded-lg border border-edge-strong px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:border-hover-edge hover:bg-hover-bg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={disabled || busy || !name.trim()}
                  className="flex-1 cursor-pointer rounded-lg bg-accent-strong px-4 py-2.5 text-sm font-semibold text-accent-ink transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busy ? "Creating…" : "Create project"}
                </button>
              </div>
            </form>
          </>
        ) : (
          <>
            <div className="mb-6 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-accent-strong/15">
                <svg className="h-6 w-6 text-accent" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <h2 className="mb-2 text-lg font-semibold">Project created</h2>
              <p className="text-sm leading-relaxed text-muted">
                Put these three values in your own project's environment, then point your
                app at <code className="font-mono text-foreground">$MOOGO_PROJECT_URL/query</code>.
                The dashboard does not need them &mdash; it reaches your database as the
                owner.
              </p>
            </div>

            {envEntries.length > 0 && (
              <div className="mb-6 rounded-lg border border-accent-strong/40 bg-accent-strong/10 p-5">
                <p className="mb-4 text-sm leading-relaxed text-accent">
                  The secret key is shown only once and cannot be retrieved again. If you
                  lose it, rotate it from Settings.
                </p>
                <div className="space-y-3">
                  {envEntries.map(([key, value]) => (
                    <EnvRow
                      key={key}
                      name={key}
                      value={value}
                      highlight={key === "MOOGO_SECRET_KEY"}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Three ways out of the panel: take the values as one paste,
                keep them as a file, or go and use them. The first two carry
                exactly the three lines shown above, and only the last is
                primary — it is the one that moves the work forward. */}
            <div className="space-y-3">
              {envEntries.length > 0 && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={handleCopyAll}
                    className="cursor-pointer rounded-lg border border-edge-strong px-4 py-2.5 text-sm font-semibold text-muted transition-colors hover:border-hover-edge hover:bg-hover-bg hover:text-foreground"
                    aria-label="Copy all three values to the clipboard"
                  >
                    {copiedAll ? "Copied all" : "Copy all"}
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadJSON}
                    className="cursor-pointer rounded-lg border border-edge-strong px-4 py-2.5 text-sm font-semibold text-muted transition-colors hover:border-hover-edge hover:bg-hover-bg hover:text-foreground"
                    aria-label="Download the three values as a JSON file"
                  >
                    Download JSON
                  </button>
                </div>
              )}
              <button
                type="button"
                onClick={handleDone}
                className="w-full cursor-pointer rounded-lg bg-accent-strong px-4 py-2.5 text-sm font-semibold text-accent-ink transition-colors hover:bg-accent"
              >
                Open the project
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// slugify turns a project name into the filename half of a download name.
// Anything a filesystem treats as punctuation collapses into one dash, and a
// name made entirely of punctuation falls back to a fixed word rather than
// producing "moogo-.json".
function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "project";
}

// EnvRow is one copyable environment variable for the post-create panel.
//
// The name sits above the value rather than beside it. A secret key next to a
// UUID next to a URL all end up on one line otherwise, and whichever is longest
// is the one that scrolls out of sight — which is the wrong value to hide.
function EnvRow({
  name,
  value,
  highlight,
}: {
  name: string;
  value: string;
  highlight?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(`${name}=${value}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable; the value stays selectable on screen.
    }
  }, [name, value]);

  return (
    <div
      className={`flex items-center gap-3 rounded-lg border bg-background px-4 py-3 ${
        highlight ? "border-accent-strong/50" : "border-edge"
      }`}
    >
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold uppercase tracking-wider text-faint">{name}</p>
        <code className="mt-1 block break-all font-mono text-sm text-foreground">{value}</code>
      </div>
      <button
        type="button"
        onClick={handleCopy}
        className="shrink-0 cursor-pointer rounded-md border border-edge-strong px-4 py-2 text-sm text-foreground transition-colors hover:border-hover-edge"
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}