import { useState, useEffect, useCallback } from "react";
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
  }, [onClose]);

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

            {secretKey && (
              <div className="mb-6 rounded-lg border border-accent-strong/40 bg-accent-strong/10 p-5">
                <p className="mb-4 text-sm leading-relaxed text-accent">
                  The secret key is shown only once and cannot be retrieved again. If you
                  lose it, rotate it from Settings.
                </p>
                <div className="space-y-3">
                  <EnvRow
                    name="MOOGO_PROJECT_URL"
                    value={`${apiOrigin()}/p/${created?.id ?? ""}`}
                  />
                  <EnvRow name="MOOGO_PROJECT_ID" value={created?.id ?? ""} />
                  <EnvRow name="MOOGO_SECRET_KEY" value={secretKey} highlight />
                </div>
              </div>
            )}

            <button
              onClick={handleDone}
              className="w-full cursor-pointer rounded-lg bg-accent-strong px-4 py-2.5 text-sm font-semibold text-accent-ink transition-colors hover:bg-accent"
            >
              Open the project
            </button>
          </>
        )}
      </div>
    </div>
  );
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