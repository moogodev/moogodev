// ProjectSettings is the card shown on the Settings tab of ProjectDetail.
//
// There is deliberately no key input here. The project key is a credential for
// the developer's own application, not for this dashboard: it goes into that
// application's environment and is never pasted back into Moogo. Everything on
// this page is either read-only reference or a project-level action, and the
// dashboard itself authenticates with the session cookie.

import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { api, type Project } from "../lib/api";
import { rawDoc } from "../lib/docs";
import { apiOrigin } from "../lib/origin";
import ConfirmDialog from "./ConfirmDialog";
import StorageCredentials from "./StorageCredentials";

interface ProjectSettingsProps {
  project: Project;
  onProjectUpdated: (project: Project) => void;
  onProjectDeleted: () => void;
}

export default function ProjectSettings({
  project,
  onProjectUpdated,
  onProjectDeleted,
}: ProjectSettingsProps) {
  const [promptCopied, setPromptCopied] = useState(false);
  const [isPausing, setIsPausing] = useState(false);
  const [isResuming, setIsResuming] = useState(false);
  const [isRotating, setIsRotating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  // A rotated key is shown exactly once, here, and then gone. It is never
  // stored: the dashboard has no use for it, and a secret kept in localStorage
  // outlives the browser session that justified it.
  const [rotatedKey, setRotatedKey] = useState<string | null>(null);
  const [rotatedCopied, setRotatedCopied] = useState(false);
  // Which shared ConfirmDialog is open, if any. The destructive actions ask
  // through the modal rather than window.confirm: the native dialog cannot be
  // styled, reads as a different application, and cannot show which project is
  // about to be deleted — only that something would be.
  const [confirming, setConfirming] = useState<"rotate-key" | "delete" | null>(null);

  const baseUrl = apiOrigin();
  // The URL the user's own application talks to. It carries the project id so a
  // client appends "/query" or "/bucket/<key>" directly, instead of assembling
  // Moogo's internal route layout and having to keep it in sync.
  const projectUrl = `${baseUrl}/p/${project.id}`;
  const isPaused = project.status === "paused";

  const envVars = [
    { name: "MOOGO_PROJECT_URL", value: projectUrl },
    { name: "MOOGO_PROJECT_ID", value: project.id },
    { name: "MOOGO_BUCKET_ENDPOINT", value: `${projectUrl}/bucket` },
  ];

  // The docs page is the reference, so the button hands over its raw
  // Markdown out of the same bundle the page renders from: prompt and
  // page cannot drift, and the assistant reads the project values from
  // the environment rows above rather than from a pasted key.
  const generatePrompt = useCallback((): string => {
    return rawDoc("ai-adoption-prompt") ?? "";
  }, []);

  const handleUsePrompt = useCallback(async () => {
    const prompt = generatePrompt();
    if (!prompt) {
      alert("The AI adoption prompt could not be loaded. Open /docs/ai-adoption-prompt instead.");
      return;
    }
    try {
      await navigator.clipboard.writeText(prompt);
      setPromptCopied(true);
      setTimeout(() => setPromptCopied(false), 3000);
    } catch {
      alert("Could not copy to clipboard. Copy the prompt manually:\n\n" + prompt);
    }
  }, [generatePrompt]);

  const handleCopyRotated = useCallback(async () => {
    if (!rotatedKey) return;
    try {
      await navigator.clipboard.writeText(rotatedKey);
      setRotatedCopied(true);
      setTimeout(() => setRotatedCopied(false), 2000);
    } catch {
      // Clipboard blocked; the value stays selectable on screen.
    }
  }, [rotatedKey]);

  const handlePause = useCallback(async () => {
    setIsPausing(true);
    setActionError(null);
    try {
      await api.pauseProject(project.id);
      onProjectUpdated({ ...project, status: "paused" });
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "Could not pause project.");
    } finally {
      setIsPausing(false);
    }
  }, [project, onProjectUpdated]);

  const handleResume = useCallback(async () => {
    setIsResuming(true);
    setActionError(null);
    try {
      const updated = await api.resumeProject(project.id);
      onProjectUpdated(updated);
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "Could not resume project.");
    } finally {
      setIsResuming(false);
    }
  }, [project, onProjectUpdated]);

  const handleRotateKey = useCallback(() => {
    setConfirming("rotate-key");
  }, []);

  const performRotateKey = useCallback(async () => {
    setIsRotating(true);
    setActionError(null);
    try {
      const result = await api.rotateKey(project.id);
      setRotatedKey(result.secret_key);
      setRotatedCopied(false);
      onProjectUpdated({ ...project, secret_key_prefix: result.secret_key_prefix });
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "Could not rotate the key.");
    } finally {
      setIsRotating(false);
      // Closed on failure as well as success: the page reports the error below,
      // where it stays visible after the dialog is gone.
      setConfirming(null);
    }
  }, [project, onProjectUpdated]);

  const handleDelete = useCallback(() => {
    setConfirming("delete");
  }, []);

  const performDelete = useCallback(async () => {
    setIsDeleting(true);
    setActionError(null);
    try {
      await api.deleteProject(project.id);
      onProjectDeleted();
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "Could not delete the project.");
    } finally {
      setIsDeleting(false);
      setConfirming(null);
    }
  }, [project, onProjectDeleted]);

  return (
    /* Generous vertical rhythm between sections. These blocks are independent
       (env reference, credentials, AI prompt, actions) and a tight stack made
       them read as one continuous list, so the gap does real separating work. */
    <div className="space-y-12">
      {/* Environment reference */}
      <section>
        <SectionHeading>Your environment</SectionHeading>
        <p className="mt-2 text-[0.8rem] font-medium text-muted">
          Put these in your own project so it can reach this database. The secret key is
          shown once at creation and once per rotation — it is never stored here.
        </p>
        <div className="mt-3 space-y-3">
          {envVars.map((entry) => (
            <CopyableField key={entry.name} label={entry.name} value={entry.value} />
          ))}
          <CopyableField label="MOOGO_SECRET_KEY" value={project.secret_key_prefix} masked />
        </div>
      </section>

      {/* One-time key reveal after a rotation */}
      {rotatedKey && (
        <section className="rounded-lg border border-accent-strong/40 bg-accent-strong/10 p-4">
          <SectionHeading accent>New secret key</SectionHeading>
          <p className="mt-2 text-[0.8rem] font-medium text-muted">
            Put this in your project as <code>MOOGO_SECRET_KEY</code> now. It will not be
            shown again — if you lose it, rotate once more.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap rounded-lg border border-edge bg-background px-3 py-2 font-mono text-sm text-foreground">
              {rotatedKey}
            </code>
            <button
              type="button"
              onClick={handleCopyRotated}
              className="shrink-0 cursor-pointer rounded-md border border-edge-strong px-3 py-2 text-xs font-semibold text-muted transition-colors hover:border-hover-edge hover:bg-hover-bg hover:text-foreground"
            >
              {rotatedCopied ? "Copied" : "Copy"}
            </button>
          </div>
          <button
            type="button"
            onClick={() => setRotatedKey(null)}
            className="mt-3 cursor-pointer text-xs font-semibold text-muted underline decoration-2 underline-offset-2 hover:text-foreground"
          >
            I have saved it, hide it
          </button>
        </section>
      )}

      {/* Backup */}
      <section>
        <SectionHeading>Backup</SectionHeading>
        <p className="mt-2 max-w-[62ch] text-[0.8rem] font-medium leading-relaxed text-muted">
          Download a copy of this project&apos;s database as a single SQLite file. It is a
          consistent snapshot taken at the moment you click, so it can be opened with
          any SQLite tool or restored into another project.
        </p>
        <div className="mt-3">
          {/* A plain anchor, so the browser runs the download and shows its own
              progress for a database of any size. A fetch-then-blob would
              buffer the whole file in memory first and give no progress at all. */}
          <a
            href={api.databaseBackupUrl(project.id)}
            className="inline-block cursor-pointer rounded-lg border border-edge-strong px-4 py-2 text-sm font-semibold text-muted transition-colors hover:border-hover-edge hover:bg-hover-bg hover:text-foreground"
            download
          >
            Download database
          </a>
        </div>
      </section>

      {/* Storage credentials */}
      <section>
        <SectionHeading>Storage credentials</SectionHeading>
        <div className="mt-3">
          <StorageCredentials projectId={project.id} />
        </div>
      </section>

      {/* AI prompt */}
      <section>
        <SectionHeading>Hand it to an AI</SectionHeading>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleUsePrompt}
            className="cursor-pointer rounded-lg border border-edge-strong px-4 py-2 text-sm font-medium text-muted transition-colors hover:border-hover-edge hover:bg-hover-bg hover:text-foreground"
          >
            {promptCopied ? "✓ Prompt copied" : "Use prompt for AI"}
          </button>
        </div>
        <p className="mt-2 max-w-[62ch] text-[0.8rem] font-medium leading-relaxed text-muted">
          Copies the{" "}
          <Link to="/docs/ai-adoption-prompt" className="text-accent-strong underline underline-offset-4 hover:text-accent">
            AI adoption prompt
          </Link>{" "}
          verbatim — the same text as the reference page — ready to paste into an
          assistant or save as moogo.md. It points the assistant at your environment
          instead of carrying the secret key, so the key never leaves your machine.
        </p>
      </section>

      {/* Project actions */}
      <section>
        <SectionHeading>Project actions</SectionHeading>
        {/* One wrapping row rather than full-width buttons stacked. The labels
            drop the word "project" because the heading already says it, which
            is what makes the row fit without shrinking the text. */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {isPaused ? (
            <ActionButton
              onClick={handleResume}
              busy={isResuming}
              label={isResuming ? "Resuming…" : "Resume"}
            />
          ) : (
            <ActionButton
              onClick={handlePause}
              busy={isPausing}
              disabled={project.status !== "ready"}
              label={isPausing ? "Pausing…" : "Pause"}
            />
          )}
          <ActionButton
            onClick={handleRotateKey}
            busy={isRotating}
            label={isRotating ? "Rotating…" : "Rotate secret key"}
          />
          <ActionButton
            onClick={handleDelete}
            busy={isDeleting}
            danger
            label={isDeleting ? "Deleting…" : "Delete project"}
          />
        </div>
        <p className="mt-3 max-w-[62ch] text-[0.8rem] font-medium leading-relaxed text-muted">
          Pausing keeps the data but rejects every query and bucket request until you
          resume. Rotating shows a new secret key once. Deleting removes the database and its
          files for good.
        </p>
      </section>

      {actionError && (
        <div
          role="alert"
          className="rounded-lg border border-amber/40 bg-amber/10 px-4 py-3 text-sm text-amber"
        >
          {actionError}
        </div>
      )}

      <ConfirmDialog
        open={confirming === "rotate-key"}
        title="Rotate the secret key?"
        description="The previous key is invalidated immediately. Anything still using it will stop working."
        confirmLabel="Rotate key"
        busy={isRotating}
        onConfirm={performRotateKey}
        onCancel={() => setConfirming(null)}
      />
      <ConfirmDialog
        open={confirming === "delete"}
        title="Delete this project?"
        description="Its database and every file in it are removed. This cannot be undone."
        detail={project.name}
        confirmLabel="Delete project"
        busy={isDeleting}
        onConfirm={performDelete}
        onCancel={() => setConfirming(null)}
      />
    </div>
  );
}

// SectionHeading is the small uppercase label each block starts with.
function SectionHeading({
  children,
  accent,
}: {
  children: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <h2
      className={`text-xs font-bold uppercase tracking-wider ${
        accent ? "text-accent" : "text-faint"
      }`}
    >
      {children}
    </h2>
  );
}

// ActionButton is a compact settings action that shows a busy label while its
// request is in flight.
//
// Sized to its label rather than stretched: a settings row of actions reads as a
// set of choices, and full-width buttons turn it into a stack of banners.
function ActionButton({
  onClick,
  busy,
  disabled,
  danger,
  label,
}: {
  onClick: () => void;
  busy: boolean;
  disabled?: boolean;
  danger?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy || disabled}
      className={`cursor-pointer rounded-lg border px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
        danger
          ? "border-amber/40 text-amber hover:border-amber hover:bg-amber/20"
          : "border-edge-strong text-muted hover:border-hover-edge hover:bg-hover-bg hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}

// CopyableField is a labeled value with a Copy button.
//
// masked stands in for a secret the dashboard does not hold: it shows the prefix
// so a key can be recognised, without pretending the full value is available.
function CopyableField({
  label,
  value,
  masked,
}: {
  label: string;
  value: string;
  masked?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable; the value is selectable, so nothing is lost.
    }
  }, [value]);

  return (
    <div>
      <p className="mb-1 text-xs font-bold uppercase tracking-wider text-muted">{label}</p>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 overflow-hidden rounded-lg border border-edge bg-background px-3 py-2 font-mono text-sm font-medium text-foreground">
          {value}
          {masked && <span className="ml-2 not-italic text-faint">(not stored)</span>}
        </code>
        <button
          type="button"
          onClick={handleCopy}
          disabled={masked}
          className="shrink-0 cursor-pointer rounded-md border border-edge-strong px-2.5 py-1.5 text-xs font-semibold text-muted transition-colors hover:border-hover-edge hover:bg-hover-bg hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
          aria-label={`Copy ${label} to clipboard`}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}
