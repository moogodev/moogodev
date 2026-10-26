/**
 * Moogo JavaScript/TypeScript Client
 * Official client for Moogo object storage API.
 */

import type {
  ClientConfig,
  Bucket,
  CreateBucketRequest,
  UpdateBucketRequest,
  ListBucketsResponse,
  BucketInfoResponse,
  ObjectResponse,
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
  QueryResponse,
  ExecRequest,
  ExecResponse,
  TransactionRequest,
  TransactionResponse,
} from './types.js';

import {
  MoogoError,
  createErrorFromResponse,
} from './errors.js';

/** Default timeout: 30 seconds */
const DEFAULT_TIMEOUT = 30_000;

// Polyfill for AbortSignal.any — available natively in Node 20+ / modern
// browsers but not in older runtimes, which made every abort-aware client
// method throw on invocation. Combines multiple signals into one AbortSignal.
if (typeof AbortSignal !== 'undefined' && typeof (AbortSignal as any).any !== 'function') {
  (AbortSignal as any).any = function (signals: AbortSignal[]): AbortSignal {
    const controller = new AbortController();
    const onAbort = () => controller.abort();

    for (const signal of signals) {
      signal.addEventListener('abort', onAbort, { once: true });
    }

    const cleanup = () => {
      for (const signal of signals) {
        signal.removeEventListener('abort', onAbort);
      }
    };

    controller.signal.addEventListener('abort', cleanup, { once: true });

    return controller.signal;
  };
}

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
export class MoogoClient {
  private readonly baseUrl: string;
  private readonly projectId: string;
  private readonly accessKeyId?: string;
  private readonly secretKey?: string;
  private readonly projectKey?: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeout: number;

  constructor(config: ClientConfig) {
    if (!config.baseUrl) throw new Error('baseUrl is required');
    if (!config.projectId) throw new Error('projectId is required');
    if (!config.accessKeyId && !config.projectKey) {
      throw new Error('Either accessKeyId/secretKey (storage) or projectKey (SQL) is required');
    }
    if (config.accessKeyId && !config.secretKey) {
      throw new Error('secretKey is required when accessKeyId is provided');
    }
    if (config.secretKey && !config.accessKeyId) {
      throw new Error('accessKeyId is required when secretKey is provided');
    }

    this.baseUrl = config.baseUrl.replace(/\/+$/, '');
    this.projectId = config.projectId;
    this.accessKeyId = config.accessKeyId;
    this.secretKey = config.secretKey;
    this.projectKey = config.projectKey;
    this.fetchImpl = config.fetch ?? fetch;
    this.timeout = config.timeout ?? DEFAULT_TIMEOUT;
  }

  /** Check if configured for SQL operations (project key) */
  private hasProjectKey(): boolean {
    return !!this.projectKey;
  }

  /** Check if configured for storage operations (access key) */
  private hasStorageCredentials(): boolean {
    return !!this.accessKeyId && !!this.secretKey;
  }

  /** Build the bucket catalog path */
  private getCatalogPath(): string {
    return `${this.baseUrl}/buckets/${this.projectId}`;
  }

  /** Build the credentials path */
  private getCredentialsPath(): string {
    return `${this.baseUrl}/storage-credentials/${this.projectId}`;
  }

  /** Detect auth mode from secret key prefix */
  private detectAuthMode(): 'bearer' | 'hmac' {
    // moogo_sk_ = Bearer token (current API)
    // moogo_hmac_ = HMAC-SHA256 (legacy/enterprise) — dead code because
    // the server expects Bearer for storage credentials; HMAC signing is
    // not implemented in this client version (Bug 10).
    if (this.secretKey?.startsWith('moogo_hmac_')) return 'hmac';
    return 'bearer';
  }

  /** Get storage auth headers (Bearer or HMAC) */
  private getStorageAuthHeaders(): Record<string, string> {
    if (!this.hasStorageCredentials()) {
      throw new Error('Storage operations require accessKeyId and secretKey');
    }
    const mode = this.detectAuthMode();
    if (mode === 'hmac') {
      // Legacy HMAC - would need async, but we keep sync for headers
      // For HMAC, we'd compute in requestStorage instead
      return {
        'X-Moogo-Access-Key-Id': this.accessKeyId!,
        'Authorization': `Bearer ${this.secretKey!}`, // fallback, actual HMAC in request
      };
    }
    // Simple Bearer (current API)
    return {
      'X-Moogo-Access-Key-Id': this.accessKeyId!,
      'Authorization': `Bearer ${this.secretKey!}`,
    };
  }

  /** Execute a storage request with Bearer/HMAC auth and error handling */
  private async requestStorage<T>(
    method: string,
    path: string,
    options: {
      headers?: Record<string, string>;
      body?: BodyInit;
      query?: Record<string, string>;
      signal?: AbortSignal;
    } = {}
  ): Promise<T> {
    if (!this.hasStorageCredentials()) {
      throw new Error('Storage operations require accessKeyId and secretKey');
    }

    const url = new URL(path, this.baseUrl);
    if (options.query) {
      Object.entries(options.query).forEach(([k, v]) => {
        if (v !== undefined && v !== null) url.searchParams.set(k, v);
      });
    }

    // Base headers
    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    // Remove Content-Type for FormData (browser sets it with boundary)
    if (options.body instanceof FormData) {
      delete requestHeaders['Content-Type'];
    }

    // Add storage auth headers (Bearer or HMAC)
    const authHeaders = this.getStorageAuthHeaders();
    Object.assign(requestHeaders, authHeaders);

    // For HMAC mode, we'd compute signature here (future)
    // For now, Bearer mode uses secretKey directly

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    const signal = options.signal
      ? AbortSignal.any([options.signal, controller.signal])
      : controller.signal;

    try {
      const response = await this.fetchImpl(url.toString(), {
        method,
        headers: requestHeaders,
        body: options.body,
        signal,
      });

      clearTimeout(timeoutId);

      const contentType = response.headers.get('Content-Type') || '';
      const isJson = contentType.includes('application/json');

      let data: any;
      if (isJson) {
        data = await response.json();
      } else {
        data = await response.text();
      }

      if (!response.ok) {
        throw createErrorFromResponse(response, data);
      }

      return data as T;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof MoogoError) throw error;
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new MoogoError('timeout', 'Request timed out', 408);
      }
      throw new MoogoError('network_error', `Network error: ${error}`, 0);
    }
  }

  /** Execute a SQL request with Bearer token auth and error handling */
  private async requestSQL<T>(
    method: string,
    path: string,
    options: {
      headers?: Record<string, string>;
      body?: BodyInit;
      query?: Record<string, string>;
      signal?: AbortSignal;
    } = {}
  ): Promise<T> {
    if (!this.hasProjectKey()) {
      throw new Error('SQL operations require projectKey');
    }

    const url = new URL(path, this.baseUrl);
    if (options.query) {
      Object.entries(options.query).forEach(([k, v]) => {
        if (v !== undefined && v !== null) url.searchParams.set(k, v);
      });
    }

    const requestHeaders: Record<string, string> = {
      'Authorization': `Bearer ${this.projectKey}`,
      'Content-Type': 'application/json',
      ...options.headers,
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    const signal = options.signal
      ? AbortSignal.any([options.signal, controller.signal])
      : controller.signal;

    try {
      const response = await this.fetchImpl(url.toString(), {
        method,
        headers: requestHeaders,
        body: options.body,
        signal,
      });

      clearTimeout(timeoutId);

      const contentType = response.headers.get('Content-Type') || '';
      const isJson = contentType.includes('application/json');

      let data: any;
      if (isJson) {
        data = await response.json();
      } else {
        data = await response.text();
      }

      if (!response.ok) {
        throw createErrorFromResponse(response, data);
      }

      return data as T;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof MoogoError) throw error;
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new MoogoError('timeout', 'Request timed out', 408);
      }
      throw new MoogoError('network_error', `Network error: ${error}`, 0);
    }
  }

  // ==================== Bucket Operations ====================

  /** List all buckets in the project */
  async listBuckets(): Promise<Bucket[]> {
    const response = await this.requestStorage<ListBucketsResponse>('GET', this.getCatalogPath());
    return response.buckets;
  }

  /** Get bucket info including usage stats (by bucket ID) */
  async getBucketInfo(bucketId: string): Promise<BucketInfoResponse> {
    const response = await this.requestStorage<BucketInfoResponse>(
      'GET',
      `${this.getCatalogPath()}/${bucketId}`
    );
    return response;
  }

  /** Get bucket info by name (resolves name to ID) */
  async getBucketInfoByName(bucketName: string): Promise<BucketInfoResponse> {
    const buckets = await this.listBuckets();
    const bucket = buckets.find(b => b.name === bucketName);
    if (!bucket) {
      throw new Error(`Bucket not found: ${bucketName}`);
    }
    return this.getBucketInfo(bucket.id);
  }

  /** Create a new bucket */
  async createBucket(request: CreateBucketRequest): Promise<Bucket> {
    const response = await this.requestStorage<{ success: true; bucket: Bucket }>(
      'POST',
      this.getCatalogPath(),
      { body: JSON.stringify(request) }
    );
    return response.bucket;
  }

  /** Update bucket settings */
  async updateBucket(bucketId: string, request: UpdateBucketRequest): Promise<Bucket> {
    const response = await this.requestStorage<{ success: true; bucket: Bucket }>(
      'PATCH',
      `${this.getCatalogPath()}/${bucketId}`,
      { body: JSON.stringify(request) }
    );
    return response.bucket;
  }

  /** Delete a bucket and all its objects */
  async deleteBucket(bucketId: string): Promise<void> {
    await this.requestStorage<DeleteResponse>('DELETE', `${this.getCatalogPath()}/${bucketId}`);
  }

  /** S3-compatible download (R2 wire-compat) via /s3/{bucket}/{key}
   * Note: This endpoint is protected by SigV4 middleware. For private objects,
   * the SDK must send a valid HMAC-SHA256 signature (not implemented in this
   * version). Public objects are accessible without auth; private objects require
   * either the signed URL from getPresignedUrl or the storage credential with
   * full SigV4 signing. */
  async s3Download(bucketName: string, key: string, opts?: { signal?: AbortSignal }): Promise<Response> {
    const url = `${this.baseUrl}/s3/${encodeURIComponent(bucketName)}/${encodeURIComponent(key)}`;
    // Pass storage auth headers when available; the SigV4 middleware can
    // fall back to bearer token for some deployments, but full HMAC signing
    // (dead code in detectAuthMode) remains unimplemented.
    const headers: Record<string, string> = {};
    if (this.hasStorageCredentials()) {
      const auth = this.getStorageAuthHeaders();
      Object.assign(headers, auth);
    }
    return fetch(url, { headers, signal: opts?.signal });
  }

  /** Toggle bucket public/private (fans out to all objects) */
  async setBucketPublic(bucketId: string, isPublic: boolean): Promise<Bucket> {
    const response = await this.requestStorage<{ success: true; bucket: Bucket }>(
      'POST',
      `${this.getCatalogPath()}/${bucketId}/public`,
      { body: JSON.stringify({ is_public: isPublic }) }
    );
    return response.bucket;
  }

  // ==================== Object Operations ====================

  /**
   * Upload an object to a bucket.
   *
   * @param key - Object key (path within bucket)
   * @param data - File data (Blob, File, Uint8Array, ReadableStream, or string)
   * @param options - Upload options
   */
  async upload(
    key: string,
    data: Blob | File | Uint8Array | ReadableStream<Uint8Array> | string,
    options: {
      bucket?: string;
      contentType?: string;
      cacheControl?: string;
      onProgress?: (loaded: number, total: number) => void;
      signal?: AbortSignal;
    } = {}
  ): Promise<UploadResponse> {
    const { bucket = 'default', contentType, cacheControl, onProgress, signal } = options;

    const path = `/p/${this.projectId}/bucket/${encodeURIComponent(key)}`;
    const query: Record<string, string> = {};
    if (bucket !== 'default') query.bucket = bucket;

    if (!this.hasStorageCredentials()) {
      throw new Error('Upload requires storage credentials (accessKeyId and secretKey)');
    }

    const requestHeaders: Record<string, string> = {};
    if (contentType) requestHeaders['Content-Type'] = contentType;
    if (cacheControl) requestHeaders['Cache-Control'] = cacheControl;

    let body: BodyInit;
    let contentLength: number | undefined;

    if (data instanceof Blob || data instanceof File) {
      body = data;
      contentLength = data.size;
    } else if (data instanceof Uint8Array) {
      body = new Blob([data as unknown as BlobPart]);
      contentLength = data.length;
    } else if (typeof data === 'string') {
      body = data;
      contentLength = new TextEncoder().encode(data).length;
    } else if (data instanceof ReadableStream) {
      // For streams, we can't know content-length upfront
      body = data;
    } else {
      throw new Error('Unsupported data type for upload');
    }

    const url = new URL(`${this.baseUrl}${path}`);
    Object.entries(query).forEach(([k, v]) => url.searchParams.set(k, v));

    // Auth headers for upload
    const authHeaders: Record<string, string> = {
      ...requestHeaders,
    };
    const storageAuth = this.getStorageAuthHeaders();
    Object.assign(authHeaders, storageAuth);

    // Handle progress if callback provided and we have a known size
    let finalBody = body;
    if (onProgress && contentLength !== undefined && body instanceof Blob) {
      finalBody = this.wrapWithProgress(body, contentLength, onProgress);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);
    const reqSignal = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal;

    try {
      const response = await this.fetchImpl(url.toString(), {
        method: 'POST',
        headers: authHeaders,
        body: finalBody,
        signal: reqSignal,
      });

      clearTimeout(timeoutId);

      const responseData = await response.json();

      if (!response.ok) {
        throw createErrorFromResponse(response, responseData);
      }

      return responseData as UploadResponse;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof MoogoError) throw error;
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new MoogoError('timeout', 'Upload timed out', 408);
      }
      throw new MoogoError('network_error', `Upload failed: ${error}`, 0);
    }
  }

  /** Wrap a Blob with progress tracking */
  private wrapWithProgress(blob: Blob, total: number, onProgress: (loaded: number, total: number) => void): ReadableStream<Uint8Array> {
    let loaded = 0;
    const reader = blob.stream().getReader();

    return new ReadableStream({
      async pull(controller) {
        const { done, value } = await reader.read();
        if (done) {
          controller.close();
          return;
        }
        loaded += value.byteLength;
        onProgress(loaded, total);
        controller.enqueue(value);
      },
      cancel() {
        reader.cancel();
      },
    });
  }

  /** Download an object */
  async download(
    key: string,
    options: {
      bucket?: string;
      signal?: AbortSignal;
      range?: { start: number; end?: number };
    } = {}
  ): Promise<Response> {
    const { bucket = 'default', signal, range } = options;

    const path = `/p/${this.projectId}/bucket/${encodeURIComponent(key)}`;
    const query: Record<string, string> = {};
    if (bucket !== 'default') query.bucket = bucket;

    if (!this.hasStorageCredentials()) {
      throw new Error('Download requires storage credentials (accessKeyId and secretKey)');
    }

    const requestHeaders: Record<string, string> = {};
    if (range) {
      const end = range.end !== undefined ? range.end : '';
      requestHeaders['Range'] = `bytes=${range.start}-${end}`;
    }

    const url = new URL(`${this.baseUrl}${path}`);
    Object.entries(query).forEach(([k, v]) => url.searchParams.set(k, v));

    // Auth headers for download
    const storageAuth = this.getStorageAuthHeaders();
    Object.assign(requestHeaders, storageAuth);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);
    const reqSignal = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal;

    try {
      const response = await this.fetchImpl(url.toString(), {
        method: 'GET',
        headers: requestHeaders,
        signal: reqSignal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw createErrorFromResponse(response, data);
      }

      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof MoogoError) throw error;
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new MoogoError('timeout', 'Download timed out', 408);
      }
      throw new MoogoError('network_error', `Download failed: ${error}`, 0);
    }
  }

  /** Download object as blob */
  async downloadBlob(key: string, options?: Parameters<typeof this.download>[1]): Promise<Blob> {
    const response = await this.download(key, options);
    return response.blob();
  }

  /** Download object as text */
  async downloadText(key: string, options?: Parameters<typeof this.download>[1]): Promise<string> {
    const response = await this.download(key, options);
    return response.text();
  }

  /** Download object as ArrayBuffer */
  async downloadArrayBuffer(key: string, options?: Parameters<typeof this.download>[1]): Promise<ArrayBuffer> {
    const response = await this.download(key, options);
    return response.arrayBuffer();
  }

  /** Get object metadata (HEAD request) */
  async headObject(
    key: string,
    options: { bucket?: string; signal?: AbortSignal } = {}
  ): Promise<{ headers: Headers; exists: boolean }> {
    const { bucket = 'default', signal } = options;

    const path = `/p/${this.projectId}/bucket/${encodeURIComponent(key)}`;
    const query: Record<string, string> = {};
    if (bucket !== 'default') query.bucket = bucket;

    if (!this.hasStorageCredentials()) {
      throw new Error('HEAD requires storage credentials (accessKeyId and secretKey)');
    }

    const url = new URL(`${this.baseUrl}${path}`);
    Object.entries(query).forEach(([k, v]) => url.searchParams.set(k, v));

    // Auth headers for HEAD
    const requestHeaders = this.getStorageAuthHeaders();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);
    const reqSignal = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal;

    try {
      const response = await this.fetchImpl(url.toString(), {
        method: 'HEAD',
        headers: requestHeaders,
        signal: reqSignal,
      });

      clearTimeout(timeoutId);

      if (response.status === 404) {
        return { headers: response.headers, exists: false };
      }

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw createErrorFromResponse(response, data);
      }

      return { headers: response.headers, exists: true };
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof MoogoError) throw error;
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new MoogoError('timeout', 'HEAD request timed out', 408);
      }
      throw new MoogoError('network_error', `HEAD failed: ${error}`, 0);
    }
  }

  /** Delete an object */
  async deleteObject(key: string, options: { bucket?: string; signal?: AbortSignal } = {}): Promise<void> {
    const { bucket = 'default', signal } = options;

    const path = `/p/${this.projectId}/bucket/${encodeURIComponent(key)}`;
    const query: Record<string, string> = {};
    if (bucket !== 'default') query.bucket = bucket;

    await this.requestStorage('DELETE', path, { query, signal });
  }

  /** List objects in a bucket */
  async listObjects(query: ListObjectsQuery = {}): Promise<ListObjectsResponse> {
    const params: Record<string, string> = {};
    if (query.bucket) params.bucket = query.bucket;
    if (query.prefix) params.prefix = query.prefix;
    if (query.search) params.search = query.search;
    if (query.order_by) params.order = query.order_by;
    if (query.order_dir) params.dir = query.order_dir;
    if (query.limit) params.limit = String(query.limit);
    if (query.cursor) params.cursor = query.cursor;

    return this.requestStorage<ListObjectsResponse>('GET', `/p/${this.projectId}/bucket`, { query: params });
  }

  /** Get a presigned URL for an object */
  async getPresignedUrl(
    key: string,
    request: PresignedUrlRequest,
    options: { bucket?: string; signal?: AbortSignal } = {}
  ): Promise<PresignedUrlResponse> {
    const { bucket = 'default', signal } = options;

    // The bucket is folded into the signed grant, so it goes in the body
    // alongside the key, method and expiry. The server reads request.Bucket
    // from the body; sending it as a query parameter is ignored and every
    // PUT grant silently signs for the default bucket.
    const path = `/p/${this.projectId}/bucket/${encodeURIComponent(key)}/sign`;
    const body: Record<string, any> = {
      method: request.method,
      expires_in: request.expires_in,
    };
    if (bucket !== 'default') body.bucket = bucket;

    return this.requestStorage<PresignedUrlResponse>('POST', path, {
      body: JSON.stringify(body),
      signal,
    });
  }

  /** Create a signed upload URL (returns upload URL + object metadata) */
  async createSignedUpload(
    key: string,
    request: PresignedUrlRequest & { content_type?: string },
    options: { bucket?: string; signal?: AbortSignal } = {}
  ): Promise<SignedUploadResponse> {
    const { bucket = 'default', signal } = options;

    // The server exposes one signing route: POST /buckets/{project_id}/sign.
    // A PUT grant is minted by passing method: "PUT" in the body, which is
    // what the client does here. The old /sign-upload path does not exist on
    // the server and always answered 404.
    const path = `/p/${this.projectId}/bucket/${encodeURIComponent(key)}/sign`;
    const body: Record<string, any> = {
      method: 'PUT',
      expires_in: request.expires_in,
    };
    if (bucket !== 'default') body.bucket = bucket;
    if (request.content_type) body.content_type = request.content_type;

    return this.requestStorage<SignedUploadResponse>('POST', path, {
      body: JSON.stringify(body),
      signal,
    });
  }

  /** Update object metadata (visibility, key) */
  async updateObject(
    key: string,
    updates: { new_key?: string },
    options: { bucket?: string; signal?: AbortSignal } = {}
  ): Promise<ObjectResponse> {
    const { bucket = 'default', signal } = options;

    const path = `/p/${this.projectId}/bucket/${encodeURIComponent(key)}`;
    const query: Record<string, string> = {};
    if (bucket !== 'default') query.bucket = bucket;

    const response = await this.requestStorage<{ success: true; object: ObjectResponse }>(
      'PATCH',
      path,
      { query, body: JSON.stringify(updates), signal }
    );
    return response.object;
  }

  // ==================== Credential Operations ====================

  /** List storage credentials */
  async listCredentials(): Promise<StorageCredential[]> {
    const response = await this.requestStorage<ListCredentialsResponse>(
      'GET',
      this.getCredentialsPath()
    );
    return response.credentials;
  }

  /** Create a new storage credential */
  async createCredential(request: CreateCredentialRequest): Promise<CreateCredentialResponse> {
    return this.requestStorage<CreateCredentialResponse>(
      'POST',
      this.getCredentialsPath(),
      { body: JSON.stringify(request) }
    );
  }

  /** Rotate a credential (generates new secret) */
  async rotateCredential(credentialId: string): Promise<RotateCredentialResponse> {
    return this.requestStorage<RotateCredentialResponse>(
      'POST',
      `${this.getCredentialsPath()}/${credentialId}/rotate`
    );
  }

  /** Revoke a credential */
  async revokeCredential(credentialId: string): Promise<void> {
    await this.requestStorage<DeleteResponse>(
      'DELETE',
      `${this.getCredentialsPath()}/${credentialId}`
    );
  }

  // ==================== Utility Methods ====================

  /** Get the public URL for an object (if published) */
  getPublicUrl(key: string, publicUrlBase?: string): string {
    if (publicUrlBase) {
      const normalizedBase = publicUrlBase.replace(/\/+$/, '');
      return `${normalizedBase}/pub/${this.projectId}/${encodeURIComponent(key)}`;
    }
    return `${this.baseUrl}/pub/${this.projectId}/${encodeURIComponent(key)}`;
  }

  /** Get the authenticated download URL for an object */
  getAuthenticatedUrl(key: string): string {
    return `${this.baseUrl}/p/${this.projectId}/${encodeURIComponent(key)}`;
  }

  /** Check if an object exists (efficient HEAD) */
  async objectExists(key: string, options?: { bucket?: string }): Promise<boolean> {
    const result = await this.headObject(key, options);
    return result.exists;
  }

  /** Get object size without downloading */
  async getObjectSize(key: string, options?: { bucket?: string }): Promise<number | null> {
    const result = await this.headObject(key, options);
    if (!result.exists) return null;
    const contentLength = result.headers.get('Content-Length');
    return contentLength ? parseInt(contentLength, 10) : null;
  }

  /** Get object ETag */
  async getObjectETag(key: string, options?: { bucket?: string }): Promise<string | null> {
    const result = await this.headObject(key, options);
    if (!result.exists) return null;
    return result.headers.get('ETag');
  }

  // ==================== SQL Operations ====================

  /** Execute a SQL read query */
  async query(request: QueryRequest, options: { signal?: AbortSignal } = {}): Promise<QueryResponse> {
    return this.requestSQL<QueryResponse>('POST', `/p/${this.projectId}/query`, {
      body: JSON.stringify(request),
      signal: options.signal,
    });
  }

  /** Execute a SQL write statement */
  async exec(request: ExecRequest, options: { signal?: AbortSignal } = {}): Promise<ExecResponse> {
    return this.requestSQL<ExecResponse>('POST', `/p/${this.projectId}/exec`, {
      body: JSON.stringify(request),
      signal: options.signal,
    });
  }

  /** Execute multiple SQL statements in a transaction */
  async transaction(request: TransactionRequest, options: { signal?: AbortSignal } = {}): Promise<TransactionResponse> {
    return this.requestSQL<TransactionResponse>('POST', `/p/${this.projectId}/transaction`, {
      body: JSON.stringify(request),
      signal: options.signal,
    });
  }

  /** Run database maintenance (VACUUM, REINDEX, ANALYZE) */
  async maintenance(options: { signal?: AbortSignal } = {}): Promise<{ success: true; reclaimed_bytes: number }> {
    return this.requestSQL<{ success: true; reclaimed_bytes: number }>(
      'POST',
      `/p/${this.projectId}/maintenance`,
      { signal: options.signal }
    );
  }
}

/** Create a client for storage operations (upload, download, list, bucket mgmt) */
export function createStorageClient(config: {
  baseUrl: string;
  projectId: string;
  accessKeyId: string;
  secretKey: string;
  fetch?: typeof fetch;
  timeout?: number;
}): MoogoClient {
  return new MoogoClient({
    baseUrl: config.baseUrl.replace(/\/+$/, ''),
    projectId: config.projectId,
    accessKeyId: config.accessKeyId,
    secretKey: config.secretKey,
    fetch: config.fetch,
    timeout: config.timeout,
  });
}

/** Create a client for SQL operations (query, exec, transaction, maintenance) */
export function createSQLClient(config: {
  baseUrl: string;
  projectId: string;
  projectKey: string;
  fetch?: typeof fetch;
  timeout?: number;
}): MoogoClient {
  return new MoogoClient({
    baseUrl: config.baseUrl.replace(/\/+$/, ''),
    projectId: config.projectId,
    projectKey: config.projectKey,
    fetch: config.fetch,
    timeout: config.timeout,
  });
}

/** Convenience function to create a client from environment variables */
export function createClientFromEnv(env?: Record<string, string | undefined>): MoogoClient {
  const getEnv = (key: string) => env?.[key] ?? process.env[key];

  const rawBase = getEnv('MOOGO_BASE_URL') || 'https://api.moogo.dev';
  const baseUrl = rawBase.replace(/\/p\/[^/]+\/bucket.*$/, '').replace(/\/+$/, '');

  const projectId = getEnv('MOOGO_PROJECT_ID');
  if (!projectId) {
    throw new Error('MOOGO_PROJECT_ID is required (Bug 18 fix: non-null assertions removed)');
  }

  // SQL key
  const projectKey = getEnv('MOOGO_SQL_KEY');
  if (projectKey) {
    if (!projectId) throw new Error('MOOGO_PROJECT_ID is required');
    return new MoogoClient({
      baseUrl,
      projectId,
      projectKey,
    });
  }
  // Storage keys
  const accessKeyId = getEnv('MOOGO_STORAGE_ACCESS_KEY_ID');
  const secretKey = getEnv('MOOGO_STORAGE_SECRET_KEY');
  if (!accessKeyId || !secretKey) {
    throw new Error('MOOGO_STORAGE_ACCESS_KEY_ID and MOOGO_STORAGE_SECRET_KEY are required when MOOGO_SQL_KEY is not set');
  }
  return new MoogoClient({
    baseUrl,
    projectId,
    accessKeyId,
    secretKey,
  });
}