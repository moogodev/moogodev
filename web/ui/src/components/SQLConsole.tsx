import { useCallback, useRef, useState } from "react";
import { api, ApiError, isReadQuery } from "../lib/api";
import type { SQLResponse } from "../lib/api";

type Outcome =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "result"; response: SQLResponse; read: boolean }
  | { kind: "error"; message: string; code: string; detail?: string };

export default function SQLConsole({
  projectId,
  onExecuted,
}: {
  projectId: string;
  onExecuted?: () => void;
}) {
  const [query, setQuery] = useState("");
  const [outcome, setOutcome] = useState<Outcome>({ kind: "idle" });
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const run = useCallback(async () => {
    const statement = query.trim();
    if (!statement) {
      return;
    }
    setOutcome({ kind: "running" });
    const read = isReadQuery(statement);
    try {
      const response = read
        ? await api.consoleQuery(projectId, statement)
        : await api.consoleExec(projectId, statement);
      setOutcome({ kind: "result", response, read });
      // A write or DDL changes the schema, so let the table browser refresh.
      if (!read) {
        onExecuted?.();
      }
    } catch (cause) {
      if (cause instanceof ApiError) {
        setOutcome({
          kind: "error",
          message: cause.message,
          code: cause.code,
          detail: cause.detail || undefined,
        });
      } else {
        setOutcome({
          kind: "error",
          message: "Could not reach the database.",
          code: "network",
        });
      }
    }
  }, [query, projectId, onExecuted]);

  function onKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Run on Cmd/Ctrl+Enter so a plain Enter still inserts a newline.
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      void run();
    }
  }

  const busy = outcome.kind === "running";

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <label htmlFor="sql" className="text-[0.82rem] font-bold uppercase tracking-wider text-faint">
          SQL
        </label>
        <span className="text-[0.78rem] text-faint">
          {isReadQuery(query.trim()) ? "read · /query" : "write · /exec"}
        </span>
      </div>

      <textarea
        id="sql"
        ref={textareaRef}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={onKeyDown}
        rows={6}
        spellCheck={false}
        placeholder="SELECT * FROM users LIMIT 10"
        className="w-full resize-y rounded-lg border border-edge-strong bg-background px-3 py-2.5 font-mono text-[0.88rem] leading-relaxed text-foreground placeholder:text-faint focus:border-accent-strong focus:outline-none"
      />

      <div className="mt-2.5 flex items-center gap-2">
        <button
          type="button"
          onClick={() => void run()}
          disabled={busy || !query.trim()}
          className="cursor-pointer rounded-lg bg-accent-strong px-4 py-2 text-[0.88rem] font-semibold text-accent-ink transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "Running…" : "Run"}
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
    </div>
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
        </p>
      );

    case "error":
      return (
        <div role="alert" className="rounded-lg border border-amber/40 bg-amber/10 px-4 py-3">
          <p className="text-[0.92rem] font-semibold text-amber">
            {outcome.message}
          </p>
          {outcome.detail && (
            <p className="mt-1 font-mono text-[0.8rem] text-amber/80">
              {outcome.detail}
            </p>
          )}
        </div>
      );

    case "result":
      if (outcome.read) {
        return <ResultTable response={outcome.response} />;
      }
      return <ExecSummary response={outcome.response} />;
  }
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
