# @moogodev/client

Official JavaScript/TypeScript client for Moogo object storage.

## Install

```bash
npm install @moogodev/client
```

## Quick Start

```typescript
import { MoogoClient, createClientFromEnv } from '@moogodev/client';

// Reads from environment variables:
// MOOGO_BASE_URL, MOOGO_PROJECT_ID, MOOGO_STORAGE_ACCESS_KEY_ID, MOOGO_STORAGE_SECRET_KEY
const client = createClientFromEnv();

// Upload with custom Cache-Control
const response = await client.upload('avatars/user.png', fileBlob, {
  contentType: 'image/png',
  cacheControl: 'public, max-age=31536000, immutable',
  onProgress: (loaded, total) => console.log(`${loaded}/${total}`),
});

console.log(response.object.public_url);
```

## Features

- **Full TypeScript support** — complete type definitions for all API responses
- **Cursor-based pagination** — stable `nextCursor` + `total` for listings
- **Range requests** — `206 Partial Content`, `416 Range Not Satisfiable`, `If-Range`
- **Custom Cache-Control** — send `Cache-Control` header on upload to override defaults
- **Presigned URLs** — GET (download) and PUT (browser direct upload)
- **Signed uploads** — returns upload URL + object metadata
- **Bucket operations** — list, create, update, delete, get info, toggle public
- **Credential management** — list, create, rotate, revoke storage credentials
- **Rate-limit handling** — `X-RateLimit-Reset` header parsing, `RateLimitedError` with `retryAfter`/`resetAt`
- **Typed errors** — all API error codes as distinct classes
- **Zero dependencies** — uses Web Crypto API (native in Node 22+, browsers, edge runtimes)
- **Works everywhere** — Node 22+, Deno, Bun, Cloudflare Workers, Vercel Edge, browsers (via bundler)

## Documentation

- [Full API Reference](https://moogo.dev/docs/javascript-client)
- [Object Storage API](https://moogo.dev/docs/object-storage)
- [Rate Limits](https://moogo.dev/docs/limits)
- [Error Codes](https://moogo.dev/docs/errors)

## License

MIT