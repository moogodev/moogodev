import { useState } from "react";

interface Sample {
  id: string;
  label: string;
  code: string;
}

// The three request shapes a new user copies first. Keeping them as plain
// strings means the copy button and the rendered block always agree, and there
// is no JSX whitespace to get wrong inside <pre>.
const samples: Sample[] = [
  {
    id: "query",
    label: "Query",
    code: `POST $MOOGO_PROJECT_URL/query
Authorization: Bearer $MOOGO_SECRET_KEY
Content-Type: application/json

{
  "query": "SELECT id, email FROM users WHERE plan = ?",
  "args": ["pro"]
}`,
  },
  {
    id: "exec",
    label: "Exec",
    code: `POST $MOOGO_PROJECT_URL/exec
Authorization: Bearer $MOOGO_SECRET_KEY
Content-Type: application/json

{
  "query": "INSERT INTO users (email) VALUES (?)",
  "args": ["ketut@example.com"]
}`,
  },
  {
    id: "curl",
    label: "cURL",
    code: `curl $MOOGO_PROJECT_URL/query \\
  -H "Authorization: Bearer $MOOGO_SECRET_KEY" \\
  -d '{"query":"SELECT count(*) FROM users"}'`,
  },
];

export function CodeTabs() {
  const [active, setActive] = useState(samples[0].id);
  const [copied, setCopied] = useState(false);

  const current = samples.find((sample) => sample.id === active) ?? samples[0];

  async function copy() {
    try {
      await navigator.clipboard.writeText(current.code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard access can be denied; there is nothing useful to do about it.
    }
  }

  return (
    <div className="relative">
      <div className="overflow-hidden rounded-xl border border-edge bg-panel">
        <div className="flex items-center gap-4 border-b border-edge bg-panel-raised px-3.5 py-3">
          <div className="flex gap-1.5" aria-hidden="true">
            <span className="h-2.5 w-2.5 rounded-full bg-edge-strong" />
            <span className="h-2.5 w-2.5 rounded-full bg-edge-strong" />
            <span className="h-2.5 w-2.5 rounded-full bg-edge-strong" />
          </div>
          <div
            role="tablist"
            aria-label="API examples"
            className="ml-1.5 flex gap-1"
          >
            {samples.map((sample) => (
              <button
                key={sample.id}
                role="tab"
                type="button"
                aria-selected={active === sample.id}
                onClick={() => setActive(sample.id)}
                className={`cursor-pointer rounded-md px-2.5 py-1 text-[0.84rem] ${
                  active === sample.id
                    ? "bg-accent-strong/15 text-accent"
                    : "text-faint hover:text-muted"
                }`}
              >
                {sample.label}
              </button>
            ))}
          </div>
        </div>

        <div className="min-h-[268px] overflow-x-auto px-5 py-4">
          <pre className="font-mono text-[0.82rem] leading-relaxed text-foreground">
            <code>{current.code}</code>
          </pre>
        </div>

        <div className="flex items-center gap-2.5 overflow-hidden border-t border-edge bg-panel-raised px-4 py-2.5 text-[0.79rem] text-faint">
          <span className="h-[7px] w-[7px] flex-none rounded-full bg-accent-strong" />
          <span>Response</span>
          <code className="overflow-hidden text-ellipsis whitespace-nowrap font-mono text-muted">
            {'{"success":true,"rows":[["7c1f…","ketut@example.com"]],"row_count":1}'}
          </code>
        </div>
      </div>

      <button
        type="button"
        onClick={copy}
        className="absolute right-3.5 top-3.5 inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-edge-strong bg-panel/90 px-2.5 py-1.5 text-[0.79rem] text-muted hover:border-hover-edge hover:text-foreground"
      >
        <svg
          viewBox="0 0 20 20"
          aria-hidden="true"
          className="h-3.5 w-3.5 fill-none stroke-current stroke-[1.6]"
        >
          <rect x="7" y="7" width="9" height="9" rx="2" />
          <path d="M13 5.5V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h.5" />
        </svg>
        <span>{copied ? "Copied" : "Copy"}</span>
      </button>
    </div>
  );
}
