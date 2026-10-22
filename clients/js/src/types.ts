/**
 * Type definitions for Moogo object storage API.
 * Matches the API responses from https://moogo.dev
 */

/** Standard API error envelope */
export interface ApiError {
  code: string;
  message: string;
  detail?: string;
}

export interface ApiErrorResponse {
  error: ApiError;
}

/** Successful response wrapper */
export interface ApiSuccessResponse {
  success: true;
  [key: string]: any;
}

/** Project/bucket identifiers */
export type ProjectId = string;
export type BucketId = string;
export type ObjectKey = string;

/** Base object fields present in all object responses */
export interface ObjectBase {
  id: string;
  bucket_id: string;
  bucket: string;
  key: string;
  size_bytes: number;
  content_type: string;
  is_public: boolean;
  etag: string;
  url: string;
  preview_url: string;
  public_url: string;
  public_url_base: string;
  url_base: string;
  created_at: string;
  updated_at: string;
  last_modified: string;
}

/** Object as returned by upload/list endpoints */
export interface ObjectResponse extends ObjectBase {}

/** Bucket configuration */
export interface Bucket {
  id: string;
  name: string;
  object_count: number;
  size_bytes: number;
  created_at: string;
  is_public: boolean;
  allowed_types: string[];
  max_object_size_bytes: number;
  quota_bytes: number;
}

/** Bucket creation request */
export interface CreateBucketRequest {
  name: string;
  allowed_types?: string[];
  max_object_size_bytes?: number;
  quota_bytes?: number;
}

/** Bucket update request */
export interface UpdateBucketRequest {
  is_public?: boolean;
  allowed_types?: string[];
  max_object_size_bytes?: number;
  quota_bytes?: number;
}

/** Bucket info response (GET /buckets/{project_id}/{bucket_id}) */
export interface BucketInfoResponse {
  success: true;
  bucket: Bucket;
  storage_used_bytes: number;
  quota_bytes: number;
}

/** List buckets response */
export interface ListBucketsResponse {
  success: true;
  buckets: Bucket[];
}

/** Object upload response */
export interface UploadResponse {
  success: true;
  object: ObjectResponse;
  storage_used_bytes: number;
  quota_bytes: number;
}

/** List objects query parameters */
export interface ListObjectsQuery {
  bucket?: string;
  prefix?: string;
  search?: string;
  order_by?: 'key' | 'size' | 'created' | 'updated' | 'contenttype';
  order_dir?: 'asc' | 'desc';
  limit?: number;
  cursor?: string;
}

/** Paginated object list response */
export interface ListObjectsResponse {
  success: true;
  objects: ObjectResponse[];
  next_cursor: string | null;
  total: number;
}

/** Presigned URL request */
export interface PresignedUrlRequest {
  method: 'GET' | 'PUT';
  expires_in: number; // 60 - 604800 seconds
}

/** Presigned URL response */
export interface PresignedUrlResponse {
  success: true;
  url: string;
  expires_at: string;
  method: 'GET' | 'PUT';
}

/** Signed upload response (POST /bucket/{project_id}/sign-upload) */
export interface SignedUploadResponse {
  success: true;
  upload_url: string;
  object: ObjectResponse;
  expires_at: string;
}

/** Storage credential */
export interface StorageCredential {
  id: string;
  access_key_id: string;
  secret_key_preview: string;
  label: string;
  created_at: string;
  rotated_at: string | null;
  revoked_at: string | null;
}

/** List credentials response */
export interface ListCredentialsResponse {
  success: true;
  credentials: StorageCredential[];
}

/** Create credential request */
export interface CreateCredentialRequest {
  label: string;
}

/** Create credential response (includes secret once) */
export interface CreateCredentialResponse {
  success: true;
  credential: StorageCredential;
  secret_key: string; // Only returned once!
}

/** Rotate credential response */
export interface RotateCredentialResponse {
  success: true;
  credential: StorageCredential;
  secret_key: string; // Only returned once!
}

/** Generic success response for deletions */
export interface DeleteResponse {
  success: true;
}

/** Configuration for the client */
export interface ClientConfig {
  /** Base URL of the Moogo API (e.g., "https://api.moogo.dev") */
  baseUrl: string;
  /** Project ID */
  projectId: string;
  /** Access Key ID (for storage operations) */
  accessKeyId?: string;
  /** Secret Key (for storage operations) */
  secretKey?: string;
  /** Project Key (for SQL operations) - used instead of accessKeyId/secretKey */
  projectKey?: string;
  /** Optional: custom fetch implementation */
  fetch?: typeof fetch;
  /** Optional: default timeout in ms */
  timeout?: number;
}

/** Internal: parsed auth header */
export interface ParsedAuth {
  accessKeyId: string;
  signature: string;
  timestamp: string;
  signedHeaders: string;
}

/** SQL query request */
export interface QueryRequest {
  sql: string;
  args?: any[];
}

/** SQL query response row */
export interface QueryRow {
  [column: string]: any;
}

/** SQL query response */
export interface QueryResponse {
  success: true;
  rows: QueryRow[];
  row_count: number;
  columns: string[];
  truncated: boolean;
  duration_ms: number;
}

/** SQL exec request */
export interface ExecRequest {
  sql: string;
  args?: any[];
}

/** SQL exec response */
export interface ExecResponse {
  success: true;
  rows_affected: number;
  duration_ms: number;
  last_insert_id?: number;
}

/** SQL transaction request */
export interface TransactionRequest {
  statements: (string | QueryRequest)[];
}

/** SQL transaction response */
export interface TransactionResponse {
  success: true;
  results: TransactionResult[];
  duration_ms: number;
}

export interface TransactionResult {
  rows?: QueryRow[];
  row_count?: number;
  rows_affected?: number;
  columns?: string[];
  truncated?: boolean;
}