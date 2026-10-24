/**
 * Moogo JavaScript/TypeScript Client
 * Official client for Moogo object storage API.
 */
import type { ClientConfig, Bucket, CreateBucketRequest, UpdateBucketRequest, BucketInfoResponse, ObjectResponse, UploadResponse, ListObjectsQuery, ListObjectsResponse, PresignedUrlRequest, PresignedUrlResponse, SignedUploadResponse, StorageCredential, CreateCredentialRequest, CreateCredentialResponse, RotateCredentialResponse, QueryRequest, QueryResponse, ExecRequest, ExecResponse, TransactionRequest, TransactionResponse } from './types.js';
/**
 * Moogo client for object storage operations.
 *
 * @example
 * ```typescript
 * import { MoogoClient } from '@moogodev/client';
 *
 * const client = new MoogoClient({
 *   baseUrl: 'https://api.moogo.dev',
 *   projectId: 'your-project-id',
 *   accessKeyId: 'your-access-key',
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
 * ```
 */
export declare class MoogoClient {
    private readonly baseUrl;
    private readonly projectId;
    private readonly accessKeyId?;
    private readonly secretKey?;
    private readonly projectKey?;
    private readonly fetchImpl;
    private readonly timeout;
    constructor(config: ClientConfig);
    /** Check if configured for SQL operations (project key) */
    private hasProjectKey;
    /** Check if configured for storage operations (access key) */
    private hasStorageCredentials;
    /** Build the bucket catalog path */
    private getCatalogPath;
    /** Build the credentials path */
    private getCredentialsPath;
    /** Detect auth mode from secret key prefix */
    private detectAuthMode;
    /** Get storage auth headers (Bearer or HMAC) */
    private getStorageAuthHeaders;
    /** Execute a storage request with Bearer/HMAC auth and error handling */
    private requestStorage;
    /** Execute a SQL request with Bearer token auth and error handling */
    private requestSQL;
    /** List all buckets in the project */
    listBuckets(): Promise<Bucket[]>;
    /** Get bucket info including usage stats (by bucket ID) */
    getBucketInfo(bucketId: string): Promise<BucketInfoResponse>;
    /** Get bucket info by name (resolves name to ID) */
    getBucketInfoByName(bucketName: string): Promise<BucketInfoResponse>;
    /** Create a new bucket */
    createBucket(request: CreateBucketRequest): Promise<Bucket>;
    /** Update bucket settings */
    updateBucket(bucketId: string, request: UpdateBucketRequest): Promise<Bucket>;
    /** Delete a bucket and all its objects */
    deleteBucket(bucketId: string): Promise<void>;
    /** S3-compatible download (R2 wire-compat) via /s3/{bucket}/{key} */
    s3Download(bucketName: string, key: string, opts?: {
        signal?: AbortSignal;
    }): Promise<Response>;
    /** Toggle bucket public/private (fans out to all objects) */
    setBucketPublic(bucketId: string, isPublic: boolean): Promise<Bucket>;
    /**
     * Upload an object to a bucket.
     *
     * @param key - Object key (path within bucket)
     * @param data - File data (Blob, File, Uint8Array, ReadableStream, or string)
     * @param options - Upload options
     */
    upload(key: string, data: Blob | File | Uint8Array | ReadableStream<Uint8Array> | string, options?: {
        bucket?: string;
        contentType?: string;
        cacheControl?: string;
        onProgress?: (loaded: number, total: number) => void;
        signal?: AbortSignal;
    }): Promise<UploadResponse>;
    /** Wrap a Blob with progress tracking */
    private wrapWithProgress;
    /** Download an object */
    download(key: string, options?: {
        bucket?: string;
        signal?: AbortSignal;
        range?: {
            start: number;
            end?: number;
        };
    }): Promise<Response>;
    /** Download object as blob */
    downloadBlob(key: string, options?: Parameters<typeof this.download>[1]): Promise<Blob>;
    /** Download object as text */
    downloadText(key: string, options?: Parameters<typeof this.download>[1]): Promise<string>;
    /** Download object as ArrayBuffer */
    downloadArrayBuffer(key: string, options?: Parameters<typeof this.download>[1]): Promise<ArrayBuffer>;
    /** Get object metadata (HEAD request) */
    headObject(key: string, options?: {
        bucket?: string;
        signal?: AbortSignal;
    }): Promise<{
        headers: Headers;
        exists: boolean;
    }>;
    /** Delete an object */
    deleteObject(key: string, options?: {
        bucket?: string;
        signal?: AbortSignal;
    }): Promise<void>;
    /** List objects in a bucket */
    listObjects(query?: ListObjectsQuery): Promise<ListObjectsResponse>;
    /** Get a presigned URL for an object */
    getPresignedUrl(key: string, request: PresignedUrlRequest, options?: {
        bucket?: string;
        signal?: AbortSignal;
    }): Promise<PresignedUrlResponse>;
    /** Create a signed upload URL (returns upload URL + object metadata) */
    createSignedUpload(key: string, request: PresignedUrlRequest & {
        content_type?: string;
    }, options?: {
        bucket?: string;
        signal?: AbortSignal;
    }): Promise<SignedUploadResponse>;
    /** Update object metadata (visibility, key) */
    updateObject(key: string, updates: {
        new_key?: string;
    }, options?: {
        bucket?: string;
        signal?: AbortSignal;
    }): Promise<ObjectResponse>;
    /** List storage credentials */
    listCredentials(): Promise<StorageCredential[]>;
    /** Create a new storage credential */
    createCredential(request: CreateCredentialRequest): Promise<CreateCredentialResponse>;
    /** Rotate a credential (generates new secret) */
    rotateCredential(credentialId: string): Promise<RotateCredentialResponse>;
    /** Revoke a credential */
    revokeCredential(credentialId: string): Promise<void>;
    /** Get the public URL for an object (if published) */
    getPublicUrl(key: string, publicUrlBase?: string): string;
    /** Get the authenticated download URL for an object */
    getAuthenticatedUrl(key: string): string;
    /** Check if an object exists (efficient HEAD) */
    objectExists(key: string, options?: {
        bucket?: string;
    }): Promise<boolean>;
    /** Get object size without downloading */
    getObjectSize(key: string, options?: {
        bucket?: string;
    }): Promise<number | null>;
    /** Get object ETag */
    getObjectETag(key: string, options?: {
        bucket?: string;
    }): Promise<string | null>;
    /** Execute a SQL read query */
    query(request: QueryRequest, options?: {
        signal?: AbortSignal;
    }): Promise<QueryResponse>;
    /** Execute a SQL write statement */
    exec(request: ExecRequest, options?: {
        signal?: AbortSignal;
    }): Promise<ExecResponse>;
    /** Execute multiple SQL statements in a transaction */
    transaction(request: TransactionRequest, options?: {
        signal?: AbortSignal;
    }): Promise<TransactionResponse>;
    /** Run database maintenance (VACUUM, REINDEX, ANALYZE) */
    maintenance(options?: {
        signal?: AbortSignal;
    }): Promise<{
        success: true;
        reclaimed_bytes: number;
    }>;
}
/** Create a client for storage operations (upload, download, list, bucket mgmt) */
export declare function createStorageClient(config: {
    baseUrl: string;
    projectId: string;
    accessKeyId: string;
    secretKey: string;
    fetch?: typeof fetch;
    timeout?: number;
}): MoogoClient;
/** Create a client for SQL operations (query, exec, transaction, maintenance) */
export declare function createSQLClient(config: {
    baseUrl: string;
    projectId: string;
    projectKey: string;
    fetch?: typeof fetch;
    timeout?: number;
}): MoogoClient;
/** Convenience function to create a client from environment variables */
export declare function createClientFromEnv(env?: Record<string, string | undefined>): MoogoClient;
//# sourceMappingURL=client.d.ts.map