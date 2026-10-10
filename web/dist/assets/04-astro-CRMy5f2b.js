var e=`# Astro

Works with SSR, static generation, and server endpoints (API routes).

## Setup

\`\`\`bash
# No extra packages needed (fetch is global)
\`\`\`

**Environment variables** (\`.env\`):

\`\`\`env
MOOGO_PROJECT_URL=https://api.moogo.dev/p/<project-id>
MOOGO_SECRET_KEY=moogo_...
MOOGO_BUCKET_ENDPOINT=https://api.moogo.dev/p/<project-id>/bucket
MOOGO_BUCKET_ACCESS_KEY_ID=moogo_ak_...
MOOGO_BUCKET_SECRET_KEY=moogo_sk_...
\`\`\`

## Client (\`src/lib/moogo.ts\`)

\`\`\`ts
// src/lib/moogo.ts
const PROJECT_URL = import.meta.env.MOOGO_PROJECT_URL!;
const SECRET_KEY = import.meta.env.MOOGO_SECRET_KEY!;
const BUCKET_ENDPOINT = import.meta.env.MOOGO_BUCKET_ENDPOINT!;
const BUCKET_ACCESS_KEY_ID = import.meta.env.MOOGO_BUCKET_ACCESS_KEY_ID!;
const BUCKET_SECRET_KEY = import.meta.env.MOOGO_BUCKET_SECRET_KEY!;

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

// The public route is /pub/<project-id>/<key> and needs no credential. The
// bucket endpoint is not it: /p/<project-id>/bucket/<key> is the authenticated
// URL, and a browser tab carries no storage credential, so an <img> pointed at
// one breaks for every private object. This serves published objects only --
// before you publish, the response's public_url is an empty string.
const publicBase = () =>
  BUCKET_ENDPOINT.replace(/\\/p\\/([^/]+)\\/bucket\\/?$/, "/pub/$1");

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
  return fetch(\`\${BUCKET_ENDPOINT}/\${encodeKey(key)}\`, {
    headers: STORAGE_HEADERS,
  });
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
  const res = await fetch(url, { headers: STORAGE_HEADERS });
  return handle(res);
}

export function bucketPublicUrl(key: string): string {
  return \`\${publicBase()}/\${encodeKey(key)}\`;
}
\`\`\`

## SSR Pages (\`.astro\` with \`---\`)

\`\`\`astro
---
// src/pages/users.astro
import { sql, toObjects } from "@/lib/moogo";

const users = await toObjects(
  await sql("SELECT id, email, plan, created_at FROM users ORDER BY created_at DESC")
);
---

<ul>
  {users.map((u) => (
    <li>{u.email} — {u.plan} <small>{new Date(u.created_at).toLocaleDateString()}</small></li>
  ))}
</ul>
\`\`\`

## Server Endpoints (API routes)

\`\`\`ts
// src/pages/api/users.json.ts
import type { APIRoute } from "astro";
import { sql, toObjects } from "@/lib/moogo";

export const GET: APIRoute = async () => {
  const users = await toObjects(await sql("SELECT id, email, plan FROM users"));
  return new Response(JSON.stringify(users), {
    headers: { "Content-Type": "application/json" },
  });
};

export const POST: APIRoute = async ({ request }) => {
  const { email, plan } = await request.json();
  const id = crypto.randomUUID();
  await sql("INSERT INTO users (id, email, plan) VALUES (?, ?, ?)", [id, email, plan ?? "free"]);
  return new Response(JSON.stringify({ id }), { status: 201 });
};
\`\`\`

## Hybrid: Static generation with dynamic data

\`\`\`astro
---
// src/pages/blog/[slug].astro
import { sql, toObjects } from "@/lib/moogo";

export async function getStaticPaths() {
  const posts = await toObjects(
    await sql("SELECT slug FROM posts WHERE published = 1")
  );
  return posts.map((p) => ({ params: { slug: p.slug } }));
}

const { slug } = Astro.props;
const post = (await toObjects(
  await sql("SELECT * FROM posts WHERE slug = ?", [slug])
))[0];
---

<h1>{post.title}</h1>
<article set:html={post.content} />
\`\`\`

## Bucket in Astro

\`\`\`astro
---
// src/pages/upload.astro
import { bucketUpload } from "@/lib/moogo";

if (Astro.request.method === "POST") {
  const form = await Astro.request.formData();
  const file = form.get("file") as File;
  await bucketUpload(\`uploads/\${file.name}\`, file, file.type);
  return Astro.redirect("/upload?success=1");
}
---

<form method="POST" enctype="multipart/form-data">
  <input type="file" name="file" required />
  <button type="submit">Upload</button>
</form>

{ Astro.url.searchParams.has("success") && <p>Uploaded!</p> }
\`\`\`

\`\`\`astro
---
// src/components/Avatar.astro (public object)
import { bucketPublicUrl } from "@/lib/moogo";

const { key } = Astro.props;
---

<img src={bucketPublicUrl(key)} alt="" />
\`\`\`

## Edge/Static adapter

\`\`\`ts
// astro.config.mjs
import { defineConfig } from "astro/config";
import vercel from "@astrojs/vercel/edge"; // or netlify, cloudflare

export default defineConfig({
  output: "server", // or "hybrid"
  adapter: vercel(),
});
\`\`\`

The \`fetch\`-based client works in all Astro adapters (Node, Edge, Deno, Bun).

## Next

- [Next.js guide](/docs/guides/nextjs) — React equivalent
- [Nuxt guide](/docs/guides/nuxt) — Vue equivalent
- [Vanilla JS guide](/docs/guides/javascript-vanilla)
- [Schema & migrations](/docs/schema-best-practices) — transactions, batch inserts, paging, indexes
- [Object storage](/docs/object-storage)`;export{e as default};