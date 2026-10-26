var e=`# Next.js (App Router)

Works with Server Components, Server Actions, Route Handlers, and Edge Runtime.

## Setup

\`\`\`bash
# No extra packages needed (fetch is global in Next.js 13+)
\`\`\`

**Environment variables** (Vercel → Settings → Environment Variables, or \`.env.local\`):

\`\`\`env
MOOGO_BASE_URL=https://api.moogo.dev
MOOGO_PROJECT_ID=<project-id>
MOOGO_SQL_KEY=moogo_...
NEXT_PUBLIC_MOOGO_BASE_URL=https://api.moogo.dev
NEXT_PUBLIC_MOOGO_PROJECT_ID=<project-id>
# Optional — origin public objects are served from; falls back to the bucket endpoint origin when empty.
NEXT_PUBLIC_MOOGO_CDN_URL=https://cdn.moogo.dev
NEXT_PUBLIC_MOOGO_STORAGE_ACCESS_KEY_ID=moogo_ak_...
NEXT_PUBLIC_MOOGO_STORAGE_SECRET_KEY=moogo_sk_...
\`\`\`

## Client (\`lib/moogo.ts\`)

\`\`\`ts
// lib/moogo.ts
const BASE_URL = process.env.MOOGO_BASE_URL!;
const PROJECT_ID = process.env.MOOGO_PROJECT_ID!;
const SECRET_KEY = process.env.MOOGO_SQL_KEY!;
const PROJECT_URL = \`\${BASE_URL}/p/\${PROJECT_ID}\`;
const BUCKET_BASE_URL = process.env.NEXT_PUBLIC_MOOGO_BASE_URL!;
const BUCKET_PROJECT_ID = process.env.NEXT_PUBLIC_MOOGO_PROJECT_ID!;
const BUCKET_ENDPOINT = \`\${BUCKET_BASE_URL}/p/\${BUCKET_PROJECT_ID}/bucket\`;
const CDN_URL = (process.env.NEXT_PUBLIC_MOOGO_CDN_URL ?? "").replace(/\\/+$/, "");
const BUCKET_ACCESS_KEY_ID = process.env.NEXT_PUBLIC_MOOGO_STORAGE_ACCESS_KEY_ID!;
const BUCKET_SECRET_KEY = process.env.NEXT_PUBLIC_MOOGO_STORAGE_SECRET_KEY!;

const SQL_HEADERS = {
  Authorization: \`Bearer \${SECRET_KEY}\`,
  "Content-Type": "application/json",
};

const STORAGE_HEADERS = {
  "X-Moogo-Access-Key-Id": BUCKET_ACCESS_KEY_ID,
  Authorization: \`Bearer \${BUCKET_SECRET_KEY}\`,
};

function isRead(sql: string): boolean {
  // \`with\` covers CTE reads (WITH ... SELECT); a CTE that writes
  // (WITH ... INSERT) must be sent to /exec directly.
  return /^\\s*(select|values|pragma|explain|with)\\b/i.test(sql.trim());
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
  const res = await fetch(\`\${PROJECT_URL}/query\`, {
    method: "POST",
    headers: SQL_HEADERS,
    body: JSON.stringify({ query: sql, args }),
    // Next.js caches fetch by default; opt out for dynamic data:
    cache: "no-store",
  });
  return handle(res);
}

export async function exec(sql: string, args: any[] = []) {
  const res = await fetch(\`\${PROJECT_URL}/exec\`, {
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

// Public objects are served from the CDN host when NEXT_PUBLIC_MOOGO_CDN_URL is
// set.
// The public route is /pub/<project-id>/<key> and needs no credential. The
// bucket endpoint is not it: /p/<project-id>/bucket/<key> is the authenticated
// URL, and a browser tab carries no storage credential, so an <img> pointed at
// one breaks for every private object. This serves published objects only --
// before you publish, the response's public_url is an empty string.
function publicBase(): string {
  const base = BUCKET_ENDPOINT.replace(/\\/p\\/([^/]+)\\/bucket\\/?$/, "/pub/$1");
  return CDN_URL ? base.replace(/^https?:\\/\\/[^/]+/, CDN_URL) : base;
}

// ── Bucket ───────────────────────────────────────────────────────────
export async function bucketUpload(
  key: string,
  body: BodyInit,
  contentType: string
) {
  const res = await fetch(\`\${BUCKET_ENDPOINT}/\${encodeKey(key)}\`, {
    method: "POST",
    headers: { ...STORAGE_HEADERS, "Content-Type": contentType },
    body,
  });
  return handle(res);
}

export async function bucketDownload(key: string) {
  const res = await fetch(\`\${BUCKET_ENDPOINT}/\${encodeKey(key)}\`, {
    headers: STORAGE_HEADERS,
    cache: "no-store",
  });
  return res; // Return Response for streaming
}

export async function bucketDelete(key: string) {
  const res = await fetch(\`\${BUCKET_ENDPOINT}/\${encodeKey(key)}\`, {
    method: "DELETE",
    headers: STORAGE_HEADERS,
  });
  return handle(res);
}

export async function bucketList(prefix?: string) {
  const url = new URL(\`\${BUCKET_ENDPOINT}\`);
  if (prefix) url.searchParams.set("prefix", prefix);
  const res = await fetch(url, { headers: STORAGE_HEADERS, cache: "no-store" });
  return handle(res);
}

// Publish an object so its public URL resolves. Uploads are private by default,
// and public_url stays an empty string until this is called.
export async function bucketPublish(key: string) {
  const res = await fetch(\`\${BUCKET_ENDPOINT}/\${encodeKey(key)}\`, {
    method: "PATCH",
    headers: { ...STORAGE_HEADERS, "Content-Type": "application/json" },
    body: JSON.stringify({ is_public: true }) // _bucket-level visibility_
    // _(bucket-level: makes all objects in the bucket public)_,
  });
  return handle(res);
}

// Public download (no auth needed once the object is published)
export function bucketPublicUrl(key: string): string {
  return \`\${publicBase()}/\${encodeKey(key)}\`;
}
\`\`\`

## Server Components (RSC) — Reading data

\`\`\`tsx
// app/users/page.tsx
import { sql, toObjects } from "@/lib/moogo";

export default async function UsersPage() {
  const users = await toObjects(
    await sql("SELECT id, email, plan, created_at FROM users ORDER BY created_at DESC")
  );

  return (
    <ul>
      {users.map((u) => (
        <li key={u.id}>
          {u.email} — {u.plan} <small>({new Date(u.created_at).toLocaleDateString()})</small>
        </li>
      ))}
    </ul>
  );
}
\`\`\`

## Server Actions — Mutations

\`\`\`ts
// app/actions.ts
"use server";
import { sql } from "@/lib/moogo";
import { revalidatePath } from "next/cache";

export async function createUser(email: string, plan = "free") {
  const id = crypto.randomUUID();
  await sql(
    "INSERT INTO users (id, email, plan) VALUES (?, ?, ?)",
    [id, email, plan]
  );
  revalidatePath("/users");
  return { id };
}

export async function deleteUser(id: string) {
  await sql("DELETE FROM users WHERE id = ?", [id]);
  revalidatePath("/users");
}
\`\`\`

\`\`\`tsx
// app/users/page.tsx (with form)
import { createUser, deleteUser } from "@/app/actions";

export default async function UsersPage() {
  // ... fetch users as above

  return (
    <>
      <form action={async (formData: FormData) => {
        "use server";
        await createUser(formData.get("email") as string);
      }}>
        <input name="email" type="email" placeholder="Email" required />
        <button type="submit">Add user</button>
      </form>

      <ul>
        {users.map((u) => (
          <li key={u.id}>
            {u.email}
            <form action={async () => { "use server"; await deleteUser(u.id); }}>
              <button type="submit">Delete</button>
            </form>
          </li>
        ))}
      </ul>
    </>
  );
}
\`\`\`

## Route Handlers — Custom API endpoints

\`\`\`ts
// app/api/users/route.ts
import { sql, toObjects } from "@/lib/moogo";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const users = await toObjects(
    await sql("SELECT id, email, plan FROM users")
  );
  return NextResponse.json(users);
}

export async function POST(req: NextRequest) {
  const { email, plan } = await req.json();
  const id = crypto.randomUUID();
  await sql("INSERT INTO users (id, email, plan) VALUES (?, ?, ?)", [id, email, plan ?? "free"]);
  return NextResponse.json({ id }, { status: 201 });
}
\`\`\`

## Edge Runtime (optional)

\`\`\`ts
// lib/moogo.ts — add at top
export const runtime = "edge"; // Works in Edge Runtime (Vercel, Cloudflare)
\`\`\`

## Bucket usage in Next.js

\`\`\`tsx
// app/upload/page.tsx
"use client";
import { useState } from "react";
import { bucketUpload, bucketPublish, bucketPublicUrl } from "@/lib/moogo";

export default function UploadPage() {
  const [publicUrl, setPublicUrl] = useState("");

  async function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const file = form.get("file") as File;
    const key = \`uploads/\${file.name}\`;
    await bucketUpload(key, file, file.type);
    // Uploads are private by default — publish so the public URL resolves.
    await bucketPublish(key);
    setPublicUrl(bucketPublicUrl(key));
  }

  return (
    <form onSubmit={handleUpload}>
      <input type="file" name="file" required />
      <button type="submit">Upload</button>
      {publicUrl && <img src={publicUrl} alt="" />}
    </form>
  );
}
\`\`\`

\`\`\`tsx
// app/components/Avatar.tsx (public object)
import { bucketPublicUrl } from "@/lib/moogo";

export function Avatar({ key }: { key: string }) {
  return <img src={bucketPublicUrl(key)} alt="" />;
}
\`\`\`

## TypeScript types

\`\`\`ts
// types/moogo.d.ts
declare namespace Moogo {
  interface QueryResult {
    success: true;
    columns: string[];
    rows: any[][];
    row_count: number;
    truncated: boolean;
    duration_ms: number;
  }
  interface ExecResult {
    success: true;
    rows_affected: number;
    size_bytes: number;
    duration_ms: number;
  }
  interface ErrorResponse {
    error: { code: string; message: string; detail?: string };
  }
}
\`\`\`

## Production Readiness ⚠️

- **SQL transactions**: Max 100 statements per \`/transaction\` and 15-second budget. Do not combine large DDL with intensive data manipulation in a single transaction.
- **Database size limit**: 256 MB per project. Database does not auto-shrink — delete rows progressively if approaching the limit, and monitor daily usage.
- **Sensitive column names**: Certain names (\`readfile\`, \`writefile\`, \`delete\`, \`vacuum\`, \`attach\`, \`detach\`, \`reindex\`, \`analyze\`, \`pragma\`) are blocked as column names in SQL queries.
- **Public object URLs**: \`public_url\` is a bearer token — cannot be revoked without rotating the key or unpublishing the object. Perform \`PATCH is_public: true\` after upload if you want to share without credentials.
- **Error handling**: Use \`error.code\` rather than \`error.message\` for safe branching (retryable vs non-retryable).

## Next

- [Vanilla JS guide](/docs/guides/javascript-vanilla) — works everywhere
- [Nuxt guide](/docs/guides/nuxt) — Vue equivalent
- [SQL API reference](/docs/sql-api)
- [Schema & migrations](/docs/schema-best-practices) — transactions, batch inserts, paging, indexes
- [Object storage](/docs/object-storage)`;export{e as default};