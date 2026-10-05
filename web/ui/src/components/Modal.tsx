import { useEffect, useRef } from "react";

// Modal is the shell every dialog in the console sits in: the backdrop, the
// Escape key, and the scroll lock behind the panel. Each dialog used to
// hand-roll those three, which is how they ended up disagreeing about padding
// and about whether Escape worked.
//
// Children own their own body content; the title and the action row are
// rendered here so every dialog lines up on the same edges.
export default function Modal({
  onClose,
  title,
  description,
  size = "md",
  children,
  actions,
}: {
  onClose: () => void;
  title: string;
  description?: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "full";
  children?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      onClose();
    }

    document.addEventListener("keydown", onKeyDown);

    // The page behind the dialog must not scroll under it.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Focus lands on the panel rather than the first control, so Tab moves
    // forward through the dialog instead of jumping to whatever was focused on
    // the page behind it.
    panelRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        className={`my-4 w-full ${PANEL_WIDTH[size]} surface-raised outline-none`}
      >
        <div className="border-b border-edge px-5 py-4">
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          {description ? (
            <div className="mt-1 text-sm text-muted">{description}</div>
          ) : null}
        </div>

        {children ? <div className="px-5 py-4">{children}</div> : null}

        {actions ? (
          <div className="flex justify-end gap-2 border-t border-edge px-5 py-4">
            {actions}
          </div>
        ) : null}
      </div>
    </div>
  );
}

const PANEL_WIDTH = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-3xl",
  full: "max-w-5xl",
} as const;
