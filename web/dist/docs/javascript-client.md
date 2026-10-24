
## S3 / R2 Wire-Compat Download

The SDK `0.2.2` adds `s3Download(bucketName, key)` for R2-compatible clients. It builds the `/s3/{bucket_name}/*` URL and passes the same SigV4 query parameters the server expects (fail-closed until full HMAC verified).

```typescript
import { createStorageClient } from '@moogodev/client';
const storage = createStorageClient();
const resp = await storage.s3Download('my-bucket', 'photo.png');
```
