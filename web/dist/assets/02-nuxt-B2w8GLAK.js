var e=`# Nuxt 3

Works with Server Routes, Composables, and Nitro (Edge/Node).

## Setup

\`\`\`bash
# No extra packages needed (ofetch is built-in)
\`\`\`

**Environment variables** (\`.env\` or runtime config):

\`\`\`env
MOOGO_BASE_URL=https://api.moogo.dev
MOOGO_PROJECT_ID=<project-id>
MOOGO_SQL_KEY=moogo_...
# Optional — origin public objects are served from; falls back to the bucket endpoint origin when empty.
MOOGO_CDN_URL=https://cdn.moogo.dev
MOOGO_STORAGE_ACCESS_KEY_ID=moogo_ak_...
MOOGO_STORAGE_SECRET_KEY=moogo_sk_...
\`\`\`

\`\`\`ts
// nuxt.config.ts
export default defineNuxtConfig({
  runtimeConfig: {
    moogoBaseUrl: process.env.MOOGO_BASE_URL,
    moogoProjectId: process.env.MOOGO_PROJECT_ID,
    moogoSqlKey: process.env.MOOGO_SQL_KEY,
    public: {
      moogoBaseUrl: process.env.MOOGO_BASE_URL,
      moogoProjectId: process.env.MOOGO_PROJECT_ID,
      moogoCdnUrl: process.env.MOOGO_CDN_URL,
      moogoBucketAccessKeyId: process.env.MOOGO_STORAGE_ACCESS_KEY_ID,
      moogoBucketSecretKey: process.env.MOOGO_STORAGE_SECRET_KEY,
    },
  },
});
\`\`\`

## Composable (\`composables/useMoogo.ts\`)

\`\`\`ts
// composables/useMoogo.ts
export const useMoogo = () => {
  const config = useRuntimeConfig();

  const BASE_URL = config.moogoBaseUrl as string;
  const PROJECT_ID = config.moogoProjectId as string;
  const SECRET_KEY = config.moogoSqlKey as string;
  const PROJECT_URL = \`\${BASE_URL}/p/\${PROJECT_ID}\`;
  const BUCKET_BASE_URL = config.public.moogoBaseUrl as string;
  const BUCKET_PROJECT_ID = config.public.moogoProjectId as string;
  const BUCKET_ENDPOINT = \`\${BUCKET_BASE_URL}/p/\${BUCKET_PROJECT_ID}/bucket\`;
  const CDN_URL = ((config.public.moogoCdnUrl as string) ?? "").replace(/\\/+$/, "");
  const BUCKET_ACCESS_KEY_ID = config.public.moogoBucketAccessKeyId as string;
  const BUCKET_SECRET_KEY = config.public.moogoBucketSecretKey as string;

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

  // ── SQL ────────────────────────────────────────────────────────────
  async function query(sql: string, args: any[] = []) {
    const res = await $fetch(\`\${PROJECT_URL}/query\`, {
      method: "POST",
      headers: SQL_HEADERS,
      body: { query: sql, args },
    });
    return handle(res as any);
  }

  async function exec(sql: string, args: any[] = []) {
    const res = await $fetch(\`\${PROJECT_URL}/exec\`, {
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
  const base = BUCKET_ENDPOINT.replace(/\\/p\\/([^/]+)\\/bucket\\/?$/, "/pub/$1");
  return CDN_URL ? base.replace(/^https?:\\/\\/[^/]+/, CDN_URL) : base;
}

  // ── Bucket ─────────────────────────────────────────────────────────
  async function bucketUpload(key: string, body: BodyInit, contentType: string) {
    const res = await $fetch(\`\${BUCKET_ENDPOINT}/\${encodeKey(key)}\`, {
      method: "POST",
      headers: { ...STORAGE_HEADERS, "Content-Type": contentType },
      body,
    });
    return handle(res as any);
  }

  async function bucketDownload(key: string) {
    return $fetch.raw(\`\${BUCKET_ENDPOINT}/\${encodeKey(key)}\`, {
      headers: STORAGE_HEADERS,
      responseType: "blob",
    });
  }

  async function bucketDelete(key: string) {
    const res = await $fetch(\`\${BUCKET_ENDPOINT}/\${encodeKey(key)}\`, {
      method: "DELETE",
      headers: STORAGE_HEADERS,
    });
    return handle(res as any);
  }

  async function bucketList(prefix?: string) {
    const url = new URL(\`\${BUCKET_ENDPOINT}\`);
    if (prefix) url.searchParams.set("prefix", prefix);
    const res = await $fetch(url.toString(), { headers: STORAGE_HEADERS });
    return handle(res as any);
  }

  // Publish an object so its public URL resolves. Uploads are private by
  // default, and public_url stays an empty string until this is called.
  async function bucketPublish(key: string) {
    const res = await $fetch(\`\${BUCKET_ENDPOINT}/\${encodeKey(key)}\`, {
      method: "PATCH",
      headers: { ...STORAGE_HEADERS, "Content-Type": "application/json" },
      body: { is_public: true },
    });
    return handle(res as any);
  }

  // Public download (no auth needed once the object is published)
  function bucketPublicUrl(key: string): string {
    return \`\${publicBase()}/\${encodeKey(key)}\`;
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
    bucketPublish,
    bucketPublicUrl,
  };
};
\`\`\`

## Usage in components

\`\`\`vue
<!-- pages/users.vue -->
<script setup lang="ts">
const { sql, toObjects } = useMoogo();

const users = ref([]);

async function load() {
  users.value = await toObjects(await sql("SELECT id, email, plan FROM users"));
}

await load();
<\/script>

<template>
  <ul>
    <li v-for="u in users" :key="u.id">
      {{ u.email }} — {{ u.plan }}
    </li>
  </ul>
</template>
\`\`\`

## Server API routes

\`\`\`ts
// server/api/users.get.ts
export default defineEventHandler(async () => {
  const { sql, toObjects } = useMoogo();
  return toObjects(await sql("SELECT id, email, plan FROM users"));
});
\`\`\`

\`\`\`ts
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
\`\`\`

## Bucket in Nuxt

\`\`\`vue
<!-- components/AvatarUpload.vue -->
<script setup lang="ts">
const { bucketUpload, bucketPublish, bucketPublicUrl } = useMoogo();

const uploading = ref(false);
const publicUrl = ref("");

async function onUpload(e: Event) {
  const input = e.target as HTMLInputElement;
  if (!input.files?.[0]) return;
  uploading.value = true;
  const file = input.files[0];
  const key = \`avatars/\${file.name}\`;
  await bucketUpload(key, file, file.type);
  // Uploads are private by default — publish so the public URL resolves.
  await bucketPublish(key);
  publicUrl.value = bucketPublicUrl(key);
  uploading.value = false;
}
<\/script>

<template>
  <input type="file" @change="onUpload" :disabled="uploading" />
  <p v-if="uploading">Uploading…</p>
  <img v-if="publicUrl" :src="publicUrl" alt="" />
</template>
\`\`\`

\`\`\`vue
<!-- components/Avatar.vue (public) -->
<script setup lang="ts">
const { bucketPublicUrl } = useMoogo();
const props = defineProps<{ key: string }>();
<\/script>

<template>
  <img :src="bucketPublicUrl(key)" alt="" />
</template>
\`\`\`

## Nitro / Edge deployment

\`\`\`ts
// nuxt.config.ts
export default defineNuxtConfig({
  nitro: {
    preset: "vercel-edge", // or "cloudflare-pages", "netlify-edge"
  },
});
\`\`\`

## Production Readiness ⚠️

- **SQL transactions**: Max 100 statements per \`/transaction\` and 15-second budget. Do not combine large DDL with intensive data manipulation in a single transaction.
- **Database size limit**: 250 MB per project. Database does not auto-shrink — delete rows progressively if approaching the limit, and monitor daily usage.
- **Sensitive column names**: Certain names (\`readfile\`, \`writefile\`, \`delete\`, \`vacuum\`, \`attach\`, \`detach\`, \`reindex\`, \`analyze\`, \`pragma\`) are blocked as column names in SQL queries.
- **Public object URLs**: \`public_url\` is a bearer token — cannot be revoked without rotating the key or unpublishing the object. Perform \`PATCH is_public: true\` after upload if you want to share without credentials.
- **Error handling**: Use \`error.code\` rather than \`error.message\` for safe branching (retryable vs non-retryable).

The \`$fetch\`/\`ofetch\` client works in all Nitro presets.

## Next

- [Next.js guide](/docs/guides/nextjs) — React equivalent
- [Vue guide](/docs/guides/vue) — SPA without Nuxt
- [SQL API reference](/docs/sql-api)
- [Schema & migrations](/docs/schema-best-practices) — transactions, batch inserts, paging, indexes
- [Object storage](/docs/object-storage)`;export{e as default};