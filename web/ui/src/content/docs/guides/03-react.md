# React (Vite / Create React App)

A guide for using Moogo from a **client-side React** app (Vite, CRA, Remix SPA mode, etc.).

> **Already using Next.js?** Use the [Next.js guide](/docs/guides/nextjs) instead — it supports Server Components, Server Actions, and keeps your SQL key on the server.

---

## The constraint: SQL key stays on the server

Moogo's **SQL endpoints** (`/query`, `/exec`) require the `MOOGO_SQL_KEY` as a Bearer token.  
**Never put this key in client-side code** — it would be visible in the browser bundle.

**Bucket endpoints** (`/bucket/*`) use a separate credential (`MOOGO_STORAGE_ACCESS_KEY_ID` + `MOOGO_STORAGE_SECRET_KEY`).  
These **can** be used client-side for public uploads/downloads.

---

## Architecture options

| Approach | SQL | Bucket | When to use |
|----------|-----|--------|-------------|
| **Backend proxy (recommended)** | ✅ Via your API | ✅ Direct or via proxy | Most apps — keeps SQL key secret |
| **Bucket only** | ❌ | ✅ Direct | Static sites, upload-only widgets |
| **Next.js** | ✅ Server-side | ✅ Both | Full-stack React apps |

---

## Option 1: Backend proxy (recommended)

Create a tiny serverless function / API route that forwards SQL calls to Moogo. Your React app calls **your** API, never Moogo directly.

### 1. Proxy endpoint (Node/Express example)

```js
// server/routes/moogo.ts
import express from "express";
import fetch from "node-fetch";

const router = express.Router();
const MOOGO_BASE_URL = process.env.MOOGO_BASE_URL!;
const MOOGO_PROJECT_ID = process.env.MOOGO_PROJECT_ID!;
const SECRET_KEY = process.env.MOOGO_SQL_KEY!;
const MOOGO_URL = `${MOOGO_BASE_URL}/p/${MOOGO_PROJECT_ID}`;

function isRead(sql) {
  // `with` covers CTE reads (WITH ... SELECT); a CTE that writes
  // (WITH ... INSERT) must be sent to /exec directly.
  return /^\s*(SELECT|VALUES|PRAGMA|EXPLAIN|WITH)\b/i.test(sql.trim());
}

router.post("/sql", async (req, res) => {
  const { query, args } = req.body;
  if (!query) return res.status(400).json({ error: "query required" });

  const endpoint = isRead(query) ? "query" : "exec";
  const moogoRes = await fetch(`${MOOGO_URL}/${endpoint}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, args: args ?? [] }),
  });

  const data = await moogoRes.json();
  res.status(moogoRes.status).json(data);
});

export default router;
```

### 2. React hook

```tsx
// hooks/useMoogo.ts
import { useMutation, useQuery } from "@tanstack/react-query";

const API = "/api/moogo/sql"; // your proxy

export function useMoogoQuery(sql: string, args: any[] = []) {
  return useQuery({
    queryKey: ["moogo", sql, args],
    queryFn: async () => {
      const res = await fetch("/api/moogo/sql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: sql, args }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    enabled: !!sql,
  });
}

export function useMoogoExec() {
  return useMutation({
    mutationFn: async ({ sql, args }: { sql: string; args: any[] }) => {
      const res = await fetch("/api/moogo/sql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: sql, args }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });
}
```

### 3. Usage in a component

```tsx
// components/UserList.tsx
import { useMoogoQuery, useMoogoExec } from "../hooks/useMoogo";

export function UserList() {
  const { data, isLoading } = useMoogoQuery(
    "SELECT id, email, plan FROM users WHERE plan = ?",
    ["pro"]
  );

  const insert = useMoogoExec();

  async function addUser(email: string) {
    await insert.mutateAsync({
      sql: "INSERT INTO users (id, email, plan) VALUES (?, ?, ?)",
      args: [crypto.randomUUID(), email, "free"],
    });
  }

  if (isLoading) return <p>Loading…</p>;

  return (
    <ul>
      {data?.rows?.map((row) => (
        <li key={row[0]}>{row[1]} — {row[2]}</li>
      ))}
    </ul>
  );
}
```

---

## Option 2: Bucket direct from React (uploads, public assets)

Since bucket credentials are separate, you **can** use them directly in React for uploads and public downloads.

```tsx
// hooks/useMoogoBucket.ts
const BASE_URL = import.meta.env.VITE_MOOGO_BASE_URL!;
const PROJECT_ID = import.meta.env.VITE_MOOGO_PROJECT_ID!;
const BUCKET_ENDPOINT = `${BASE_URL}/p/${PROJECT_ID}/bucket`;
const CDN_URL = (import.meta.env.VITE_MOOGO_CDN_URL ?? "").replace(/\/+$/, "");
const ACCESS_KEY = import.meta.env.VITE_MOOGO_STORAGE_ACCESS_KEY_ID!;
const SECRET_KEY = import.meta.env.VITE_MOOGO_STORAGE_SECRET_KEY!;

// Slashes are meaningful in a key, so escape each segment and keep them.
const encodeKey = (key: string) =>
  key.split("/").map(encodeURIComponent).join("/");

// Public objects are served from the CDN host when VITE_MOOGO_CDN_URL is set.
// The public route is /pub/<project-id>/<key> and needs no credential. The
// bucket endpoint is not it: /p/<project-id>/bucket/<key> is the authenticated
// URL, so an <img> pointed at one breaks for every private object. This serves
// published objects only.
function publicBase(): string {
  const base = BUCKET_ENDPOINT.replace(/\/p\/([^/]+)\/bucket\/?$/, "/pub/$1");
  return CDN_URL ? base.replace(/^https?:\/\/[^/]+/, CDN_URL) : base;
}

const headers = {
  "X-Moogo-Access-Key-Id": ACCESS_KEY,
  Authorization: `Bearer ${SECRET_KEY}`,
};

export async function uploadFile(key: string, file: File) {
  const res = await fetch(`${BUCKET_ENDPOINT}/${encodeKey(key)}`, {
    method: "POST",
    headers: { ...headers, "Content-Type": file.type },
    body: file,
  });
  return res.json();
}

// Uploads are private by default, so an uploaded object has to be published
// before its public URL resolves.
export async function publishFile(key: string) {
  const res = await fetch(`${BUCKET_ENDPOINT}/${encodeKey(key)}`, {
    method: "PATCH",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ is_public: true }) // _bucket-level visibility_,  });
  return res.json();
}

export function getPublicUrl(key: string) {
  return `${publicBase()}/${encodeKey(key)}`;
}

export async function listFiles(prefix?: string) {
  const url = new URL(BUCKET_ENDPOINT);
  if (prefix) url.searchParams.set("prefix", prefix);
  const res = await fetch(url, { headers });
  return res.json();
}
```

```tsx
// components/AvatarUpload.tsx
import { useState } from "react";
import { uploadFile, publishFile, getPublicUrl } from "../hooks/useMoogoBucket";

export function AvatarUpload() {
  const [publicUrl, setPublicUrl] = useState<string>();

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const key = `avatars/${file.name}`;
    await uploadFile(key, file);
    // Uploads are private by default — publish so the public URL resolves.
    await publishFile(key);
    setPublicUrl(getPublicUrl(key));
  }

  return (
    <>
      <input type="file" onChange={handleUpload} accept="image/*" />
      {publicUrl && <img src={publicUrl} alt="" />}
    </>
  );
}
```

```tsx
// components/Avatar.tsx
import { getPublicUrl } from "../hooks/useMoogoBucket";

export function Avatar({ key }: { key: string }) {
  return <img src={getPublicUrl(key)} alt="" />;
}
```

---

## Environment variables (`.env`)

```env
# Backend (proxy) — keep secret!
MOOGO_BASE_URL=https://api.moogo.dev
MOOGO_PROJECT_ID=<project-id>
MOOGO_SQL_KEY=moogo_...

# Frontend (bucket only) — safe to expose
VITE_MOOGO_BASE_URL=https://api.moogo.dev
VITE_MOOGO_PROJECT_ID=<project-id>
# Optional — origin public objects are served from; falls back to the bucket endpoint origin when empty.
VITE_MOOGO_CDN_URL=https://cdn.moogo.dev
VITE_MOOGO_STORAGE_ACCESS_KEY_ID=moogo_ak_...
VITE_MOOGO_STORAGE_SECRET_KEY=moogo_sk_...
```

---

## Vite / CRA setup

```bash
# Vite
npm create vite@latest my-app -- --template react-ts
cd my-app
npm i @tanstack/react-query  # recommended for data fetching
```

```bash
# CRA
npx create-react-app my-app --template typescript
cd my-app
npm i @tanstack/react-query
```

Add a `.env` file with the variables above, prefixed with `VITE_` (the hook reads
`import.meta.env.VITE_*`). A CRA setup would instead read
`process.env.REACT_APP_*` in the hook, since CRA does not expose `import.meta.env`.

---

## When to switch to Next.js

| Trigger | Why Next.js? |
|---------|--------------|
| SEO / SSR needed | `getServerSideProps`, `generateStaticParams` |
| Want Server Actions | Mutations stay on server, no proxy needed |
| Auth + SQL in same request | Cookies + DB in one Server Component |
| Edge / streaming | `export const runtime = "edge"` |

The [Next.js guide](/docs/guides/nextjs) covers Server Components, Server Actions, and the Moogo client pattern.

---

## Quick reference

| Task | Code |
|------|------|
| Read data | `useMoogoQuery("SELECT * FROM users WHERE plan = ?", ["pro"])` |
| Write data | `insert.mutateAsync({ sql: "INSERT ...", args: [...] })` |
| Upload file | `uploadFile("avatars/me.png", file)` |
| Public URL | `getPublicUrl("avatars/me.png")` |

---

## Production Readiness ⚠️

- **SQL transactions**: Max 100 statements per `/transaction` and 15-second budget. Do not combine large DDL with intensive data manipulation in a single transaction.
- **Database size limit**: 256 MB per project. Database does not auto-shrink — delete rows progressively if approaching the limit, and monitor daily usage.
- **Sensitive column names**: Certain names (`readfile`, `writefile`, `delete`, `vacuum`, `attach`, `detach`, `reindex`, `analyze`, `pragma`) are blocked as column names in SQL queries.
- **Public object URLs**: `public_url` is a bearer token — cannot be revoked without rotating the key or unpublishing the object. Perform bucket-level visibility toggle (Dashboard → Bucket settings → Public) after upload if you want to share without credentials.
- **Error handling**: Use `error.code` rather than `error.message` for safe branching (retryable vs non-retryable).

## Next

- [Next.js guide](/docs/guides/nextjs) — full-stack React with Server Components
- [JavaScript vanilla](/docs/guides/javascript-vanilla) — no framework
- [Schema & migrations](/docs/schema-best-practices) — transactions, batch inserts, paging, indexes
- [Bucket API](/docs/object-storage) — full bucket reference