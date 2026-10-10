var e=`# React (Vite / Create React App)

A guide for using Moogo from a **client-side React** app (Vite, CRA, Remix SPA mode, etc.).

> **Already using Next.js?** Use the [Next.js guide](/docs/guides/nextjs) instead — it supports Server Components, Server Actions, and keeps your SQL key on the server.

---

## The constraint: SQL key stays on the server

Moogo's **SQL endpoints** (\`/query\`, \`/exec\`) require the \`MOOGO_SECRET_KEY\` as a Bearer token.  
**Never put this key in client-side code** — it would be visible in the browser bundle.

**Bucket endpoints** (\`/bucket/*\`) use a separate credential (\`MOOGO_BUCKET_ACCESS_KEY_ID\` + \`MOOGO_BUCKET_SECRET_KEY\`).  
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

\`\`\`js
// server/routes/moogo.js
import express from "express";
import fetch from "node-fetch";

const router = express.Router();
const MOOGO_URL = process.env.MOOGO_PROJECT_URL!;
const SECRET_KEY = process.env.MOOGO_SECRET_KEY!;

function isRead(sql) {
  // \`WITH\` belongs here: a CTE that ends in a SELECT is a read, and /query
  // takes it. A CTE that writes still reaches /exec, which accepts writes.
  return /^\\s*(SELECT|VALUES|PRAGMA|EXPLAIN|WITH)\\b/i.test(sql.trim());
}

router.post("/sql", async (req, res) => {
  const { query, args } = req.body;
  if (!query) return res.status(400).json({ error: "query required" });

  const endpoint = isRead(query) ? "query" : "exec";
  const moogoRes = await fetch(\`\${MOOGO_URL}/\${endpoint}\`, {
    method: "POST",
    headers: {
      Authorization: \`Bearer \${SECRET_KEY}\`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, args: args ?? [] }),
  });

  const data = await moogoRes.json();
  res.status(moogoRes.status).json(data);
});

export default router;
\`\`\`

### 2. React hook

\`\`\`tsx
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
\`\`\`

### 3. Usage in a component

\`\`\`tsx
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
\`\`\`

---

## Option 2: Bucket direct from React (uploads, public assets)

Since bucket credentials are separate, you **can** use them directly in React for uploads and public downloads.

\`\`\`tsx
// hooks/useMoogoBucket.ts
const BUCKET_ENDPOINT = import.meta.env.VITE_MOOGO_BUCKET_ENDPOINT!;
const ACCESS_KEY = import.meta.env.VITE_MOOGO_BUCKET_ACCESS_KEY_ID!;
const SECRET_KEY = import.meta.env.VITE_MOOGO_BUCKET_SECRET_KEY!;

// Slashes are meaningful in a key, so escape each segment and keep them.
const encodeKey = (key: string) =>
  key.split("/").map(encodeURIComponent).join("/");

// The public route is /pub/<project-id>/<key> and needs no credential. The
// bucket endpoint is not it: /p/<project-id>/bucket/<key> is the authenticated
// URL, so an <img> pointed at one breaks for every private object. This serves
// published objects only.
const publicBase = () =>
  BUCKET_ENDPOINT.replace(/\\/p\\/([^/]+)\\/bucket\\/?$/, "/pub/$1");

const headers = {
  "X-Moogo-Access-Key-Id": ACCESS_KEY,
  Authorization: \`Bearer \${SECRET_KEY}\`,
};

export async function uploadFile(key: string, file: File) {
  const res = await fetch(\`\${BUCKET_ENDPOINT}/\${encodeKey(key)}\`, {
    method: "POST",
    headers: { ...headers, "Content-Type": file.type },
    body: file,
  });
  return res.json();
}

export function getPublicUrl(key: string) {
  return \`\${publicBase()}/\${encodeKey(key)}\`;
}

export async function listFiles(prefix?: string) {
  const url = new URL(BUCKET_ENDPOINT);
  if (prefix) url.searchParams.set("prefix", prefix);
  const res = await fetch(url, { headers });
  return res.json();
}
\`\`\`

\`\`\`tsx
// components/AvatarUpload.tsx
import { uploadFile, getPublicUrl } from "../hooks/useMoogoBucket";

export function AvatarUpload() {
  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    await uploadFile(\`avatars/\${file.name}\`, file);
    alert("Uploaded!");
  }

  return <input type="file" onChange={handleUpload} accept="image/*" />;
}
\`\`\`

\`\`\`tsx
// components/Avatar.tsx
import { getPublicUrl } from "../hooks/useMoogoBucket";

export function Avatar({ key }: { key: string }) {
  return <img src={getPublicUrl(key)} alt="" />;
}
\`\`\`

---

## Environment variables (\`.env\`)

\`\`\`env
# Backend (proxy) — keep secret!
MOOGO_PROJECT_URL=https://api.moogo.dev/p/<project-id>
MOOGO_SECRET_KEY=moogo_...

# Frontend (bucket only) — safe to expose
VITE_MOOGO_BUCKET_ENDPOINT=https://api.moogo.dev/p/<project-id>/bucket
VITE_MOOGO_BUCKET_ACCESS_KEY_ID=moogo_ak_...
VITE_MOOGO_BUCKET_SECRET_KEY=moogo_sk_...
\`\`\`

---

## Vite / CRA setup

\`\`\`bash
# Vite
npm create vite@latest my-app -- --template react-ts
cd my-app
npm i @tanstack/react-query  # recommended for data fetching
\`\`\`

\`\`\`bash
# CRA
npx create-react-app my-app --template typescript
cd my-app
npm i @tanstack/react-query
\`\`\`

Add a \`.env\` file with the variables above (prefix with \`VITE_\` for Vite, \`REACT_APP_\` for CRA).

---

## When to switch to Next.js

| Trigger | Why Next.js? |
|---------|--------------|
| SEO / SSR needed | \`getServerSideProps\`, \`generateStaticParams\` |
| Want Server Actions | Mutations stay on server, no proxy needed |
| Auth + SQL in same request | Cookies + DB in one Server Component |
| Edge / streaming | \`export const runtime = "edge"\` |

The [Next.js guide](/docs/guides/nextjs) covers Server Components, Server Actions, and the Moogo client pattern.

---

## Quick reference

| Task | Code |
|------|------|
| Read data | \`useMoogoQuery("SELECT * FROM users WHERE plan = ?", ["pro"])\` |
| Write data | \`insert.mutateAsync({ sql: "INSERT ...", args: [...] })\` |
| Upload file | \`uploadFile("avatars/me.png", file)\` |
| Public URL | \`getPublicUrl("avatars/me.png")\` |

---

## Next

- [Next.js guide](/docs/guides/nextjs) — full-stack React with Server Components
- [JavaScript vanilla](/docs/guides/javascript-vanilla) — no framework
- [Bucket API](/docs/object-storage) — full bucket reference`;export{e as default};