# Quickstart

Two minutes from an account to a working query. If you already have an account,
start at [step 2](#2-create-a-project).

## 1. Register

Go to [moogo.dev/register](/register) and create an account with an email and a
password. One email is one account. Registration sends a confirmation link and
does not sign you in — follow the link first, then sign in.

Full detail: [Register](/docs/register).

## 2. Create a project

In the [dashboard](/app), click **New project**, name it, and confirm.

When it reaches the status `ready`, Moogo shows three values **once**:

```
MOOGO_BASE_URL=https://api.moogo.dev
MOOGO_PROJECT_ID=8f3c1a20-5b7e-4a91-9d3c-2f6b81e4a7d0
MOOGO_SQL_KEY=moogo_...
```

**Copy them now.** The SQL key is never displayed again — only a hash and an
eight-character prefix are stored. If you lose it, you can
[rotate it](/docs/credentials#rotating-a-key).

Put them in your environment:

```bash
export MOOGO_BASE_URL="https://api.moogo.dev"
export MOOGO_PROJECT_ID="8f3c1a20-5b7e-4a91-9d3c-2f6b81e4a7d0"
export MOOGO_SQL_KEY="moogo_..."
```

Full detail: [Create your first project](/docs/create-project).

## 3. Create a table


## 4. (Optional) Use the JavaScript/TypeScript SDK

The official `@moogodev/client` package provides a type-safe, zero-dependency client for Moogo's object storage and SQL API. Instead of manually constructing headers and URLs, you can use:

```bash
npm install @moogodev/client

# In your Node.js app:
import { createClient } from '@moogodev/client'

const client = createClient({
  baseUrl: 'https://api.moogo.dev',
  storageKey: 'your-storage-key',
  sqlKey: 'your-sql-key'
})

// Upload an object
await client.s3Upload({ bucket: 'default', key: 'avatars/kit.png', file: buffer })

# Run a SQL query
const result = await client.sql`SELECT * FROM users WHERE id = '123'`
```

**Detail**: [javascript-client.md](/docs/javascript-client.md)

Creating a table is a **write**, so it goes to `/exec`:

```bash
curl $MOOGO_BASE_URL/p/$MOOGO_PROJECT_ID/exec \
  -H "Authorization: Bearer $MOOGO_SQL_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "CREATE TABLE users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      plan TEXT NOT NULL DEFAULT '"'"'free'"'"',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )"
  }'
```

Response:

```json
{ "success": true, "rows_affected": 0, "size_bytes": 20480, "duration_ms": 1 }
```

## 4. Insert data


### FormData vs File blob per framework

Penggunaan `FormData` dan `Blob` sedikit berbeda tergantung framework yang digunakan. Berikut perbandingannya:

**React (useRef + onChange)**
```jsx
<InputType
  ref={fileRef}
  onChange={e => {
    const file = e.target.files[0]
    // Untuk FormData: langsung kirim files[0]
    // Untuk Blob: wrapper ke Blob terlebih dahulu
    setSelectedFile(fileRef.current.files[0])
  }}
```

**Next.js Server Actions**
```ts
// action.ts
'use server'
import { prisma } from '@/prisma'

export async function uploadFile(prevState: any, formData: FormData) {
  const file = formData.get('file') // ambil file dari FormData
  // Kirim ke Moogo API
  const res = await fetch('$ENDPOINT/avatars/kit.png?bucket=avatars', {
    method: 'POST',
    headers: {
      'X-Moogo-Access-Key-Id': $MOOGO_STORAGE_ACCESS_KEY_ID,
      Authorization: `Bearer $MOOGO_STORAGE_SECRET_KEY`,
    },
    body: formData, // langsung kirim FormData
  })
  // ...
}
```

**Next.js App Router (action route handler)**
```ts
// app/upload/route.ts
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const formData = await request.formData()
  const file = formData.get('file')
  // ... proses ke Moogo API
  return NextResponse.json({ success: true })
}
```

**Vue 3 (Composition API)**
```vue
<template>
  <input type="file" @change="onFileChange" ref="fileRef" />
</template>
<script setup>
import { ref } from 'vue'

const fileRef = ref<HTMLInputElement>()

const onFileChange = (e) => {
  const file = e.target.files[0]
  // Kirim ke API dengan FormData atau Blob
}
</script>
```

**Catatan Penting**: 
- `FormData.get('file')` mengembalikan `File` object langsung dari input element
- `Blob` digunakan ketika ingin membuat gambar baru dari data yang ada
- Semua framework ultimately mengirim `File` atau `Blob` melalui `FormData` ke API Moogo


Note the `args` array — values are bound parameters, never interpolated into the
SQL text.

```bash
curl $MOOGO_BASE_URL/p/$MOOGO_PROJECT_ID/exec \
  -H "Authorization: Bearer $MOOGO_SQL_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "INSERT INTO users (id, email, plan) VALUES (?, ?, ?)",
    "args": ["7c1f", "ketut@example.com", "pro"]
  }'
```

```json
{ "success": true, "rows_affected": 1, "size_bytes": 24576, "duration_ms": 1 }
```

## 5. Read it back

Reads go to `/query`:

```bash
curl $MOOGO_BASE_URL/p/$MOOGO_PROJECT_ID/query \
  -H "Authorization: Bearer $MOOGO_SQL_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query":"SELECT id, email, plan FROM users WHERE plan = ?","args":["pro"]}'
```

```json
{
  "success": true,
  "columns": ["id", "email", "plan"],
  "rows": [["7c1f", "ketut@example.com", "pro"]],
  "row_count": 1,
  "truncated": false,
  "duration_ms": 1
}
```

That is a working database.

## Several writes at once


## Receipt & Transaction Example

After uploading a file, you may want to attach the public URL (receipt) to a database transaction.

### Step 1: Upload an object

```bash
# Upload with FormData (see JavaScript example in object-storage.md)
const formData = new FormData()
formData.append('file', file)

fetch('$ENDPOINT/avatars/kit.png?bucket=avatars', {
  method: 'POST',
  headers: {
    'X-Moogo-Access-Key-Id': $MOOGO_STORAGE_ACCESS_KEY_ID,
    Authorization: `Bearer $MOOGO_STORAGE_SECRET_KEY`,
  },
  body: formData,
})
```

### Step 2: Get the public URL (receipt)

```js
// After upload, the object's public_url will be populated
const receiptUrl = object.public_url // e.g., https://cdn.moogo.dev/p/abc/kit.png
```

### Step 3: Save receipt URL to transaction

```bash
curl $MOOGO_BASE_URL/p/$MOOGO_PROJECT_ID/transaction   -H "Authorization: Bearer $MOOGO_SQL_KEY"   -H "Content-Type: application/json"   -d '{
    "query": "INSERT INTO incomes (description, receipt_url, amount) VALUES (??, ?, ?)",
    "args": ["Avatar upload", "$receiptUrl", 1000]
  }'
```

**Catatan**: `public_url` hanya akan terisi setelah object dipublish (lihat `POST /buckets/{id}/public`). Jika object masih private, `public_url` akan kosong.

### Several writes at once

When one change is several statements, send them as one batch:

```bash
curl $MOOGO_BASE_URL/p/$MOOGO_PROJECT_ID/transaction   -H "Authorization: Bearer $MOOGO_SQL_KEY"   -H "Content-Type: application/json"   -d '{
    "statements": [
      { "query": "INSERT INTO users (id, email) VALUES (?, ?)", "args": ["7c1f", "ketut@example.com"] },
      { "query": "UPDATE counters SET signups = signups + 1 WHERE name = ?", "args": ["total"] }
    ]
  }'
```

Either both statements commit or neither does, so a request that half-succeeds
cannot leave your data in a state your code never intended. Full reference:
[`POST /transaction`](/docs/sql-api#post-transaction-writes-as-one-unit).

### The one rule to remember

| Endpoint | Accepts | Rejects |
|---|---|---|
| `/query` | Read-only SQL statements | Write statements (`INSERT`, `UPDATE`, `DELETE`) |
| `/exec` | Write statements (`INSERT`, `UPDATE`, `DELETE`) | Read-only statements |
| `/transaction` | Multiple write statements in one batch | Empty batch, more than 100 statements |

When one change is several statements, send them as one batch:

```bash
curl $MOOGO_BASE_URL/p/$MOOGO_PROJECT_ID/transaction \
  -H "Authorization: Bearer $MOOGO_SQL_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "statements": [
      { "query": "INSERT INTO users (id, email) VALUES (?, ?)", "args": ["7c1f", "ketut@example.com"] },
      { "query": "UPDATE counters SET signups = signups + 1 WHERE name = ?", "args": ["total"] }
    ]
  }'
```

Either both statements commit or neither does, so a request that half-succeeds
cannot leave your data in a state your code never intended. Full reference:
[`POST /transaction`](/docs/sql-api#post-transaction-writes-as-one-unit).

## The one rule to remember

| Endpoint | Accepts | Rejects |
|---|---|---|
| `/query` | Reads — `SELECT`, `VALUES`, `PRAGMA`, `EXPLAIN`, `WITH` that selects | Writes, with `not_a_read` |
| `/exec` | Writes — `INSERT`, `UPDATE`, `DELETE`, `CREATE`, `ALTER`, `DROP` | Reads, with `not_a_write` |

Sending the wrong kind of statement is the most common early mistake, and it is
rejected rather than silently accepted so you find out immediately.

## From JavaScript

The quickest way to integrate, since there is no driver to install:

```js
const headers = {
  Authorization: `Bearer ${process.env.MOOGO_SQL_KEY}`,
  "Content-Type": "application/json",
};

export async function sql(query, args = []) {
  // `with` covers CTE reads (WITH ... SELECT). A CTE that writes
  // (WITH ... INSERT) must be sent to /exec directly.
  const endpoint = /^(select|values|pragma|explain|with)\b/i.test(query.trim())
    ? "query"
    : "exec";

  const response = await fetch(
    `${process.env.MOOGO_BASE_URL}/p/${process.env.MOOGO_PROJECT_ID}/${endpoint}`,
    { method: "POST", headers, body: JSON.stringify({ query, args }) },
  );

  const body = await response.json();
  if (!response.ok) throw new Error(body.error?.message ?? "request failed");
  return body;
}
```

```js
const proUsers = await sql(
  "SELECT id, email FROM users WHERE plan = ?",
  ["pro"],
);
```

`rows` come back as arrays aligned with `columns`. Full reference:
[SQL API](/docs/sql-api).

## From the dashboard

You never need a key to explore. Open the project's **Database** tab to browse
tables as a spreadsheet, build tables without writing DDL, and run SQL in a
console with the same rules the API applies.

## What to read next

- [SQL API](/docs/sql-api) — the full query, exec and transaction reference
- [Schema & migrations](/docs/schema-best-practices) — batch inserts, paging, indexes
- [Credentials](/docs/credentials) — keys, rotation, and storage credentials
- [Object storage](/docs/object-storage) — files under the same project
- [Limits](/docs/limits) — the quotas you are working within