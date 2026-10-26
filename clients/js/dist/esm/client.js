/**
 * Moogo JavaScript/TypeScript Client
 * Official client for Moogo object storage API.
 */
import { MoogoError, createErrorFromResponse, } from './errors.js';
/** Default timeout: 30 seconds */
const DEFAULT_TIMEOUT = 30_000;
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
    baseUrl;
    projectId;
    accessKeyId;
    secretKey;
    projectKey;
    fetchImpl;
    timeout;
    constructor(config) {
        if (!config.baseUrl)
            throw new Error('baseUrl is required');
        if (!config.projectId)
            throw new Error('projectId is required');
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
    hasProjectKey() {
        return !!this.projectKey;
    }
    /** Check if configured for storage operations (access key) */
    hasStorageCredentials() {
        return !!this.accessKeyId && !!this.secretKey;
    }
    /** Build the bucket catalog path */
    getCatalogPath() {
        return `${this.baseUrl}/buckets/${this.projectId}`;
    }
    /** Build the credentials path */
    getCredentialsPath() {
        return `${this.baseUrl}/storage-credentials/${this.projectId}`;
    }
    /** Detect auth mode from secret key prefix */
    detectAuthMode() {
        // moogo_sk_ = Bearer token (current API)
        // moogo_hmac_ = HMAC-SHA256 (legacy/enterprise)
        if (this.secretKey?.startsWith('moogo_hmac_'))
            return 'hmac';
        return 'bearer';
    }
    /** Get storage auth headers (Bearer or HMAC) */
    getStorageAuthHeaders() {
        if (!this.hasStorageCredentials()) {
            throw new Error('Storage operations require accessKeyId and secretKey');
        }
        const mode = this.detectAuthMode();
        if (mode === 'hmac') {
            // Legacy HMAC - would need async, but we keep sync for headers
            // For HMAC, we'd compute in requestStorage instead
            return {
                'X-Moogo-Access-Key-Id': this.accessKeyId,
                'Authorization': `Bearer ${this.secretKey}`, // fallback, actual HMAC in request
            };
        }
        // Simple Bearer (current API)
        return {
            'X-Moogo-Access-Key-Id': this.accessKeyId,
            'Authorization': `Bearer ${this.secretKey}`,
        };
    }
    /** Execute a storage request with Bearer/HMAC auth and error handling */
    async requestStorage(method, path, options = {}) {
        if (!this.hasStorageCredentials()) {
            throw new Error('Storage operations require accessKeyId and secretKey');
        }
        const url = new URL(path, this.baseUrl);
        if (options.query) {
            Object.entries(options.query).forEach(([k, v]) => {
                if (v !== undefined && v !== null)
                    url.searchParams.set(k, v);
            });
        }
        // Base headers
        const requestHeaders = {
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
            let data;
            if (isJson) {
                data = await response.json();
            }
            else {
                data = await response.text();
            }
            if (!response.ok) {
                throw createErrorFromResponse(response, data);
            }
            return data;
        }
        catch (error) {
            clearTimeout(timeoutId);
            if (error instanceof MoogoError)
                throw error;
            if (error instanceof DOMException && error.name === 'AbortError') {
                throw new MoogoError('timeout', 'Request timed out', 408);
            }
            throw new MoogoError('network_error', `Network error: ${error}`, 0);
        }
    }
    /** Execute a SQL request with Bearer token auth and error handling */
    async requestSQL(method, path, options = {}) {
        if (!this.hasProjectKey()) {
            throw new Error('SQL operations require projectKey');
        }
        const url = new URL(path, this.baseUrl);
        if (options.query) {
            Object.entries(options.query).forEach(([k, v]) => {
                if (v !== undefined && v !== null)
                    url.searchParams.set(k, v);
            });
        }
        const requestHeaders = {
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
            let data;
            if (isJson) {
                data = await response.json();
            }
            else {
                data = await response.text();
            }
            if (!response.ok) {
                throw createErrorFromResponse(response, data);
            }
            return data;
        }
        catch (error) {
            clearTimeout(timeoutId);
            if (error instanceof MoogoError)
                throw error;
            if (error instanceof DOMException && error.name === 'AbortError') {
                throw new MoogoError('timeout', 'Request timed out', 408);
            }
            throw new MoogoError('network_error', `Network error: ${error}`, 0);
        }
    }
    // ==================== Bucket Operations ====================
    /** List all buckets in the project */
    async listBuckets() {
        const response = await this.requestStorage('GET', this.getCatalogPath());
        return response.buckets;
    }
    /** Get bucket info including usage stats (by bucket ID) */
    async getBucketInfo(bucketId) {
        const response = await this.requestStorage('GET', `${this.getCatalogPath()}/${bucketId}`);
        return response;
    }
    /** Get bucket info by name (resolves name to ID) */
    async getBucketInfoByName(bucketName) {
        const buckets = await this.listBuckets();
        const bucket = buckets.find(b => b.name === bucketName);
        if (!bucket) {
            throw new Error(`Bucket not found: ${bucketName}`);
        }
        return this.getBucketInfo(bucket.id);
    }
    /** Create a new bucket */
    async createBucket(request) {
        const response = await this.requestStorage('POST', this.getCatalogPath(), { body: JSON.stringify(request) });
        return response.bucket;
    }
    /** Update bucket settings */
    async updateBucket(bucketId, request) {
        const response = await this.requestStorage('PATCH', `${this.getCatalogPath()}/${bucketId}`, { body: JSON.stringify(request) });
        return response.bucket;
    }
    /** Delete a bucket and all its objects */
    async deleteBucket(bucketId) {
        await this.requestStorage('DELETE', `${this.getCatalogPath()}/${bucketId}`);
    }
    /** S3-compatible download (R2 wire-compat) via /s3/{bucket}/{key}
     * Note: This endpoint is protected by SigV4 middleware. For private objects,
     * the SDK must send a valid HMAC-SHA256 signature (not implemented in this
     * version). Public objects are accessible without auth; private objects require
     * either the signed URL from getPresignedUrl or the storage credential with
     * full SigV4 signing. */
    async s3Download(bucketName, key, opts) {
        const url = `${this.baseUrl}/s3/${encodeURIComponent(bucketName)}/${encodeURIComponent(key)}`;
        // Pass storage auth headers when available; the SigV4 middleware can
        // fall back to bearer token for some deployments, but full HMAC signing
        // (dead code in detectAuthMode) remains unimplemented.
        const headers = {};
        if (this.hasStorageCredentials()) {
            const auth = this.getStorageAuthHeaders();
            Object.assign(headers, auth);
        }
        return fetch(url, { headers, signal: opts?.signal });
    }
    /** Toggle bucket public/private (fans out to all objects) */
    async setBucketPublic(bucketId, isPublic) {
        const response = await this.requestStorage('POST', `${this.getCatalogPath()}/${bucketId}/public`, { body: JSON.stringify({ is_public: isPublic }) });
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
    async upload(key, data, options = {}) {
        const { bucket = 'default', contentType, cacheControl, onProgress, signal } = options;
        const path = `/p/${this.projectId}/bucket/${encodeURIComponent(key)}`;
        const query = {};
        if (bucket !== 'default')
            query.bucket = bucket;
        if (!this.hasStorageCredentials()) {
            throw new Error('Upload requires storage credentials (accessKeyId and secretKey)');
        }
        const requestHeaders = {};
        if (contentType)
            requestHeaders['Content-Type'] = contentType;
        if (cacheControl)
            requestHeaders['Cache-Control'] = cacheControl;
        let body;
        let contentLength;
        if (data instanceof Blob || data instanceof File) {
            body = data;
            contentLength = data.size;
        }
        else if (data instanceof Uint8Array) {
            body = new Blob([data]);
            contentLength = data.length;
        }
        else if (typeof data === 'string') {
            body = data;
            contentLength = new TextEncoder().encode(data).length;
        }
        else if (data instanceof ReadableStream) {
            // For streams, we can't know content-length upfront
            body = data;
        }
        else {
            throw new Error('Unsupported data type for upload');
        }
        const url = new URL(`${this.baseUrl}${path}`);
        Object.entries(query).forEach(([k, v]) => url.searchParams.set(k, v));
        // Auth headers for upload
        const authHeaders = {
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
            return responseData;
        }
        catch (error) {
            clearTimeout(timeoutId);
            if (error instanceof MoogoError)
                throw error;
            if (error instanceof DOMException && error.name === 'AbortError') {
                throw new MoogoError('timeout', 'Upload timed out', 408);
            }
            throw new MoogoError('network_error', `Upload failed: ${error}`, 0);
        }
    }
    /** Wrap a Blob with progress tracking */
    wrapWithProgress(blob, total, onProgress) {
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
    async download(key, options = {}) {
        const { bucket = 'default', signal, range } = options;
        const path = `/p/${this.projectId}/bucket/${encodeURIComponent(key)}`;
        const query = {};
        if (bucket !== 'default')
            query.bucket = bucket;
        if (!this.hasStorageCredentials()) {
            throw new Error('Download requires storage credentials (accessKeyId and secretKey)');
        }
        const requestHeaders = {};
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
        }
        catch (error) {
            clearTimeout(timeoutId);
            if (error instanceof MoogoError)
                throw error;
            if (error instanceof DOMException && error.name === 'AbortError') {
                throw new MoogoError('timeout', 'Download timed out', 408);
            }
            throw new MoogoError('network_error', `Download failed: ${error}`, 0);
        }
    }
    /** Download object as blob */
    async downloadBlob(key, options) {
        const response = await this.download(key, options);
        return response.blob();
    }
    /** Download object as text */
    async downloadText(key, options) {
        const response = await this.download(key, options);
        return response.text();
    }
    /** Download object as ArrayBuffer */
    async downloadArrayBuffer(key, options) {
        const response = await this.download(key, options);
        return response.arrayBuffer();
    }
    /** Get object metadata (HEAD request) */
    async headObject(key, options = {}) {
        const { bucket = 'default', signal } = options;
        const path = `/p/${this.projectId}/bucket/${encodeURIComponent(key)}`;
        const query = {};
        if (bucket !== 'default')
            query.bucket = bucket;
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
        }
        catch (error) {
            clearTimeout(timeoutId);
            if (error instanceof MoogoError)
                throw error;
            if (error instanceof DOMException && error.name === 'AbortError') {
                throw new MoogoError('timeout', 'HEAD request timed out', 408);
            }
            throw new MoogoError('network_error', `HEAD failed: ${error}`, 0);
        }
    }
    /** Delete an object */
    async deleteObject(key, options = {}) {
        const { bucket = 'default', signal } = options;
        const path = `/p/${this.projectId}/bucket/${encodeURIComponent(key)}`;
        const query = {};
        if (bucket !== 'default')
            query.bucket = bucket;
        await this.requestStorage('DELETE', path, { query, signal });
    }
    /** List objects in a bucket */
    async listObjects(query = {}) {
        const params = {};
        if (query.bucket)
            params.bucket = query.bucket;
        if (query.prefix)
            params.prefix = query.prefix;
        if (query.search)
            params.search = query.search;
        if (query.order_by)
            params.order = query.order_by;
        if (query.order_dir)
            params.dir = query.order_dir;
        if (query.limit)
            params.limit = String(query.limit);
        if (query.cursor)
            params.cursor = query.cursor;
        return this.requestStorage('GET', `/p/${this.projectId}/bucket`, { query: params });
    }
    /** Get a presigned URL for an object */
    async getPresignedUrl(key, request, options = {}) {
        const { bucket = 'default', signal } = options;
        // The bucket is folded into the signed grant, so it goes in the body
        // alongside the key, method and expiry. The server reads request.Bucket
        // from the body; sending it as a query parameter is ignored and every
        // PUT grant silently signs for the default bucket.
        const path = `/p/${this.projectId}/bucket/${encodeURIComponent(key)}/sign`;
        const body = {
            method: request.method,
            expires_in: request.expires_in,
        };
        if (bucket !== 'default')
            body.bucket = bucket;
        return this.requestStorage('POST', path, {
            body: JSON.stringify(body),
            signal,
        });
    }
    /** Create a signed upload URL (returns upload URL + object metadata) */
    async createSignedUpload(key, request, options = {}) {
        const { bucket = 'default', signal } = options;
        // The server exposes one signing route: POST /buckets/{project_id}/sign.
        // A PUT grant is minted by passing method: "PUT" in the body, which is
        // what the client does here. The old /sign-upload path does not exist on
        // the server and always answered 404.
        const path = `/p/${this.projectId}/bucket/${encodeURIComponent(key)}/sign`;
        const body = {
            method: 'PUT',
            expires_in: request.expires_in,
        };
        if (bucket !== 'default')
            body.bucket = bucket;
        if (request.content_type)
            body.content_type = request.content_type;
        return this.requestStorage('POST', path, {
            body: JSON.stringify(body),
            signal,
        });
    }
    /** Update object metadata (visibility, key) */
    async updateObject(key, updates, options = {}) {
        const { bucket = 'default', signal } = options;
        const path = `/p/${this.projectId}/bucket/${encodeURIComponent(key)}`;
        const query = {};
        if (bucket !== 'default')
            query.bucket = bucket;
        const response = await this.requestStorage('PATCH', path, { query, body: JSON.stringify(updates), signal });
        return response.object;
    }
    // ==================== Credential Operations ====================
    /** List storage credentials */
    async listCredentials() {
        const response = await this.requestStorage('GET', this.getCredentialsPath());
        return response.credentials;
    }
    /** Create a new storage credential */
    async createCredential(request) {
        return this.requestStorage('POST', this.getCredentialsPath(), { body: JSON.stringify(request) });
    }
    /** Rotate a credential (generates new secret) */
    async rotateCredential(credentialId) {
        return this.requestStorage('POST', `${this.getCredentialsPath()}/${credentialId}/rotate`);
    }
    /** Revoke a credential */
    async revokeCredential(credentialId) {
        await this.requestStorage('DELETE', `${this.getCredentialsPath()}/${credentialId}`);
    }
    // ==================== Utility Methods ====================
    /** Get the public URL for an object (if published) */
    getPublicUrl(key, publicUrlBase) {
        if (publicUrlBase) {
            const normalizedBase = publicUrlBase.replace(/\/+$/, '');
            return `${normalizedBase}/pub/${this.projectId}/${encodeURIComponent(key)}`;
        }
        return `${this.baseUrl}/pub/${this.projectId}/${encodeURIComponent(key)}`;
    }
    /** Get the authenticated download URL for an object */
    getAuthenticatedUrl(key) {
        return `${this.baseUrl}/p/${this.projectId}/${encodeURIComponent(key)}`;
    }
    /** Check if an object exists (efficient HEAD) */
    async objectExists(key, options) {
        const result = await this.headObject(key, options);
        return result.exists;
    }
    /** Get object size without downloading */
    async getObjectSize(key, options) {
        const result = await this.headObject(key, options);
        if (!result.exists)
            return null;
        const contentLength = result.headers.get('Content-Length');
        return contentLength ? parseInt(contentLength, 10) : null;
    }
    /** Get object ETag */
    async getObjectETag(key, options) {
        const result = await this.headObject(key, options);
        if (!result.exists)
            return null;
        return result.headers.get('ETag');
    }
    // ==================== SQL Operations ====================
    /** Execute a SQL read query */
    async query(request, options = {}) {
        return this.requestSQL('POST', `/p/${this.projectId}/query`, {
            body: JSON.stringify(request),
            signal: options.signal,
        });
    }
    /** Execute a SQL write statement */
    async exec(request, options = {}) {
        return this.requestSQL('POST', `/p/${this.projectId}/exec`, {
            body: JSON.stringify(request),
            signal: options.signal,
        });
    }
    /** Execute multiple SQL statements in a transaction */
    async transaction(request, options = {}) {
        return this.requestSQL('POST', `/p/${this.projectId}/transaction`, {
            body: JSON.stringify(request),
            signal: options.signal,
        });
    }
    /** Run database maintenance (VACUUM, REINDEX, ANALYZE) */
    async maintenance(options = {}) {
        return this.requestSQL('POST', `/p/${this.projectId}/maintenance`, { signal: options.signal });
    }
}
/** Create a client for storage operations (upload, download, list, bucket mgmt) */
export function createStorageClient(config) {
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
export function createSQLClient(config) {
    return new MoogoClient({
        baseUrl: config.baseUrl.replace(/\/+$/, ''),
        projectId: config.projectId,
        projectKey: config.projectKey,
        fetch: config.fetch,
        timeout: config.timeout,
    });
}
/** Convenience function to create a client from environment variables */
export function createClientFromEnv(env) {
    const getEnv = (key) => env?.[key] ?? process.env[key];
    // Standard env vars only (no legacy fallbacks)
    const rawBase = getEnv('MOOGO_BASE_URL') || 'https://api.moogo.dev';
    const baseUrl = rawBase.replace(/\/p\/[^/]+\/bucket.*$/, '').replace(/\/+$/, '');
    // SQL key
    const projectKey = getEnv('MOOGO_SQL_KEY');
    if (projectKey) {
        return new MoogoClient({
            baseUrl,
            projectId: getEnv('MOOGO_PROJECT_ID'),
            projectKey,
        });
    }
    // Storage keys
    return new MoogoClient({
        baseUrl,
        projectId: getEnv('MOOGO_PROJECT_ID'),
        accessKeyId: getEnv('MOOGO_STORAGE_ACCESS_KEY_ID'),
        secretKey: getEnv('MOOGO_STORAGE_SECRET_KEY'),
    });
}
