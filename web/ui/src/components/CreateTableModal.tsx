import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "../lib/api";
import { buildCreateTable, newColumnDraft, type ColumnDraft } from "../lib/sqlbuilder";
import ColumnEditor, { ColumnEditorHeader } from "./ColumnEditor";
import Modal from "./Modal";

interface CreateTableModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  onCreated: (table: string) => void;
}

// CreateTableModal is the visual counterpart of a SQLite viewer's "Create
// table" dialog: name the table, add columns, pick each column's affinity, and
// mark one primary key (optionally AUTOINCREMENT). The generated DDL is shown
// before it runs so the statement is never a black box.
export default function CreateTableModal({
  isOpen,
  onClose,
  projectId,
  onCreated,
}: CreateTableModalProps) {
  const [table, setTable] = useState("");
  const [columns, setColumns] = useState<ColumnDraft[]>([newColumnDraft(1)]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setTable("");
      setColumns([newColumnDraft(1)]);
      setError(null);
      setBusy(false);
    }
  }, [isOpen]);

  const preview = buildCreateTable(table, columns);

  const handleSubmit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      if (!preview) {
        setError("Give the table a name and at least one named column.");
        return;
      }
      setBusy(true);
      setError(null);
      try {
        await api.consoleExec(projectId, preview);
        onCreated(table.trim());
      } catch (cause) {
        setError(
          cause instanceof ApiError
            ? `${cause.message}${cause.detail ? ` — ${cause.detail}` : ""}`
            : "Could not create the table.",
        );
        setBusy(false);
      }
    },
    [preview, projectId, table, onCreated],
  );

  if (!isOpen) {
    return null;
  }

  return (
    <Modal
      onClose={onClose}
      title="Create table"
      description="Define columns the way a SQLite viewer does. One column may be the primary key, optionally AUTOINCREMENT."
      size="xl"
      actions={
        <>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-lg border border-edge-strong px-4 py-2 text-sm font-medium text-muted transition-colors hover:border-hover-edge hover:bg-hover-bg hover:text-foreground"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={(event) => {
              const form = event.currentTarget.form;
              if (form) form.requestSubmit();
            }}
            disabled={busy || !preview}
            className="cursor-pointer rounded-lg bg-accent-strong px-5 py-2 text-sm font-semibold text-accent-ink transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Creating…" : "Create table"}
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit}>
        <label className="mb-5 flex flex-col gap-2">
          <span className="text-sm text-muted">Table name</span>
          <input
            type="text"
            value={table}
            onChange={(event) => setTable(event.target.value)}
            placeholder="users"
            spellCheck={false}
            className="rounded-lg border border-edge-strong bg-panel px-3 py-2.5 font-mono text-sm text-foreground placeholder:text-faint focus:border-accent-strong focus:outline-none"
          />
        </label>

        <ColumnEditorHeader
          label={`Columns (${columns.filter((column) => column.name.trim()).length})`}
          action="+ Add column"
          onAction={() =>
            setColumns((current) => {
              const nextId =
                current.reduce((highest, column) => Math.max(highest, column.id), 0) + 1;
              return [...current, newColumnDraft(nextId)];
            })
          }
        />
        <ColumnEditor columns={columns} onChange={setColumns} label="Columns" />

        <div className="mt-5">
          <p className="mb-2 text-[0.82rem] font-bold uppercase tracking-wider text-faint">
            Preview
          </p>
          <pre className="overflow-x-auto rounded-lg border border-edge bg-panel px-3 py-2.5 font-mono text-[0.8rem] text-muted">
            {preview ?? "-- name the table and its columns"}
          </pre>
        </div>

        {error && (
          <p
            role="alert"
            className="mt-4 rounded-lg border border-amber/40 bg-amber/10 px-3 py-2 text-sm text-amber"
          >
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}
