import type { SQLResponse } from "../lib/api";
import type { SchemaObject } from "../lib/sqlbuilder";

// Schema reading. Kept in its own module because three panes need the same
// interpretation of SQLite's catalog output, and they had each grown their own.

export interface SchemaColumn {
  name: string;
  type: string;
  notNull: boolean;
  defaultValue: string | null;
  primaryKey: boolean;
  // table_xinfo reports generated columns in its last field: 0 for an ordinary
  // column, 1 for a virtual table's hidden column, 2 for a VIRTUAL generated
  // column and 3 for a STORED one. Both generated kinds are computed by SQLite
  // and refuse writes, so the grid marks them rather than letting the user
  // discover it through a constraint error.
  generated: boolean;
  hidden: boolean;
}

// TableIdentity is what a WHERE clause can name a single row by.
export type TableIdentity = { kind: "column" | "rowid"; name: string };

// parseColumns reads PRAGMA table_xinfo output, whose columns are positional:
// cid, name, type, notnull, dflt_value, pk, hidden.
export function parseColumns(response: SQLResponse | null): SchemaColumn[] {
  return (response?.rows ?? []).map((row) => {
    const hidden = Number(row[6]) || 0;
    return {
      name: String(row[1]),
      type: String(row[2] ?? ""),
      notNull: Number(row[3]) === 1,
      defaultValue: row[4] === null || row[4] === undefined ? null : String(row[4]),
      primaryKey: Number(row[5]) > 0,
      // 2 and 3 are the generated kinds. 1 belongs to virtual tables, which
      // this project does not create, but it is hidden either way.
      generated: hidden === 2 || hidden === 3,
      hidden: hidden !== 0,
    };
  });
}

// pickIdentity decides how a row can be addressed.
//
// A single-column primary key is the clean answer. Failing that the implicit
// rowid works, except on a WITHOUT ROWID table where it does not exist — the
// caller passes hasRowid so that case reports no identity at all instead of
// generating a WHERE clause that fails on every edit.
//
// A composite primary key is also passed over: it is two columns, so one is not
// enough to name a row, and the rowid is the honest fallback when there is one.
export function pickIdentity(
  columns: SchemaColumn[],
  hasRowid: boolean,
): TableIdentity | null {
  const keys = columns.filter((column) => column.primaryKey);
  if (keys.length === 1) {
    return { kind: "column", name: keys[0].name };
  }
  if (hasRowid) {
    return { kind: "rowid", name: "rowid" };
  }
  return null;
}

export interface TableIndex {
  name: string;
  unique: boolean;
  // "c" a CREATE INDEX, "u" a UNIQUE constraint, "pk" the primary key. Only
  // "c" can be dropped on its own; the other two belong to the table's own
  // definition and go away with the constraint that made them.
  origin: string;
  partial: boolean;
  columns: string[];
}

// INDEX_ORIGIN_LABEL names the three origins in words.
export const INDEX_ORIGIN_LABEL: Record<string, string> = {
  c: "CREATE INDEX",
  u: "UNIQUE constraint",
  pk: "PRIMARY KEY",
};

// parseIndexes pairs PRAGMA index_list output with each index's columns from
// PRAGMA index_info.
//
// The two are separate pragmas because SQLite has no join form for them, so
// this walks the index names it was given. A name whose column list is missing
// is left with an empty one rather than dropped: an index shown without its
// columns is still better than an index that silently disappeared.
export function parseIndexes(
  listResponse: SQLResponse | null,
  columnResponses: Record<string, string[]>,
): TableIndex[] {
  return (listResponse?.rows ?? []).map((row) => {
    const name = String(row[1]);
    const origin = String(row[3] ?? "c");
    return {
      name,
      unique: Number(row[2]) === 1,
      origin,
      partial: Number(row[4]) === 1,
      columns: (columnResponses[name] ?? []).map(
        // index_info reports a null name when the index covers the rowid
        // rather than a named column, which is what an implicit index on a
        // WITHOUT ROWID table looks like.
        (column) => (column === "" ? "(rowid)" : column),
      ),
    };
  });
}

export interface ForeignKey {
  id: string;
  columns: string[];
  referencesTable: string;
  referencesColumns: string[];
  onUpdate: string;
  onDelete: string;
}

// parseForeignKeys reads PRAGMA foreign_key_list output, whose columns are
// positional: id, seq, table, from, to, on_update, on_delete, match.
//
// A composite key arrives as several rows sharing one id, one per column pair,
// so rows are grouped by id rather than shown one per row. The "to" column is
// null when the key relies on the referenced table's primary key, which reads
// better as the implicit reference it is.
export function parseForeignKeys(response: SQLResponse | null): ForeignKey[] {
  const grouped = new Map<string, ForeignKey>();

  for (const row of response?.rows ?? []) {
    const id = String(row[0]);
    const from = String(row[3]);
    const to = row[4] === null || row[4] === undefined ? "" : String(row[4]);
    const existing = grouped.get(id);

    if (existing) {
      existing.columns.push(from);
      existing.referencesColumns.push(to);
      continue;
    }

    grouped.set(id, {
      id,
      columns: [from],
      referencesTable: String(row[2]),
      referencesColumns: [to],
      onUpdate: String(row[5] ?? "NO ACTION"),
      onDelete: String(row[6] ?? "NO ACTION"),
    });
  }

  return [...grouped.values()];
}

// parseSchemaObjects reads listSchema output into typed objects.
export function parseSchemaObjects(response: SQLResponse | null): SchemaObject[] {
  return (response?.rows ?? []).map((row) => ({
    type: String(row[1]) as SchemaObject["type"],
    name: String(row[0]),
    table: String(row[2] ?? ""),
    sql: row[3] === null || row[3] === undefined ? null : String(row[3]),
  }));
}

// parseCounts reads countRowsFor output into a name-to-count map.
export function parseCounts(response: SQLResponse | null): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const row of response?.rows ?? []) {
    const total = Number(row[1]);
    counts[String(row[0])] = Number.isFinite(total) ? total : 0;
  }
  return counts;
}
