var e=`# Object storage

Files live under your project with a [storage credential](/docs/credentials) — not
the SQL project key. This page is the full reference.

## Routes

There are three mounts for the same handlers. They behave identically; pick
whichever fits your client.

| Route | Credential | Use it for |
|---|---|---|
| \`/p/{project_id}/bucket/*\` | Storage credential | **Your application.** This is the one to use. |
| \`/bucket/{project_id}/*\` | Storage credential | The original form, kept working. |
| \`/api/projects/{project_id}/bucket/*\` | Session cookie | The dashboard. Not for applications. |

The \`/p/\` form is recommended for new code because the project id is already in
the URL and you append only the object key.

## Authentication

Two headers, on every request:

\`\`\`
X-Moogo-Access-Key-Id: moogo_ak_...
Authorization: Bearer moogo_sk_...
\`\`\`

\`\`\`bash
export ENDPOINT="https://api.moogo.dev/p/$MOOGO_PROJECT_ID/bucket"

curl "$ENDPOINT/avatars/kit.png" \\
  -H "X-Moogo-Access-Key-Id: $MOOGO_STORAGE_ACCESS_KEY_ID" \\
  -H "Authorization: Bearer $MOOGO_STORAGE_SECRET_KEY"
\`\`\`

The project key does **not** work here, and a credential for one project does not
work against another's URL.

## Upload

\`\`\`bash
curl -X POST "$ENDPOINT/avatars/kit.png" \\
  -H "X-Moogo-Access-Key-Id: $MOOGO_STORAGE_ACCESS_KEY_ID" \\
  -H "Authorization: Bearer $MOOGO_STORAGE_SECRET_KEY" \\
  -H "Content-Type: image/png" \\
  --data-binary @kit.png
\`\`\`

**Where it lands.** The first path segment is part of the key, not the bucket:
\`avatars/kit.png\` is a key in the bucket named \`default\`, which Moogo creates on
first use. A bucket is chosen by the \`?bucket=\` parameter and nothing else, so to
put the object in a bucket of your own, add it:

\`\`\`bash
curl -X POST "$ENDPOINT/kit.png?bucket=avatars" \\
  -H "X-Moogo-Access-Key-Id: $MOOGO_STORAGE_ACCESS_KEY_ID" \\
  -H "Authorization: Bearer $MOOGO_STORAGE_SECRET_KEY" \\
  -H "Content-Type: image/png" \\
  --data-binary @kit.png
\`\`\`

A named bucket has to exist first — create it through
[\`POST /buckets/{project_id}\`](#bucket-catalog). An upload naming a bucket that
does not exist answers \`404 not_found\` rather than quietly making one, so a typo
cannot scatter objects across buckets you never asked for.

Response, for the first upload:

\`\`\`json
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
    "etag": "\\"a1b2c3d4\\"",
    "url": "https://api.moogo.dev/p/8f3c.../bucket/avatars/kit.png",
    "preview_url": "/api/projects/8f3c.../bucket/avatars/kit.png",
    "public_url": "",
    "public_url_base": "https://cdn.moogo.dev",
    "url_base": "https://api.moogo.dev",
    "created_at": "2026-10-01T09:20:11Z",
    "updated_at": "2026-10-01T09:20:11Z",
    "last_modified": "2026-10-01T09:20:11Z"
  },
  "storage_used_bytes": 10485760,
  "quota_bytes": 262144000
}
\`\`\`

### The five URL fields

This trips people up, so it is worth being explicit.

| Field | Route | Needs a credential? | Use it for |
|---|---|---|---|
| \`url\` | \`/p/{id}/bucket/{key}\` | **Yes** — storage credential | Your application fetching a private object. |
| \`preview_url\` | \`/api/projects/{id}/bucket/{key}\` | Session cookie | The dashboard rendering a preview. |
| \`public_url\` | \`/pub/{id}/{key}\` | **No** | Sharing a published object. |
| \`public_url_base\` | (CDN origin) | — | Building public URLs in clients. |
| \`url_base\` | (API origin) | — | Building authenticated URLs in clients. |

\`url\` is the one your application uses. Do not put it in an \`<img>\` tag: a browser
tab does not carry a storage credential, so the image would break for every
private object. \`public_url\` is an empty string until the object is published —
a value you can test for, rather than a missing field.

\`url\` and \`preview_url\` are always built from the API origin. \`public_url\` is
built from the deployment's CDN origin (\`MOOGO_CDN_URL\`) when it has one, so a
published object is served — and can be cached — on a host of its own rather
than on the credential-bearing API host. With no CDN configured it falls back to
the API origin.

The two base fields (\`public_url_base\`, \`url_base\`) let clients construct URLs
without hardcoding origins.

### Upload limits

- **Per object:** the bucket's \`max_object_size_bytes\`, or the project ceiling if
  the bucket sets none.
- **Per project:** 250 MB total, across all buckets.
- **Per request:** the same object cap. The JSON endpoints are capped at 1 MB, but
  storage is not — a 1 MB cap on a 250 MB project would mean nobody could ever
  fill their bucket.

Failures are distinguishable:

| Code | Status | Means |
|---|---|---|
| \`object_too_large\` | 413 | Over **this bucket's** cap. \`detail\` names the limit. |
| \`quota_exceeded\` | 507 | The project total is full. \`detail\` reports usage and quota. |

### Custom Cache-Control

You can override the default caching behavior for an object by sending a
\`Cache-Control\` header on the upload request:

\`\`\`bash
curl -X POST "$ENDPOINT/avatars/kit.png" \\
  -H "X-Moogo-Access-Key-Id: $MOOGO_STORAGE_ACCESS_KEY_ID" \\
  -H "Authorization: Bearer $MOOGO_STORAGE_SECRET_KEY" \\
  -H "Content-Type: image/png" \\
  -H "Cache-Control: public, max-age=31536000, immutable" \\
  --data-binary @kit.png
\`\`\`

The header is stored with the object and used for all subsequent downloads
(both authenticated and public). If omitted, Moogo applies its defaults:

| Access type | Default \`Cache-Control\` |
|---|---|
| Published (\`/pub/\`) | \`public, max-age=300, must-revalidate\` |
| Private / Signed | \`private, no-cache\` |

A custom value replaces the default for that object entirely. Common patterns:

| Goal | Header |
|---|---|
| Long-term cache, never revalidate | \`public, max-age=31536000, immutable\` |
| No caching, always check server | \`no-store\` |
| Cache for 1 hour, revalidate | \`public, max-age=3600, must-revalidate\` |
| Private cache only, 1 hour | \`private, max-age=3600\` |

> **Note:** The \`Cache-Control\` header you send on upload applies to **all**
> subsequent downloads of that object. It is not request-specific. To change it,
> re-upload the object with a new header (the object key and ETag will update).

## Download

\`\`\`bash
curl "$ENDPOINT/avatars/kit.png" \\
  -H "X-Moogo-Access-Key-Id: $MOOGO_STORAGE_ACCESS_KEY_ID" \\
  -H "Authorization: Bearer $MOOGO_STORAGE_SECRET_KEY"
\`\`\`

\`GET\` returns the bytes with the object's \`Content-Type\`. \`HEAD\` returns the same
headers with no body — use it to check existence and size before downloading.

\`\`\`bash
curl -I "$ENDPOINT/avatars/kit.png" \\
  -H "X-Moogo-Access-Key-Id: $MOOGO_STORAGE_ACCESS_KEY_ID" \\
  -H "Authorization: Bearer $MOOGO_STORAGE_SECRET_KEY"
\`\`\`

### Range requests (partial downloads)

Both \`GET\` and \`HEAD\` support the \`Range\` header for partial content:

\`\`\`bash
# Get bytes 0-999 (first 1 KB)
curl -H "Range: bytes=0-999" "$ENDPOINT/avatars/kit.png" \\
  -H "X-Moogo-Access-Key-Id: $MOOGO_STORAGE_ACCESS_KEY_ID" \\
  -H "Authorization: Bearer $MOOGO_STORAGE_SECRET_KEY"
\`\`\`

- \`206 Partial Content\` with \`Content-Range\` header when range is valid
- \`416 Range Not Satisfiable\` when range is outside file size
- \`If-Range\` header supported for conditional range requests (validate ETag or Last-Modified)

Use this for resumable downloads, streaming large files, or reading only the
metadata (e.g., first few bytes to detect file type).

## Public download

\`\`\`bash
curl https://cdn.moogo.dev/pub/8f3c1a20-5b7e-4a91-9d3c-2f6b81e4a7d0/avatars/kit.png
\`\`\`

No headers. This host is the CDN origin (\`MOOGO_CDN_URL\`); a deployment without
one serves the same route from the API host. It serves only objects that were
published, or a single object named by a valid signed URL (next section);
anything else returns \`404\`, so a private object is indistinguishable from a
missing one. Responses carry
\`Cross-Origin-Resource-Policy: cross-origin\`, so a page on any other domain can
embed them in an \`<img>\`, a \`<video>\`, or CSS.

## Signed URLs

A signed URL serves one object for a limited time without a credential. Use it
when the reader cannot hold a secret: a private image embedded in someone
else's page, a download handed to a build step, a file shared with a partner
for an hour.

Mint one with the storage credential:

\`\`\`bash
curl -X POST "https://api.moogo.dev/buckets/$MOOGO_PROJECT_ID/sign" \\
  -H "X-Moogo-Access-Key-Id: $MOOGO_STORAGE_ACCESS_KEY_ID" \\
  -H "Authorization: Bearer $MOOGO_STORAGE_SECRET_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"key": "avatars/kit.png", "expires_in": 900}'
\`\`\`

\`\`\`json
{
  "url": "https://api.moogo.dev/pub/8f3c1a20-5b7e-4a91-9d3c-2f6b81e4a7d0/avatars/kit.png?exp=1800000900&sig=...",
  "method": "GET",
  "expires_at": "2026-10-19T15:00:00Z",
  "expires_in": 900
}
\`\`\`

\`GET\` that URL with no headers and the bytes come back, published or not. \`HEAD\`
works with the same link.

| Field | Notes |
|---|---|
| \`key\` | Required. Same naming rules as an upload; the signature covers it exactly. |
| \`method\` | \`GET\` (default) for a download link, \`PUT\` for an upload link. |
| \`bucket\` | Only with \`method: PUT\`. Defaults to the default bucket; a bucket name on a \`GET\` is refused with \`invalid_bucket\`. |
| \`expires_in\` | Seconds. Defaults to \`900\`; must be between \`60\` and \`604800\` (seven days). |

What the link cannot be edited into: the signature covers the method, the
project, the bucket, the key and the expiry, so changing the key, moving an
upload to another bucket, extending \`exp\` or replaying it against another
project breaks it. What it can do: be forwarded to anyone. Treat one as a
temporary password for a single file.

Two failures are worth telling apart:

- **\`403 link_expired\`** — the link was genuine and its time ran out. Mint a new
  one.
- **\`404 not_found\`** — the signature does not match, or the object is gone.
  A wrong key and a missing object look the same on purpose.

Signed downloads are not cacheable by shared caches (\`Cache-Control: private\`),
so a CDN never serves one past its expiry. Rotating the deployment's session
secret invalidates every outstanding signed URL at once — there is no per-link
revocation, so rotate when a link leaks and the time limit is not enough.

## Presigned uploads

Ask for \`method: PUT\` and the link writes instead of reading:

\`\`\`bash
curl -X POST "https://api.moogo.dev/buckets/$MOOGO_PROJECT_ID/sign" \\
  -H "X-Moogo-Access-Key-Id: $MOOGO_STORAGE_ACCESS_KEY_ID" \\
  -H "Authorization: Bearer $MOOGO_STORAGE_SECRET_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"key": "avatars/kit.png", "method": "PUT", "bucket": "avatars", "expires_in": 300}'
\`\`\`

The response carries a \`PUT\` URL. Send the bytes to it with no credential
header:

\`\`\`bash
curl -X PUT "$SIGNED_UPLOAD_URL" \\
  -H "Content-Type: image/png" \\
  --data-binary @kit.png
\`\`\`

This is what lets a browser upload straight from a form without ever holding a
storage secret. It is also why the upload URL is narrower than the credential:

- The link names one key in one bucket. Every naming rule, type policy and
  quota still applies, and a second \`PUT\` to a key that already exists is
  refused with \`key_taken\` exactly like a normal upload.
- A paused project refuses the write, so pausing stops a link minted a minute
  earlier as well.
- The signature covers the method, so a download link cannot be turned into a
  write, and an upload link cannot be turned into a read.

Because the grant is the URL itself, the public plane answers browser CORS
requests from any origin: \`Access-Control-Allow-Origin: *\` with no credentials
allowed, \`ETag\`, \`Content-Length\` and \`X-Request-ID\` exposed. Nothing on that
plane reads a cookie, so a wildcard origin grants only what the URL already
grants to whoever holds it.

Treat an upload link as public: anyone who receives it can write that one key
until it expires.

## List objects

\`\`\`bash
curl "$ENDPOINT/?bucket=avatars&limit=50&order=created&dir=desc" \\
  -H "X-Moogo-Access-Key-Id: $MOOGO_STORAGE_ACCESS_KEY_ID" \\
  -H "Authorization: Bearer $MOOGO_STORAGE_SECRET_KEY"
\`\`\`

| Query parameter | Notes |
|---|---|
| \`bucket\` | Limit to one bucket. |
| \`prefix\` | Only keys starting with this. This is how you list a "folder". |
| \`search\` | Substring match on the key. |
| \`order\` | \`key\`, \`size\`, \`created\`, \`updated\`, or \`contenttype\`. |
| \`dir\` | \`asc\` or \`desc\`. |
| \`limit\` | Page size. Defaults to 100, 1000 at most. |
| \`cursor\` | Continue after the last object of the previous page. Omit it for the first page. |

Response:

\`\`\`json
{
  "success": true,
  "bucket": { "id": "3f8a...", "name": "avatars", "object_count": 42, "size_bytes": 10485760 },
  "objects": [ /* … */ ],
  "total": 42,
  "limit": 50,
  "next_cursor": "eyJzIjoiYWZiM2Yw...",
  "storage_used_bytes": 10485760,
  "quota_bytes": 262144000
}
\`\`\`

\`total\` is the count of everything matching the filter, not the length of
\`objects\`, so you can compute the page count without a second request.

**Paging is by cursor.** The first request carries none; when \`next_cursor\`
comes back non-empty, send it back as \`cursor\` and you get the page after it.
Stop when it comes back empty. The token names a position in the sort order
rather than a number of rows to skip, so objects arriving or leaving between
two requests cannot make a page repeat an object or drop one — and it costs the
same to fetch page twenty as page two.

A cursor belongs to the listing that issued it: the same bucket, filters and
order. Presented anywhere else it is refused with \`invalid_cursor\` rather than
quietly applied to a different listing. Start again without one when the
question changes.

## Update an object

\`PATCH\` targets one object at \`$ENDPOINT/{key}\` and changes either its key or its
visibility. Send \`new_key\` to rename or move, \`is_public\` to publish or unpublish.

**Rename or move:**

\`\`\`bash
curl -X PATCH "$ENDPOINT/avatars/kit.png" \\
  -H "X-Moogo-Access-Key-Id: $MOOGO_STORAGE_ACCESS_KEY_ID" \\
  -H "Authorization: Bearer $MOOGO_STORAGE_SECRET_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"new_key": "avatars/2026/kit.png"}'
\`\`\`

**Publish or unpublish:**

\`\`\`bash
curl -X PATCH "$ENDPOINT/avatars/kit.png" \\
  -H "X-Moogo-Access-Key-Id: $MOOGO_STORAGE_ACCESS_KEY_ID" \\
  -H "Authorization: Bearer $MOOGO_STORAGE_SECRET_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"is_public": true}'
\`\`\`

\`true\` publishes the object and fills in its \`public_url\`; \`false\` makes it
private again and empties the field. Renaming moves the file and updates its
record atomically from the caller's point of view; the object keeps its identity
and \`id\`. A rename never changes visibility — if a body carries both \`new_key\` and
\`is_public\`, the rename wins and the visibility is left as it was.

## Publishing vs bucket visibility

There are two switches, and they do different things.

**Per object** — \`PATCH /p/{project_id}/bucket/{key}\` with \`{"is_public": true}\`. This
publishes or unpublishes a single object, and it is the normal way to share a
file. Only objects with \`is_public: true\` answer on \`/pub/{project_id}/{key}\`.

**Per bucket** — \`POST /buckets/{project_id}/{bucket_id}/public\` with
\`{"is_public": true|false}\`. This is a bulk operation, not a default for new
uploads alone: it sets the visibility new uploads inherit **and rewrites
\`is_public\` on every object already in the bucket**. The response's \`affected\`
field is the number of objects it changed. Making a bucket private therefore
takes every object in it off \`/pub/\` immediately; making it public puts every
object back.

The dashboard states this before saving a bucket visibility change, and the
bucket list labels the state as "every object is public" rather than "new
uploads are public", because that is what the toggle does.

Overwriting a key (\`PUT\` on an existing key) never changes visibility in either
direction: it is a storage operation, not a publishing one.

### Caching and unpublishing

A published object is served with \`Cache-Control: public, max-age=300,
must-revalidate\`, so a CDN or browser holds the bytes for at most five minutes.
A \`404\` on the public route is sent with \`Cache-Control: no-store\`, so a missing
or unpublished object is never cached negatively: publishing it is visible on
the next request.

Unpublishing stops new requests, but it cannot recall a copy that a CDN, a
browser, or another user already stored. Treat "publish" as "hand out this
file", not as a grant you can revoke after the fact. If you need a URL that can
be withdrawn cleanly, publish under a versioned key (\`avatar-v2.png\`) and stop
linking the old one.

## Delete

**One object:**

\`\`\`bash
curl -X DELETE "$ENDPOINT/avatars/kit.png" \\
  -H "X-Moogo-Access-Key-Id: $MOOGO_STORAGE_ACCESS_KEY_ID" \\
  -H "Authorization: Bearer $MOOGO_STORAGE_SECRET_KEY"
\`\`\`

\`\`\`json
{
  "success": true,
  "deleted": 1,
  "freed_bytes": 24576,
  "storage_used_bytes": 10485760,
  "quota_bytes": 262144000
}
\`\`\`

**Everything under a prefix** — this is the folder delete, and it is an explicit
opt-in because it is not obviously destructive from the URL alone:

\`\`\`bash
curl -X DELETE "$ENDPOINT/avatars/?prefix=true" \\
  -H "X-Moogo-Access-Key-Id: $MOOGO_STORAGE_ACCESS_KEY_ID" \\
  -H "Authorization: Bearer $MOOGO_STORAGE_SECRET_KEY"
\`\`\`

\`?prefix=true\` is required. Without it the same URL deletes nothing, so a routine
"clear this folder" call cannot silently wipe it.

## Bucket catalog

\`\`\`bash
curl https://api.moogo.dev/buckets/$MOOGO_PROJECT_ID \\
  -H "X-Moogo-Access-Key-Id: $MOOGO_STORAGE_ACCESS_KEY_ID" \\
  -H "Authorization: Bearer $MOOGO_STORAGE_SECRET_KEY"
\`\`\`

\`\`\`json
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
\`\`\`

| Method | Path | Purpose |
|---|---|---|
| \`GET\` | \`/buckets/{project_id}\` | List buckets with counts. |
| \`GET\` | \`/buckets/{project_id}/{bucket_id}\` | Get single bucket info + usage. |
| \`POST\` | \`/buckets/{project_id}\` | Create a bucket. |
| \`PATCH\` | \`/buckets/{project_id}/{bucket_id}\` | Update visibility, upload policy, and quota. |
| \`DELETE\` | \`/buckets/{project_id}/{bucket_id}\` | Delete a bucket and its objects. |
| \`POST\` | \`/buckets/{project_id}/{bucket_id}/public\` | Publish or unpublish the bucket — sets the upload default and rewrites every existing object. |
| \`POST\` | \`/buckets/{project_id}/{bucket_id}/purge-cache\` | List all public URLs in the bucket for CDN cache purging. |

### Purge CDN cache

\`\`\`bash
curl -X POST https://api.moogo.dev/buckets/$MOOGO_PROJECT_ID/$BUCKET_ID/purge-cache \\
  -H "X-Moogo-Access-Key-Id: $MOOGO_STORAGE_ACCESS_KEY_ID" \\
  -H "Authorization: Bearer $MOOGO_STORAGE_SECRET_KEY"
\`\`\`

\`\`\`json
{
  "success": true,
  "bucket_id": "3f8a...",
  "bucket_name": "avatars",
  "purged_count": 42,
  "urls": [
    "https://cdn.moogo.dev/pub/8f3c.../avatars/kit.png",
    "https://cdn.moogo.dev/pub/8f3c.../avatars/logo.png"
  ],
  "note": "These URLs should be purged from your CDN. If using Cloudflare, call the Purge Cache API with these URLs. For manual purge, use the dashboard or Cloudflare API with your zone ID and API token."
}
\`\`\`

Use this to enumerate every public URL in a bucket so you can issue a cache purge to your CDN
(Cloudflare, CloudFront, Fastly, etc.). The response includes all currently-public object URLs.
Future versions may call the CDN API directly when credentials are configured.

### Get bucket info

\`\`\`bash
curl https://api.moogo.dev/buckets/$MOOGO_PROJECT_ID/$BUCKET_ID \\
  -H "X-Moogo-Access-Key-Id: $MOOGO_STORAGE_ACCESS_KEY_ID" \\
  -H "Authorization: Bearer $MOOGO_STORAGE_SECRET_KEY"
\`\`\`

\`\`\`json
{
  "success": true,
  "bucket": {
    "id": "3f8a...",
    "name": "avatars",
    "object_count": 42,
    "size_bytes": 10485760,
    "created_at": "2026-10-01T09:14:22Z",
    "is_public": false,
    "allowed_types": ["image"],
    "max_object_size_bytes": 2097152,
    "quota_bytes": 247463936
  },
  "storage_used_bytes": 10485760,
  "quota_bytes": 262144000,
  "public_url_base": "https://cdn.moogo.dev",
  "url_base": "https://api.moogo.dev"
}
\`\`\`

Use this to inspect a bucket's config and usage without listing its objects. The
two bases in the response are the same ones an object response carries, so a
client can construct public and authenticated URLs from the bucket alone:
\`{public_url_base}/pub/{project_id}/{key}\` and
\`{url_base}/p/{project_id}/bucket/{key}\`.

The catalog lives on its own \`/buckets\` prefix rather than under
\`/bucket/{bucket_id}/\`. Folding it in would have meant reserving the key \`bucket\`,
so you could never upload a file with that name — a silent restriction on what
you can store.

## Errors

| Code | Status | Meaning |
|---|---|---|
| \`missing_key\` | 400 | No object key in the path. |
| \`invalid_key\` | 400 | The key breaks the naming rules. |
| \`key_taken\` | 409 | An object with that key already exists in this project. |
| \`invalid_expires_in\` | 400 | \`expires_in\` is outside the 60–604800 second range. |
| \`invalid_method\` | 400 | A signed URL was requested with a method other than \`GET\` or \`PUT\`. |
| \`invalid_bucket\` | 400 | A bucket was named on a download request. |
| \`bucket_not_found\` | 404 | A signed upload named a bucket this project does not have. |
| \`link_expired\` | 403 | The signed URL was genuine and its time ran out. Mint a new one. |
| \`signing_unavailable\` | 503 | This deployment has no signer configured and cannot mint URLs. |
| \`not_found\` | 404 | No such object or bucket, or no valid signature for the object. |
| \`object_too_large\` | 413 | Over the bucket's per-object cap. |
| \`quota_exceeded\` | 507 | The project storage total is full. |
| \`invalid_prefix\` | 400 | The prefix for a folder delete is not valid. |
| \`storage_error\` | 500 | The request could not be completed. |

All of them use the standard envelope:

\`\`\`json
{ "error": { "code": "object_too_large", "message": "the object is larger than this bucket accepts", "detail": "bucket limit is 2097152 bytes" } }
\`\`\`

**Note on 404 shape:** On \`/pub/*\` (public route), missing or unpublished objects return \`404 not_found\` with the same envelope. These responses are sent with \`Cache-Control: no-store\` to avoid CDN negative caching. The shape is identical to authenticated routes.

## Official JavaScript/TypeScript Client

Use the official \`@moogodev/client\` package instead of hand-rolling fetch calls:

\`\`\`bash
npm install @moogodev/client
\`\`\`

\`\`\`typescript
import { createStorageClient } from '@moogodev/client';

// Reads from env: MOOGO_BASE_URL, MOOGO_PROJECT_ID, MOOGO_STORAGE_ACCESS_KEY_ID, MOOGO_STORAGE_SECRET_KEY
const client = createStorageClient();

// Upload with custom Cache-Control
await client.upload('avatars/user.png', fileBlob, {
  contentType: 'image/png',
  cacheControl: 'public, max-age=31536000, immutable',
});

// Download
const blob = await client.downloadBlob('avatars/user.png');

// List with cursor pagination
const { objects, nextCursor, total } = await client.listObjects({
  prefix: 'avatars/',
  limit: 50,
});

// Presigned URLs
const { url } = await client.getPresignedUrl('avatars/user.png', {
  method: 'GET',
  expiresIn: 3600,
});

// Bucket operations
const buckets = await client.listBuckets();
const info = await client.getBucketInfo('bucket-id');
\`\`\`

See [JavaScript Client](/docs/javascript-client) for full API reference, SQL client, error handling, browser usage, and TypeScript types.

### Minimal fetch wrapper (if you prefer no dependency)

If you need zero dependencies, here's a minimal wrapper:

\`\`\`js
// storage.js
// MOOGO_BASE_URL is the API origin; the bucket endpoint is built from it.
const root = \`\${process.env.MOOGO_BASE_URL}/p/\${process.env.MOOGO_PROJECT_ID}/bucket\`;

const headers = {
  "X-Moogo-Access-Key-Id": process.env.MOOGO_STORAGE_ACCESS_KEY_ID,
  Authorization: \`Bearer \${process.env.MOOGO_STORAGE_SECRET_KEY}\`,
};

async function storage(path = "", init = {}) {
  const response = await fetch(\`\${root}/\${path}\`, { ...init, headers });
  const body = await response.json();
  if (!response.ok) {
    const error = new Error(body.error?.message ?? "storage request failed");
    error.code = body.error?.code;
    throw error;
  }
  return body;
}

export const upload = (key, file, bucket) =>
  storage(\`\${encodeKey(key)}\${bucket ? \`?bucket=\${bucket}\` : ""}\`, {
    method: "POST",
    headers: { ...headers, "Content-Type": file.type || "application/octet-stream" },
    body: file,
  });

export const download = async (key) => {
  const response = await fetch(\`\${root}/\${encodeKey(key)}\`, { headers });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error?.message ?? "storage request failed");
  }
  return response.blob();
}

export const list = (prefix) =>
  storage(\`?prefix=\${encodeURIComponent(prefix)}&limit=100\`);

const encodeKey = (key) =>
  key.split("/").map(encodeURIComponent).join("/");
\`\`\`

## Troubleshooting

- **415 unsupported_media_type** — you're missing or wrong \`Content-Type\`. On JSON endpoints it must be \`application/json\`. On an object upload it must be the file's type (never JSON-wrapped).
- **401 unauthorized / invalid credentials** — storage requests need the two storage headers. SQL requests need \`Authorization: Bearer $MOOGO_SQL_KEY\`. The types are not interchangeable.
- **404 on an object you just uploaded** — check the key case and the bucket (\`?bucket=\`). The path is \`/bucket/{key}\`, not \`/buckets/\`.
- **Object 404s on \`/pub/\` right after making it public** — check that the object is actually published: make the bucket public, or \`PATCH\` the object with \`{"is_public": true}\`, and read \`is_public\` back. Missing and unpublished objects answer \`404\` by design, and those responses are \`no-store\`, so a fresh publish shows up on the next request. If the URL was fetched while an older deployment was live, an edge copy of that 404 can linger until its TTL expires — use a new key or purge your CDN. For mutable assets, versioning keys (\`image-v2.png\`) is more reliable than cache invalidation.
- **object_too_large** — above the bucket's \`max_object_size_bytes\` (or 250 MB). Shrink the file, raise the cap, or split it.
- **quota_exceeded** — project or bucket storage would go over its limit. Delete some objects or increase quota.
- **truncated: true** — your listing is capped at \`limit\` rows. Send the \`next_cursor\` to fetch the next page, or increase \`limit\` up to 1000.
- **invalid_cursor** — the cursor belongs to a different listing (different bucket/filters/order). Drop it and start from page 1.

## Next

- [Create a bucket](/docs/create-bucket) — policies and public objects
- [Credentials](/docs/credentials) — storage credentials in detail
- [Security](/docs/security) — how public URLs and key validation work`;export{e as default};