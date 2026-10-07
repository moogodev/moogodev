// SQL_EXAMPLES is the shelf of runnable snippets under the editor.
//
// Everything here is a statement the server's sanitizer actually accepts —
// no triggers, no transactions, no file functions, only allowlisted pragmas —
// so loading one and pressing Run cannot fail on policy. The two-table example
// is deliberately multi-statement: it is the shape people paste in from a
// tutorial, and the console now runs it as a sequence.
export interface SqlExample {
  id: string;
  title: string;
  category: "Schema" | "Read" | "Write" | "Inspect";
  description: string;
  sql: string;
}

export const SQL_EXAMPLES: SqlExample[] = [
  {
    id: "create-table",
    title: "Create a table",
    category: "Schema",
    description: "A new table with an auto-incrementing primary key.",
    sql: `CREATE TABLE "jobs" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "title" TEXT NOT NULL,
  "company" TEXT NOT NULL
);`,
  },
  {
    id: "relation",
    title: "Two tables, one relation",
    category: "Schema",
    description: "A child table pointing at its parent — runs as two statements.",
    sql: `-- Table parent
CREATE TABLE "jobs" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "title" TEXT NOT NULL,
  "company" TEXT NOT NULL
);

-- Table child (one-to-many to jobs)
CREATE TABLE "jobdesks" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "job_id" INTEGER NOT NULL,
  "description" TEXT NOT NULL,
  FOREIGN KEY ("job_id") REFERENCES "jobs" ("id") ON DELETE CASCADE
);`,
  },
  {
    id: "select",
    title: "Query rows",
    category: "Read",
    description: "Filter, order and cap the result set.",
    sql: `SELECT id, title, company
FROM jobs
WHERE company LIKE '% Ltd%'
ORDER BY id DESC
LIMIT 20;`,
  },
  {
    id: "join",
    title: "Join two tables",
    category: "Read",
    description: "Parent rows with their children, one row per relation.",
    sql: `SELECT jobs.title, jobdesks.description
FROM jobs
JOIN jobdesks ON jobdesks.job_id = jobs.id
ORDER BY jobs.id;`,
  },
  {
    id: "insert",
    title: "Insert rows",
    category: "Write",
    description: "Several rows in one statement.",
    sql: `INSERT INTO jobs (title, company) VALUES
  ('Backend Engineer', 'Acme'),
  ('Data Analyst', 'Globex'),
  ('Site Reliability Engineer', 'Initech');`,
  },
  {
    id: "update",
    title: "Update rows",
    category: "Write",
    description: "Change the rows a WHERE clause selects.",
    sql: `UPDATE jobs
SET company = 'Initech'
WHERE company = 'Globex';`,
  },
  {
    id: "delete",
    title: "Delete rows",
    category: "Write",
    description: "Remove matching rows; the child table's ON DELETE CASCADE follows.",
    sql: `DELETE FROM jobs
WHERE id = 1;`,
  },
  {
    id: "alter",
    title: "Add a column",
    category: "Schema",
    description: "Extend an existing table without recreating it.",
    sql: `ALTER TABLE jobs
ADD COLUMN location TEXT DEFAULT 'Remote';`,
  },
  {
    id: "index",
    title: "Index a column",
    category: "Schema",
    description: "Keep WHERE and JOIN fast as the table grows.",
    sql: `CREATE INDEX idx_jobs_company
ON jobs (company);`,
  },
  {
    id: "inspect",
    title: "Inspect the schema",
    category: "Inspect",
    description: "Column definitions and every table SQLite holds.",
    sql: `PRAGMA table_info(jobs);

SELECT name, sql
FROM sqlite_master
WHERE type = 'table';`,
  },
];
