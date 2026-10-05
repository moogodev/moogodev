import { useCallback, useState } from "react";
import {
  buildAddColumn,
  buildCreateIndex,
  buildDropColumn,
  buildDropIndex,
  buildRenameColumn,
  newColumnDraft,
  quoteIdent,
  type ColumnDraft,
} from "../lib/sqlbuilder";
import ColumnEditor from "./ColumnEditor";
import ConfirmDialog from "./ConfirmDialog";
import { INDEX_ORIGIN_LABEL } from "./tableSchema";
import type { ForeignKey, SchemaColumn, TableIndex } from "./tableSchema";

interface TableStructureProps {
  table: string;
  columns: SchemaColumn[];
  indexes: TableIndex[];
  foreignKeys: ForeignKey[];
  triggers: { name: string; sql: string | null }[];
  // A view has no storage of its own, so none of the ALTER statements offered
  // here apply to it. The read-only half of the pane still does.
  readOnly?: boolean;
  busy: boolean;
  // runStatement executes one statement and then asks the tab to reload, so no
  // caller here has to say when it is done.
  runStatement: (statement: string, after?: () => void) => Promise<void>;
}

// TableStructure reports what SQLite actually made of the table: its columns
// including the generated ones, its indexes and where each came from, its
// foreign keys with their actions, and its triggers. This is the part a table
// browser usually skips, and skipping it is what makes a viewer disagree with
// the file it claims to be showing.
export default function TableStructure({
  table,
  columns,
  indexes,
  foreignKeys,
  triggers,
  readOnly = false,
  busy,
  runStatement,
}: TableStructureProps) {
  const [error, setError] = useState<string | null>(null);
  const [pendingDropColumn, setPendingDropColumn] = useState<string | null>(null);
  const [pendingDropIndex, setPendingDropIndex] = useState<string | null>(null);
  const [renamingColumn, setRenamingColumn] = useState<string | null>(null);
  const [columnNameDraft, setColumnNameDraft] = useState("");
  const [addingColumn, setAddingColumn] = useState(false);
  const [columnDraft, setColumnDraft] = useState<ColumnDraft>(() => newColumnDraft(1));
  const [creatingIndex, setCreatingIndex] = useState(false);
  const [indexDraft, setIndexDraft] = useState({ name: "", column: "", unique: false });

  const addColumnPreview = addingColumn ? buildAddColumn(table, columnDraft) : null;
  const createIndexPreview = creatingIndex
    ? buildCreateIndex(
        indexDraft.name,
        table,
        indexDraft.column ? [indexDraft.column] : [],
        indexDraft.unique,
      )
    : null;

  function closeAddColumn() {
    setAddingColumn(false);
    setColumnDraft(newColumnDraft(1));
  }

  const submitAddColumn = useCallback(() => {
    const statement = buildAddColumn(table, columnDraft);
    if (!statement) {
      setError("Give the new column a name.");
      return;
    }
    setError(null);
    void runStatement(statement, () => {
      setAddingColumn(false);
      setColumnDraft(newColumnDraft(1));
    });
  }, [table, columnDraft, runStatement]);

  const submitRenameColumn = (column: string) => {
    const statement = buildRenameColumn(table, column, columnNameDraft);
    if (!statement) return;
    void runStatement(statement, () => {
      setRenamingColumn(null);
      setColumnNameDraft("");
    });
  };

  function submitCreateIndex() {
    const statement = createIndexPreview;
    if (!statement) {
      setError("Name the index and pick the column it covers.");
      return;
    }
    setError(null);
    void runStatement(statement, () => {
      setCreatingIndex(false);
      setIndexDraft({ name: "", column: "", unique: false });
    });
  }

  return (
    <div className="space-y-8">
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-amber/40 bg-amber/10 px-3 py-2 text-[0.85rem] text-amber"
        >
          {error}
        </p>
      )}

      {/* Columns */}
      <section>
        <SectionHeading count={columns.length}>Columns</SectionHeading>
        {!readOnly && (
          <button
            type="button"
            onClick={() => {
              setAddingColumn((current) => !current);
              setError(null);
            }}
            className="mb-2 cursor-pointer rounded-md border border-edge-strong px-2.5 py-1 text-[0.78rem] text-muted transition-colors hover:border-hover-edge hover:bg-hover-bg hover:text-foreground"
          >
            {addingColumn ? "Close" : "+ Add column"}
          </button>
        )}
        <div className="overflow-x-auto rounded-lg border border-edge">
          <table className="w-full border-collapse text-left text-[0.85rem]">
            <thead className="bg-panel-raised">
              <tr>
                <th scope="col" className="border-b border-edge px-3 py-2 font-semibold text-foreground">Name</th>
                <th scope="col" className="border-b border-edge px-3 py-2 font-semibold text-foreground">Type</th>
                <th scope="col" className="border-b border-edge px-3 py-2 font-semibold text-foreground">Not null</th>
                <th scope="col" className="border-b border-edge px-3 py-2 font-semibold text-foreground">Default</th>
                <th scope="col" className="border-b border-edge px-3 py-2 font-semibold text-foreground">Key</th>
                <th scope="col" className="border-b border-edge px-3 py-2">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {columns.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-3 text-center text-muted">
                    No columns.
                  </td>
                </tr>
              ) : (
                columns.map((column) => (
                  <tr key={column.name} className="odd:bg-panel even:bg-panel/40">
                    <td className="border-b border-edge/60 px-3 py-1.5 font-mono text-foreground">
                      {renamingColumn === column.name ? (
                        <input
                          value={columnNameDraft}
                          onChange={(event) => setColumnNameDraft(event.target.value)}
                          autoFocus
                          spellCheck={false}
                          aria-label={`Rename ${column.name}`}
                          className="w-36 rounded border border-edge-strong bg-background px-2 py-1 font-mono text-[0.8rem] text-foreground focus:border-accent-strong focus:outline-none"
                        />
                      ) : (
                        <span className="flex items-center gap-1.5">
                          {column.name}
                          {column.hidden && (
                            <span
                              title="Generated or hidden — SQLite computes this value, so it cannot be edited"
                              className="rounded bg-violet/15 px-1.5 py-0.5 text-[0.7rem] font-semibold uppercase text-violet"
                            >
                              Gen
                            </span>
                          )}
                        </span>
                      )}
                    </td>
                    <td className="border-b border-edge/60 px-3 py-1.5 font-mono text-muted">
                      {column.type || "ANY"}
                    </td>
                    <td className="border-b border-edge/60 px-3 py-1.5 text-muted">
                      {column.notNull ? "yes" : "no"}
                    </td>
                    <td className="border-b border-edge/60 px-3 py-1.5 font-mono text-muted">
                      {column.defaultValue ?? "—"}
                    </td>
                    <td className="border-b border-edge/60 px-3 py-1.5">
                      {column.primaryKey && (
                        <span className="rounded bg-accent-strong/15 px-1.5 py-0.5 text-[0.72rem] font-semibold uppercase text-accent">
                          PK
                        </span>
                      )}
                    </td>
                    <td className="border-b border-edge/60 px-3 py-1.5 text-right">
                      {renamingColumn === column.name ? (
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => submitRenameColumn(column.name)}
                            disabled={busy || !columnNameDraft.trim()}
                            className="cursor-pointer rounded px-2 py-1 text-[0.75rem] font-semibold text-accent transition-colors hover:bg-hover-bg disabled:opacity-50"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => setRenamingColumn(null)}
                            className="cursor-pointer rounded px-2 py-1 text-[0.75rem] text-muted transition-colors hover:bg-hover-bg"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : readOnly ? (
                        <span className="px-2 py-1 text-[0.72rem] text-faint">—</span>
                      ) : (
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setRenamingColumn(column.name);
                              setColumnNameDraft(column.name);
                            }}
                            className="cursor-pointer rounded px-2 py-1 text-[0.75rem] text-muted transition-colors hover:bg-hover-bg hover:text-foreground"
                          >
                            Rename
                          </button>
                          <button
                            type="button"
                            onClick={() => setPendingDropColumn(column.name)}
                            disabled={busy}
                            className="cursor-pointer rounded px-2 py-1 text-[0.75rem] text-amber transition-colors hover:bg-amber/20 disabled:opacity-50"
                          >
                            Drop
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {addingColumn && (
          <div className="mt-3 rounded-lg border border-edge bg-panel p-3">
            <ColumnEditor
              columns={[columnDraft]}
              onChange={(next) => setColumnDraft(next[0] ?? newColumnDraft(Date.now()))}
              allowPrimaryKey={false}
              showAddRow={false}
              compact
              label="New column"
            />
            {addColumnPreview && (
              <pre className="mt-3 overflow-x-auto rounded-lg border border-edge bg-background px-3 py-2 font-mono text-[0.78rem] text-muted">
                {addColumnPreview}
              </pre>
            )}
            <div className="mt-3 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={closeAddColumn}
                className="cursor-pointer rounded-lg border border-edge-strong px-3 py-1.5 text-[0.8rem] text-muted transition-colors hover:border-hover-edge hover:bg-hover-bg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitAddColumn}
                disabled={busy || !columnDraft.name.trim()}
                className="cursor-pointer rounded-lg bg-accent-strong px-4 py-1.5 text-[0.8rem] font-semibold text-accent-ink transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
              >
                Add column
              </button>
            </div>
            <p className="mt-2 text-[0.75rem] text-faint">
              SQLite can add a column to an existing table, but not a primary key or an
              autoincrementing one.
            </p>
          </div>
        )}
      </section>

      {/* Indexes */}
      <section>
        <SectionHeading count={indexes.length}>Indexes</SectionHeading>
        {!readOnly && (
          <button
            type="button"
            onClick={() => {
              setCreatingIndex((current) => !current);
              setError(null);
            }}
            className="mb-2 cursor-pointer rounded-md border border-edge-strong px-2.5 py-1 text-[0.78rem] text-muted transition-colors hover:border-hover-edge hover:bg-hover-bg hover:text-foreground"
          >
            {creatingIndex ? "Close" : "+ Add index"}
          </button>
        )}
        <div className="overflow-x-auto rounded-lg border border-edge">
          <table className="w-full border-collapse text-left text-[0.85rem]">
            <thead className="bg-panel-raised">
              <tr>
                <th scope="col" className="border-b border-edge px-3 py-2 font-semibold text-foreground">Name</th>
                <th scope="col" className="border-b border-edge px-3 py-2 font-semibold text-foreground">Columns</th>
                <th scope="col" className="border-b border-edge px-3 py-2 font-semibold text-foreground">Unique</th>
                <th scope="col" className="border-b border-edge px-3 py-2 font-semibold text-foreground">Created by</th>
                <th scope="col" className="border-b border-edge px-3 py-2">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {indexes.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-3 text-center text-muted">
                    No indexes.
                  </td>
                </tr>
              ) : (
                indexes.map((index) => (
                  <tr key={index.name} className="odd:bg-panel even:bg-panel/40">
                    <td className="border-b border-edge/60 px-3 py-1.5 font-mono text-foreground">
                      {index.name}
                      {index.partial && (
                        <span
                          title="Partial index — its WHERE clause limits which rows it covers"
                          className="ml-1.5 rounded bg-blue/15 px-1.5 py-0.5 text-[0.7rem] font-semibold uppercase text-blue"
                        >
                          Partial
                        </span>
                      )}
                    </td>
                    <td className="border-b border-edge/60 px-3 py-1.5 font-mono text-muted">
                      {index.columns.length > 0 ? index.columns.join(", ") : "—"}
                    </td>
                    <td className="border-b border-edge/60 px-3 py-1.5 text-muted">
                      {index.unique ? "yes" : "no"}
                    </td>
                    <td className="border-b border-edge/60 px-3 py-1.5 text-muted">
                      {INDEX_ORIGIN_LABEL[index.origin] ?? index.origin}
                    </td>
                    <td className="border-b border-edge/60 px-3 py-1.5 text-right">
                      {/* Only an index the developer wrote can be dropped on its
                          own. A UNIQUE or PRIMARY KEY index belongs to the
                          constraint, and dropping it is not legal SQLite. */}
                      {readOnly ? (
                        <span className="px-2 py-1 text-[0.72rem] text-faint">—</span>
                      ) : index.origin === "c" ? (
                        <button
                          type="button"
                          onClick={() => setPendingDropIndex(index.name)}
                          disabled={busy}
                          className="cursor-pointer rounded px-2 py-1 text-[0.75rem] text-amber transition-colors hover:bg-amber/20 disabled:opacity-50"
                        >
                          Drop
                        </button>
                      ) : (
                        <span className="px-2 py-1 text-[0.72rem] text-faint">
                          part of the table definition
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {creatingIndex && (
          <div className="mt-3 rounded-lg border border-edge bg-panel p-3">
            <div className="flex flex-wrap items-end gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-[0.72rem] font-bold uppercase tracking-wider text-faint">Index name</span>
                <input
                  value={indexDraft.name}
                  onChange={(event) => setIndexDraft({ ...indexDraft, name: event.target.value })}
                  placeholder="idx_orders_user"
                  spellCheck={false}
                  className="w-44 rounded border border-edge-strong bg-background px-2 py-1.5 font-mono text-[0.8rem] text-foreground placeholder:text-faint focus:border-accent-strong focus:outline-none"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[0.72rem] font-bold uppercase tracking-wider text-faint">Column</span>
                <select
                  value={indexDraft.column}
                  onChange={(event) => setIndexDraft({ ...indexDraft, column: event.target.value })}
                  className="rounded border border-edge-strong bg-background px-2 py-1.5 font-mono text-[0.8rem] text-foreground focus:border-accent-strong focus:outline-none"
                >
                  <option value="">Choose a column</option>
                  {columns.map((column) => (
                    <option key={column.name} value={column.name}>
                      {column.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2 pb-2 text-[0.8rem] text-muted">
                <input
                  type="checkbox"
                  checked={indexDraft.unique}
                  onChange={(event) => setIndexDraft({ ...indexDraft, unique: event.target.checked })}
                  className="cursor-pointer accent-accent-strong"
                />
                Unique
              </label>
              <button
                type="button"
                onClick={submitCreateIndex}
                disabled={busy || !createIndexPreview}
                className="cursor-pointer rounded-lg bg-accent-strong px-4 py-2 text-[0.8rem] font-semibold text-accent-ink transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
              >
                Create index
              </button>
            </div>
            {createIndexPreview && (
              <pre className="mt-3 overflow-x-auto rounded-lg border border-edge bg-background px-3 py-2 font-mono text-[0.78rem] text-muted">
                {createIndexPreview}
              </pre>
            )}
            <p className="mt-2 text-[0.75rem] text-faint">
              A UNIQUE index refuses a second row with the same value in that column.
            </p>
          </div>
        )}
      </section>

      {/* Foreign keys */}
      <section>
        <SectionHeading count={foreignKeys.length}>Foreign keys</SectionHeading>
        <div className="overflow-x-auto rounded-lg border border-edge">
          <table className="w-full border-collapse text-left text-[0.85rem]">
            <thead className="bg-panel-raised">
              <tr>
                <th scope="col" className="border-b border-edge px-3 py-2 font-semibold text-foreground">Columns</th>
                <th scope="col" className="border-b border-edge px-3 py-2 font-semibold text-foreground">References</th>
                <th scope="col" className="border-b border-edge px-3 py-2 font-semibold text-foreground">On update</th>
                <th scope="col" className="border-b border-edge px-3 py-2 font-semibold text-foreground">On delete</th>
              </tr>
            </thead>
            <tbody>
              {foreignKeys.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-3 text-center text-muted">
                    No foreign keys.
                  </td>
                </tr>
              ) : (
                foreignKeys.map((foreignKey) => (
                  <tr key={foreignKey.id} className="odd:bg-panel even:bg-panel/40">
                    <td className="border-b border-edge/60 px-3 py-1.5 font-mono text-foreground">
                      {foreignKey.columns.join(", ")}
                    </td>
                    <td className="border-b border-edge/60 px-3 py-1.5 font-mono text-muted">
                      {quoteIdent(foreignKey.referencesTable)}
                      {foreignKey.referencesColumns.some(Boolean)
                        ? ` (${foreignKey.referencesColumns.filter(Boolean).join(", ")})`
                        : ""}
                    </td>
                    <td className="border-b border-edge/60 px-3 py-1.5 text-muted">
                      {foreignKey.onUpdate}
                    </td>
                    <td className="border-b border-edge/60 px-3 py-1.5 text-muted">
                      {foreignKey.onDelete}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {foreignKeys.length > 0 && (
          <p className="mt-2 text-[0.75rem] text-faint">
            Foreign keys are enforced on this project&apos;s connections, so a write
            that breaks one is refused rather than quietly ignored.
          </p>
        )}
      </section>

      {/* Triggers */}
      <section>
        <SectionHeading count={triggers.length}>Triggers</SectionHeading>
        {triggers.length === 0 ? (
          <p className="rounded-lg border border-dashed border-edge-strong px-3 py-4 text-center text-[0.82rem] text-faint">
            No triggers.
          </p>
        ) : (
          <div className="space-y-2">
            {triggers.map((trigger) => (
              <details
                key={trigger.name}
                className="rounded-lg border border-edge bg-panel px-3 py-2"
              >
                <summary className="cursor-pointer font-mono text-[0.85rem] text-foreground">
                  {trigger.name}
                </summary>
                <pre className="mt-2 overflow-x-auto whitespace-pre-wrap font-mono text-[0.78rem] text-muted">
                  {trigger.sql ?? "—"}
                </pre>
              </details>
            ))}
          </div>
        )}
      </section>

      <ConfirmDialog
        open={pendingDropColumn !== null}
        title="Drop column"
        description="Every row loses this column and the values in it. This cannot be undone."
        detail={pendingDropColumn ?? undefined}
        confirmLabel="Drop column"
        busy={busy}
        onConfirm={() => {
          const column = pendingDropColumn;
          setPendingDropColumn(null);
          if (column) void runStatement(buildDropColumn(table, column));
        }}
        onCancel={() => setPendingDropColumn(null)}
      />

      <ConfirmDialog
        open={pendingDropIndex !== null}
        title="Drop index"
        description="The index is removed. The data it covered is untouched, and queries that relied on it get slower."
        detail={pendingDropIndex ?? undefined}
        confirmLabel="Drop index"
        busy={busy}
        onConfirm={() => {
          const index = pendingDropIndex;
          setPendingDropIndex(null);
          if (index) void runStatement(buildDropIndex(index));
        }}
        onCancel={() => setPendingDropIndex(null)}
      />
    </div>
  );
}

function SectionHeading({ count, children }: { count: number; children: React.ReactNode }) {
  return (
    <h3 className="mb-2 text-[0.78rem] font-bold uppercase tracking-wider text-faint">
      {children} ({count})
    </h3>
  );
}
