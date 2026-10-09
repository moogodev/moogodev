var e=`# Create a bucket

Every project has **256 MB of object storage**. A bucket is a named namespace
inside that quota, so you can keep \`avatars\` separate from \`exports\` without
either one colliding.

## Create a bucket

### From the dashboard

1. Open your project and go to the **Bucket** tab.
2. Click **New bucket**.
3. Name it, set the upload policy, and confirm.

The new bucket appears in the sidebar with its object count and size, both of
which update as you upload.

### From the API

\`\`\`bash
curl https://api.moogo.dev/api/projects/$MOOGO_PROJECT_ID/buckets \\
  -H "Cookie: moogo_session=..." \\
  -H "Content-Type: application/json" \\
  -d '{"name":"avatars"}'
\`\`\`

Or, using a [storage credential](/docs/credentials):

\`\`\`bash
curl https://api.moogo.dev/buckets/$MOOGO_PROJECT_ID \\
  -H "X-Moogo-Access-Key-Id: $MOOGO_BUCKET_ACCESS_KEY_ID" \\
  -H "Authorization: Bearer $MOOGO_BUCKET_SECRET_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"name":"avatars"}'
\`\`\`

Response:

\`\`\`json
{
  "success": true,
  "bucket": {
    "id": "3f8a2c11-9d4e-4b7a-8f21-5e6c3d9a1b84",
    "name": "avatars",
    "object_count": 0,
    "size_bytes": 0,
    "created_at": "2026-10-01T09:14:22Z",
    "is_public": false,
    "allowed_types": ["any"],
    "max_object_size_bytes": 0,
    "quota_bytes": 262144000
  }
}
\`\`\`

Bucket names must be unique **within a project**. A second create with a name
you already hold returns \`409 bucket_exists\` — the bucket is already yours, so
delete it first if you want a fresh one. Uniqueness stops at the project:
another project, yours or anyone else's, can use the same name, because every
bucket lives under its own project id.

## The \`default\` bucket

Uploads that name no bucket land in a bucket called \`default\`, which is created
on demand.

This exists for backwards compatibility: the original storage API had no concept
of buckets, and clients written against it should keep working rather than start
failing because they did not know about this feature. You are free to ignore it.

## Bucket settings

Four settings control what a bucket accepts and how much room it has. **The server
enforces all of them on every write**, not just in the dashboard's file picker, so
an API client cannot bypass them.

### \`is_public\`

Whether objects uploaded to this bucket from now on are readable by their URL
without a credential. \`false\` by default.

Turning a bucket off also makes the objects already in it private. Each object can
then be published again on its own, and replacing a file never changes its
visibility either way — overwriting is a storage operation, not a publishing
decision.

### \`allowed_types\`

An **array**, so a bucket can take more than one kind of file.

| Value | Accepts |
|---|---|
| \`any\` | Everything. The default. |
| \`image\` | Anything sent as \`image/*\`. |
| \`video\` | Anything sent as \`video/*\`. |
| \`audio\` | Anything sent as \`audio/*\`. |
| \`document\` | PDF, Word, Excel, PowerPoint, OpenDocument, plain text. |
| \`archive\` | Zip, Gzip, Tar, 7z, Rar, Bzip2, Xz. |
| \`file\` | Everything the rows above do not cover: binaries, fonts, and the like. |

\`file\` is **not** a synonym for \`any\`. It is the complement of the other rows, so
it refuses a PNG and accepts a compiled binary — which makes it the right choice
for a bucket of assets nobody wants to classify.

\`any\` cannot be combined with a specific type: asking to both allow and refuse the
same upload has no answer, so the request is rejected rather than one side being
dropped silently.

\`\`\`bash
curl -X PATCH https://api.moogo.dev/buckets/$MOOGO_PROJECT_ID/$BUCKET_ID \\
  -H "X-Moogo-Access-Key-Id: $MOOGO_BUCKET_ACCESS_KEY_ID" \\
  -H "Authorization: Bearer $MOOGO_BUCKET_SECRET_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"allowed_types":["image","video"],"max_object_size_bytes":2097152}'
\`\`\`

### \`max_object_size_bytes\`

Per-object cap in bytes. **\`0\` means no limit**, which is not the same as a limit
of zero bytes — so \`0\` disables the cap rather than refusing everything.

### \`quota_bytes\`

This bucket's own storage ceiling, **250 MB** by default. Uploads past it are
refused with \`507 bucket_quota_exceeded\` even when the project still has room, so
one bucket cannot starve the others.

It cannot exceed the project's 256 MB total, and it cannot be set below what the
bucket already holds — a quota under its current usage would leave every later
upload refused for a reason that looks like a full project.

A rejected upload returns \`413\` with \`object_too_large\` and a \`detail\` naming the
limit, which is the difference between the two cases:

| Code | Status | Means |
|---|---|---|
| \`object_too_large\` | 413 | This one object is over **this bucket's** limit. |
| \`quota_exceeded\` | 507 | The object is fine, but the **project total** is full. |

Set the cap. A bucket meant for avatars should not accept a 200 MB video, and the
quota error arriving only after a long upload is a worse experience than being
refused immediately.

## Public objects

By default every object is private. Publishing makes it readable at a URL with no
credential at all:

\`\`\`bash
curl -X POST https://api.moogo.dev/buckets/$MOOGO_PROJECT_ID/$BUCKET_ID/public \\
  -H "X-Moogo-Access-Key-Id: $MOOGO_BUCKET_ACCESS_KEY_ID" \\
  -H "Authorization: Bearer $MOOGO_BUCKET_SECRET_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"is_public":true}'
\`\`\`

Publish one object:

\`\`\`json
{ "is_public": true, "key": "avatars/kit.png" }
\`\`\`

A published object gets a \`public_url\`:

\`\`\`
https://api.moogo.dev/pub/8f3c1a20-5b7e-4a91-9d3c-2f6b81e4a7d0/avatars/kit.png
\`\`\`

That URL works with no header, no cookie, and no session. You can put it in an
\`<img>\`, a \`<video>\`, or a CSS \`background-image\`.

> **Understand what publishing means.** A public URL is a bearer token. Anyone who
> has the link has the file, and there is no way to make it private again without
> changing the URL. Publish only what you intend to be public — avatars, public
> assets, exported reports — and keep anything sensitive private behind a
> credential.
>
> Private objects are **not** merely awkward to fetch: an unlisted object answers
> \`404\` on the public route, so it is indistinguishable from one that does not
> exist.

You can also publish a whole bucket at once with the same endpoint and no \`key\`,
which sets every object in it.

## Organising with prefixes

Object keys are paths, so use \`/\` to create structure without creating buckets:

\`\`\`
avatars/user-1.png
avatars/user-2.png
exports/2026-09/report.csv
\`\`\`

This gives you filtering and folder-style deletes without spending bucket names
on categories.

### Keys are strict

A key must:

- have no leading slash
- have no \`.\` or \`..\` segments, and no empty segments (\`//\`)
- contain no control characters or NUL
- contain no backslash

Valid keys look like this:

\`\`\`
avatars/user-1.png
exports/2026-09/report.csv
\`\`\`

All of these are **rejected**:

\`\`\`
/avatars/user-1.png
./avatars/user-1.png
../other-project/secrets.txt
avatars//user-1.png
\`\`\`

A key is rejected rather than silently normalised when it contains a \`.\` or
\`..\` segment or a leading slash, because two different keys resolving to one
object is more surprising than a clear error. Maximum key length is **1024
characters**.

## Quota

**256 MB per project**, counted across all buckets — not per bucket. Two buckets
do not give you 512 MB.

Every response that touches storage reports both numbers so you can see where you
stand:

\`\`\`json
{ "storage_used_bytes": 10485760, "quota_bytes": 268435456 }
\`\`\`

If you need space back:

- **Delete objects.** The response to a delete includes \`freed_bytes\`.
- **Delete a whole prefix.** See [Object storage](/docs/object-storage#deleting).
- **Delete a bucket**, which removes every object in it. Confirm the count first
  — it is permanent.

A quota check happens against the declared \`Content-Length\` before a byte is
written, and again against the bytes actually received. Uploads for one project
are serialised so two concurrent large uploads cannot both see room for 100 MB and
together overrun the quota.

## Delete a bucket

\`\`\`bash
curl -X DELETE https://api.moogo.dev/buckets/$MOOGO_PROJECT_ID/$BUCKET_ID \\
  -H "X-Moogo-Access-Key-Id: $MOOGO_BUCKET_ACCESS_KEY_ID" \\
  -H "Authorization: Bearer $MOOGO_BUCKET_SECRET_KEY"
\`\`\`

This removes the bucket **and every object in it**, permanently. The response
reports how many objects were deleted:

\`\`\`json
{
  "success": true,
  "deleted_objects": 42,
  "storage_used_bytes": 10485760,
  "quota_bytes": 268435456
}
\`\`\`

Check that count before you confirm the deletion in the UI.

## Next

- [Object storage](/docs/object-storage) — upload, download, list, delete
- [Credentials](/docs/credentials) — creating a storage credential
- [Limits](/docs/limits) — every quota in one table`;export{e as default};