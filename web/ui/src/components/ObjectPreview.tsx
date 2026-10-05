import { useEffect, useState } from "react";
import { formatBytes, type BucketObject } from "../lib/api";

interface ObjectPreviewProps {
  object: BucketObject;
  onClose: () => void;
  onOpenPublic: () => void;
}

// ObjectPreview is the detail drawer for one object: a large preview on the left,
// the metadata and the actions on the right.
//
// It renders the object from the session route rather than the public one, so a
// private object previews exactly the same way a published one does. Checking
// that the public URL works is a separate button, because the two differ in
// exactly one way -- authentication -- and that difference is the thing a user
// needs to verify before embedding the link in a site.
export default function ObjectPreview({
  object,
  onClose,
  onOpenPublic,
}: ObjectPreviewProps) {
  const [text, setText] = useState<string | null>(null);
  const [textError, setTextError] = useState<string | null>(null);

  const kind = previewKind(object.content_type);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Text is fetched rather than rendered inline. A CSV or JSON file can be
  // megabytes, and loading one into the DOM to preview it would freeze the tab;
  // the cap below keeps a preview a preview.
  useEffect(() => {
    if (kind !== "text") {
      setText(null);
      setTextError(null);
      return;
    }

    const controller = new AbortController();
    setText(null);
    setTextError(null);

    fetch(object.preview_url, { credentials: "same-origin", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`the server answered ${response.status}`);
        }
        const body = await response.text();
        setText(body.slice(0, TEXT_PREVIEW_LIMIT));
      })
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === "AbortError") {
          return;
        }
        setTextError(
          cause instanceof Error ? cause.message : "the file could not be loaded",
        );
      });

    return () => controller.abort();
  }, [kind, object.preview_url]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={object.key}
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm sm:p-8"
      onClick={onClose}
    >
      <div
        className="surface-raised flex max-h-full w-full max-w-5xl flex-col overflow-hidden rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-4 border-b border-edge px-5 py-4">
          <div className="min-w-0">
            <p className="truncate font-mono text-sm font-semibold text-foreground">
              {object.key}
            </p>
            <p className="mt-1 text-xs text-muted">
              {object.content_type} · {formatBytes(object.size_bytes)}
              {object.is_public ? " · public" : " · private"}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {/* Two ways out of the modal, because a file the browser cannot show
                inline still has to be reachable: one hands it to the browser to
                open, the other saves it under its own name. */}
            <a
              href={object.preview_url}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md border border-edge-strong px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-panel-raised"
            >
              Open
            </a>
            <a
              href={object.preview_url}
              download={keyFilename(object.key)}
              className="rounded-md border border-edge-strong px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-panel-raised"
            >
              Download
            </a>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close preview"
              className="cursor-pointer rounded-md px-2.5 py-1.5 text-sm text-muted transition-colors hover:bg-panel-raised hover:text-foreground"
            >
              Close
            </button>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto md:grid-cols-[1fr_18rem]">
          <div className="flex min-h-64 items-center justify-center bg-panel-raised p-4">
            <PreviewBody object={object} kind={kind} text={text} error={textError} />
          </div>

          <dl className="space-y-4 border-t border-edge p-5 text-sm md:border-l md:border-t-0">
            <Field label="Bucket">{object.bucket || "—"}</Field>
            <Field label="Uploaded">{new Date(object.created_at).toLocaleString()}</Field>
            <Field label="Modified">{new Date(object.updated_at).toLocaleString()}</Field>

            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-faint">
                Public URL
              </dt>
              <dd className="mt-1.5">
                {object.is_public ? (
                  <button
                    type="button"
                    onClick={onOpenPublic}
                    className="w-full cursor-pointer break-all rounded-md bg-panel-raised px-2.5 py-2 text-left font-mono text-xs text-accent-strong transition-colors hover:bg-hover-bg"
                  >
                    {object.public_url}
                    <span className="mt-1 block text-[0.7rem] text-muted">
                      click to open in a new tab
                    </span>
                  </button>
                ) : (
                  <p className="text-xs text-muted">
                    This object is private. Publish it to get a link you can use on
                    your own site.
                  </p>
                )}
              </dd>
            </div>

            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-faint">
                ETag
              </dt>
              <dd className="mt-1 break-all font-mono text-xs text-muted">{object.etag}</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}

type PreviewKind = "image" | "video" | "audio" | "text" | "none";

function previewKind(contentType: string): PreviewKind {
  const media = contentType.split(";")[0].trim().toLowerCase();
  if (media === "image/svg+xml") {
    // An SVG is a document that can carry script. The server already refuses to
    // render it inline, and previewing it here would reintroduce that inside the
    // app's own origin.
    return "none";
  }
  if (media.startsWith("image/")) return "image";
  if (media.startsWith("video/")) return "video";
  if (media.startsWith("audio/")) return "audio";
  if (
    media === "application/json" ||
    media === "text/plain" ||
    media === "text/markdown" ||
    media === "text/csv"
  ) {
    return "text";
  }
  return "none";
}

function PreviewBody({
  object,
  kind,
  text,
  error,
}: {
  object: BucketObject;
  kind: PreviewKind;
  text: string | null;
  error: string | null;
}) {
  if (kind === "image") {
    // The source is the session route, not object.url: the latter wants a
    // storage credential, so every private image would render broken.
    return (
      <img
        src={object.preview_url}
        alt={object.key}
        className="max-h-[70vh] max-w-full rounded-md object-contain"
      />
    );
  }
  if (kind === "video") {
    return (
      <video
        src={object.preview_url}
        controls
        className="max-h-[70vh] max-w-full rounded-md"
      />
    );
  }
  if (kind === "audio") {
    return <audio src={object.preview_url} controls className="w-full" />;
  }
  if (kind === "text") {
    if (error) {
      return <p className="text-sm text-amber">{error}</p>;
    }
    if (text === null) {
      return <p className="text-sm text-muted">Loading…</p>;
    }
    return (
      <pre className="max-h-[70vh] w-full overflow-auto whitespace-pre-wrap break-words rounded-md bg-panel p-4 text-left font-mono text-xs text-foreground">
        {text}
      </pre>
    );
  }
  return (
    <div className="text-center">
      <p className="text-sm text-muted">
        {object.content_type} cannot be shown here.
      </p>
      <a
        href={object.preview_url}
        className="mt-3 inline-block rounded-lg border border-edge-strong px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-panel-raised"
      >
        Download it instead
      </a>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-faint">{label}</dt>
      <dd className="mt-1 text-foreground">{children}</dd>
    </div>
  );
}

// TEXT_PREVIEW_LIMIT caps how much of a text object is shown.
//
// A preview that loads an entire 40 MB log file is not a preview, it is a way to
// make the tab unresponsive.
const TEXT_PREVIEW_LIMIT = 200_000;

// keyFilename is the name a download should be saved under.
//
// It is the last segment of the key, because a browser cannot write a path. A
// key of "logo.png" saved as the whole key would create a file called
// "photos/2026/logo.png", which either lands in the wrong place or gets
// flattened to something the user did not ask for.
function keyFilename(key: string): string {
  const segments = key.split("/").filter(Boolean);
  return segments[segments.length - 1] || key;
}