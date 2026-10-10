import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import {
  buildDropTable,
  buildRenameTable,
  columnInfo,
  countRowsFor,
  foreignKeyList,
  indexColumns,
  indexList,
  listSchema,
  quoteIdent,
  readTableTraits,
} from "../lib/sqlbuilder";
import type { SchemaObject } from "../lib/sqlbuilder";
import CreateTableModal from "./CreateTableModal";
import ConfirmDialog from "./ConfirmDialog";
import TableDataGrid from "./TableDataGrid";
import TableStructure from "./TableStructure";
import {
  parseColumns,
  parseCounts,
  parseForeignKeys,
  parseIndexes,
  parseSchemaObjects,
  pickIdentity,
} from "./tableSchema";
import type { ForeignKey, SchemaColumn, TableIndex } from "./tableSchema";

type Pane = "rows" | "structure" | "sql";

interface LoadState {
  objects: SchemaObject[];
  counts: Record<string, number>;
}

// TableBrowser is the project's Tables tab: a list of everything in the SQLite
// file on the left, and the selected table read from that same file on the
// right.
//
// It reads the catalog rather than keeping its own picture of the schema. Every
// table, view, index and trigger comes from one sqlite_master read, and each
// table's columns come from PRAGMA table_xinfo, so what is on screen is what
// the file actually contains rather than what this component last wrote.
export default function TableBrowser({
  projectId,
  refreshKey,
}: {
  projectId: string;
  // Bumped after a write from elsewhere in the tab so the catalog re-reads.
  refreshKey: number;
}) {
  const [state, setState] = useState<LoadState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [builderOpen, setBuilderOpen] = useState(false);
  const [tableFilter, setTableFilter] = useState("");
  const [localRefresh, setLocalRefresh] = useState(0);
  // Bumped after any write so the table detail re-reads its own schema too.
  const [detailRefresh, setDetailRefresh] = useState(0);
  // Focus mode: the one open table takes the whole viewport and the schema
  // sidebar steps out of the way, so a wide table has room to be read and edited.
  const [focused, setFocused] = useState(false);

  // Escape leaves focus mode. It is the way out a keyboard user expects from a
  // mode that covers the page, and it costs one listener while focused.
  //
  // A dialog opened from inside the panel -- the full-value viewer -- handles
  // Escape itself, and the listener here would close both at once. Checking for
  // an open dialog is what keeps Escape meaning "dismiss the topmost thing"
  // rather than "dismiss everything on the way out".
  useEffect(() => {
    if (!focused) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (document.querySelector('[role="dialog"]')) return;
      setFocused(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [focused]);

  // The page behind the panel must not scroll under it, or a wheel gesture over
  // the table moves the dashboard out from under the overlay.
  useEffect(() => {
    if (!focused) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [focused]);

  // The open table lives in the query string ("?table=todo") and is derived
  // from it rather than stored: a reload keeps it open, the view is linkable,
  // and a back or forward step moves the selection with it.
  const selected = searchParams.get("table");

  // replace: a table click is a view change, not a step the back button
  // should have to undo.
  const selectTable = useCallback(
    (name: string | null) => {
      const next = new URLSearchParams(searchParams);
      if (name === null) next.delete("table");
      else next.set("table", name);
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const load = useCallback(async () => {
    setError(null);
    try {
      const schemaResponse = await api.consoleQuery(projectId, listSchema());
      const objects = parseSchemaObjects(schemaResponse);

      // Row counts come from one UNION ALL rather than one COUNT(*) per table.
      // They are allowed to be slow or to fail: the sidebar is still correct
      // without them, so a failure here leaves the names and nothing else.
      const tableNames = objects
        .filter((object) => object.type === "table")
        .map((object) => object.name);
      const countStatement = countRowsFor(tableNames);
      let counts: Record<string, number> = {};
      if (countStatement) {
        try {
          counts = parseCounts(await api.consoleQuery(projectId, countStatement));
        } catch {
          counts = {};
        }
      }

      setState({ objects, counts });
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Could not list the schema.");
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load, refreshKey, localRefresh]);

  const handleChanged = useCallback(() => {
    setLocalRefresh((current) => current + 1);
    setDetailRefresh((current) => current + 1);
  }, []);

  const handleCreated = useCallback(
    (table: string) => {
      setBuilderOpen(false);
      selectTable(table);
      handleChanged();
    },
    [handleChanged, selectTable],
  );

  const tables = useMemo(
    () => (state?.objects ?? []).filter((object) => object.type === "table"),
    [state],
  );
  const views = useMemo(
    () => (state?.objects ?? []).filter((object) => object.type === "view"),
    [state],
  );

  // Derived, not stored: a DROP that removes the table cannot leave a stale
  // detail pane behind.
  const activeObject =
    state?.objects.find(
      (object) =>
        object.name === selected &&
        (object.type === "table" || object.type === "view"),
    ) ?? null;

  const filter = tableFilter.trim().toLowerCase();
  const matches = (name: string) => name.toLowerCase().includes(filter);

  return (
    <div>
      {/* The two classes are swapped rather than the sidebar being unmounted:
          the detail pane has to keep its page, its sort and its in-flight cell
          edit across the switch, and re-mounting it would read the schema again.
          The aside is hidden rather than removed for the same reason -- a React
          tree that keeps the same elements in the same order keeps their state. */}
      <div className={focused ? "block" : "grid gap-5 lg:grid-cols-[228px_1fr]"}>
        <aside className={focused ? "hidden" : "min-w-0"}>
          <div className="rounded-lg border border-edge bg-panel">
            <div className="flex items-center justify-between gap-2 border-b border-edge px-3 py-2">
              <h2 className="text-[0.82rem] font-bold uppercase tracking-wider text-faint">
                Schema
              </h2>
              <button
                type="button"
                onClick={() => setBuilderOpen(true)}
                className="cursor-pointer rounded-md bg-accent-strong px-2 py-1 text-[0.75rem] font-semibold text-accent-ink transition-colors hover:bg-accent"
              >
                + New table
              </button>
            </div>

            {(tables.length > 0 || views.length > 0) && (
              <div className="border-b border-edge p-2">
                <input
                  type="search"
                  value={tableFilter}
                  onChange={(event) => setTableFilter(event.target.value)}
                  placeholder="Filter"
                  aria-label="Filter tables and views"
                  className="w-full cursor-text rounded-md bg-background px-2.5 py-1.5 text-[0.82rem] text-foreground placeholder:text-faint focus:outline-none focus:ring-1 focus:ring-accent-strong"
                />
              </div>
            )}

            <nav aria-label="Tables and views" className="max-h-[52vh] overflow-y-auto p-1.5">
              {error && (
                <p role="alert" className="m-1.5 rounded-md border border-amber/40 bg-amber/10 px-2.5 py-2 text-[0.8rem] text-amber">
                  {error}
                </p>
              )}

              {!error && !state && (
                <p className="px-2 py-3 text-center text-[0.82rem] text-muted">Loading…</p>
              )}

              {!error && state && tables.length === 0 && views.length === 0 && (
                <div className="px-2 py-4 text-center">
                  <p className="text-[0.82rem] text-faint">No tables yet.</p>
                  <button
                    type="button"
                    onClick={() => setBuilderOpen(true)}
                    className="mt-2 cursor-pointer text-[0.82rem] font-semibold text-accent-strong hover:underline"
                  >
                    Create the first one
                  </button>
                </div>
              )}

              <SidebarGroup
                label="Tables"
                count={tables.length}
                hidden={tables.filter((object) => matches(object.name)).length}
              >
                {tables
                  .filter((object) => matches(object.name))
                  .map((object) => (
                    <SidebarItem
                      key={object.name}
                      object={object}
                      active={object.name === activeObject?.name}
                      count={state?.counts[object.name]}
                      onSelect={() => selectTable(object.name)}
                    />
                  ))}
              </SidebarGroup>

              <SidebarGroup
                label="Views"
                count={views.length}
                hidden={views.filter((object) => matches(object.name)).length}
              >
                {views
                  .filter((object) => matches(object.name))
                  .map((object) => (
                    <SidebarItem
                      key={object.name}
                      object={object}
                      active={object.name === activeObject?.name}
                      onSelect={() => selectTable(object.name)}
                    />
                  ))}
              </SidebarGroup>
            </nav>
          </div>
        </aside>

        {/* In focus mode this section becomes the viewport. It covers the app
            header too, because the point is that nothing else competes with the
            grid -- the way back out is the collapse icon and Escape. */}
        <section
          className={
            focused
              ? "fixed inset-0 z-40 overflow-y-auto bg-background p-4 lg:p-6"
              : "min-w-0"
          }
        >
          {activeObject ? (
            <TableDetail
              key={activeObject.name}
              projectId={projectId}
              object={activeObject}
              siblings={state?.objects ?? []}
              refreshKey={detailRefresh}
              focused={focused}
              onToggleFocus={() => setFocused((current) => !current)}
              onChanged={handleChanged}
              onGone={() => {
                // The table the panel was showing is gone, so there is nothing
                // left to be full screen about.
                setFocused(false);
                selectTable(null);
                handleChanged();
              }}
              onRenamed={(name) => {
                selectTable(name);
                handleChanged();
              }}
              onReload={() => setLocalRefresh((current) => current + 1)}
            />
          ) : (
            <div className="rounded-lg border border-dashed border-edge-strong px-6 py-16 text-center">
              <p className="text-[0.9rem] font-semibold text-foreground">
                {tables.length === 0 && views.length === 0
                  ? "This database has no tables yet"
                  : "Select a table to read it"}
              </p>
              <p className="mx-auto mt-1 max-w-[34em] text-[0.85rem] text-muted">
                {tables.length === 0 && views.length === 0
                  ? "Create one to start storing rows. The file itself is a single SQLite database."
                  : "Its rows, its columns, its indexes and the SQL SQLite stored for it are all read from the file."}
              </p>
              {tables.length === 0 && (
                <button
                  type="button"
                  onClick={() => setBuilderOpen(true)}
                  className="mt-5 cursor-pointer rounded-lg bg-accent-strong px-4 py-2 text-sm font-semibold text-accent-ink transition-colors hover:bg-accent"
                >
                  New table
                </button>
              )}
            </div>
          )}
        </section>
      </div>

      <CreateTableModal
        isOpen={builderOpen}
        onClose={() => setBuilderOpen(false)}
        projectId={projectId}
        onCreated={handleCreated}
      />
    </div>
  );
}

// SidebarGroup is one labelled run of schema objects. The heading is dropped
// when a filter has hidden everything it would contain, so the list does not
// show an empty "Views (0)" above a blank space.
function SidebarGroup({
  label,
  count,
  hidden,
  children,
}: {
  label: string;
  count: number;
  hidden: number;
  children: React.ReactNode;
}) {
  if (count === 0 || hidden === 0) {
    return null;
  }
  return (
    <div className="mb-1.5 last:mb-0">
      <p className="px-2 pb-1 pt-1.5 text-[0.7rem] font-bold uppercase tracking-wider text-faint">
        {label} ({count})
      </p>
      <ul className="flex flex-col">{children}</ul>
    </div>
  );
}

function SidebarItem({
  object,
  active,
  count,
  onSelect,
}: {
  object: SchemaObject;
  active: boolean;
  // Undefined when the count query could not run. The name is still worth
  // showing, so the row renders without a number rather than not at all.
  count?: number;
  onSelect: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-current={active ? "page" : undefined}
        className={`flex w-full cursor-pointer items-center gap-2 rounded-md border-l-2 py-1.5 pl-2.5 pr-2 text-left font-mono text-[0.82rem] transition-colors ${
          active
            ? "border-accent-strong bg-panel-raised font-semibold text-foreground"
            : "border-transparent text-muted hover:bg-panel-raised/60 hover:text-foreground"
        }`}
      >
        <span className="min-w-0 flex-1 truncate">{object.name}</span>
        {object.type === "view" ? (
          <span className="shrink-0 text-[0.68rem] font-semibold uppercase text-violet">
            view
          </span>
        ) : count !== undefined ? (
          <span className="shrink-0 text-[0.7rem] tabular-nums text-faint">
            {count.toLocaleString()}
          </span>
        ) : null}
      </button>
    </li>
  );
}

function TableDetail({
  projectId,
  object,
  siblings,
  refreshKey,
  focused,
  onToggleFocus,
  onChanged,
  onGone,
  onRenamed,
  onReload,
}: {
  projectId: string;
  object: SchemaObject;
  // The rest of the catalog, so the SQL tab can show the triggers and indexes
  // that belong to this table without another read.
  siblings: SchemaObject[];
  refreshKey: number;
  /** Focus mode is on: the pane is the viewport and the grid may use all of it. */
  focused: boolean;
  onToggleFocus: () => void;
  onChanged: () => void;
  /** The object is gone, so nothing should stay selected. */
  onGone: () => void;
  /** The object still exists under a new name. */
  onRenamed: (name: string) => void;
  /** The user asked for a fresh read, so the sidebar counts re-read too. */
  onReload: () => void;
}) {
  const [pane, setPane] = useState<Pane>("rows");
  // Bumped by the Reload button: the grid re-reads its rows while the schema
  // stays untouched, so there is no "Reading …" flash over the detail pane.
  const [rowsRefresh, setRowsRefresh] = useState(0);
  const [columns, setColumns] = useState<SchemaColumn[]>([]);
  const [indexes, setIndexes] = useState<TableIndex[]>([]);
  const [foreignKeys, setForeignKeys] = useState<ForeignKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [renamingTable, setRenamingTable] = useState(false);
  const [tableNameDraft, setTableNameDraft] = useState(object.name);
  const [pendingDropTable, setPendingDropTable] = useState(false);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  // A table name can hold characters that are awkward in an element id, so the
  // tab group is identified by a generated prefix instead.
  const tabGroupId = useId();

  const isView = object.type === "view";
  const traits = readTableTraits(object.sql);
  const triggers = siblings.filter(
    (sibling) => sibling.type === "trigger" && sibling.table === object.name,
  );

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const columnResponse = await api.consoleQuery(projectId, columnInfo(object.name));
        if (cancelled) return;
        setColumns(parseColumns(columnResponse));

        // Indexes, index columns and foreign keys are read only for a table.
        // A view has none of them, and asking anyway would return empty sets
        // that look like a table with no indexes.
        if (isView) {
          setIndexes([]);
          setForeignKeys([]);
          return;
        }

        const [indexListResponse, foreignKeyResponse] = await Promise.all([
          api.consoleQuery(projectId, indexList(object.name)),
          api.consoleQuery(projectId, foreignKeyList(object.name)),
        ]);
        if (cancelled) return;

        // Each index needs its own PRAGMA index_info: SQLite has no joined form
        // of the two, so the column lists are fetched by name and matched back.
        const indexRows = indexListResponse?.rows ?? [];
        const indexColumnsMap: Record<string, string[]> = {};
        await Promise.all(
          indexRows.map(async (row) => {
            const name = String(row[1]);
            try {
              const infoResponse = await api.consoleQuery(projectId, indexColumns(name));
              indexColumnsMap[name] = (infoResponse?.rows ?? []).map((info) =>
                info[2] === null || info[2] === undefined ? "" : String(info[2]),
              );
            } catch {
              indexColumnsMap[name] = [];
            }
          }),
        );
        if (cancelled) return;

        setIndexes(parseIndexes(indexListResponse, indexColumnsMap));
        setForeignKeys(parseForeignKeys(foreignKeyResponse));
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof ApiError ? cause.message : "Could not read the schema.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [projectId, object.name, isView, refreshKey]);

  // The grid can only write to a row it can name. A single-column primary key
  // is the clean case; otherwise the implicit rowid does the job, except on a
  // WITHOUT ROWID table where there is none.
  const identity = useMemo(
    () => (isView ? null : pickIdentity(columns, !traits.withoutRowid)),
    [columns, isView, traits.withoutRowid],
  );

  const runStatement = useCallback(
    async (statement: string, after?: () => void) => {
      setBusy(true);
      setActionError(null);
      try {
        await api.consoleExec(projectId, statement);
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

  const submitRenameTable = () => {
    const next = tableNameDraft.trim();
    const statement = buildRenameTable(object.name, next);
    if (!statement) return;
    void runStatement(statement, () => {
      setRenamingTable(false);
      // The pane is keyed on the name, so it has to be rebuilt under the new
      // one. Selecting it again keeps the user on the table they just renamed
      // instead of dropping them back to the empty state.
      onRenamed(next);
    });
  };

  const tabs: { id: Pane; label: string }[] = [
    ...(isView ? [] : [{ id: "rows" as Pane, label: "Rows" }]),
    { id: "structure", label: "Structure" },
    { id: "sql", label: "SQL" },
  ];
  const activeTab = tabs.some((tab) => tab.id === pane) ? pane : tabs[0].id;

  // onTabKeyDown moves between tabs with the arrow keys, which is what the tab
  // pattern expects: Tab moves out of the tab list, arrows move within it.
  function onTabKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const step = event.key === "ArrowRight" ? 1 : -1;
    const nextIndex = (index + step + tabs.length) % tabs.length;
    const next = tabs[nextIndex];
    setPane(next.id);
    // Focus follows the selection, so the arrow key does not have to be pressed
    // twice to land on the tab it just moved to.
    tabRefs.current[nextIndex]?.focus();
  }

  if (loading) {
    return (
      <div className="rounded-lg border border-edge bg-panel px-4 py-10 text-center text-[0.88rem] text-muted">
        Reading {object.name}…
      </div>
    );
  }

  if (error) {
    return (
      <p
        role="alert"
        className="rounded-lg border border-amber/40 bg-amber/10 px-4 py-4 text-[0.9rem] text-amber"
      >
        {error}
      </p>
    );
  }

  return (
    <div>
      <header className="mb-4">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          {renamingTable ? (
            <>
              <input
                value={tableNameDraft}
                onChange={(event) => setTableNameDraft(event.target.value)}
                spellCheck={false}
                aria-label="New table name"
                className="rounded-md border border-edge-strong bg-background px-2 py-1 font-mono text-[0.95rem] text-foreground focus:border-accent-strong focus:outline-none"
              />
              <button
                type="button"
                onClick={submitRenameTable}
                disabled={busy || !tableNameDraft.trim()}
                className="cursor-pointer rounded-md bg-accent-strong px-2.5 py-1 text-[0.78rem] font-semibold text-accent-ink transition-colors hover:bg-accent disabled:opacity-50"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => {
                  setRenamingTable(false);
                  setTableNameDraft(object.name);
                }}
                className="cursor-pointer rounded-md border border-edge-strong px-2.5 py-1 text-[0.78rem] text-muted transition-colors hover:border-hover-edge hover:bg-hover-bg"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <h2 className="font-mono text-[1.05rem] font-semibold text-foreground">
                {object.name}
              </h2>
              {isView && <Badge tone="violet">View</Badge>}
              {traits.strict && <Badge tone="blue">Strict</Badge>}
              {traits.withoutRowid && <Badge tone="amber">No rowid</Badge>}
              <button
                type="button"
                onClick={() => {
                  setRenamingTable(true);
                  setTableNameDraft(object.name);
                }}
                className="cursor-pointer rounded-md px-2 py-1 text-[0.78rem] text-muted transition-colors hover:bg-hover-bg hover:text-foreground"
              >
                Rename
              </button>
              <button
                type="button"
                onClick={() => setPendingDropTable(true)}
                disabled={busy}
                className="cursor-pointer rounded-md px-2 py-1 text-[0.78rem] text-amber transition-colors hover:bg-amber/20 disabled:opacity-50"
              >
                Drop {isView ? "view" : "table"}
              </button>
            </>
          )}
        </div>

        <p className="mt-1 text-[0.8rem] text-faint">
          {isView
            ? "A view is a stored query. It has no rows of its own and cannot be edited."
            : `${columns.length} column${columns.length === 1 ? "" : "s"}, ${
                indexes.length
              } index${indexes.length === 1 ? "" : "es"}, ${
                foreignKeys.length
              } foreign key${foreignKeys.length === 1 ? "" : "s"}`}
        </p>
      </header>

      <div className="mb-4 flex items-end gap-1 border-b border-edge">
        <div role="tablist" aria-label={`Views of ${object.name}`} className="flex gap-1">
          {tabs.map((tab, index) => (
            <button
              key={tab.id}
              ref={(element) => {
                tabRefs.current[index] = element;
              }}
              role="tab"
              id={`${tabGroupId}-tab-${tab.id}`}
              aria-selected={tab.id === activeTab}
              aria-controls={`${tabGroupId}-panel-${tab.id}`}
              tabIndex={tab.id === activeTab ? 0 : -1}
              onClick={() => setPane(tab.id)}
              onKeyDown={(event) => onTabKeyDown(event, index)}
              className={`-mb-px cursor-pointer border-b-2 px-3 py-2 text-[0.85rem] font-semibold transition-colors ${
                tab.id === activeTab
                  ? "border-accent-strong text-foreground"
                  : "border-transparent text-muted hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {/* The controls sit in their own group so the Reload button keeps the
            right-hand end of the tab bar for every object, view or table. */}
        <div className="-mb-px ml-auto flex items-end">
          {!isView && (
            <button
              type="button"
              onClick={() => {
                setRowsRefresh((current) => current + 1);
                onReload();
              }}
              title="Re-read the rows and the row counts from the database"
              className="cursor-pointer border-b-2 border-transparent px-3 py-2 text-[0.85rem] font-semibold text-muted transition-colors hover:text-foreground"
            >
              Reload
            </button>
          )}
          <button
            type="button"
            onClick={onToggleFocus}
            title={focused ? "Leave focus mode (Esc)" : "Show this table on its own, full screen"}
            aria-pressed={focused}
            aria-label={focused ? "Leave focus mode" : "Focus this table full screen"}
            className={`cursor-pointer border-b-2 px-2.5 py-2 transition-colors ${
              focused
                ? "border-accent-strong text-foreground"
                : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            <FocusIcon expanded={focused} />
          </button>
        </div>
      </div>

      {actionError && (
        <p
          role="alert"
          className="mb-3 rounded-lg border border-amber/40 bg-amber/10 px-3 py-2 text-[0.85rem] text-amber"
        >
          {actionError}
        </p>
      )}

      <div
        role="tabpanel"
        id={`${tabGroupId}-panel-${activeTab}`}
        aria-labelledby={`${tabGroupId}-tab-${activeTab}`}
      >
        {activeTab === "rows" ? (
          <TableDataGrid
            projectId={projectId}
            table={object.name}
            columns={columns}
            identity={identity}
            refreshKey={refreshKey + rowsRefresh}
            // Focus mode is the only place the grid is allowed to grow past the
            // reading pane's share of the window.
            tall={focused}
            onChanged={onChanged}
          />
        ) : activeTab === "structure" ? (
          <TableStructure
            table={object.name}
            columns={columns}
            indexes={indexes}
            foreignKeys={foreignKeys}
            triggers={triggers.map((trigger) => ({ name: trigger.name, sql: trigger.sql }))}
            readOnly={isView}
            busy={busy}
            runStatement={(statement, after) => runStatement(statement, after)}
          />
        ) : (
          <SqlPane object={object} indexes={indexes} triggers={triggers} />
        )}
      </div>

      <ConfirmDialog
        open={pendingDropTable}
        title={isView ? "Drop view" : "Drop table"}
        description={
          isView
            ? "The stored query is removed. No data is affected, because a view holds none."
            : "Every row in the table is deleted along with its indexes and triggers. This cannot be undone."
        }
        detail={quoteIdent(object.name)}
        confirmLabel={isView ? "Drop view" : "Drop table"}
        busy={busy}
        onConfirm={() => {
          setPendingDropTable(false);
          void runStatement(buildDropTable(object.name), onGone);
        }}
        onCancel={() => setPendingDropTable(false)}
      />
    </div>
  );
}

// FocusIcon is the four-corner bracket, pointing out when the table is about to
// take the screen and in when it is about to give it back. Two glyphs rather
// than one with a rotation, because the reading differs.
function FocusIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {expanded ? (
        <>
          <path d="M7.5 3.5h-4v4M12.5 3.5h4v4M12.5 16.5h4v-4M7.5 16.5h-4v-4" />
        </>
      ) : (
        <>
          <path d="M3.5 7.5h4v-4M16.5 7.5h-4v-4M16.5 12.5h-4v4M3.5 12.5h4v4" />
        </>
      )}
    </svg>
  );
}

// SqlPane shows the SQL SQLite itself holds for the object.
//
// This is the stored text, not a reconstruction: a table created elsewhere
// keeps the exact CREATE statement it was created with, comments and all. It is
// what makes a disagreement between the viewer and the file traceable.
function SqlPane({
  object,
  indexes,
  triggers,
}: {
  object: SchemaObject;
  indexes: TableIndex[];
  triggers: SchemaObject[];
}) {
  const statements: { label: string; sql: string }[] = [];

  if (object.sql) {
    statements.push({ label: object.type === "view" ? "CREATE VIEW" : "CREATE TABLE", sql: object.sql });
  }

  const ownIndexes = indexes.filter((index) => index.origin === "c");
  if (ownIndexes.length > 0) {
    statements.push({
      label: `Indexes (${ownIndexes.length})`,
      sql: ownIndexes
        .map(
          (index) =>
            `${index.unique ? "CREATE UNIQUE INDEX" : "CREATE INDEX"} ${quoteIdent(index.name)} ON ${quoteIdent(object.name)} (${index.columns
              .map(quoteIdent)
              .join(", ")});`,
        )
        .join("\n"),
    });
  } else if (indexes.length > 0) {
    statements.push({
      label: "Indexes",
      sql: `${indexes.length} index${indexes.length === 1 ? "" : "es"} exist for this table, ${
        ownIndexes.length === 0 ? "all" : "some"
      } created by its UNIQUE and PRIMARY KEY constraints rather than by CREATE INDEX.`,
    });
  }

  for (const trigger of triggers) {
    if (trigger.sql) {
      statements.push({ label: trigger.name, sql: trigger.sql });
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-[0.8rem] text-faint">
        The text SQLite recorded when this {object.type === "view" ? "view" : "table"} was
        created. Editing it here is not possible; run a statement in the SQL Editor tab
        beside this one.
      </p>
      {statements.length === 0 ? (
        <p className="rounded-lg border border-dashed border-edge-strong px-3 py-6 text-center text-[0.85rem] text-faint">
          SQLite holds no SQL for this {object.type}.
        </p>
      ) : (
        statements.map((statement) => (
          <section key={statement.label}>
            <h3 className="mb-1.5 text-[0.78rem] font-bold uppercase tracking-wider text-faint">
              {statement.label}
            </h3>
            <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg border border-edge bg-background px-3 py-2.5 font-mono text-[0.8rem] text-muted">
              {statement.sql}
            </pre>
          </section>
        ))
      )}
    </div>
  );
}

// Badge is one fact about a table, set beside its name. It is a badge because it
// is a property rather than a status: there is no good or bad to it.
function Badge({ tone, children }: { tone: "violet" | "blue" | "amber"; children: React.ReactNode }) {
  const tones = {
    violet: "bg-violet/15 text-violet",
    blue: "bg-blue/15 text-blue",
    amber: "bg-amber/15 text-amber",
  };
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[0.7rem] font-semibold uppercase ${tones[tone]}`}
    >
      {children}
    </span>
  );
}
