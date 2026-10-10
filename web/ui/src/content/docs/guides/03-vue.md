# Vue 3 (SPA)

Works with Vite, Pinia, Vue Router — client-side only or with a backend proxy.

## Setup

```bash
npm i ofetch  # or use built-in fetch (modern browsers)
```

**Environment variables** (`.env` — only public bucket URL goes to client):

```env
VITE_MOOGO_BUCKET_ENDPOINT=https://api.moogo.dev/p/<project-id>/bucket
VITE_MOOGO_BUCKET_ACCESS_KEY_ID=moogo_ak_...
VITE_MOOGO_BUCKET_SECRET_KEY=moogo_sk_...
```

> ⚠️ **Never expose `MOOGO_SECRET_KEY` (SQL key) in client code.**  
> For SQL in a SPA, create a small backend proxy (see below) or use a Server Function (Netlify/Vercel Functions, Cloudflare Workers).

## Client-side Bucket only (`composables/useMoogoBucket.ts`)

```ts
// composables/useMoogoBucket.ts
import { ofetch } from "ofetch";

const BUCKET_ENDPOINT = import.meta.env.VITE_MOOGO_BUCKET_ENDPOINT!;
const BUCKET_ACCESS_KEY_ID = import.meta.env.VITE_MOOGO_BUCKET_ACCESS_KEY_ID!;
const BUCKET_SECRET_KEY = import.meta.env.VITE_MOOGO_BUCKET_SECRET_KEY!;

const STORAGE_HEADERS = {
  "X-Moogo-Access-Key-Id": BUCKET_ACCESS_KEY_ID,
  Authorization: `Bearer ${BUCKET_SECRET_KEY}`,
};

// Slashes are meaningful in a key, so escape each segment and keep them.
const encodeKey = (key: string) =>
  key.split("/").map(encodeURIComponent).join("/");

// The public route is /pub/<project-id>/<key> and needs no credential. The
// bucket endpoint is not it: /p/<project-id>/bucket/<key> is the authenticated
// URL, so an <img> pointed at one breaks for every private object. This serves
// published objects only.
const publicBase = () =>
  BUCKET_ENDPOINT.replace(/\/p\/([^/]+)\/bucket\/?$/, "/pub/$1");

export function useMoogoBucket() {
  async function upload(key: string, file: File) {
    return ofetch(`${BUCKET_ENDPOINT}/${encodeKey(key)}`, {
      method: "POST",
      headers: { ...STORAGE_HEADERS, "Content-Type": file.type },
      body: file,
    });
  }

  async function download(key: string): Promise<Blob> {
    return ofetch.raw(`${BUCKET_ENDPOINT}/${encodeKey(key)}`, {
      headers: STORAGE_HEADERS,
      responseType: "blob",
    });
  }

  async function remove(key: string) {
    return ofetch(`${BUCKET_ENDPOINT}/${encodeKey(key)}`, {
      method: "DELETE",
      headers: STORAGE_HEADERS,
    });
  }

  async function list(prefix?: string) {
    const url = new URL(BUCKET_ENDPOINT);
    if (prefix) url.searchParams.set("prefix", prefix);
    return ofetch(url.toString(), { headers: STORAGE_HEADERS });
  }

  function publicUrl(key: string): string {
    return `${publicBase()}/${encodeKey(key)}`;
  }

  return { upload, download, remove, list, publicUrl };
}
```

## Usage in component

```vue
<!-- components/FileUpload.vue -->
<script setup lang="ts">
import { useMoogoBucket } from "@/composables/useMoogoBucket";

const { upload, publicUrl, list } = useMoogoBucket();
const files = ref<{ key: string; url: string }[]>([]);
const uploading = ref(false);

async function onUpload(e: Event) {
  const input = e.target as HTMLInputElement;
  if (!input.files?.length) return;
  uploading.value = true;
  for (const file of input.files) {
    await upload(`uploads/${file.name}`, file);
  }
  await refresh();
  uploading.value = false;
}

async function refresh() {
  const { objects } = await list("uploads/");
  files.value = objects.map((o) => ({ key: o.key, url: publicUrl(o.key) }));
}

onMounted(refresh);
</script>

<template>
  <input type="file" multiple @change="onUpload" :disabled="uploading" />
  <p v-if="uploading">Uploading…</p>

  <div v-for="f in files" :key="f.key" class="flex items-center gap-2">
    <img :src="f.url" width="40" height="40" />
    <span>{{ f.key }}</span>
  </div>
</template>
```

## SQL via backend proxy (required for SPA)

Create a tiny serverless function (Netlify, Vercel, Cloudflare Workers):

```ts
// netlify/functions/moogo-sql.ts
import type { Handler } from "@netlify/functions";

const PROJECT_URL = process.env.MOOGO_PROJECT_URL!;
const SECRET_KEY = process.env.MOOGO_SECRET_KEY!;

const headers = {
  Authorization: `Bearer ${SECRET_KEY}`,
  "Content-Type": "application/json",
};

function isRead(sql: string) {
  // `with` belongs here: a CTE that ends in a SELECT is a read, and /query
  // takes it. A CTE that writes still reaches /exec, which accepts writes.
  return /^\s*(select|values|pragma|explain|with)\b/i.test(sql.trim());
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method not allowed" };
  const { query, args } = JSON.parse(event.body ?? "{}");
  if (!query) return { statusCode: 400, body: "query required" };

  const endpoint = isRead(query) ? "query" : "exec";
  const res = await fetch(`${PROJECT_URL}/${endpoint}`, {
    method: "POST",
    headers,
    body: JSON.stringify({ query, args: args ?? [] }),
  });

  return { statusCode: res.status, body: await res.text() };
};
```

```ts
// composables/useMoogoSql.ts (calls your proxy)
import { ofetch } from "ofetch";

const PROXY_URL = "/.netlify/functions/moogo-sql"; // or your Vercel/Cloudflare URL

export function useMoogoSql() {
  async function sql(query: string, args: any[] = []) {
    return ofetch(PROXY_URL, { method: "POST", body: { query, args } });
  }

  function toObjects<T>(result: { columns: string[]; rows: any[][] }): T[] {
    return result.rows.map((row) =>
      Object.fromEntries(result.columns.map((col, i) => [col, row[i]]))
    ) as T[];
  }

  return { sql, toObjects };
}
```

```vue
<!-- components/UserList.vue -->
<script setup lang="ts">
import { useMoogoSql } from "@/composables/useMoogoSql";

const { sql, toObjects } = useMoogoSql();
const users = ref([]);

async function load() {
  users.value = await toObjects(await sql("SELECT id, email, plan FROM users"));
}

onMounted(load);
</script>

<template>
  <ul>
    <li v-for="u in users" :key="u.id">{{ u.email }} — {{ u.plan }}</li>
  </ul>
</template>
```

## Alternative: Pinia store

```ts
// stores/moogo.ts
import { defineStore } from "pinia";
import { useMoogoBucket } from "@/composables/useMoogoBucket";
import { useMoogoSql } from "@/composables/useMoogoSql";

export const useMoogoStore = defineStore("moogo", () => {
  const bucket = useMoogoBucket();
  const sql = useMoogoSql();

  return { bucket, sql };
});
```

## Next

- [Nuxt guide](/docs/guides/nuxt) — SSR + SQL + Bucket without proxy
- [Vanilla JS guide](/docs/guides/javascript-vanilla) — same patterns
- [Object storage](/docs/object-storage)
- [Schema & migrations](/docs/schema-best-practices) — transactions, batch inserts, paging, indexes
- [Security](/docs/security) — why SQL key must stay server-side