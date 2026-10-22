/**
 * @moogodev/client - Official JavaScript/TypeScript client for Moogo object storage
 *
 * @example
 * ```typescript
 * import { MoogoClient, createClientFromEnv } from '@moogodev/client';
 *
 * // From environment variables
 * const client = createClientFromEnv();
 *
 * // Or with explicit config
 * const client = new MoogoClient({
 *   baseUrl: 'https://api.moogo.dev',
 *   projectId: 'your-project-id',
 *   accessKeyId: 'your-access-key-id',
 *   secretKey: 'your-secret-key',
 * });
 *
 * // Upload a file
 * const response = await client.upload('avatars/user.png', fileBlob, {
 *   contentType: 'image/png',
 *   cacheControl: 'public, max-age=31536000, immutable',
 * });
 *
 * // List objects
 * const { objects, nextCursor } = await client.listObjects({ prefix: 'avatars/' });
 *
 * // Download
 * const blob = await client.downloadBlob('avatars/user.png');
 * ```
 */

// Types
export type {
  ClientConfig,
  ProjectId,
  BucketId,
  ObjectKey,
  ApiError,
  ApiErrorResponse,
  ApiSuccessResponse,
  ObjectBase,
  ObjectResponse,
  Bucket,
  CreateBucketRequest,
  UpdateBucketRequest,
  BucketInfoResponse,
  ListBucketsResponse,
  UploadResponse,
  ListObjectsQuery,
  ListObjectsResponse,
  PresignedUrlRequest,
  PresignedUrlResponse,
  SignedUploadResponse,
  StorageCredential,
  ListCredentialsResponse,
  CreateCredentialRequest,
  CreateCredentialResponse,
  RotateCredentialResponse,
  DeleteResponse,
  // SQL types
  QueryRequest,
  QueryRow,
  QueryResponse,
  ExecRequest,
  ExecResponse,
  TransactionRequest,
  TransactionResponse,
  TransactionResult,
} from './types.js';

// Errors
export {
  MoogoError,
  MissingKeyError,
  InvalidKeyError,
  KeyTooLongError,
  KeyTakenError,
  InvalidBucketError,
  InvalidCursorError,
  InvalidOrderError,
  BodyTooLargeError,
  ObjectTooLargeError,
  UnsupportedMediaTypeError,
  QuotaExceededError,
  ProjectPausedError,
  LinkExpiredError,
  NotFoundError,
  BucketNotFoundError,
  CredentialLimitError,
  RateLimitedError,
  InvalidBodyError,
  InvalidExpiresInError,
  InvalidMethodError,
  UnauthorizedError,
  createErrorFromResponse,
} from './errors.js';

// Client
export { MoogoClient, createClientFromEnv } from './client.js';