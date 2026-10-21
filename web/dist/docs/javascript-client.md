# JavaScript / TypeScript Client

The official `@moogodev/client` package provides a type-safe, zero-dependency client for Moogo's object storage API.

> **⚠️ Not yet published to npm**
>
> The package is currently **not available on npm** (registration/publish in progress).
> You can still use it by installing directly from GitHub:
>
> ```bash
> npm install github:moogodev/moogodev#main:clients/js
> ```
>
> Or clone and link locally:
> ```bash
> git clone https://github.com/moogodev/moogodev
> cd moogodev/clients/js && npm install && npm run build
> # then in your project:
> npm link /path/to/moogodev/clients/js
> ```
>
> This documentation is published ahead of the npm release so you can start integrating. Check the [GitHub repo](https://github.com/moogodev/moogodev/tree/main/clients/js) for publish status.

## Install

```bash
npm install @moogodev/client
```

> **Note:** Once published, the command above will work. Until then, use the GitHub install method above.

Works in Node 18+, Deno, Bun, Cloudflare Workers, Vercel Edge, and browsers (via bundler).

## Quick Start

```typescript
import { MoogoClient, createClientFromEnv } from '@moogodev/client';

// Reads from environment variables:
// MOOGO_API_URL, MOOGO_PROJECT_ID, MOOGO_BUCKET_ACCESS_KEY_ID, MOOGO_BUCKET_SECRET_KEY
const client = createClientFromEnv();

// Upload a file with custom caching
const response = await client.upload('avatars/user.png', fileBlob, {
  contentType: 'image/png',
  cacheControl: 'public, max-age=31536000, immutable',
  onProgress: (loaded, total) => console.log(`${loaded}/${total}`),
});

console.log(response.object.public_url); // https://cdn.moogo.dev/pub/.../avatars/user.png
```

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `MOOGO_API_URL` | Yes | API base URL (e.g., `https://api.moogo.dev`) |
| `MOOGO_PROJECT_ID` | Yes | Your project UUID |
| `MOOGO_BUCKET_ACCESS_KEY_ID` | Yes | Storage credential access key |
| `MOOGO_BUCKET_SECRET_KEY` | Yes | Storage credential secret key |

Or pass config explicitly:

```typescript
const client = new MoogoClient({
  baseUrl: 'https://api.moogo.dev',
  projectId: 'your-project-id',
  accessKeyId: 'your-access-key-id',
  secretKey: 'your-secret-key',
  timeout: 30_000, // optional, default 30s
});
```

## Core Methods

### Upload

```typescript
// File, Blob, Uint8Array, ReadableStream, or string
await client.upload('path/to/file.png', file, {
  bucket: 'my-bucket',           // optional, defaults to 'default'
  contentType: 'image/png',      // optional, inferred from File/Blob
  cacheControl: 'public, max-age=31536000, immutable', // optional, stored with object
  onProgress: (loaded, total) => {}, // optional, progress callback
  signal: abortController.signal,    // optional, for cancellation
});
```

Returns `UploadResponse` with `object`, `storage_used_bytes`, `quota_bytes`.

### Download

```typescript
// As blob (for images, files)
const blob = await client.downloadBlob('avatars/user.png');

// As text (for JSON, CSV, etc.)
const text = await client.downloadText('data/export.json');

// As ArrayBuffer
const buffer = await client.downloadArrayBuffer('data/export.json');

// Raw Response (for streaming, range requests)
const response = await client.download('large-file.zip', {
  range: { start: 0, end: 1023 * 1024 }, // first 1 MB
});
```

### List Objects (Cursor Pagination)

```typescript
const { objects, nextCursor, total } = await client.listObjects({
  bucket: 'my-bucket',
  prefix: 'avatars/',        // folder-like listing
  search: 'png',             // substring match
  order_by: 'created',       // 'key' | 'size' | 'created' | 'updated' | 'contenttype'
  order_dir: 'desc',         // 'asc' | 'desc'
  limit: 100,                // max 1000
  cursor: '...',             // from previous page
});

// Walk all pages
let cursor: string | undefined;
do {
  const page = await client.listObjects({ prefix: 'avatars/', cursor });
  for (const obj of page.objects) {
    console.log(obj.key, obj.size_bytes);
  }
  cursor = page.nextCursor || undefined;
} while (cursor);
```

### Presigned URLs

```typescript
// Download link (expires in 1 hour)
const { url, expiresAt } = await client.getPresignedUrl('avatars/user.png', {
  method: 'GET',
  expiresIn: 3600,
});

// Upload link (for browser direct upload)
const { url, expiresAt } = await client.getPresignedUrl('uploads/user.png', {
  method: 'PUT',
  expiresIn: 300,
});
```

### Signed Upload (with object metadata)

```typescript
const { upload_url, object, expires_at } = await client.createSignedUpload(
  'avatars/user.png',
  { method: 'PUT', expires_in: 300, content_type: 'image/png' },
  { bucket: 'avatars' }
);

// Browser posts directly to upload_url (no credentials needed)
await fetch(upload_url, {
  method: 'PUT',
  headers: { 'Content-Type': 'image/png' },
  body: fileBlob,
});
```

### Object Metadata

```typescript
// Check existence (HEAD)
const exists = await client.objectExists('avatars/user.png');

// Get size without downloading
const size = await client.getObjectSize('avatars/user.png');

// Get ETag for caching
const etag = await client.getObjectETag('avatars/user.png');

// Update visibility or rename
await client.updateObject('avatars/user.png', { is_public: true });
await client.updateObject('avatars/user.png', { new_key: 'avatars/2024/user.png' });

// Delete
await client.deleteObject('avatars/user.png');
```

### Bucket Operations

```typescript
// List all buckets
const buckets = await client.listBuckets();

// Get bucket info + usage
const info = await client.getBucketInfo('bucket-id');

// Create bucket
const bucket = await client.createBucket({
  name: 'uploads',
  allowed_types: ['image/*'],
  max_object_size_bytes: 2 * 1024 * 1024, // 2 MB
  quota_bytes: 50 * 1024 * 1024,          // 50 MB
});

// Update bucket settings
await client.updateBucket('bucket-id', {
  is_public: true,        // new uploads are public by default
  quota_bytes: 100 * 1024 * 1024,
});

// Toggle bucket public/private (affects new uploads)
await client.setBucketPublic('bucket-id', true);

// Delete bucket and all objects
await client.deleteBucket('bucket-id');
```

### Credential Management

```typescript
// List credentials
const creds = await client.listCredentials();

// Create new credential (returns secret_key ONCE)
const { credential, secret_key } = await client.createCredential({
  label: 'Production server',
});
console.log(secret_key); // Save this! Never shown again.

// Rotate credential (new secret, same access key ID)
const { credential: rotated, secret_key: newSecret } = await client.rotateCredential('cred-id');

// Revoke
await client.revokeCredential('cred-id');
```

### URL Helpers

```typescript
// Public URL (for published objects)
client.getPublicUrl('avatars/user.png');           // https://api.moogo.dev/pub/proj/avatars/user.png
client.getPublicUrl('avatars/user.png', 'https://cdn.example.com'); // custom CDN

// Authenticated URL (needs credential)
client.getAuthenticatedUrl('avatars/user.png');    // https://api.moogo.dev/p/proj/avatars/user.png
```

## Error Handling

All errors are typed subclasses of `MoogoError`:

```typescript
import {
  MoogoClient,
  NotFoundError,
  RateLimitedError,
  QuotaExceededError,
  ObjectTooLargeError,
  createErrorFromResponse,
} from '@moogodev/client';

try {
  await client.upload('big-file.zip', hugeBlob);
} catch (err) {
  if (err instanceof RateLimitedError) {
    // err.retryAfter (seconds), err.resetAt (unix timestamp)
    await sleep(err.retryAfter * 1000);
    // retry...
  } else if (err instanceof ObjectTooLargeError) {
    // err.detail has the bucket limit
  } else if (err instanceof QuotaExceededError) {
    // project or bucket quota full
  } else if (err instanceof NotFoundError) {
    // bucket or object not found
  } else {
    // err.code, err.status, err.detail
  }
}
```

| Error Class | Code | Status |
|---|---|---|
| `MissingKeyError` | `missing_key` | 400 |
| `InvalidKeyError` | `invalid_key` | 400 |
| `KeyTooLongError` | `key_too_long` | 400 |
| `KeyTakenError` | `key_taken` | 409 |
| `InvalidBucketError` | `invalid_bucket` | 400 |
| `InvalidCursorError` | `invalid_cursor` | 400 |
| `InvalidOrderError` | `invalid_order` | 400 |
| `BodyTooLargeError` | `body_too_large` | 413 |
| `ObjectTooLargeError` | `object_too_large` | 413 |
| `UnsupportedMediaTypeError` | `unsupported_media_type` | 415 |
| `QuotaExceededError` | `quota_exceeded` | 409/507 |
| `ProjectPausedError` | `project_paused` | 403 |
| `LinkExpiredError` | `link_expired` | 403 |
| `NotFoundError` | `not_found` | 404 |
| `BucketNotFoundError` | `bucket_not_found` | 404 |
| `CredentialLimitError` | `credential_limit` | 409 |
| `RateLimitedError` | `rate_limited` | 429 |
| `InvalidBodyError` | `invalid_body` | 400 |
| `InvalidExpiresInError` | `invalid_expires_in` | 400 |
| `InvalidMethodError` | `invalid_method` | 400 |
| `UnauthorizedError` | `unauthorized` | 401 |

## Custom Cache-Control

Override default caching per object:

```typescript
await client.upload('static/asset.js', jsBlob, {
  contentType: 'application/javascript',
  cacheControl: 'public, max-age=31536000, immutable', // 1 year, immutable
});

// Defaults if omitted:
// - Published (/pub/):  public, max-age=300, must-revalidate
// - Private / Signed: private, no-cache
```

Common patterns:

| Goal | Header |
|---|---|
| Long-term, never revalidate | `public, max-age=31536000, immutable` |
| No caching | `no-store` |
| Cache 1 hour, revalidate | `public, max-age=3600, must-revalidate` |
| Private cache only | `private, max-age=3600` |

## Rate Limit Headers

Every response includes standard headers:

```typescript
// Accessible via the underlying fetch Response if needed
// X-RateLimit-Limit: 300
// X-RateLimit-Remaining: 299
// X-RateLimit-Reset: 1708456800 (unix timestamp)
```

The `RateLimitedError` exposes `retryAfter` (seconds) and `resetAt` (unix timestamp) for precise retry scheduling.

## Browser Usage

In a browser, credentials **must not** be exposed in client-side code. Use a backend proxy:

```typescript
// Next.js API route /app/api/upload/route.ts
import { MoogoClient } from '@moogodev/client';

const client = new MoogoClient({
  baseUrl: process.env.MOOGO_API_URL!,
  projectId: process.env.MOOGO_PROJECT_ID!,
  accessKeyId: process.env.MOOGO_BUCKET_ACCESS_KEY_ID!,
  secretKey: process.env.MOOGO_BUCKET_SECRET_KEY!,
});

export async function POST(req: Request) {
  const formData = await req.formData();
  const file = formData.get('file') as File;
  const key = formData.get('key') as string;

  const response = await client.upload(key, file, {
    contentType: file.type,
  });
  return Response.json(response);
}
```

```tsx
// Client component
const formData = new FormData();
formData.append('file', file);
formData.append('key', 'avatars/user.png');
const res = await fetch('/api/upload', { method: 'POST', body: formData });
const { object } = await res.json();
```

## Full TypeScript Types

All request/response types are exported:

```typescript
import type {
  Bucket,
  ObjectResponse,
  ListObjectsQuery,
  ListObjectsResponse,
  UploadResponse,
  PresignedUrlRequest,
  PresignedUrlResponse,
  SignedUploadResponse,
  StorageCredential,
  ClientConfig,
} from '@moogodev/client';
```

## Links

- **npm**: [@moogodev/client](https://www.npmjs.com/package/@moogodev/client)
- **GitHub**: [clients/js](https://github.com/moogodev/moogodev/tree/main/clients/js)
- **Object Storage API**: [Object Storage](/docs/object-storage)
- **Rate Limits**: [Limits](/docs/limits)
- **Error Codes**: [Errors](/docs/errors)