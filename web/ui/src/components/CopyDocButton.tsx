// CopyDocButton copies one documentation page as Markdown.
//
// The point of the button is that a guide can be handed to an agent, dropped into
// a project as moogo.md, or read next to the code it is about -- so what is
// copied is the Markdown source from the bundle, not the rendered HTML.
//
// Each document is a lazy chunk (see lib/docs.ts), so a click fetches that one
// document rather than the whole corpus, and caches it for the next click.
//
// Failure is reported on the button instead of in a dialog. The clipboard is
// blocked on insecure origins and by permissions, and a button that silently does
// nothing is worse than one that says it did not copy -- the page itself is
// always there to select from by hand.
import { useCallback, useState } from "react";
import type { ReactNode } from "react";
import { copyToClipboard } from "../lib/clipboard";
import { docFileName, ensureDoc } from "../lib/docs";

type CopyState = "idle" | "copied" | "failed";

export function CopyDocButton({
  slug,
  className,
  title,
  ariaLabel,
  children,
}: {
  slug: string;
  className?: string;
  title?: string;
  /**
   * The accessible name, for the buttons whose visible content is a picture. A
   * title attribute is the fallback, but it is announced late and not at all by
   * every reader, so a logo button states what it copies.
   */
  ariaLabel?: string;
  /**
   * Replaces the default "Copy <file>.md" label. Used where the button wraps
   * something else -- a logo, say -- and the confirmation is shown as an overlay
   * instead, because the child is already carrying the meaning.
   */
  children?: ReactNode;
}) {
  const [state, setState] = useState<CopyState>("idle");
  const file = docFileName(slug);

  const copy = useCallback(async () => {
    setState("idle");
    try {
      const source = await ensureDoc(slug);
      if (source === undefined) {
        setState("failed");
        return;
      }
      const copied = await copyToClipboard(source, {
        onSuccess: () => setState("copied"),
        onFail: () => setState("failed"),
      });
      // The confirmation is held long enough to be read, then withdrawn so the
      // button goes back to offering the copy again.
      if (copied) window.setTimeout(() => setState("idle"), 2000);
    } catch {
      setState("failed");
    }
  }, [slug]);

  const label =
    state === "copied"
      ? `✓ Copied ${file}`
      : state === "failed"
        ? "Copy failed"
        : `Copy ${file}`;

  return (
    <button
      type="button"
      onClick={() => void copy()}
      title={title ?? `Copy ${file} to the clipboard`}
      aria-label={ariaLabel}
      // relative is not decoration: with children, the confirmation is pinned to
      // this button rather than to the nearest positioned ancestor, which on the
      // homepage marquee would be a row a hundred logos wide.
      className={`relative cursor-pointer ${className ?? ""}`}
    >
      {children ?? label}
      {children && state !== "idle" && (
        <span
          aria-live="polite"
          className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rounded-md border border-edge-strong bg-panel px-2 py-1 text-[0.7rem] font-semibold whitespace-nowrap text-foreground shadow-sm"
        >
          {label}
        </span>
      )}
    </button>
  );
}