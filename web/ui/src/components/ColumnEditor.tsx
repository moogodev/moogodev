import { useId } from "react";
import { COLUMN_TYPES, newColumnDraft, type ColumnDraft } from "../lib/sqlbuilder";

// ColumnEditor is the column list shared by the create-table dialog and the
// add-column form in the structure pane.
//
// They used to be two hand-written tables that had drifted apart: the dialog
// offered AUTOINCREMENT, the inline form did not, and neither copied the other's
// styling. SQLite's rule is the reason the two can now differ by one flag
// rather than by two implementations: an existing table cannot be given a
// primary key or an autoincrementing column, so allowPrimaryKey is off there
// and the columns simply are not offered.
export default function ColumnEditor({
  columns,
  onChange,
  allowPrimaryKey = true,
  showAddRow = true,
  label = "Columns",
  compact = false,
}: {
  columns: ColumnDraft[];
  onChange: (next: ColumnDraft[]) => void;
  allowPrimaryKey?: boolean;
  // The inline add-column form edits exactly one column, so it hides the row
  // that would add another.
  showAddRow?: boolean;
  label?: string;
  // The inline form sits under a live preview of the ALTER statement, so it
  // uses tighter rows to keep the whole pane on one screen.
  compact?: boolean;
}) {
  const cell = compact
    ? "border-b border-edge/60 px-2 py-1"
    : "border-b border-edge/60 px-3 py-2";
  const input = compact
    ? "rounded border border-edge-strong bg-background px-2 py-1 font-mono text-[0.78rem] text-foreground placeholder:text-faint focus:border-accent-strong focus:outline-none"
    : "rounded border border-edge-strong bg-background px-2 py-1.5 font-mono text-[0.8rem] text-foreground placeholder:text-faint focus:border-accent-strong focus:outline-none";

  // The primary key is a radio group, and a radio group is scoped by its name
  // attribute across the whole document. A generated name keeps two editors
  // from sharing one group, which would let picking a key in the inline form
  // clear the key chosen in the dialog.
  const groupName = useId();

  // New ids are derived from the rows on screen rather than kept in a counter,
  // so a form that is reset to id 1 by its parent cannot collide with an id the
  // editor already handed out.
  function addColumn() {
    const nextId = columns.reduce((highest, column) => Math.max(highest, column.id), 0) + 1;
    onChange([...columns, newColumnDraft(nextId)]);
  }

  function removeColumn(id: number) {
    const next = columns.filter((column) => column.id !== id);
    // Always leave one empty row so the form never looks broken.
    onChange(next.length > 0 ? next : [newColumnDraft(Date.now())]);
  }

  function updateColumn(id: number, patch: Partial<ColumnDraft>) {
    onChange(
      columns.map((column) => {
        if (column.id !== id) {
          // Only one column can hold the primary key.
          if (patch.primaryKey) {
            return { ...column, primaryKey: false, autoIncrement: false };
          }
          return column;
        }
        const merged = { ...column, ...patch };
        // AUTOINCREMENT only exists on an INTEGER primary key, and spelling the
        // column that way is what forces the type in the generated DDL.
        if (merged.primaryKey && merged.autoIncrement) {
          merged.type = "INTEGER";
        }
        if (!merged.primaryKey) {
          merged.autoIncrement = false;
        }
        return merged;
      }),
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-edge">
      <table className="w-full border-collapse text-left text-[0.85rem]" aria-label={label}>
        <thead className="bg-panel-raised">
          <tr>
            <th scope="col" className={`${cell} font-semibold text-foreground`}>Name</th>
            <th scope="col" className={`${cell} font-semibold text-foreground`}>Type</th>
            <th scope="col" className={`${cell} font-semibold text-foreground`}>Default</th>
            {allowPrimaryKey ? (
              <>
                <th scope="col" className={`${cell} font-semibold text-foreground`}>PK</th>
                <th
                  scope="col"
                  className={`${cell} text-center font-semibold text-foreground`}
                  title="AUTOINCREMENT — only valid on an INTEGER primary key"
                >
                  AI
                </th>
              </>
            ) : null}
            <th
              scope="col"
              className={`${cell} text-center font-semibold text-foreground`}
              title="NOT NULL"
            >
              NN
            </th>
            <th scope="col" className={cell} />
          </tr>
        </thead>
        <tbody>
          {columns.map((column) => (
            <tr key={column.id}>
              <td className={cell}>
                <input
                  value={column.name}
                  onChange={(event) => updateColumn(column.id, { name: event.target.value })}
                  placeholder="column_name"
                  spellCheck={false}
                  aria-label="Column name"
                  className={`${input} w-36`}
                />
              </td>
              <td className={cell}>
                <select
                  value={column.type}
                  onChange={(event) => updateColumn(column.id, { type: event.target.value })}
                  disabled={column.primaryKey && column.autoIncrement}
                  aria-label={`Type for ${column.name || "new column"}`}
                  className={`${input} w-32 disabled:opacity-50`}
                >
                  {COLUMN_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </td>
              <td className={cell}>
                <input
                  value={column.defaultValue}
                  onChange={(event) =>
                    updateColumn(column.id, { defaultValue: event.target.value })
                  }
                  placeholder="NULL"
                  spellCheck={false}
                  aria-label={`Default for ${column.name || "new column"}`}
                  className={`${input} w-28`}
                />
              </td>
              {allowPrimaryKey ? (
                <>
                  <td className={`${cell} text-center`}>
                    <input
                      type="radio"
                      name={groupName}
                      checked={column.primaryKey}
                      onChange={() => updateColumn(column.id, { primaryKey: true })}
                      aria-label={`Make ${column.name || "new column"} the primary key`}
                      className="cursor-pointer accent-accent-strong"
                    />
                  </td>
                  <td className={`${cell} text-center`}>
                    <input
                      type="checkbox"
                      checked={column.autoIncrement}
                      disabled={!column.primaryKey}
                      onChange={(event) =>
                        updateColumn(column.id, { autoIncrement: event.target.checked })
                      }
                      aria-label={`Autoincrement ${column.name || "new column"}`}
                      className="cursor-pointer accent-accent-strong disabled:cursor-not-allowed disabled:opacity-40"
                    />
                  </td>
                </>
              ) : null}
              <td className={`${cell} text-center`}>
                <input
                  type="checkbox"
                  checked={column.notNull}
                  onChange={(event) => updateColumn(column.id, { notNull: event.target.checked })}
                  aria-label={`Not null for ${column.name || "new column"}`}
                  className="cursor-pointer accent-accent-strong"
                />
              </td>
              <td className={`${cell} text-right`}>
                <button
                  type="button"
                  onClick={() => removeColumn(column.id)}
                  aria-label={`Remove ${column.name || "new column"}`}
                  className="cursor-pointer rounded px-2 py-1 text-[0.75rem] text-amber transition-colors hover:bg-amber/20"
                >
                  Remove
                </button>
              </td>
            </tr>
          ))}
          {showAddRow && (
            <tr>
              <td colSpan={allowPrimaryKey ? 7 : 5} className="p-0">
                <button
                  type="button"
                  onClick={addColumn}
                  className="w-full cursor-pointer px-3 py-2 text-left text-[0.8rem] text-muted transition-colors hover:bg-hover-bg hover:text-foreground"
                >
                  + Add column
                </button>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ColumnEditorHeader is the small heading plus action that sits above a column
// or index list. It is exported so the create-table dialog and the structure
// pane place it identically.
export function ColumnEditorHeader({
  label,
  action,
  onAction,
}: {
  label: string;
  action: string;
  onAction: () => void;
}) {
  return (
    <div className="mb-2 flex items-center justify-between">
      <h3 className="text-[0.78rem] font-bold uppercase tracking-wider text-faint">
        {label}
      </h3>
      <button
        type="button"
        onClick={onAction}
        className="cursor-pointer rounded-md border border-edge-strong px-2.5 py-1 text-[0.78rem] text-muted transition-colors hover:border-hover-edge hover:bg-hover-bg hover:text-foreground"
      >
        {action}
      </button>
    </div>
  );
}
