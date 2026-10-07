import { useEffect, useMemo, useRef, useState } from "react";
import { api, ApiError } from "../lib/api";
import { columnInfo, foreignKeyList, listSchema } from "../lib/sqlbuilder";
import { parseColumns, parseForeignKeys, parseSchemaObjects } from "./tableSchema";
import type { ForeignKey, SchemaColumn } from "./tableSchema";

// SchemaVisualizer is the read-only map of a project's schema: every table and
// view as a card, every foreign key as a line between the two cards it joins.
//
// It reads the catalog the same way the Tables tab does — one sqlite_master
// read for the object list, then PRAGMA table_xinfo and PRAGMA foreign_key_list
// per table — so what is on screen is what the SQLite file actually contains,
// not a picture the dashboard invented. There is no write path here by design:
// editing belongs to the Tables tab, and a canvas that could change the schema
// would need the confirmation and the error handling that already live there.
//
// The layout is computed, not negotiated: follow the foreign keys from the
// tables that reference nothing up to the tables that reference them, put each
// generation in its own column, and stack the column. Cycles settle wherever
// the relaxation stops, which is fine — the edges still say who points at whom.
// Cards can be dragged afterwards; positions live in component state and are
// recomputed whenever the schema itself changes.

/** Card width. Fixed because the edge anchors are derived from it. */
const CARD_W = 240;
/** Header height: the card's name row, h-10 in the markup below. */
const HEADER_H = 40;
/** One column row: h-[26px] in the markup below. */
const ROW_H = 26;
/** Top and bottom border of the card, which the anchor maths has to cross. */
const CARD_BORDER = 1;
/** Horizontal gap between layout columns, vertical gap between cards. */
const COL_GAP = 72;
const ROW_GAP = 28;

/**
 * anchorY is the vertical centre of a column row inside a card, in canvas
 * coordinates. The card markup and these constants are a pair: change one
 * without the other and the lines float off the rows they point at.
 *
 * row is null when the target column is not in the card — a foreign key to the
 * implicit rowid, say — and then the line aims at the header instead.
 */
function anchorY(row: number | null): number {
  if (row === null) return CARD_BORDER + HEADER_H / 2;
  return CARD_BORDER + HEADER_H + row * ROW_H + ROW_H / 2;
}

function cardHeight(rows: number): number {
  return CARD_BORDER * 2 + HEADER_H + rows * ROW_H;
}

interface VisualTable {
  name: string;
  kind: "table" | "view";
  columns: SchemaColumn[];
  foreignKeys: ForeignKey[];
}

interface LayoutNode {
  table: VisualTable;
  x: number;
  y: number;
  /** Map from column name to its row index, for edge anchors. */
  rowIndex: Map<string, number>;
}

interface VisualEdge {
  key: string;
  from: string;
  to: string;
  /** Anchor offsets inside each card, fixed once the schema is read. */
  fromY: number;
  toY: number;
  label: string;
}

interface Position {
  x: number;
  y: number;
}

interface Viewport {
  x: number;
  y: number;
  k: number;
}

// computeLayout places every table in a column of its own generation and stacks
// the column. It returns positions only; rendering is a separate step so a drag
// can move one card without asking the layout question again.
function computeLayout(tables: VisualTable[]): LayoutNode[] {
  const names = new Set(tables.map((table) => table.name));
  const layers = new Map<string, number>(tables.map((table) => [table.name, 0]));

  // Longest path from a table with no outgoing foreign key, relaxed until it
  // stops changing. The iteration count caps the growth a reference cycle
  // causes: a cycle simply climbs once per pass and then stops mattering.
  for (let pass = 0; pass <= tables.length; pass++) {
    let changed = false;
    for (const table of tables) {
      if (table.kind === "view") continue;
      for (const foreignKey of table.foreignKeys) {
        if (foreignKey.referencesTable === table.name) continue;
        if (!names.has(foreignKey.referencesTable)) continue;
        const want = (layers.get(foreignKey.referencesTable) ?? 0) + 1;
        if (want > (layers.get(table.name) ?? 0)) {
          layers.set(table.name, want);
          changed = true;
        }
      }
    }
    if (!changed) break;
  }

  // Views stand after every table: they read from tables rather than being
  // referenced by them, and their own layer keeps them from mixing into the
  // dependency columns.
  const highestTable = tables.reduce(
    (highest, table) =>
      table.kind === "table" ? Math.max(highest, layers.get(table.name) ?? 0) : highest,
    0,
  );
  for (const table of tables) {
    if (table.kind === "view") layers.set(table.name, highestTable + 1);
  }

  const columns = new Map<number, VisualTable[]>();
  for (const table of tables) {
    const layer = layers.get(table.name) ?? 0;
    const bucket = columns.get(layer);
    if (bucket) bucket.push(table);
    else columns.set(layer, [table]);
  }

  const nodes: LayoutNode[] = [];
  [...columns.keys()]
    .sort((first, second) => first - second)
    .forEach((layer, columnIndex) => {
      let y = 0;
      for (const table of columns.get(layer) ?? []) {
        const rowIndex = new Map(table.columns.map((column, index) => [column.name, index]));
        nodes.push({ table, x: columnIndex * (CARD_W + COL_GAP), y, rowIndex });
        y += cardHeight(table.columns.length) + ROW_GAP;
      }
    });
  return nodes;
}

// edgeAnchors returns the start and end Y of one foreign key line, in canvas
// coordinates, using the row indexes captured by the layout.
function edgeAnchors(from: LayoutNode, to: LayoutNode, foreignKey: ForeignKey) {
  const sourceColumn = foreignKey.columns[0] ?? "";
  const targetColumn = foreignKey.referencesColumns[0] ?? "";
  return {
    fromY: anchorY(from.rowIndex.get(sourceColumn) ?? null),
    toY: anchorY(to.rowIndex.get(targetColumn) ?? null),
  };
}

// edgeGeometry draws a cubic bezier between two cards' current positions,
// leaving the source card on one side and arriving on the facing side of the
// target. A card pointing at itself would otherwise have both endpoints in the
// same spot, so it loops out to the right instead.
function edgeGeometry(from: Position, to: Position, fromY: number, toY: number) {
  const sy = from.y + fromY;
  const ty = to.y + toY;
  const sameCard = from.x === to.x && from.y === to.y;
  const rightward = sameCard || to.x >= from.x;
  const sx = rightward ? from.x + CARD_W : from.x;
  const tx = rightward ? to.x : to.x + CARD_W;
  const endY = sameCard && Math.abs(ty - sy) < 1 ? ty + 24 : ty;
  const bend = Math.max(56, Math.abs(tx - sx) / 2);
  const c1 = rightward ? sx + bend : sx - bend;
  const c2 = rightward ? tx - bend : tx + bend;
  return {
    path: `M ${sx} ${sy} C ${c1} ${sy}, ${c2} ${endY}, ${tx} ${endY}`,
    labelX: (sx + 3 * c1 + 3 * c2 + tx) / 8,
    labelY: (sy + 3 * sy + 3 * endY + endY) / 8,
  };
}

export default function SchemaVisualizer({
  projectId,
  refreshKey,
}: {
  projectId: string;
  refreshKey: number;
}) {
  const [tables, setTables] = useState<VisualTable[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retries, setRetries] = useState(0);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [positions, setPositions] = useState<Record<string, Position>>({});
  const [viewport, setViewport] = useState<Viewport>({ x: 48, y: 40, k: 1 });

  const canvasRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<
    | { mode: "pan"; startX: number; startY: number; originX: number; originY: number }
    | {
        mode: "card";
        name: string;
        startX: number;
        startY: number;
        originX: number;
        originY: number;
        moved: number;
      }
    | null
  >(null);

  // The schema is read once per mount and re-read whenever the SQL editor
  // says something changed (refreshKey) or the operator retries.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setError(null);
      try {
        const schemaResponse = await api.consoleQuery(projectId, listSchema());
        const objects = parseSchemaObjects(schemaResponse).filter(
          (object) => object.type === "table" || object.type === "view",
        );
        const loaded = await Promise.all(
          objects.map(async (object): Promise<VisualTable> => {
            const columnResponse = await api.consoleQuery(projectId, columnInfo(object.name));
            const columns = parseColumns(columnResponse);
            if (object.type === "view") {
              return { name: object.name, kind: "view", columns, foreignKeys: [] };
            }
            const foreignKeyResponse = await api.consoleQuery(
              projectId,
              foreignKeyList(object.name),
            );
            return {
              name: object.name,
              kind: "table",
              columns,
              foreignKeys: parseForeignKeys(foreignKeyResponse),
            };
          }),
        );
        if (cancelled) return;
        setTables(loaded);
      } catch (cause) {
        if (cancelled) return;
        setTables(null);
        setError(cause instanceof ApiError ? cause.message : "Could not read the schema.");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [projectId, refreshKey, retries]);

  const layout = useMemo(() => computeLayout(tables ?? []), [tables]);

  // A new schema means a new picture: positions, selection and viewport all
  // start over, because the old coordinates were answers about old cards.
  useEffect(() => {
    const next: Record<string, Position> = {};
    for (const node of layout) next[node.table.name] = { x: node.x, y: node.y };
    setPositions(next);
    setSelected(null);
    setViewport({ x: 48, y: 40, k: 1 });
  }, [layout]);

  // World size: big enough for the computed layout plus room to drag around,
  // with a floor so a two-table schema still gets a surface to sit on.
  const worldSize = useMemo(() => {
    let width = 1600;
    let height = 900;
    for (const node of layout) {
      width = Math.max(width, node.x + CARD_W + 800);
      height = Math.max(height, node.y + cardHeight(node.table.columns.length) + 500);
    }
    return { width, height };
  }, [layout]);

  const nodeByName = useMemo(() => {
    const map = new Map<string, LayoutNode>();
    for (const node of layout) map.set(node.table.name, node);
    return map;
  }, [layout]);

  const edges = useMemo(() => {
    const result: VisualEdge[] = [];
    for (const node of layout) {
      for (const foreignKey of node.table.foreignKeys) {
        const target = nodeByName.get(foreignKey.referencesTable);
        if (!target) continue;
        const { fromY, toY } = edgeAnchors(node, target, foreignKey);
        const sourceColumn = foreignKey.columns[0] ?? "";
        const targetColumn = foreignKey.referencesColumns[0] || "rowid";
        result.push({
          key: `${node.table.name}.${sourceColumn}->${foreignKey.referencesTable}.${targetColumn}`,
          from: node.table.name,
          to: foreignKey.referencesTable,
          fromY,
          toY,
          label: `${sourceColumn} → ${targetColumn}`,
        });
      }
    }
    return result;
  }, [layout, nodeByName]);

  // Wheel zoom, anchored at the cursor. The listener is attached directly
  // because React's synthetic wheel cannot prevent the page scroll: the canvas
  // has to swallow the gesture to zoom instead of scrolling past it.
  useEffect(() => {
    const element = canvasRef.current;
    if (!element) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = element.getBoundingClientRect();
      const cursorX = event.clientX - rect.left;
      const cursorY = event.clientY - rect.top;
      setViewport((current) => {
        const next = Math.min(2.4, Math.max(0.3, current.k * Math.exp(-event.deltaY * 0.0015)));
        const factor = next / current.k;
        return {
          k: next,
          x: cursorX - (cursorX - current.x) * factor,
          y: cursorY - (cursorY - current.y) * factor,
        };
      });
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, []);

  const fitToView = () => {
    const element = canvasRef.current;
    if (!element || layout.length === 0) return;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const node of layout) {
      const position = positions[node.table.name] ?? { x: node.x, y: node.y };
      minX = Math.min(minX, position.x);
      minY = Math.min(minY, position.y);
      maxX = Math.max(maxX, position.x + CARD_W);
      maxY = Math.max(maxY, position.y + cardHeight(node.table.columns.length));
    }
    const width = maxX - minX;
    const height = maxY - minY;
    const k = Math.min(
      1.6,
      Math.max(
        0.3,
        Math.min((element.clientWidth - 96) / width, (element.clientHeight - 96) / height),
      ),
    );
    setViewport({
      k,
      x: (element.clientWidth - width * k) / 2 - minX * k,
      y: (element.clientHeight - height * k) / 2 - minY * k,
    });
  };

  const zoomBy = (factor: number) => {
    const element = canvasRef.current;
    const centerX = element ? element.clientWidth / 2 : 0;
    const centerY = element ? element.clientHeight / 2 : 0;
    setViewport((current) => {
      const next = Math.min(2.4, Math.max(0.3, current.k * factor));
      const ratio = next / current.k;
      return {
        k: next,
        x: centerX - (centerX - current.x) * ratio,
        y: centerY - (centerY - current.y) * ratio,
      };
    });
  };

  const resetLayout = () => {
    const next: Record<string, Position> = {};
    for (const node of layout) next[node.table.name] = { x: node.x, y: node.y };
    setPositions(next);
    setSelected(null);
    setViewport({ x: 48, y: 40, k: 1 });
  };

  const beginPan = (event: React.PointerEvent) => {
    canvasRef.current?.setPointerCapture(event.pointerId);
    dragRef.current = {
      mode: "pan",
      startX: event.clientX,
      startY: event.clientY,
      originX: viewport.x,
      originY: viewport.y,
    };
  };

  const beginCardDrag = (event: React.PointerEvent, name: string) => {
    event.stopPropagation();
    const position = positions[name];
    if (!position) return;
    canvasRef.current?.setPointerCapture(event.pointerId);
    dragRef.current = {
      mode: "card",
      name,
      startX: event.clientX,
      startY: event.clientY,
      originX: position.x,
      originY: position.y,
      moved: 0,
    };
  };

  const handlePointerMove = (event: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (drag.mode === "pan") {
      setViewport((current) => ({ ...current, x: drag.originX + dx, y: drag.originY + dy }));
      return;
    }
    drag.moved = Math.max(drag.moved, Math.hypot(dx, dy));
    setPositions((current) => ({
      ...current,
      [drag.name]: { x: drag.originX + dx / viewport.k, y: drag.originY + dy / viewport.k },
    }));
  };

  const handlePointerUp = () => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (drag?.mode === "card" && drag.moved < 4) {
      setSelected((current) => (current === drag.name ? null : drag.name));
    }
  };

  const query = search.trim().toLowerCase();
  const matches = (name: string) => query === "" || name.toLowerCase().includes(query);

  if (error && !tables) {
    return (
      <div className="rounded-xl border border-edge bg-panel px-6 py-12 text-center">
        <p className="text-sm text-muted">{error}</p>
        <button
          type="button"
          onClick={() => setRetries((current) => current + 1)}
          className="mt-4 cursor-pointer rounded-lg border border-edge-strong px-4 py-2 text-sm font-medium text-muted transition-colors hover:border-hover-edge hover:bg-hover-bg hover:text-foreground"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!tables) {
    return (
      <div className="grid h-[420px] place-items-center rounded-xl border border-edge bg-panel">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-accent-strong border-t-transparent" />
      </div>
    );
  }

  if (tables.length === 0) {
    return (
      <div className="grid h-[420px] place-items-center rounded-xl border border-dashed border-edge-strong bg-panel px-6 text-center">
        <div>
          <p className="text-lg font-semibold text-foreground">No tables yet</p>
          <p className="mx-auto mt-1 max-w-[36em] text-sm text-muted">
            Create one from the Tables tab or run a CREATE TABLE in the SQL Editor, and it
            will appear here with its columns and its relations.
          </p>
        </div>
      </div>
    );
  }

  const tableCount = tables.filter((table) => table.kind === "table").length;
  const viewCount = tables.length - tableCount;

  return (
    <div className="overflow-hidden rounded-xl border border-edge bg-panel">
      <div className="flex flex-wrap items-center gap-3 border-b border-edge px-4 py-2.5">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Find a table…"
          aria-label="Find a table"
          className="w-44 rounded-lg border border-edge bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-faint focus:border-accent-strong focus:outline-none"
        />
        <p className="text-[0.78rem] text-faint">
          {tableCount} table{tableCount === 1 ? "" : "s"}
          {viewCount > 0 && ` · ${viewCount} view${viewCount === 1 ? "" : "s"}`}
        </p>
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={() => zoomBy(1 / 1.25)}
            aria-label="Zoom out"
            className="cursor-pointer rounded-md border border-edge-strong px-2.5 py-1 text-sm font-medium text-muted transition-colors hover:border-hover-edge hover:bg-hover-bg hover:text-foreground"
          >
            −
          </button>
          <span className="w-11 text-center font-mono text-[0.72rem] text-faint">
            {Math.round(viewport.k * 100)}%
          </span>
          <button
            type="button"
            onClick={() => zoomBy(1.25)}
            aria-label="Zoom in"
            className="cursor-pointer rounded-md border border-edge-strong px-2.5 py-1 text-sm font-medium text-muted transition-colors hover:border-hover-edge hover:bg-hover-bg hover:text-foreground"
          >
            +
          </button>
          <button
            type="button"
            onClick={fitToView}
            className="ml-1 cursor-pointer rounded-md border border-edge-strong px-2.5 py-1 text-sm font-medium text-muted transition-colors hover:border-hover-edge hover:bg-hover-bg hover:text-foreground"
          >
            Fit
          </button>
          <button
            type="button"
            onClick={resetLayout}
            className="cursor-pointer rounded-md border border-edge-strong px-2.5 py-1 text-sm font-medium text-muted transition-colors hover:border-hover-edge hover:bg-hover-bg hover:text-foreground"
          >
            Reset
          </button>
        </div>
      </div>

      <div
        ref={canvasRef}
        onPointerDown={beginPan}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="relative h-[600px] cursor-grab touch-none select-none overflow-hidden bg-background active:cursor-grabbing"
      >
        <div
          className="absolute left-0 top-0"
          style={{
            width: worldSize.width,
            height: worldSize.height,
            transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.k})`,
            transformOrigin: "0 0",
          }}
        >
          {/* Grid, in the same coordinate space as the cards, so it pans and
              zooms with them instead of sitting still behind the motion. */}
          <div
            aria-hidden="true"
            className="absolute inset-0 opacity-60"
            style={{
              backgroundImage:
                "linear-gradient(var(--color-edge) 1px, transparent 1px), linear-gradient(90deg, var(--color-edge) 1px, transparent 1px)",
              backgroundSize: "40px 40px",
            }}
          />

          <svg
            aria-hidden="true"
            width={worldSize.width}
            height={worldSize.height}
            className="absolute left-0 top-0 overflow-visible"
          >
            {edges.map((edge) => {
              const from = positions[edge.from];
              const to = positions[edge.to];
              if (!from || !to) return null;
              const geometry = edgeGeometry(from, to, edge.fromY, edge.toY);
              const touching =
                selected === null || selected === edge.from || selected === edge.to;
              return (
                <path
                  key={edge.key}
                  d={geometry.path}
                  fill="none"
                  className={
                    selected !== null && touching
                      ? "stroke-accent-strong stroke-2"
                      : "stroke-edge-strong stroke-[1.5]"
                  }
                  opacity={touching ? 1 : 0.3}
                />
              );
            })}
          </svg>

          {/* Relationship labels for the selected table only: a label per line
              at rest turns a diagram into soup the moment two tables join. */}
          {selected !== null &&
            edges
              .filter((edge) => edge.from === selected || edge.to === selected)
              .map((edge) => {
                const from = positions[edge.from];
                const to = positions[edge.to];
                if (!from || !to) return null;
                const geometry = edgeGeometry(from, to, edge.fromY, edge.toY);
                return (
                  <div
                    key={`label-${edge.key}`}
                    className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded bg-accent-strong px-1.5 py-0.5 font-mono text-[0.66rem] font-medium text-accent-ink"
                    style={{ left: geometry.labelX, top: geometry.labelY }}
                  >
                    {edge.label}
                  </div>
                );
              })}

          {layout.map((node) => {
            const name = node.table.name;
            const position = positions[name] ?? { x: node.x, y: node.y };
            const connected =
              selected === null ||
              selected === name ||
              edges.some(
                (edge) =>
                  (edge.from === selected || edge.to === selected) &&
                  (edge.from === name || edge.to === name),
              );
            const dimmed = !matches(name) || !connected;
            const isView = node.table.kind === "view";
            const foreignColumns = new Set(
              node.table.foreignKeys.flatMap((foreignKey) => foreignKey.columns),
            );
            return (
              <div
                key={name}
                onPointerDown={(event) => beginCardDrag(event, name)}
                style={{ left: position.x, top: position.y, width: CARD_W }}
                className={`absolute cursor-grab rounded-lg border bg-panel shadow-sm active:cursor-grabbing ${
                  isView ? "border-dashed border-edge-strong" : "border-edge"
                } ${selected === name ? "ring-2 ring-accent-strong" : ""} ${
                  dimmed ? "opacity-30" : "opacity-100"
                } transition-opacity`}
              >
                <div className="flex h-10 items-center gap-2 border-b border-edge px-3">
                  <span className="min-w-0 flex-1 truncate text-[0.83rem] font-semibold text-foreground">
                    {name}
                  </span>
                  {isView && (
                    <span className="rounded bg-panel-raised px-1.5 py-0.5 text-[0.64rem] font-medium uppercase tracking-wide text-muted">
                      view
                    </span>
                  )}
                  <span className="text-[0.68rem] text-faint">{node.table.columns.length}</span>
                </div>
                <div className="overflow-hidden rounded-b-lg">
                  {node.table.columns.map((column) => (
                    <div key={column.name} className="flex h-[26px] items-center gap-1.5 px-3">
                      {column.primaryKey && (
                        <span className="shrink-0 rounded bg-amber/15 px-1 text-[0.6rem] font-bold text-amber">
                          PK
                        </span>
                      )}
                      {foreignColumns.has(column.name) && (
                        <span className="shrink-0 rounded bg-blue/15 px-1 text-[0.6rem] font-bold text-blue">
                          FK
                        </span>
                      )}
                      <span className="min-w-0 flex-1 truncate text-[0.76rem] text-foreground">
                        {column.name}
                      </span>
                      {column.type && (
                        <span className="shrink-0 font-mono text-[0.64rem] text-faint">
                          {column.type}
                        </span>
                      )}
                    </div>
                  ))}
                  {node.table.columns.length === 0 && (
                    <div className="flex h-[26px] items-center px-3 text-[0.72rem] text-faint">
                      no columns
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {query !== "" && !tables.some((table) => matches(table.name)) && (
          <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center">
            <span className="rounded-lg border border-edge bg-panel px-3 py-1.5 text-sm text-muted">
              No table named “{search.trim()}”
            </span>
          </div>
        )}
      </div>

      <div className="border-t border-edge px-4 py-2 text-[0.75rem] text-faint">
        Drag the background to pan, a card to move it, the wheel to zoom. Click a table to
        highlight its relations. Read-only — schema edits belong to the Tables tab.
      </div>
    </div>
  );
}
