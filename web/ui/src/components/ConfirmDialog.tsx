import Modal from "./Modal";

// ConfirmDialog replaces window.confirm. The native dialog cannot be styled, so
// it ignored the theme and read as a different application entirely; it also
// could not show which row was about to be deleted, only that something would
// be.
export default function ConfirmDialog({
  open,
  title,
  description,
  detail,
  confirmLabel = "Confirm",
  tone = "danger",
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description: React.ReactNode;
  // A monospace line naming the exact object. Shown as a separate row so a
  // table or column name never has to be read inside a sentence.
  detail?: string;
  confirmLabel?: string;
  tone?: "danger" | "accent";
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) {
    return null;
  }

  return (
    <Modal
      onClose={onCancel}
      title={title}
      size="sm"
      actions={
        <>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="cursor-pointer rounded-lg border border-edge-strong px-4 py-2 text-sm font-medium text-muted transition-colors hover:border-hover-edge hover:bg-hover-bg hover:text-foreground disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`cursor-pointer rounded-lg px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 ${
              tone === "danger" ? "bg-red" : "bg-accent-strong"
            }`}
          >
            {busy ? "Working…" : confirmLabel}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-muted">{description}</p>
        {detail ? (
          <p className="rounded-lg border border-edge bg-panel px-3 py-2 font-mono text-[0.82rem] text-foreground">
            {detail}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}
