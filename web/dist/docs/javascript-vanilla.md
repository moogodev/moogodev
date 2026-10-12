# JavaScript / TypeScript (Vanilla)

Works in Node 18+, Deno, Bun, Cloudflare Workers, and Vercel Edge. In a browser it
works through a bundler that injects `process.env` — the values have to come from
your build, never from a literal key in client-side code. If you want a guide that
puts the SQL key behind a proxy instead, see [React](/docs/guides/react).

## Setup

```bash
# No package needed — uses fetch (global in Node 18+, Deno, Bun, browsers)
```

**Environment variables** (set in your deployment platform):

| Variable | Description |
|----------|-------------|
| `MOOGO_PROJECT_URL` | `https://api.moogo.dev/p/<project-id>` |
| `MOOGO_SECRET_KEY` | `moogo_...` (SQL auth) |
| `MOOGO_BUCKET_ENDPOINT` | `https://api.moogo.dev/p/<project-id>/bucket` |
| `MOOGO_CDN_URL` | Optional — origin public objects are served from; falls back to the bucket endpoint origin when empty |
| `MOOGO_BUCKET_ACCESS_KEY_ID` | `moogo_ak_...` |
| `MOOGO_BUCKET_SECRET_KEY` | `moogo_sk_...` |

`MOOGO_PROJECT_URL` and `MOOGO_SECRET_KEY` are on **Project → Settings**, shown
once at creation. The three bucket variables come from **Project → Bucket →
Credentials**, where you create a credential — each is shown once too. Copy both
immediately.

## Client (`lib/moogo.ts`)

```ts
// lib/moogo.ts
const PROJECT_URL = process.env.MOOGO_PROJECT_URL!;
const SECRET_KEY = process.env.MOOGO_SECRET_KEY!;
const BUCKET_ENDPOINT = process.env.MOOGO_BUCKET_ENDPOINT!;
const CDN_URL = (process.env.MOOGO_CDN_URL ?? "").replace(/\/+$/, "");
const BUCKET_ACCESS_KEY_ID = process.env.MOOGO_BUCKET_ACCESS_KEY_ID!;
const BUCKET_SECRET_KEY = process.env.MOOGO_BUCKET_SECRET_KEY!;

const SQL_HEADERS = {
  Authorization: `Bearer ${SECRET_KEY}`,
  "Content-Type": "application/json",
};

const STORAGE_HEADERS = {
  "X-Moogo-Access-Key-Id": BUCKET_ACCESS_KEY_ID,
  Authorization: `Bearer ${BUCKET_SECRET_KEY}`,
};

function isRead(sql: string): boolean {
  // `with` covers CTE reads (WITH ... SELECT); a CTE that writes
  // (WITH ... INSERT) must be sent to /exec directly.
  return /^\s*(select|values|pragma|explain|with)\b/i.test(sql.trim());
}

async function handle(res: Response) {
  const body = await res.json();
  if (!res.ok) {
    const err = new Error(body.error?.message ?? "request failed");
    (err as any).code = body.error?.code;
    (err as any).detail = body.error?.detail;
    (err as any).status = res.status;
    throw err;
  }
  return body;
}

// ── SQL ──────────────────────────────────────────────────────────────
export async function query(sql: string, args: any[] = []) {
  const res = await fetch(`${PROJECT_URL}/query`, {
    method: "POST",
    headers: SQL_HEADERS,
    body: JSON.stringify({ query: sql, args }),
  });
  return handle(res);
}

export async function exec(sql: string, args: any[] = []) {
  const res = await fetch(`${PROJECT_URL}/exec`, {
    method: "POST",
    headers: SQL_HEADERS,
    body: JSON.stringify({ query: sql, args }),
  });
  return handle(res);
}

export async function sql(sql: string, args: any[] = []) {
  return isRead(sql) ? query(sql, args) : exec(sql, args);
}

export function toObjects<T>(result: { columns: string[]; rows: any[][] }): T[] {
  return result.rows.map((row) =>
    Object.fromEntries(result.columns.map((col, i) => [col, row[i]]))
  ) as T[];
}

// Slashes are meaningful in a key, so escape each segment and keep them -- the
// server escapes a key the same way when it hands one back.
const encodeKey = (key: string) =>
  key.split("/").map(encodeURIComponent).join("/");

// Public objects are served from the CDN host when MOOGO_CDN_URL is set.
// The public route is /pub/<project-id>/<key> and needs no credential. The
// bucket endpoint is not it: /p/<project-id>/bucket/<key> is the authenticated
// URL, and a browser tab carries no storage credential, so an <img> pointed at
// one breaks for every private object. This serves published objects only --
// before you publish, the response's public_url is an empty string.
function publicBase(): string {
  const base = BUCKET_ENDPOINT.replace(/\/p\/([^/]+)\/bucket\/?$/, "/pub/$1");
  return CDN_URL ? base.replace(/^https?:\/\/[^/]+/, CDN_URL) : base;
}

// ── Bucket (Object Storage) ─────────────────────────────────────────
export async function bucketUpload(
  key: string,
  body: BodyInit,
  contentType: string
) {
  const res = await fetch(`${BUCKET_ENDPOINT}/${encodeKey(key)}`, {
    method: "POST",
    headers: { ...STORAGE_HEADERS, "Content-Type": contentType },
    body,
  });
  return handle(res);
}

export async function bucketDownload(key: string): Promise<Response> {
  return fetch(`${BUCKET_ENDPOINT}/${encodeKey(key)}`, {
    headers: STORAGE_HEADERS,
  });
}

export async function bucketDelete(key: string) {
  const res = await fetch(`${BUCKET_ENDPOINT}/${encodeKey(key)}`, {
    method: "DELETE",
    headers: STORAGE_HEADERS,
  });
  return handle(res);
}

export async function bucketList(prefix?: string) {
  const url = new URL(`${BUCKET_ENDPOINT}`);
  if (prefix) url.searchParams.set("prefix", prefix);
  const res = await fetch(url, { headers: STORAGE_HEADERS });
  return handle(res);
}

// Publish an object so its public URL resolves. Uploads are private by default,
// and public_url stays an empty string until this is called.
export async function bucketPublish(key: string) {
  const res = await fetch(`${BUCKET_ENDPOINT}/${encodeKey(key)}`, {
    method: "PATCH",
    headers: { ...STORAGE_HEADERS, "Content-Type": "application/json" },
    body: JSON.stringify({ is_public: true }),
  });
  return handle(res);
}

// Public download (no auth needed once the object is published)
export function bucketPublicUrl(key: string): string {
  return `${publicBase()}/${encodeKey(key)}`;
}
```

## Usage — SQLite

```ts
import { sql, toObjects } from "./lib/moogo";

// Create table (runs via /exec)
await sql(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    plan TEXT DEFAULT 'free',
    created_at TEXT DEFAULT (datetime('now'))
  )
`);

// Insert (write → /exec)
await sql(
  "INSERT INTO users (id, email, plan) VALUES (?, ?, ?)",
  [crypto.randomUUID(), "ketut@example.com", "pro"]
);

// Query (read → /query)
const users = await toObjects(
  await sql("SELECT id, email, plan FROM users WHERE plan = ?", ["pro"])
);

console.log(users); // [{ id: "...", email: "ketut@example.com", plan: "pro" }, ...]
```

## Usage — Bucket (Object Storage)

```ts
import {
  bucketUpload,
  bucketDownload,
  bucketDelete,
  bucketList,
  bucketPublish,
  bucketPublicUrl,
} from "./lib/moogo";

// Upload a file (private by default)
const file = new File([await fetch("https://example.com/avatar.png").then(r => r.blob())], "avatar.png");
await bucketUpload("avatars/kit.png", file, file.type);

// Download (private — needs auth)
const res = await bucketDownload("avatars/kit.png");
const blob = await res.blob();

// List objects
const { objects } = await bucketList("avatars/");

// Publish, then serve the public URL (published objects need no auth)
await bucketPublish("avatars/kit.png");

const img = document.createElement("img");
img.src = bucketPublicUrl("avatars/kit.png");

// Delete
await bucketDelete("avatars/old.png");
```

## Error handling

```ts
try {
  await sql("SELECT * FROM nonexistent");
} catch (err: any) {
  if (err.code === "sql_error") {
    console.log("SQLite error:", err.detail);
  } else if (err.code === "database_too_large") {
    console.log("Project hit 250 MB limit");
  } else if (err.status === 401) {
    console.log("Invalid or rotated secret key");
  }
  throw err;
}
```

## Production Readiness ⚠️

- **SQL transaksi**: Batas 100 pernyataan per `/transaction` dan budget 15 detik. Jangan gabungkan DDL besar dengan manipulasi data intensif dalam satu transaksi.
- **Batas database**: 250 MB per project. Database tidak menyusut otomatis — hapus baris secara bertahap jika mendekati limit, dan monitor penggunaan harian.
- **Nama kolom sensitif**: beberapa nama (`readfile`, `writefile`, `delete`, `vacuum`, `attach`, `detach`, `reindex`, `analyze`, `pragma`) dilarang digunakan sebagai nama kolom dalam query SQL.
- **Public URL object**: `public_url` bersifat bearer token — tidak bisa direvoke tanpa mengganti key atau unpublish object. Lakukan `PATCH is_public: true` setelah upload jika ingin share tanpa kredensial.
- **Error handling**: Ambil `error.code` daripada `error.message` untuk branching yang aman (retryable vs non-retryable).

## Production Readiness ⚠️

- **SQL transactions**: Max 100 statements per `/transaction` and 15-second budget. Do not combine large DDL with intensive data manipulation in a single transaction.
- **Database size limit**: 250 MB per project. Database does not auto-shrink — delete rows progressively if approaching the limit, and monitor daily usage.
- **Sensitive column names**: Certain names (`readfile`, `writefile`, `delete`, `vacuum`, `attach`, `detach`, `reindex`, `analyze`, `pragma`) are blocked as column names in SQL queries.
- **Public object URLs**: `public_url` is a bearer token — cannot be revoked without rotating the key or unpublishing the object. Perform `PATCH is_public: true` after upload if you want to share without credentials.
- **Error handling**: Use `error.code` rather than `error.message` for safe branching (retryable vs non-retryable).

## Next

- [Next.js guide](/docs/guides/nextjs) — App Router, RSC, Server Actions
- [Nuxt guide](/docs/guides/nuxt) — Server routes, composables
- [SQL API reference](/docs/sql-api)
- [Schema & migrations](/docs/schema-best-practices) — transactions, batch inserts, paging, indexes
- [Object storage](/docs/object-storage)