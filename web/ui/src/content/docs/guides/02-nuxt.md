# Nuxt 3

Works with Server Routes, Composables, and Nitro (Edge/Node).

## Setup

```bash
# No extra packages needed (ofetch is built-in)
```

**Environment variables** (`.env` or runtime config):

```env
MOOGO_PROJECT_URL=https://api.moogo.dev/p/<project-id>
MOOGO_SECRET_KEY=moogo_...
MOOGO_BUCKET_ENDPOINT=https://api.moogo.dev/p/<project-id>/bucket
MOOGO_BUCKET_ACCESS_KEY_ID=moogo_ak_...
MOOGO_BUCKET_SECRET_KEY=moogo_sk_...
```

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  runtimeConfig: {
    moogoProjectUrl: process.env.MOOGO_PROJECT_URL,
    moogoSecretKey: process.env.MOOGO_SECRET_KEY,
    moogoBucketEndpoint: process.env.MOOGO_BUCKET_ENDPOINT,
    moogoBucketAccessKeyId: process.env.MOOGO_BUCKET_ACCESS_KEY_ID,
    moogoBucketSecretKey: process.env.MOOGO_BUCKET_SECRET_KEY,
  },
});
```

## Composable (`composables/useMoogo.ts`)

```ts
// composables/useMoogo.ts
export const useMoogo = () => {
  const config = useRuntimeConfig();

  const PROJECT_URL = config.moogoProjectUrl as string;
  const SECRET_KEY = config.moogoSecretKey as string;
  const BUCKET_ENDPOINT = config.moogoBucketEndpoint as string;
  const BUCKET_ACCESS_KEY_ID = config.moogoBucketAccessKeyId as string;
  const BUCKET_SECRET_KEY = config.moogoBucketSecretKey as string;

  const SQL_HEADERS = {
    Authorization: `Bearer ${SECRET_KEY}`,
    "Content-Type": "application/json",
  };

  const STORAGE_HEADERS = {
    "X-Moogo-Access-Key-Id": BUCKET_ACCESS_KEY_ID,
    Authorization: `Bearer ${BUCKET_SECRET_KEY}`,
  };

  function isRead(sql: string): boolean {
    return /^\s*(select|values|pragma|explain)\b/i.test(sql.trim());
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

  // ── SQL ────────────────────────────────────────────────────────────
  async function query(sql: string, args: any[] = []) {
    const res = await $fetch(`${PROJECT_URL}/query`, {
      method: "POST",
      headers: SQL_HEADERS,
      body: { query: sql, args },
    });
    return handle(res as any);
  }

  async function exec(sql: string, args: any[] = []) {
    const res = await $fetch(`${PROJECT_URL}/exec`, {
      method: "POST",
      headers: SQL_HEADERS,
      body: { query: sql, args },
    });
    return handle(res as any);
  }

  async function sql(sql: string, args: any[] = []) {
    return isRead(sql) ? query(sql, args) : exec(sql, args);
  }

  function toObjects<T>(result: { columns: string[]; rows: any[][] }): T[] {
    return result.rows.map((row) =>
      Object.fromEntries(result.columns.map((col, i) => [col, row[i]]))
    ) as T[];
  }

  // ── Bucket ─────────────────────────────────────────────────────────
  async function bucketUpload(key: string, body: BodyInit, contentType: string) {
    const res = await $fetch(`${BUCKET_ENDPOINT}/${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { ...STORAGE_HEADERS, "Content-Type": contentType },
      body,
    });
    return handle(res as any);
  }

  async function bucketDownload(key: string) {
    return $fetch.raw(`${BUCKET_ENDPOINT}/${encodeURIComponent(key)}`, {
      headers: STORAGE_HEADERS,
      responseType: "blob",
    });
  }

  async function bucketDelete(key: string) {
    const res = await $fetch(`${BUCKET_ENDPOINT}/${encodeURIComponent(key)}`, {
      method: "DELETE",
      headers: STORAGE_HEADERS,
    });
    return handle(res as any);
  }

  async function bucketList(prefix?: string) {
    const url = new URL(`${BUCKET_ENDPOINT}`);
    if (prefix) url.searchParams.set("prefix", prefix);
    const res = await $fetch(url.toString(), { headers: STORAGE_HEADERS });
    return handle(res as any);
  }

  function bucketPublicUrl(key: string): string {
    return `${BUCKET_ENDPOINT}/${encodeURIComponent(key)}`;
  }

  return {
    sql,
    query,
    exec,
    toObjects,
    bucketUpload,
    bucketDownload,
    bucketDelete,
    bucketList,
    bucketPublicUrl,
  };
};
```

## Usage in components

```vue
<!-- pages/users.vue -->
<script setup lang="ts">
const { sql, toObjects } = useMoogo();

const users = ref([]);

async function load() {
  users.value = await toObjects(await sql("SELECT id, email, plan FROM users"));
}

await load();
</script>

<template>
  <ul>
    <li v-for="u in users" :key="u.id">
      {{ u.email }} — {{ u.plan }}
    </li>
  </ul>
</template>
```

## Server API routes

```ts
// server/api/users.get.ts
export default defineEventHandler(async () => {
  const { sql, toObjects } = useMoogo();
  return toObjects(await sql("SELECT id, email, plan FROM users"));
});
```

```ts
// server/api/users.post.ts
export default defineEventHandler(async (event) => {
  const { sql } = useMoogo();
  const body = await readBody(event);
  const id = crypto.randomUUID();
  await sql("INSERT INTO users (id, email, plan) VALUES (?, ?, ?)", [
    id,
    body.email,
    body.plan ?? "free",
  ]);
  return { id };
});
```

## Bucket in Nuxt

```vue
<!-- components/AvatarUpload.vue -->
<script setup lang="ts">
const { bucketUpload, bucketPublicUrl } = useMoogo();

const uploading = ref(false);

async function onUpload(e: Event) {
  const input = e.target as HTMLInputElement;
  if (!input.files?.[0]) return;
  uploading.value = true;
  const file = input.files[0];
  await bucketUpload(`avatars/${file.name}`, file, file.type);
  uploading.value = false;
}
</script>

<template>
  <input type="file" @change="onUpload" :disabled="uploading" />
  <p v-if="uploading">Uploading…</p>
</template>
```

```vue
<!-- components/Avatar.vue (public) -->
<script setup lang="ts">
const { bucketPublicUrl } = useMoogo();
const props = defineProps<{ key: string }>();
</script>

<template>
  <img :src="bucketPublicUrl(key)" alt="" />
</template>
```

## Nitro / Edge deployment

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  nitro: {
    preset: "vercel-edge", // or "cloudflare-pages", "netlify-edge"
  },
});
```

The `$fetch`/`ofetch` client works in all Nitro presets.

## Next

- [Next.js guide](/docs/guides/nextjs) — React equivalent
- [Vue guide](/docs/guides/vue) — SPA without Nuxt
- [SQL API reference](/docs/sql-api)
- [Object storage](/docs/object-storage)