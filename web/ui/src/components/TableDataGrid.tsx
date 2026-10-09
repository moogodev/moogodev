import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "../lib/api";
import type { SQLResponse } from "../lib/api";
import {
  buildDelete,
  buildInsert,
  buildUpdate,
  countRows,
  ROWID_ALIAS,
  selectRows,
  toArgument,
  type SortDirection,
} from "../lib/sqlbuilder";
import type { SchemaColumn, TableIdentity } from "./tableSchema";
import ConfirmDialog from "./ConfirmDialog";

// PAGE_SIZE is how many rows one page of the grid holds. It is fixed rather
// than selectable because the grid is already wider than most viewports, and a
// wider page buys very little.
export const PAGE_SIZE = 25;

export interface SortState {
  // A column name, or ROWID_ALIAS when the table has no primary key and the
  // row counter is being ordered instead.
  column: string | null;
  direction: SortDirection;
}

interface GridRow {
  id: unknown;
  cells: (string | null)[];
}

interface TableDataGridProps {
  projectId: string;
  table: string;
  columns: SchemaColumn[];
  // null when the table has no way to name a single row, which makes editing
  // impossible; the grid then renders read-only.
  identity: TableIdentity | null;
  /** Bumped after a write elsewhere in the tab, or by the Reload button. */
  refreshKey: number;
  onChanged: () => void;
}

// TableDataGrid is a spreadsheet over one page of a table: a cell becomes an
// input on click, commits on blur or Enter, and reverts on Escape. A new row is
// typed at the bottom and inserted when focus leaves it.
export default function TableDataGrid({
  projectId,
  table,
  columns,
  identity,
  refreshKey,
  onChanged,
}: TableDataGridProps) {
  const [rows, setRows] = useState<SQLResponse | null>(null);
  const [totalRows, setTotalRows] = useState<number | null>(null);
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState<SortState>({ column: null, direction: "asc" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<GridRow | null>(null);

  const pageStart = page * PAGE_SIZE;
  const editable = identity !== null;

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const pageResponse = await api.consoleQuery(
          projectId,
          selectRows({
            table,
            identifyByRowid: identity?.kind === "rowid",
            limit: PAGE_SIZE,
            offset: pageStart,
            sortColumn: sort.column,
            sortDirection: sort.direction,
          }),
        );
        if (cancelled) return;
        setRows(pageResponse);

        // The total is fetched alongside the page rather than derived from it,
        // because a page tells you nothing about how many pages follow. It is
        // fetched separately so a failure here costs the count, not the grid.
        try {
          const countResponse = await api.consoleQuery(projectId, countRows(table));
          if (cancelled) return;
          const total = Number(countResponse.rows?.[0]?.[0]);
          setTotalRows(Number.isFinite(total) ? total : null);
        } catch {
          if (!cancelled) setTotalRows(null);
        }
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof ApiError ? cause.message : "Could not load the table.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [projectId, table, refreshKey, pageStart, sort.column, sort.direction, identity?.kind]);

  // A row is identified by its single-column primary key when there is one, and
  // by the implicit rowid otherwise.
  const keyIndex = identity?.kind === "column" ? columns.findIndex((c) => c.name === identity.name) : -1;
  const offset = identity?.kind === "rowid" ? 1 : 0;

  const [gridRows, setGridRows] = useState<GridRow[]>([]);
  const [edit, setEdit] = useState<{ rowIndex: number; columnIndex: number } | null>(null);
  const [draft, setDraft] = useState<(string | null)[] | null>(null);
  const cancelRef = useRef(false);
  const draftRef = useRef<(string | null)[] | null>(null);
  const draftRowRef = useRef<HTMLTableRowElement | null>(null);

  // Rebuild the local grid whenever new rows arrive. columns and identity are
  // recomputed from the schema in the same render, so capturing them here is
  // safe.
  useEffect(() => {
    const data = rows?.rows ?? [];
    setGridRows(
      data.map((row, rowIndex) => ({
        // A row whose identifier cannot be read is not editable, but it still
        // has to render, so it falls back to its position in the page.
        id: identity ? (identity.kind === "rowid" ? row[0] : row[keyIndex]) : `#${rowIndex}`,
        cells: columns.map((_, index) => {
          const value = row[index + offset];
          return value === null || value === undefined ? null : String(value);
        }),
      })),
    );
  }, [rows, columns, identity, keyIndex, offset]);

  // draftRef mirrors the draft so the deferred blur handler can read the values
  // without re-subscribing to every keystroke. The copy is made in an effect
  // rather than during render, so reading it is not a render-time ref access.
  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  const runStatement = useCallback(
    async (statement: string, args: unknown[], after?: () => void) => {
      setBusy(true);
      setActionError(null);
      try {
        await api.consoleExec(projectId, statement, args);
        after?.();
        onChanged();
      } catch (cause) {
        setActionError(
          cause instanceof ApiError
            ? `${cause.message}${cause.detail ? ` — ${cause.detail}` : ""}`
            : "The statement could not be executed.",
        );
      } finally {
        setBusy(false);
      }
    },
    [projectId, onChanged],
  );

  const commitCell = (rowIndex: number, columnIndex: number, raw: string) => {
    const gridRow = gridRows[rowIndex];
    const column = columns[columnIndex];
    if (!gridRow || !column || !identity) return;
    const next = raw === "" ? null : raw;
    if (gridRow.cells[columnIndex] === next) return;

    // Optimistic: the cell updates immediately, the request follows.
    setGridRows((current) =>
      current.map((row, index) =>
        index === rowIndex
          ? { ...row, cells: row.cells.map((cell, ci) => (ci === columnIndex ? next : cell)) }
          : row,
      ),
    );
    void runStatement(buildUpdate(table, [column.name], identity.name), [
      toArgument(raw, column.type),
      gridRow.id,
    ]);
  };

  const commitDraft = () => {
    const values = draftRef.current;
    if (!values) return;
    const args = columns.map((column, index) => toArgument(values[index] ?? "", column.type));
    if (args.every((value) => value === null)) {
      setDraft(null);
      return;
    }
    void runStatement(buildInsert(table, columns.map((column) => column.name)), args, () =>
      setDraft(null),
    );
  };

  const confirmDelete = useCallback(() => {
    const row = pendingDelete;
    if (!row || !identity) return;
    setPendingDelete(null);
    void runStatement(buildDelete(table, identity.name), [row.id]);
  }, [pendingDelete, identity, runStatement, table]);

  function toggleSort(columnName: string) {
    setPage(0);
    setSort((current) => {
      if (current.column !== columnName) {
        return { column: columnName, direction: "asc" };
      }
      if (current.direction === "asc") {
        return { column: columnName, direction: "desc" };
      }
      // Third click clears the ordering and returns the natural order.
      return { column: null, direction: "asc" };
    });
  }

  const pageCount = totalRows === null ? null : Math.max(1, Math.ceil(totalRows / PAGE_SIZE));
  const sortTarget = sort.column === ROWID_ALIAS ? null : sort.column;

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[0.78rem] text-faint">
          {loading
            ? "Loading rows…"
            : totalRows === null
              ? `${gridRows.length} row${gridRows.length === 1 ? "" : "s"}`
              : totalRows === 0
                ? "No rows"
                : `${totalRows.toLocaleString()} row${totalRows === 1 ? "" : "s"}`}
        </p>
        <div className="flex items-center gap-1.5">
          {!editable && (
            <span className="text-[0.75rem] text-faint">Read-only</span>
          )}
          {sortTarget && (
            <button
              type="button"
              onClick={() => {
                setPage(0);
                setSort({ column: null, direction: "asc" });
              }}
              className="cursor-pointer rounded-md px-2 py-1 text-[0.75rem] text-muted transition-colors hover:bg-hover-bg hover:text-foreground"
            >
              Clear sort
            </button>
          )}
        </div>
      </div>

      {actionError && (
        <p
          role="alert"
          className="mb-2 rounded-lg border border-amber/40 bg-amber/10 px-3 py-2 text-[0.85rem] text-amber"
        >
          {actionError}
        </p>
      )}

      <div className="max-h-[62vh] overflow-auto rounded-lg border border-edge">
        <table className="w-full border-collapse text-left text-[0.82rem]">
          <caption className="sr-only">
            Rows from {table}. Click a cell to edit it.
          </caption>
          <thead className="sticky top-0 z-10 bg-panel-raised">
            <tr>
              <th
                scope="col"
                title="Position of this row on the current page"
                className="w-14 border-b border-edge px-2 py-1.5 text-right font-mono text-[0.72rem] font-normal text-faint"
              >
                #
              </th>
              {columns.map((column) => (
                <SortableHeader
                  key={column.name}
                  column={column}
                  sortColumn={sortTarget}
                  direction={sort.direction}
                  onSort={() => toggleSort(column.name)}
                />
              ))}
              {editable && (
                <th scope="col" className="w-16 border-b border-l border-edge px-2 py-1.5">
                  <span className="sr-only">Actions</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {error && (
              <tr>
                <td colSpan={columns.length + 2} className="px-3 py-6 text-center text-amber">
                  {error}
                </td>
              </tr>
            )}
            {!error && !loading && gridRows.length === 0 && (
              <tr>
                <td
                  colSpan={columns.length + 2}
                  className="px-3 py-10 text-center text-faint"
                >
                  No rows yet.
                </td>
              </tr>
            )}
            {gridRows.map((gridRow, rowIndex) => (
              <tr
                key={String(gridRow.id)}
                className="border-b border-edge/50 last:border-b-0 hover:bg-panel-raised/40"
              >
                <td className="px-2 py-0 text-right font-mono text-[0.72rem] text-faint">
                  {pageStart + rowIndex + 1}
                </td>
                {columns.map((column, columnIndex) => {
                  const editing = edit?.rowIndex === rowIndex && edit?.columnIndex === columnIndex;
                  const value = gridRow.cells[columnIndex];
                  // A generated column is computed by SQLite, so writing to it
                  // is refused by the engine and would surface as a bare
                  // constraint error in the alert above the grid.
                  const readonly = !editable || column.generated;
                  return (
                    <td key={column.name} className="border-l border-edge/50 p-0">
                      {editing ? (
                        <input
                          autoFocus
                          defaultValue={value ?? ""}
                          spellCheck={false}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              event.currentTarget.blur();
                            } else if (event.key === "Escape") {
                              event.preventDefault();
                              cancelRef.current = true;
                              event.currentTarget.blur();
                            }
                          }}
                          onBlur={(event) => {
                            if (cancelRef.current) {
                              cancelRef.current = false;
                              setEdit(null);
                              return;
                            }
                            commitCell(rowIndex, columnIndex, event.currentTarget.value);
                            setEdit(null);
                          }}
                          className="w-full bg-background px-3 py-1 font-mono text-[0.82rem] text-foreground outline-none ring-2 ring-inset ring-accent-strong"
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => !readonly && setEdit({ rowIndex, columnIndex })}
                          disabled={readonly}
                          title={readonly && column.generated ? "Generated column" : undefined}
                          className={`block w-full px-3 py-1 text-left font-mono text-[0.82rem] ${
                            readonly
                              ? "cursor-default bg-panel/50 text-muted"
                              : "cursor-text text-foreground/90"
                          }`}
                        >
                          {value === null ? (
                            <span className="text-[0.75rem] italic text-faint/70">null</span>
                          ) : value === "" ? (
                            <span className="text-faint/50">&nbsp;</span>
                          ) : (
                            value
                          )}
                        </button>
                      )}
                    </td>
                  );
                })}
                {editable && (
                  <td className="border-l border-edge/50 p-0 text-right">
                    <button
                      type="button"
                      onClick={() => setPendingDelete(gridRow)}
                      disabled={busy}
                      className="cursor-pointer px-2 py-1 text-[0.72rem] text-amber transition-colors hover:bg-amber/20 disabled:opacity-40"
                    >
                      Delete
                    </button>
                  </td>
                )}
              </tr>
            ))}

            {editable && draft && (
              <tr ref={draftRowRef} className="bg-accent-strong/5">
                <td className="px-2 py-0 text-right font-mono text-[0.72rem] text-accent">+</td>
                {columns.map((column, columnIndex) => (
                  <td key={column.name} className="border-l border-edge/50 p-0">
                    <input
                      value={draft[columnIndex] ?? ""}
                      onChange={(event) =>
                        setDraft((current) =>
                          current
                            ? current.map((value, index) =>
                                index === columnIndex ? event.target.value : value,
                              )
                            : current,
                        )
                      }
                      placeholder={column.defaultValue ?? "null"}
                      spellCheck={false}
                      aria-label={`Value for ${column.name}`}
                      onKeyDown={(event) => {
                        // Enter commits the new row, Escape throws it away.
                        if (event.key === "Enter") {
                          event.preventDefault();
                          event.currentTarget.blur();
                        } else if (event.key === "Escape") {
                          event.preventDefault();
                          setDraft(null);
                        }
                      }}
                      onBlur={() => {
                        // Defer so the next focus target is settled, then insert
                        // only when focus has truly left the new row.
                        window.setTimeout(() => {
                          const row = draftRowRef.current;
                          if (!row || !row.contains(document.activeElement)) {
                            commitDraft();
                          }
                        }, 0);
                      }}
                      className="w-full bg-background px-3 py-1 font-mono text-[0.82rem] text-foreground placeholder:italic placeholder:text-faint outline-none ring-2 ring-inset ring-accent-strong/40 focus:ring-accent-strong"
                    />
                  </td>
                ))}
                <td className="border-l border-edge/50 p-0" />
              </tr>
            )}

            {editable && !draft && (
              <tr>
                <td colSpan={columns.length + 2} className="p-0">
                  <button
                    type="button"
                    onClick={() => setDraft(columns.map(() => null))}
                    className="w-full cursor-pointer px-3 py-2 text-left text-[0.82rem] text-faint transition-colors hover:bg-panel-raised/60 hover:text-foreground"
                  >
                    + Insert row
                  </button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[0.78rem] text-faint">
        <span>
          {totalRows === null || totalRows === 0
            ? " "
            : `Showing ${(pageStart + 1).toLocaleString()}–${Math.min(
                pageStart + gridRows.length,
                totalRows,
              ).toLocaleString()} of ${totalRows.toLocaleString()}`}
        </span>
        {pageCount !== null && pageCount > 1 && (
          <div className="flex items-center gap-1">
            <PagerButton
              onClick={() => setPage((current) => Math.max(0, current - 1))}
              disabled={page === 0}
            >
              Previous
            </PagerButton>
            <span className="px-2 tabular-nums">
              Page {page + 1} of {pageCount}
            </span>
            <PagerButton
              onClick={() => setPage((current) => current + 1)}
              disabled={pageStart + PAGE_SIZE >= (totalRows ?? 0)}
            >
              Next
            </PagerButton>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete row"
        description="This cannot be undone. The row is removed from the table."
        detail={pendingDelete ? rowLabel(columns, identity, pendingDelete) : undefined}
        confirmLabel="Delete row"
        busy={busy}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}

// rowLabel names the row in the confirmation. The identity value is what the
// DELETE matches on, so showing it is what tells the user which row is about to
// go.
function rowLabel(
  columns: SchemaColumn[],
  identity: TableIdentity | null,
  row: GridRow,
): string {
  if (!identity) {
    return "";
  }
  if (identity.kind === "rowid") {
    return `rowid = ${row.id === null ? "NULL" : String(row.id)}`;
  }
  const index = columns.findIndex((column) => column.name === identity.name);
  const value = index >= 0 ? row.cells[index] : row.id;
  return `${identity.name} = ${value === null ? "NULL" : (value ?? "")}`;
}

function SortableHeader({
  column,
  sortColumn,
  direction,
  onSort,
}: {
  column: SchemaColumn;
  sortColumn: string | null;
  direction: SortDirection;
  onSort: () => void;
}) {
  const active = sortColumn === column.name;
  return (
    <th
      scope="col"
      aria-sort={active ? (direction === "asc" ? "ascending" : "descending") : "none"}
      className="min-w-[9rem] border-b border-l border-edge px-3 py-1.5 align-top"
    >
      <button
        type="button"
        onClick={onSort}
        title={`Sort by ${column.name}`}
        className="group flex w-full cursor-pointer flex-col gap-0.5 text-left"
      >
        <span className="flex items-center gap-1 font-semibold text-foreground">
          {column.name}
          {column.primaryKey && (
            <span
              title="Primary key"
              className="rounded bg-accent-strong/15 px-1 text-[0.65rem] font-semibold uppercase text-accent"
            >
              PK
            </span>
          )}
          {column.generated && (
            <span
              title="Generated column"
              className="rounded bg-violet/15 px-1 text-[0.65rem] font-semibold uppercase text-violet"
            >
              GEN
            </span>
          )}
          <span
            aria-hidden="true"
            className={`text-[0.7rem] transition-opacity ${
              active ? "opacity-100" : "opacity-0 group-hover:opacity-40"
            }`}
          >
            {active && direction === "desc" ? "▼" : "▲"}
          </span>
        </span>
        <span className="font-mono text-[0.7rem] font-normal text-faint">
          {column.type || "ANY"}
          {column.notNull ? " · not null" : ""}
        </span>
      </button>
    </th>
  );
}

// PagerButton is one step control in the grid footer.
function PagerButton({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="cursor-pointer rounded-md px-2.5 py-1 font-semibold text-muted transition-colors hover:bg-panel-raised hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}
