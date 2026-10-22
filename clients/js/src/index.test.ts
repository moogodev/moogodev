/**
 * Basic type and structure tests for the Moogo client.
 * These verify the exports and types compile correctly.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  MoogoClient,
  createClientFromEnv,
  MoogoError,
  RateLimitedError,
  NotFoundError,
  createErrorFromResponse,
} from './index.js';
import type {
  ClientConfig,
  Bucket,
  ObjectResponse,
  ListObjectsQuery,
  ListObjectsResponse,
  StorageCredential,
} from './types.js';

describe('MoogoClient types', () => {
  it('should accept valid config', () => {
    const config: ClientConfig = {
      baseUrl: 'https://api.moogo.dev',
      projectId: 'test-project',
      accessKeyId: 'test-key',
      secretKey: 'test-secret',
    };
    expect(config.baseUrl).toBe('https://api.moogo.dev');
  });

  it('should have correct Bucket type', () => {
    const bucket: Bucket = {
      id: 'bucket-1',
      name: 'test-bucket',
      object_count: 0,
      size_bytes: 0,
      created_at: '2024-01-01T00:00:00Z',
      is_public: false,
      allowed_types: ['image/*'],
      max_object_size_bytes: 1024 * 1024,
      quota_bytes: 1024 * 1024 * 100,
    };
    expect(bucket.name).toBe('test-bucket');
  });

  it('should have correct ObjectResponse type', () => {
    const obj: ObjectResponse = {
      id: 'obj-1',
      bucket_id: 'bucket-1',
      bucket: 'test-bucket',
      key: 'test.png',
      size_bytes: 1024,
      content_type: 'image/png',
      is_public: true,
      etag: '"abc123"',
      url: 'https://api.moogo.dev/p/proj/bucket/test.png',
      preview_url: '/api/projects/proj/bucket/test.png',
      public_url: 'https://cdn.moogo.dev/pub/proj/test.png',
      public_url_base: 'https://cdn.moogo.dev',
      url_base: 'https://api.moogo.dev',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      last_modified: '2024-01-01T00:00:00Z',
    };
    expect(obj.public_url_base).toBe('https://cdn.moogo.dev');
  });

  it('should have correct ListObjectsQuery type', () => {
    const query: ListObjectsQuery = {
      bucket: 'my-bucket',
      prefix: 'images/',
      search: 'png',
      order_by: 'created',
      order_dir: 'desc',
      limit: 50,
      cursor: 'cursor123',
    };
    expect(query.order_by).toBe('created');
  });

  it('should have correct ListObjectsResponse type', () => {
    const response: ListObjectsResponse = {
      success: true,
      objects: [],
      next_cursor: null,
      total: 0,
    };
    expect(response.success).toBe(true);
  });
});

describe('MoogoClient instantiation', () => {
  it('should create client with config', () => {
    const client = new MoogoClient({
      baseUrl: 'https://api.moogo.dev',
      projectId: 'test-project',
      accessKeyId: 'test-key',
      secretKey: 'test-secret',
    });
    expect(client).toBeInstanceOf(MoogoClient);
  });

  it('should create client from env', () => {
    const originalEnv = process.env;
    process.env = {
      ...originalEnv,
      MOOGO_BASE_URL: 'https://api.moogo.dev',
      MOOGO_PROJECT_ID: 'test-project',
      MOOGO_STORAGE_ACCESS_KEY_ID: 'test-key',
      MOOGO_STORAGE_SECRET_KEY: 'test-secret',
    };
    const client = createClientFromEnv();
    expect(client).toBeInstanceOf(MoogoClient);
    process.env = originalEnv;
  });

  it('should throw on missing required config', () => {
    expect(() => new MoogoClient({
      baseUrl: '',
      projectId: 'test',
      accessKeyId: 'test',
      secretKey: 'test',
    })).toThrow('baseUrl is required');

    expect(() => new MoogoClient({
      baseUrl: 'https://api.moogo.dev',
      projectId: '',
      accessKeyId: 'test',
      secretKey: 'test',
    })).toThrow('projectId is required');
  });
});

describe('Error classes', () => {
  it('should create MoogoError with correct properties', () => {
    const error = new MoogoError('test_code', 'Test message', 400, 'detail');
    expect(error.code).toBe('test_code');
    expect(error.message).toBe('Test message');
    expect(error.status).toBe(400);
    expect(error.detail).toBe('detail');
  });

  it('should create RateLimitedError with retry info', () => {
    const error = new RateLimitedError(60, 1234567890, 'Too many requests');
    expect(error.retryAfter).toBe(60);
    expect(error.resetAt).toBe(1234567890);
    expect(error.status).toBe(429);
  });

  it('should create specific error types', () => {
    const notFound = new NotFoundError('Object not found');
    expect(notFound.code).toBe('not_found');
    expect(notFound.status).toBe(404);
  });
});

describe('createErrorFromResponse', () => {
  const mockResponse = (status: number, headers: Record<string, string> = {}) => ({
    status,
    ok: status >= 200 && status < 300,
    headers: {
      get: (key: string) => headers[key.toLowerCase()] || null,
    },
  });

  it('should create RateLimitedError for 429', () => {
    const response = mockResponse(429, {
      'retry-after': '60',
      'x-ratelimit-reset': '1234567890',
    });
    const error = createErrorFromResponse(response as any, { error: { code: 'rate_limited', message: 'Too many', detail: 'detail' } });
    expect(error).toBeInstanceOf(RateLimitedError);
    expect(error.retryAfter).toBe(60);
    expect(error.resetAt).toBe(1234567890);
  });

  it('should create NotFoundError for not_found code', () => {
    const response = mockResponse(404);
    const error = createErrorFromResponse(response as any, { error: { code: 'not_found', message: 'Not found', detail: 'detail' } });
    expect(error).toBeInstanceOf(NotFoundError);
  });

  it('should fallback to generic MoogoError for unknown codes', () => {
    const response = mockResponse(500);
    const error = createErrorFromResponse(response as any, { error: { code: 'unknown_code', message: 'Unknown', detail: 'detail' } });
    expect(error).toBeInstanceOf(MoogoError);
    expect(error.code).toBe('unknown_code');
  });
});

describe('Client method signatures', () => {
  let client: MoogoClient;

  beforeEach(() => {
    client = new MoogoClient({
      baseUrl: 'https://api.moogo.dev',
      projectId: 'test-project',
      accessKeyId: 'test-key',
      secretKey: 'test-secret',
    });
  });

  it('should have bucket methods', () => {
    expect(typeof client.listBuckets).toBe('function');
    expect(typeof client.getBucketInfo).toBe('function');
    expect(typeof client.createBucket).toBe('function');
    expect(typeof client.updateBucket).toBe('function');
    expect(typeof client.deleteBucket).toBe('function');
    expect(typeof client.setBucketPublic).toBe('function');
  });

  it('should have object methods', () => {
    expect(typeof client.upload).toBe('function');
    expect(typeof client.download).toBe('function');
    expect(typeof client.downloadBlob).toBe('function');
    expect(typeof client.downloadText).toBe('function');
    expect(typeof client.downloadArrayBuffer).toBe('function');
    expect(typeof client.headObject).toBe('function');
    expect(typeof client.deleteObject).toBe('function');
    expect(typeof client.listObjects).toBe('function');
    expect(typeof client.getPresignedUrl).toBe('function');
    expect(typeof client.createSignedUpload).toBe('function');
    expect(typeof client.updateObject).toBe('function');
  });

  it('should have credential methods', () => {
    expect(typeof client.listCredentials).toBe('function');
    expect(typeof client.createCredential).toBe('function');
    expect(typeof client.rotateCredential).toBe('function');
    expect(typeof client.revokeCredential).toBe('function');
  });

  it('should have utility methods', () => {
    expect(typeof client.getPublicUrl).toBe('function');
    expect(typeof client.getAuthenticatedUrl).toBe('function');
    expect(typeof client.objectExists).toBe('function');
    expect(typeof client.getObjectSize).toBe('function');
    expect(typeof client.getObjectETag).toBe('function');
  });
});

describe('URL helpers', () => {
  let client: MoogoClient;

  beforeEach(() => {
    client = new MoogoClient({
      baseUrl: 'https://api.moogo.dev',
      projectId: 'test-project',
      accessKeyId: 'test-key',
      secretKey: 'test-secret',
    });
  });

  it('should generate public URL', () => {
    const url = client.getPublicUrl('test.png');
    expect(url).toBe('https://api.moogo.dev/pub/test-project/test.png');
  });

  it('should generate public URL with custom base', () => {
    const url = client.getPublicUrl('test.png', 'https://cdn.example.com');
    expect(url).toBe('https://cdn.example.com/pub/test-project/test.png');
  });

  it('should generate authenticated URL', () => {
    const url = client.getAuthenticatedUrl('test.png');
    expect(url).toBe('https://api.moogo.dev/p/test-project/test.png');
  });

  it('should handle special characters in key', () => {
    const url = client.getPublicUrl('path/to/file.png');
    expect(url).toBe('https://api.moogo.dev/pub/test-project/path%2Fto%2Ffile.png');
  });
});