import { useCallback, useRef, useState } from "react";
import { api, ApiError, isReadQuery } from "../lib/api";
import type { SQLResponse } from "../lib/api";
import { splitStatements } from "../lib/splitSql";
import { SQL_EXAMPLES, type SqlExample } from "../lib/sqlExamples";
import ConfirmDialog from "./ConfirmDialog";

// One outcome per statement, in the order they ran. A batch stops at the first
// failure, so results carries the successes before the error and the remaining
// statements are counted separately as skipped.
type StatementOutcome =
  | { sql: string; ok: true; read: boolean; response: SQLResponse }
  | { sql: string; ok: false; code: string; message: string; detail?: string };

type Outcome =
  | { kind: "idle" }
  | { kind: "running"; step: number; total: number }
  | { kind: "batch"; results: StatementOutcome[]; skipped: number };

export default function SQLConsole({
  projectId,
  onExecuted,
}: {
  projectId: string;
  onExecuted?: () => void;
}) {
  const [query, setQuery] = useState("");
  const [outcome, setOutcome] = useState<Outcome>({ kind: "idle" });
  const [pendingExample, setPendingExample] = useState<SqlExample | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const statements = splitStatements(query);

  const run = useCallback(async () => {
    const queue = splitStatements(query);
    if (queue.length === 0) {
      return;
    }
    setOutcome({ kind: "running", step: 1, total: queue.length });
    const results: StatementOutcome[] = [];
    let attempted = 0;
    let wrote = false;

    for (const statement of queue) {
      setOutcome({ kind: "running", step: attempted + 1, total: queue.length });
      attempted += 1;
      const read = isReadQuery(statement);
      try {
        const response = read
          ? await api.consoleQuery(projectId, statement)
          : await api.consoleExec(projectId, statement);
        results.push({ sql: statement, ok: true, read, response });
        if (!read) wrote = true;
      } catch (cause) {
        if (cause instanceof ApiError) {
          results.push({
            sql: statement,
            ok: false,
            code: cause.code,
            message: cause.message,
            detail: cause.detail || undefined,
          });
        } else {
          results.push({
            sql: statement,
            ok: false,
            code: "network",
            message: "Could not reach the database.",
          });
        }
        break;
      }
    }

    setOutcome({ kind: "batch", results, skipped: queue.length - attempted });
    // A write or DDL changes the schema, so let the table browser refresh.
    if (wrote) {
      onExecuted?.();
    }
  }, [query, projectId, onExecuted]);

  function onKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Run on Cmd/Ctrl+Enter so a plain Enter still inserts a newline.
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      void run();
    }
  }

  const loadExample = (example: SqlExample) => {
    // Typing and then clicking a card would silently throw the typing away, so
    // a non-empty editor asks first. An empty one just loads.
    if (query.trim()) {
      setPendingExample(example);
      return;
    }
    applyExample(example);
  };

  const applyExample = (example: SqlExample) => {
    setQuery(example.sql);
    setOutcome({ kind: "idle" });
    setPendingExample(null);
    textareaRef.current?.focus();
  };

  const busy = outcome.kind === "running";
  const modeLabel =
    statements.length > 1
      ? `${statements.length} statements · runs in order`
      : isReadQuery(query.trim())
        ? "read · /query"
        : "write · /exec";

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <label htmlFor="sql" className="text-[0.82rem] font-bold uppercase tracking-wider text-faint">
          SQL
        </label>
        <span className="text-[0.78rem] text-faint">{modeLabel}</span>
      </div>

      <textarea
        id="sql"
        ref={textareaRef}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={onKeyDown}
        rows={6}
        spellCheck={false}
        placeholder={"SELECT * FROM users LIMIT 10\n\n-- Several statements at once are fine:\n-- each one runs in order, split on ;"}
        className="w-full resize-y rounded-lg border border-edge-strong bg-background px-3 py-2.5 font-mono text-[0.88rem] leading-relaxed text-foreground placeholder:text-faint focus:border-accent-strong focus:outline-none"
      />

      <div className="mt-2.5 flex items-center gap-2">
        <button
          type="button"
          onClick={() => void run()}
          disabled={busy || statements.length === 0}
          className="cursor-pointer rounded-lg bg-accent-strong px-4 py-2 text-[0.88rem] font-semibold text-accent-ink transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy
            ? outcome.kind === "running" && outcome.total > 1
              ? `Running ${outcome.step}/${outcome.total}…`
              : "Running…"
            : statements.length > 1
              ? `Run ${statements.length} statements`
              : "Run"}
        </button>
        <button
          type="button"
          onClick={() => {
            setQuery("");
            setOutcome({ kind: "idle" });
            textareaRef.current?.focus();
          }}
          className="cursor-pointer rounded-lg border border-edge-strong px-4 py-2 text-[0.88rem] text-muted transition-colors hover:border-hover-edge hover:bg-hover-bg"
        >
          Clear
        </button>
        <span className="ml-auto text-[0.76rem] text-faint">
          Run with <kbd className="rounded bg-panel-raised px-1.5 py-0.5 font-mono text-[0.72rem]">⌘/Ctrl + Enter</kbd>
        </span>
      </div>

      <div className="mt-4">
        <OutcomeView outcome={outcome} />
      </div>

      <section className="mt-8 border-t border-edge pt-5">
        <h2 className="text-[0.82rem] font-bold uppercase tracking-wider text-faint">
          Examples
        </h2>
        <p className="mt-1 text-[0.8rem] text-muted">
          Click an example to load it into the editor — nothing runs until you press Run.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {SQL_EXAMPLES.map((example) => (
            <button
              key={example.id}
              type="button"
              onClick={() => loadExample(example)}
              className="cursor-pointer rounded-lg border border-edge bg-panel p-3 text-left transition-colors hover:border-hover-edge hover:bg-hover-bg"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-[0.86rem] font-semibold text-foreground">
                  {example.title}
                </span>
                <ExampleCategory category={example.category} />
              </div>
              <p className="mt-0.5 text-[0.76rem] text-muted">{example.description}</p>
              <pre className="mt-2 max-h-36 overflow-auto rounded bg-background px-2.5 py-2 text-left font-mono text-[0.72rem] leading-relaxed text-muted">
                {example.sql}
              </pre>
            </button>
          ))}
        </div>
      </section>

      <ConfirmDialog
        open={pendingExample !== null}
        title="Replace the SQL in the editor?"
        description="The text currently in the editor will be replaced with this example."
        detail={pendingExample?.title}
        confirmLabel="Replace"
        tone="accent"
        onConfirm={() => {
          if (pendingExample) applyExample(pendingExample);
        }}
        onCancel={() => setPendingExample(null)}
      />
    </div>
  );
}

function ExampleCategory({ category }: { category: SqlExample["category"] }) {
  const tone =
    category === "Schema"
      ? "text-blue"
      : category === "Read"
        ? "text-accent-strong"
        : category === "Write"
          ? "text-amber"
          : "text-violet";
  return (
    <span className={`shrink-0 rounded bg-panel-raised px-1.5 py-0.5 text-[0.62rem] font-bold uppercase tracking-wide ${tone}`}>
      {category}
    </span>
  );
}

function OutcomeView({ outcome }: { outcome: Outcome }) {
  switch (outcome.kind) {
    case "idle":
      return (
        <p className="py-10 text-center text-[0.88rem] text-faint">
          Results appear here.
        </p>
      );

    case "running":
      return (
        <p className="rounded-lg border border-edge bg-panel px-4 py-6 text-center text-[0.88rem] text-muted">
          Running…
          {outcome.total > 1 && (
            <span className="ml-1 text-faint">
              statement {outcome.step} of {outcome.total}
            </span>
          )}
        </p>
      );

    case "batch":
      return <BatchView results={outcome.results} skipped={outcome.skipped} />;
  }
}

// BatchView renders one block per statement. A single statement renders bare —
// the same picture the console always showed — so the frames only appear when
// there is a sequence to tell apart.
function BatchView({
  results,
  skipped,
}: {
  results: StatementOutcome[];
  skipped: number;
}) {
  const succeeded = results.filter((result) => result.ok).length;
  const failed = results.length - succeeded;
  const framed = results.length > 1 || skipped > 0;

  return (
    <div className="space-y-4">
      {framed && (
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-[0.82rem]">
          <span className="font-semibold text-accent">
            {succeeded} of {results.length + skipped} statement
            {results.length + skipped === 1 ? "" : "s"} succeeded
          </span>
          {failed > 0 && <span className="text-amber">{failed} failed</span>}
          {skipped > 0 && (
            <span className="text-faint">
              {skipped} not run — statements execute one at a time, not in a
              transaction, so those that succeeded stay applied.
            </span>
          )}
        </div>
      )}

      {results.map((result, index) => (
        <div
          key={index}
          className={framed ? "rounded-lg border border-edge bg-panel p-3" : ""}
        >
          {framed && (
            <div className="mb-2 flex items-center gap-2">
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[0.7rem] font-bold ${
                  result.ok ? "bg-accent/15 text-accent" : "bg-amber/15 text-amber"
                }`}
                aria-hidden="true"
              >
                {result.ok ? "✓" : "✗"}
              </span>
              <code className="min-w-0 flex-1 truncate font-mono text-[0.76rem] text-muted">
                {compact(result.sql)}
              </code>
              {result.ok && (
                <span className="shrink-0 text-[0.72rem] text-faint">
                  {result.read
                    ? `${result.response.row_count ?? result.response.rows?.length ?? 0} rows`
                    : `${result.response.rows_affected ?? 0} affected`}
                  {typeof result.response.duration_ms === "number" &&
                    ` · ${result.response.duration_ms} ms`}
                </span>
              )}
            </div>
          )}

          {result.ok ? (
            result.read ? (
              <ResultTable response={result.response} />
            ) : (
              <ExecSummary response={result.response} />
            )
          ) : (
            <div role="alert" className="rounded-lg border border-amber/40 bg-amber/10 px-4 py-3">
              <p className="text-[0.92rem] font-semibold text-amber">{result.message}</p>
              {result.detail && (
                <p className="mt-1 font-mono text-[0.8rem] text-amber/80">{result.detail}</p>
              )}
              {framed && (
                <p className="mt-1 text-[0.75rem] text-amber/70">
                  Statement {index + 1} of {results.length} failed.
                </p>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// compact flattens a statement to one line for the sequence header.
function compact(sql: string): string {
  const flat = sql.replace(/\s+/g, " ").trim();
  return flat.length > 96 ? `${flat.slice(0, 96)}…` : flat;
}

function ResultTable({ response }: { response: SQLResponse }) {
  const columns = response.columns ?? [];
  const rows = response.rows ?? [];

  if (columns.length === 0) {
    return (
      <p className="rounded-lg border border-edge bg-panel px-4 py-3 text-[0.88rem] text-muted">
        No columns returned.
      </p>
    );
  }

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.78rem] text-faint">
        <span>
          {response.row_count ?? rows.length} row{rows.length === 1 ? "" : "s"}
        </span>
        {typeof response.duration_ms === "number" && (
          <span>{response.duration_ms} ms</span>
        )}
        {response.truncated && (
          <span className="text-amber">
            truncated — result cap reached
          </span>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border border-edge">
        <table className="w-full border-collapse text-left text-[0.85rem]">
          <thead className="bg-panel-raised">
            <tr>
              {columns.map((column, index) => (
                <th
                  key={index}
                  scope="col"
                  className="whitespace-nowrap border-b border-edge px-3 py-2 font-semibold text-foreground"
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-3 py-4 text-center text-muted"
                >
                  No rows.
                </td>
              </tr>
            ) : (
              /* Rows are separated by the zebra striping rather than by a rule
                 under every cell. A grid of bordered cells draws a lattice that
                 is heavier than the data it contains. */
              rows.map((row, rowIndex) => (
                <tr key={rowIndex} className="odd:bg-panel even:bg-background">
                  {row.map((cell, cellIndex) => (
                    <td
                      key={cellIndex}
                      className="whitespace-nowrap px-3 py-1.5 font-mono text-[0.82rem] text-muted"
                    >
                      {renderCell(cell)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ExecSummary({ response }: { response: SQLResponse }) {
  return (
    <div className="rounded-lg border border-edge bg-panel px-4 py-3 text-[0.9rem] text-muted">
      <span className="font-semibold text-accent">
        {response.rows_affected ?? 0}
      </span>{" "}
      row{(response.rows_affected ?? 0) === 1 ? "" : "s"} affected
      {typeof response.duration_ms === "number" && (
        <span className="ml-3 text-[0.82rem] text-faint">
          {response.duration_ms} ms
        </span>
      )}
      {typeof response.size_bytes === "number" && (
        <span className="ml-3 text-[0.82rem] text-faint">
          db {formatSize(response.size_bytes)}
        </span>
      )}
    </div>
  );
}

function renderCell(value: unknown): string {
  if (value === null || value === undefined) {
    return "NULL";
  }
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${Math.round(bytes / 1024)} KB`;
}
