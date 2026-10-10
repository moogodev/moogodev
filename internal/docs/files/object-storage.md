# Object storage

Files live under your project with a [storage credential](/docs/credentials) — not
the SQL project key. This page is the full reference.

## Routes

There are three mounts for the same handlers. They behave identically; pick
whichever fits your client.

| Route | Credential | Use it for |
|---|---|---|
| `/p/{project_id}/bucket/*` | Storage credential | **Your application.** This is the one to use. |
| `/bucket/{project_id}/*` | Storage credential | The original form, kept working. |
| `/api/projects/{project_id}/bucket/*` | Session cookie | The dashboard. Not for applications. |

The `/p/` form is recommended for new code because the project id is already in
the URL and you append only the object key.

## Authentication

Two headers, on every request:

```
X-Moogo-Access-Key-Id: moogo_ak_...
Authorization: Bearer moogo_sk_...
```

```bash
export ENDPOINT="https://api.moogo.dev/p/$MOOGO_PROJECT_ID/bucket"

curl "$ENDPOINT/avatars/kit.png" \
  -H "X-Moogo-Access-Key-Id: $MOOGO_BUCKET_ACCESS_KEY_ID" \
  -H "Authorization: Bearer $MOOGO_BUCKET_SECRET_KEY"
```

The project key does **not** work here, and a credential for one project does not
work against another's URL.

## Upload

```bash
curl -X POST "$ENDPOINT/avatars/kit.png" \
  -H "X-Moogo-Access-Key-Id: $MOOGO_BUCKET_ACCESS_KEY_ID" \
  -H "Authorization: Bearer $MOOGO_BUCKET_SECRET_KEY" \
  -H "Content-Type: image/png" \
  --data-binary @kit.png
```

**Where it lands.** The first path segment is part of the key, not the bucket:
`avatars/kit.png` is a key in the bucket named `default`, which Moogo creates on
first use. A bucket is chosen by the `?bucket=` parameter and nothing else, so to
put the object in a bucket of your own, add it:

```bash
curl -X POST "$ENDPOINT/kit.png?bucket=avatars" \
  -H "X-Moogo-Access-Key-Id: $MOOGO_BUCKET_ACCESS_KEY_ID" \
  -H "Authorization: Bearer $MOOGO_BUCKET_SECRET_KEY" \
  -H "Content-Type: image/png" \
  --data-binary @kit.png
```

A named bucket has to exist first — create it through
[`POST /buckets/{project_id}`](#bucket-catalog). An upload naming a bucket that
does not exist answers `404 not_found` rather than quietly making one, so a typo
cannot scatter objects across buckets you never asked for.

Response, for the first upload:

```json
{
  "success": true,
  "object": {
    "id": "b21d9f04-77a3-4c58-9e0a-2f8c6d5b1e93",
    "bucket_id": "3f8a2c11-9d4e-4b7a-8f21-5e6c3d9a1b84",
    "bucket": "default",
    "key": "avatars/kit.png",
    "size_bytes": 24576,
    "content_type": "image/png",
    "is_public": false,
    "etag": "\"a1b2c3d4\"",
    "url": "https://api.moogo.dev/p/8f3c.../bucket/avatars/kit.png",
    "preview_url": "/api/projects/8f3c.../bucket/avatars/kit.png",
    "public_url": "",
    "created_at": "2026-10-01T09:20:11Z",
    "updated_at": "2026-10-01T09:20:11Z",
    "last_modified": "2026-10-01T09:20:11Z"
  },
  "storage_used_bytes": 10485760,
  "quota_bytes": 262144000
}
```

### The three URL fields

This trips people up, so it is worth being explicit.

| Field | Route | Needs a credential? | Use it for |
|---|---|---|---|
| `url` | `/p/{id}/bucket/{key}` | **Yes** — storage credential | Your application fetching a private object. |
| `preview_url` | `/api/projects/{id}/bucket/{key}` | Session cookie | The dashboard rendering a preview. |
| `public_url` | `/pub/{id}/{key}` | **No** | Sharing a published object. |

`url` is the one your application uses. Do not put it in an `<img>` tag: a browser
tab does not carry a storage credential, so the image would break for every
private object. `public_url` is an empty string until the object is published —
a value you can test for, rather than a missing field.

### Upload limits

- **Per object:** the bucket's `max_object_size_bytes`, or the project ceiling if
  the bucket sets none.
- **Per project:** 250 MB total, across all buckets.
- **Per request:** the same object cap. The JSON endpoints are capped at 1 MB, but
  storage is not — a 1 MB cap on a 250 MB project would mean nobody could ever
  fill their bucket.

Failures are distinguishable:

| Code | Status | Means |
|---|---|---|
| `object_too_large` | 413 | Over **this bucket's** cap. `detail` names the limit. |
| `quota_exceeded` | 507 | The project total is full. `detail` reports usage and quota. |

## Download

```bash
curl "$ENDPOINT/avatars/kit.png" \
  -H "X-Moogo-Access-Key-Id: $MOOGO_BUCKET_ACCESS_KEY_ID" \
  -H "Authorization: Bearer $MOOGO_BUCKET_SECRET_KEY"
```

`GET` returns the bytes with the object's `Content-Type`. `HEAD` returns the same
headers with no body — use it to check existence and size before downloading.

```bash
curl -I "$ENDPOINT/avatars/kit.png" \
  -H "X-Moogo-Access-Key-Id: $MOOGO_BUCKET_ACCESS_KEY_ID" \
  -H "Authorization: Bearer $MOOGO_BUCKET_SECRET_KEY"
```

## Public download

```bash
curl https://api.moogo.dev/pub/8f3c1a20-5b7e-4a91-9d3c-2f6b81e4a7d0/avatars/kit.png
```

No headers. Serves only objects that were published; anything else returns `404`,
so a private object is indistinguishable from a missing one.

## List objects

```bash
curl "$ENDPOINT/?bucket=avatars&limit=50&order=created&dir=desc" \
  -H "X-Moogo-Access-Key-Id: $MOOGO_BUCKET_ACCESS_KEY_ID" \
  -H "Authorization: Bearer $MOOGO_BUCKET_SECRET_KEY"
```

| Query parameter | Notes |
|---|---|
| `bucket` | Limit to one bucket. |
| `prefix` | Only keys starting with this. This is how you list a "folder". |
| `search` | Substring match on the key. |
| `order` | `key`, `size`, `created`, `updated`, or `contenttype`. |
| `dir` | `asc` or `desc`. |
| `limit` | Page size. Defaults to 100. |
| `offset` | Skip this many, for paging. |

Response:

```json
{
  "success": true,
  "bucket": { "id": "3f8a...", "name": "avatars", "object_count": 42, "size_bytes": 10485760 },
  "objects": [ /* … */ ],
  "total": 42,
  "limit": 50,
  "offset": 0,
  "storage_used_bytes": 10485760,
  "quota_bytes": 262144000
}
```

`total` is the count of everything matching the filter, not the length of
`objects`, so you can compute the page count without a second request.

## Update an object

`PATCH` changes an object's metadata or key.

**Rename or move:**

```json
{ "rename_to": "avatars/2026/kit.png" }
```

**Publish or unpublish:**

```json
{ "is_public": true }
```

Renaming moves the file and updates its record atomically from the caller's point
of view; the object keeps its identity and `id`.

## Delete

**One object:**

```bash
curl -X DELETE "$ENDPOINT/avatars/kit.png" \
  -H "X-Moogo-Access-Key-Id: $MOOGO_BUCKET_ACCESS_KEY_ID" \
  -H "Authorization: Bearer $MOOGO_BUCKET_SECRET_KEY"
```

```json
{
  "success": true,
  "deleted": 1,
  "freed_bytes": 24576,
  "storage_used_bytes": 10485760,
  "quota_bytes": 262144000
}
```

**Everything under a prefix** — this is the folder delete, and it is an explicit
opt-in because it is not obviously destructive from the URL alone:

```bash
curl -X DELETE "$ENDPOINT/avatars/?prefix=true" \
  -H "X-Moogo-Access-Key-Id: $MOOGO_BUCKET_ACCESS_KEY_ID" \
  -H "Authorization: Bearer $MOOGO_BUCKET_SECRET_KEY"
```

`?prefix=true` is required. Without it the same URL deletes nothing, so a routine
"clear this folder" call cannot silently wipe it.

## Bucket catalog

```bash
curl https://api.moogo.dev/buckets/$MOOGO_PROJECT_ID \
  -H "X-Moogo-Access-Key-Id: $MOOGO_BUCKET_ACCESS_KEY_ID" \
  -H "Authorization: Bearer $MOOGO_BUCKET_SECRET_KEY"
```

```json
{
  "success": true,
  "buckets": [
    {
      "id": "3f8a...",
      "name": "avatars",
      "object_count": 42,
      "size_bytes": 10485760,
      "created_at": "2026-10-01T09:14:22Z",
      "is_public": false,
      "allowed_types": ["image"],
      "max_object_size_bytes": 2097152,
      "quota_bytes": 247463936
    }
  ],
  "storage_used_bytes": 10485760,
  "quota_bytes": 262144000
}
```

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/buckets/{project_id}` | List buckets with counts. |
| `POST` | `/buckets/{project_id}` | Create a bucket. |
| `PATCH` | `/buckets/{project_id}/{bucket_id}` | Update visibility, upload policy, and quota. |
| `DELETE` | `/buckets/{project_id}/{bucket_id}` | Delete a bucket and its objects. |
| `POST` | `/buckets/{project_id}/{bucket_id}/public` | Publish or unpublish the bucket. |

The catalog lives on its own `/buckets` prefix rather than under
`/bucket/{bucket_id}/`. Folding it in would have meant reserving the key `bucket`,
so you could never upload a file with that name — a silent restriction on what
you can store.

## Errors

| Code | Status | Meaning |
|---|---|---|
| `missing_key` | 400 | No object key in the path. |
| `invalid_key` | 400 | The key breaks the naming rules. |
| `key_taken` | 409 | An object with that key already exists in this project. |
| `not_found` | 404 | No such object or bucket. |
| `object_too_large` | 413 | Over the bucket's per-object cap. |
| `quota_exceeded` | 507 | The project storage total is full. |
| `invalid_prefix` | 400 | The prefix for a folder delete is not valid. |
| `storage_error` | 500 | The request could not be completed. |

All of them use the standard envelope:

```json
{ "error": { "code": "object_too_large", "message": "the object is larger than this bucket accepts", "detail": "bucket limit is 2097152 bytes" } }
```

## A small client

```js
// storage.js
// MOOGO_BUCKET_ENDPOINT already ends in /p/{project_id}/bucket.
const root = process.env.MOOGO_BUCKET_ENDPOINT;

const headers = {
  "X-Moogo-Access-Key-Id": process.env.MOOGO_BUCKET_ACCESS_KEY_ID,
  Authorization: `Bearer ${process.env.MOOGO_BUCKET_SECRET_KEY}`,
};

async function storage(path = "", init = {}) {
  const response = await fetch(`${root}/${path}`, { ...init, headers });
  const body = await response.json();
  if (!response.ok) {
    const error = new Error(body.error?.message ?? "storage request failed");
    error.code = body.error?.code;
    throw error;
  }
  return body;
}

export const upload = (key, file, bucket) =>
  storage(`${encodeKey(key)}${bucket ? `?bucket=${bucket}` : ""}`, {
    method: "POST",
    headers: { ...headers, "Content-Type": file.type || "application/octet-stream" },
    body: file,
  });

// GET returns the bytes, not JSON, so this bypasses storage().
export const download = async (key) => {
  const response = await fetch(`${root}/${encodeKey(key)}`, { headers });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error?.message ?? "storage request failed");
  }
  return response.blob();
};

export const list = (prefix) =>
  storage(`?prefix=${encodeURIComponent(prefix)}&limit=100`);

// Slashes are meaningful in a key, so encode each segment and keep them.
const encodeKey = (key) =>
  key.split("/").map(encodeURIComponent).join("/");
```

## Next

- [Create a bucket](/docs/create-bucket) — policies and public objects
- [Credentials](/docs/credentials) — storage credentials in detail
- [Security](/docs/security) — how public URLs and key validation work