// Builders for the SQLite-style table editor.
//
// The dashboard lets a developer assemble DDL through a form instead of typing
// it. That means the identifiers and literals they supply end up in a SQL
// string, so every one is quoted here rather than concatenated raw. A project
// owner can already run any statement through /exec, so this is about avoiding
// accidents (a space in a column name, an apostrophe in a default) rather than
// defending against the owner.

// The column types offered in the builder. SQLite uses dynamic typing, so
// these are affinities rather than strict types.
export const COLUMN_TYPES = [
  "INTEGER",
  "REAL",
  "TEXT",
  "BLOB",
  "NUMERIC",
  "BOOLEAN",
  "DATE",
  "DATETIME",
  "VARCHAR(255)",
  "DECIMAL(10,5)",
] as const;

export interface ColumnDraft {
  id: number;
  name: string;
  type: string;
  primaryKey: boolean;
  autoIncrement: boolean;
  notNull: boolean;
  defaultValue: string;
}

export function newColumnDraft(id: number): ColumnDraft {
  return {
    id,
    name: "",
    type: "TEXT",
    primaryKey: false,
    autoIncrement: false,
    notNull: false,
    defaultValue: "",
  };
}

// quoteIdent wraps an identifier in double quotes, doubling any embedded
// quote. This is what makes a name like `order items` or `we"ird` safe.
export function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

// A default value is either a keyword, a number, or a literal. Anything else
// is treated as a string and quoted, so `CURRENT_TIMESTAMP` stays a keyword
// while `hello world` becomes a string.
const DEFAULT_KEYWORDS = new Set([
  "NULL",
  "CURRENT_TIMESTAMP",
  "CURRENT_DATE",
  "CURRENT_TIME",
  "TRUE",
  "FALSE",
]);

function formatDefault(raw: string): string {
  const upper = raw.toUpperCase();
  if (DEFAULT_KEYWORDS.has(upper)) {
    return upper;
  }
  if (/^[+-]?(\d+\.?\d*|\.\d+)$/.test(raw)) {
    return raw;
  }
  if (raw.startsWith("'") && raw.endsWith("'") && raw.length >= 2) {
    // The developer already wrote a quoted literal; leave it alone.
    return raw;
  }
  return `'${raw.replace(/'/g, "''")}'`;
}

function columnDefinition(column: ColumnDraft): string {
  const parts = [quoteIdent(column.name.trim())];

  // SQLite only accepts AUTOINCREMENT on an INTEGER PRIMARY KEY, and spelling
  // it that way forces the type regardless of what the form selected.
  if (column.primaryKey && column.autoIncrement) {
    parts.push("INTEGER PRIMARY KEY AUTOINCREMENT");
  } else {
    parts.push(column.type);
    if (column.primaryKey) {
      parts.push("PRIMARY KEY");
    }
  }

  // NOT NULL is redundant on the rowid alias, and SQLite rejects it in some
  // positions when combined with AUTOINCREMENT.
  if (column.notNull && !(column.primaryKey && column.autoIncrement)) {
    parts.push("NOT NULL");
  }

  const defaultValue = column.defaultValue.trim();
  if (defaultValue) {
    parts.push(`DEFAULT ${formatDefault(defaultValue)}`);
  }

  return parts.join(" ");
}

// buildCreateTable renders a single CREATE TABLE statement. It returns null
// when the form does not yet describe a usable table, so the caller can keep
// the button disabled instead of sending invalid SQL.
export function buildCreateTable(
  table: string,
  columns: ColumnDraft[],
): string | null {
  const name = table.trim();
  if (!name) {
    return null;
  }

  const usable = columns.filter((column) => column.name.trim());
  if (usable.length === 0) {
    return null;
  }

  const definitions = usable.map(columnDefinition);
  return `CREATE TABLE ${quoteIdent(name)} (\n  ${definitions.join(",\n  ")}\n);`;
}

// buildAddColumn renders ALTER TABLE ... ADD COLUMN. SQLite cannot add a
// PRIMARY KEY or AUTOINCREMENT column after the fact, so those flags are not
// offered here.
export function buildAddColumn(
  table: string,
  column: ColumnDraft,
): string | null {
  if (!column.name.trim()) {
    return null;
  }
  return `ALTER TABLE ${quoteIdent(table)} ADD COLUMN ${columnDefinition({
    ...column,
    primaryKey: false,
    autoIncrement: false,
  })};`;
}

export function buildDropTable(table: string): string {
  return `DROP TABLE ${quoteIdent(table)};`;
}

export function buildRenameTable(table: string, next: string): string | null {
  if (!next.trim()) {
    return null;
  }
  return `ALTER TABLE ${quoteIdent(table)} RENAME TO ${quoteIdent(next.trim())};`;
}

export function buildRenameColumn(
  table: string,
  column: string,
  next: string,
): string | null {
  if (!next.trim()) {
    return null;
  }
  return `ALTER TABLE ${quoteIdent(table)} RENAME COLUMN ${quoteIdent(column)} TO ${quoteIdent(next.trim())};`;
}

export function buildDropColumn(table: string, column: string): string {
  return `ALTER TABLE ${quoteIdent(table)} DROP COLUMN ${quoteIdent(column)};`;
}

// --- Indexes ------------------------------------------------------------

// buildCreateIndex renders CREATE INDEX for the structure pane.
export function buildCreateIndex(
  index: string,
  table: string,
  columns: string[],
  unique: boolean,
): string | null {
  const name = index.trim();
  if (!name) {
    return null;
  }
  const usable = columns.filter((column) => column.trim());
  if (usable.length === 0) {
    return null;
  }
  const prefix = unique ? "CREATE UNIQUE INDEX" : "CREATE INDEX";
  return `${prefix} ${quoteIdent(name)} ON ${quoteIdent(table)} (${usable
    .map((column) => quoteIdent(column.trim()))
    .join(", ")});`;
}

export function buildDropIndex(index: string): string {
  return `DROP INDEX ${quoteIdent(index)};`;
}

// --- Table traits read back from the stored DDL -------------------------

export interface TableTraits {
  // A WITHOUT ROWID table has no implicit row counter, which changes how the
  // grid identifies rows and is worth stating on screen rather than leaving the
  // user to wonder why editing is unavailable.
  withoutRowid: boolean;
  // STRICT rejects a value that does not fit the column's declared type. It
  // changes what an edit can do, so it belongs next to the other facts.
  strict: boolean;
}

// readTableTraits pulls the two table options SQLite records in the DDL.
//
// These are read out of the CREATE statement because there is no PRAGMA that
// reports them: PRAGMA table_list would, but the console's sanitizer does not
// allow that pragma. SQLite writes the options after the closing parenthesis,
// so only the tail is inspected and a column named "strict" cannot be mistaken
// for the option.
export function readTableTraits(ddl: string | null): TableTraits {
  if (!ddl) {
    return { withoutRowid: false, strict: false };
  }
  const close = ddl.lastIndexOf(")");
  const tail = close >= 0 ? ddl.slice(close) : "";
  return {
    withoutRowid: /\bWITHOUT\s+ROWID\b/i.test(tail),
    strict: /\bSTRICT\b/i.test(tail),
  };
}

// --- Schema introspection ----------------------------------------------
//
// A SQLite viewer is mostly introspection. Everything below reads the file's
// own catalog rather than guessing: sqlite_master holds the DDL SQLite stored
// at CREATE time, and the PRAGMA family reports what SQLite made of it.

export type SchemaObjectType = "table" | "view" | "index" | "trigger";

export interface SchemaObject {
  type: SchemaObjectType;
  name: string;
  table: string;
  /** The exact DDL SQLite recorded, or null for an implicit index. */
  sql: string | null;
}

// SCHEMA_NAME_ALIAS and SCHEMA_TYPE_ALIAS name the two columns listSchema
// projects its results onto. The aliases are quoted and namespaced so they
// cannot collide with a column named the same thing.
const SCHEMA_NAME_ALIAS = "__moogo_name__";
const SCHEMA_TYPE_ALIAS = "__moogo_type__";
const SCHEMA_TABLE_ALIAS = "__moogo_table__";
const SCHEMA_SQL_ALIAS = "__moogo_sql__";

// listSchema reads the whole catalog in one statement: every table, view, index
// and trigger with the DDL behind it.
//
// PRAGMA table_list would be the tidier way to ask this, but the console's
// sanitizer allowlist does not include it, so sqlite_master is the one source
// that answers every question at once. Ordering puts tables first because that
// is what the sidebar is for; views follow, then the objects that belong to a
// table rather than standing on their own.
export function listSchema(): string {
  return (
    `SELECT name AS ${quoteIdent(SCHEMA_NAME_ALIAS)},` +
    ` type AS ${quoteIdent(SCHEMA_TYPE_ALIAS)},` +
    ` tbl_name AS ${quoteIdent(SCHEMA_TABLE_ALIAS)},` +
    ` sql AS ${quoteIdent(SCHEMA_SQL_ALIAS)}` +
    " FROM sqlite_master" +
    " WHERE name NOT LIKE 'sqlite_%'" +
    " ORDER BY CASE type" +
    " WHEN 'table' THEN 0" +
    " WHEN 'view' THEN 1" +
    " WHEN 'index' THEN 2" +
    " ELSE 3 END, name;"
  );
}

export const SCHEMA_ALIASES = {
  name: SCHEMA_NAME_ALIAS,
  type: SCHEMA_TYPE_ALIAS,
  table: SCHEMA_TABLE_ALIAS,
  sql: SCHEMA_SQL_ALIAS,
} as const;

// columnInfo lists a table's columns.
//
// table_xinfo is used rather than table_info because it adds the `hidden`
// column, which is what separates an ordinary column from a generated one
// (VIRTUAL or STORED) or a virtual table's hidden column. Dropping that
// distinction would let the grid offer to edit a column it cannot write to.
//
// Returns: cid, name, type, notnull, dflt_value, pk, hidden.
export function columnInfo(table: string): string {
  return `PRAGMA table_xinfo(${quoteIdent(table)});`;
}

// indexList lists a table's indexes.
//
// Returns: seq, name, unique, origin, partial. `origin` says where the index
// came from: "c" CREATE INDEX, "u" a UNIQUE constraint, "pk" the primary key.
// The last two are owned by the table's definition, so the viewer offers to
// drop only the ones it can actually drop.
export function indexList(table: string): string {
  return `PRAGMA index_list(${quoteIdent(table)});`;
}

// indexColumns lists the columns making up one index.
//
// Returns: seqno, cid, name. name is null for the rowid column backing an
// implicit index, which is exactly the case worth showing as "(rowid)".
export function indexColumns(index: string): string {
  return `PRAGMA index_info(${quoteIdent(index)});`;
}

// foreignKeyList lists a table's foreign keys.
//
// Returns: id, seq, table, from, to, on_update, on_delete, match. `to` is null
// when the key points at the referenced table's primary key implicitly.
export function foreignKeyList(table: string): string {
  return `PRAGMA foreign_key_list(${quoteIdent(table)});`;
}

// COUNTS_NAME_ALIAS and COUNTS_COUNT_ALIAS name the columns countRowsFor
// returns, one row per table.
const COUNTS_NAME_ALIAS = "__moogo_counted__";
const COUNTS_COUNT_ALIAS = "__moogo_count__";

export const COUNTS_ALIASES = {
  name: COUNTS_NAME_ALIAS,
  count: COUNTS_COUNT_ALIAS,
} as const;

// quoteLiteral wraps a value in single quotes as a SQL string literal.
//
// This exists because double quotes cannot be used for the job: SQLite reads
// "users" as a column reference, not the text users, so a literal has to be
// single-quoted.
export function quoteLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

// countRowsFor counts several tables in one round trip.
//
// The sidebar wants a row count beside every table, and one COUNT(*) query per
// table would be one query per table. A UNION ALL of counts is still a single
// statement, so it passes the console's one-statement-per-request rule while
// costing a single round trip.
//
// It returns null when there is nothing to count, because an empty UNION is a
// syntax error rather than an empty result.
export function countRowsFor(tables: string[]): string | null {
  if (tables.length === 0) {
    return null;
  }
  const parts = tables.map(
    (table) =>
      `SELECT ${quoteLiteral(table)} AS ${quoteIdent(COUNTS_NAME_ALIAS)},` +
      ` COUNT(*) AS ${quoteIdent(COUNTS_COUNT_ALIAS)} FROM ${quoteIdent(table)}`,
  );
  return `${parts.join(" UNION ALL ")};`;
}

// --- Row editing (the Browse grid) -------------------------------------
//
// Values are always bound as ? parameters rather than pasted into the SQL, so
// a value that contains a quote, a semicolon, or the word DROP is just data.

export function buildInsert(table: string, columns: string[]): string {
  const names = columns.map(quoteIdent).join(", ");
  const placeholders = columns.map(() => "?").join(", ");
  return `INSERT INTO ${quoteIdent(table)} (${names}) VALUES (${placeholders});`;
}

// buildUpdate needs the column that identifies the row: the primary key when
// there is exactly one, otherwise the implicit rowid.
export function buildUpdate(
  table: string,
  columns: string[],
  identity: string,
): string {
  const assignments = columns.map((column) => `${quoteIdent(column)} = ?`).join(", ");
  return `UPDATE ${quoteIdent(table)} SET ${assignments} WHERE ${quoteIdent(identity)} = ?;`;
}

export function buildDelete(table: string, identity: string): string {
  return `DELETE FROM ${quoteIdent(table)} WHERE ${quoteIdent(identity)} = ?;`;
}

// selectRows lists a table for the grid. When the table has no single-column
// primary key the implicit rowid is selected first and used to identify rows.
// The alias is quoted so it can never collide with a real column.
export const ROWID_ALIAS = "__moogo_rowid__";

export type SortDirection = "asc" | "desc";

export interface RowPage {
  table: string;
  identifyByRowid: boolean;
  limit: number;
  offset?: number;
  // A column name, or ROWID_ALIAS to sort by the row counter.
  sortColumn?: string | null;
  sortDirection?: SortDirection;
}

// selectRows builds the page query.
//
// Sorting goes through the SQL rather than through the array already in hand,
// because the grid only ever holds one page: sorting a page of twenty-five rows
// client-side would order those twenty-five rows and quietly ignore the rest of
// the table. ORDER BY also accepts the rowid alias, so a table with no primary
// key can still be ordered by insertion.
//
// NULLs are left where SQLite puts them (first ascending, last descending)
// rather than pushed to the end, so the order matches what the same query
// returns in the SQL editor beside this tab.
export function selectRows(page: RowPage): string {
  const prefix = page.identifyByRowid
    ? `SELECT rowid AS ${quoteIdent(ROWID_ALIAS)}, * FROM ${quoteIdent(page.table)}`
    : `SELECT * FROM ${quoteIdent(page.table)}`;

  const clauses: string[] = [];
  if (page.sortColumn) {
    clauses.push(
      `ORDER BY ${quoteIdent(page.sortColumn)} ${page.sortDirection === "desc" ? "DESC" : "ASC"}`,
    );
  }

  // LIMIT is always emitted; OFFSET is omitted on the first page rather than
  // written as OFFSET 0, so the common case stays a plain LIMIT.
  const limit = `LIMIT ${page.limit}`;
  if (page.offset && page.offset > 0) {
    clauses.push(`${limit} OFFSET ${page.offset}`);
  } else {
    clauses.push(limit);
  }

  return `${prefix} ${clauses.join(" ")};`;
}

// countRows returns the total row count for a table.
//
// It is a separate query from the page of rows because SQLite will not report a
// count alongside a LIMIT-ed result, and a page that says "1-100 of ?" is worse
// than no total at all.
export function countRows(table: string): string {
  return `SELECT COUNT(*) AS ${quoteIdent("__moogo_count__")} FROM ${quoteIdent(table)};`;
}

// ROW_COUNT_ALIAS is the column countRows aliases its result to.
export const ROW_COUNT_ALIAS = "__moogo_count__";

// toArgument converts what the user typed into the value sent to the server.
// An empty field means NULL, a numeric column parses to a number, and anything
// else is sent as text. The server binds it as a prepared-statement argument.
export function toArgument(raw: string, type: string): unknown {
  if (raw === "") {
    return null;
  }
  const affinity = type.toUpperCase();
  if (/INT|REAL|NUMERIC|DECIMAL|DOUBLE|FLOAT|BOOL/.test(affinity)) {
    const parsed = Number(raw);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  return raw;
}
