/**
 * Error classes for Moogo client.
 * All errors follow the API error codes.
 */
export class MoogoError extends Error {
    code;
    status;
    detail;
    constructor(code, message, status, detail) {
        super(message);
        this.name = 'MoogoError';
        this.code = code;
        this.status = status;
        this.detail = detail;
        Object.setPrototypeOf(this, MoogoError.prototype);
    }
    static fromResponse(response, data) {
        const error = data?.error;
        if (error) {
            return new MoogoError(error.code, error.message, response.status, error.detail);
        }
        return new MoogoError('unknown_error', `HTTP ${response.status}: ${response.statusText}`, response.status);
    }
}
/** 400 - Missing or invalid object key */
export class MissingKeyError extends MoogoError {
    constructor(detail) {
        super('missing_key', 'No object key in the path', 400, detail);
        this.name = 'MissingKeyError';
        Object.setPrototypeOf(this, MissingKeyError.prototype);
    }
}
export class InvalidKeyError extends MoogoError {
    constructor(detail) {
        super('invalid_key', 'Key contains invalid characters', 400, detail);
        this.name = 'InvalidKeyError';
        Object.setPrototypeOf(this, InvalidKeyError.prototype);
    }
}
export class KeyTooLongError extends MoogoError {
    constructor(detail) {
        super('key_too_long', 'Object key exceeds maximum length', 400, detail);
        this.name = 'KeyTooLongError';
        Object.setPrototypeOf(this, KeyTooLongError.prototype);
    }
}
export class KeyTakenError extends MoogoError {
    constructor(detail) {
        super('key_taken', 'An object with that key already exists', 409, detail);
        this.name = 'KeyTakenError';
        Object.setPrototypeOf(this, KeyTakenError.prototype);
    }
}
export class InvalidBucketError extends MoogoError {
    constructor(detail) {
        super('invalid_bucket', 'Bucket name is not allowed or invalid', 400, detail);
        this.name = 'InvalidBucketError';
        Object.setPrototypeOf(this, InvalidBucketError.prototype);
    }
}
export class InvalidCursorError extends MoogoError {
    constructor(detail) {
        super('invalid_cursor', 'Cursor is malformed or belongs to a different listing', 400, detail);
        this.name = 'InvalidCursorError';
        Object.setPrototypeOf(this, InvalidCursorError.prototype);
    }
}
export class InvalidOrderError extends MoogoError {
    constructor(detail) {
        super('invalid_order', 'Unknown order or direction', 400, detail);
        this.name = 'InvalidOrderError';
        Object.setPrototypeOf(this, InvalidOrderError.prototype);
    }
}
export class BodyTooLargeError extends MoogoError {
    constructor(detail) {
        super('body_too_large', 'Request body exceeded the JSON or upload cap', 413, detail);
        this.name = 'BodyTooLargeError';
        Object.setPrototypeOf(this, BodyTooLargeError.prototype);
    }
}
export class ObjectTooLargeError extends MoogoError {
    constructor(detail) {
        super('object_too_large', 'Object over the bucket max size. Check bucket max_object_size_bytes (default 256 MB). Use `PATCH /buckets/{id}` to increase, or split the file.', 413, detail);
        this.name = 'ObjectTooLargeError';
        Object.setPrototypeOf(this, ObjectTooLargeError.prototype);
    }
}
export class UnsupportedMediaTypeError extends MoogoError {
    constructor(detail) {
        super('unsupported_media_type', 'Wrong Content-Type', 415, detail);
        this.name = 'UnsupportedMediaTypeError';
        Object.setPrototypeOf(this, UnsupportedMediaTypeError.prototype);
    }
}
export class QuotaExceededError extends MoogoError {
    constructor(detail) {
        super('quota_exceeded', 'Project or bucket storage would go over quota. Delete objects or run `moogo db vacuum` / `POST /maintenance` to reclaim space.', 409, detail);
        this.name = 'QuotaExceededError';
        Object.setPrototypeOf(this, QuotaExceededError.prototype);
    }
}
export class ProjectPausedError extends MoogoError {
    constructor(detail) {
        super('project_paused', 'Project is paused', 403, detail);
        this.name = 'ProjectPausedError';
        Object.setPrototypeOf(this, ProjectPausedError.prototype);
    }
}
export class LinkExpiredError extends MoogoError {
    constructor(detail) {
        super('link_expired', 'Signed URL expired', 403, detail);
        this.name = 'LinkExpiredError';
        Object.setPrototypeOf(this, LinkExpiredError.prototype);
    }
}
export class NotFoundError extends MoogoError {
    constructor(detail) {
        super('not_found', 'Bucket/object missing or not published. For public URLs: ensure the bucket is public (dashboard → Bucket settings → Public) and check key spelling.', 404, detail);
        this.name = 'NotFoundError';
        Object.setPrototypeOf(this, NotFoundError.prototype);
    }
}
export class BucketNotFoundError extends MoogoError {
    constructor(detail) {
        super('bucket_not_found', 'Bucket does not exist', 404, detail);
        this.name = 'BucketNotFoundError';
        Object.setPrototypeOf(this, BucketNotFoundError.prototype);
    }
}
export class CredentialLimitError extends MoogoError {
    constructor(detail) {
        super('credential_limit', 'Too many storage credentials', 409, detail);
        this.name = 'CredentialLimitError';
        Object.setPrototypeOf(this, CredentialLimitError.prototype);
    }
}
export class RateLimitedError extends MoogoError {
    retryAfter;
    resetAt;
    constructor(retryAfter, resetAt, detail) {
        super('rate_limited', `Too many requests. Retry after ${retryAfter}s (reset at ${resetAt ? new Date(resetAt * 1000).toISOString() : 'unknown'}). Use X-RateLimit-Reset header for precise timing.`, 429, detail);
        this.name = 'RateLimitedError';
        this.retryAfter = retryAfter;
        this.resetAt = resetAt;
        Object.setPrototypeOf(this, RateLimitedError.prototype);
    }
    static fromResponse(response, data) {
        const retryAfter = parseInt(response.headers.get('Retry-After') || '1', 10);
        const resetAt = response.headers.get('X-RateLimit-Reset')
            ? parseInt(response.headers.get('X-RateLimit-Reset'), 10)
            : null;
        return new RateLimitedError(retryAfter, resetAt, data?.error?.detail);
    }
}
export class InvalidBodyError extends MoogoError {
    constructor(detail) {
        super('invalid_body', 'Malformed JSON or missing required fields', 400, detail);
        this.name = 'InvalidBodyError';
        Object.setPrototypeOf(this, InvalidBodyError.prototype);
    }
}
export class InvalidExpiresInError extends MoogoError {
    constructor(detail) {
        super('invalid_expires_in', 'expires_in is outside the 60-604800 second range', 400, detail);
        this.name = 'InvalidExpiresInError';
        Object.setPrototypeOf(this, InvalidExpiresInError.prototype);
    }
}
export class InvalidMethodError extends MoogoError {
    constructor(detail) {
        super('invalid_method', 'A signed URL was requested with a method other than GET or PUT', 400, detail);
        this.name = 'InvalidMethodError';
        Object.setPrototypeOf(this, InvalidMethodError.prototype);
    }
}
export class UnauthorizedError extends MoogoError {
    constructor(detail) {
        const hint = detail
            ? detail
            : 'Authentication required. Storage: set MOOGO_BASE_URL, MOOGO_PROJECT_ID, MOOGO_STORAGE_ACCESS_KEY_ID, MOOGO_STORAGE_SECRET_KEY. SQL: set MOOGO_SQL_KEY.';
        super('unauthorized', hint, 401, detail);
        this.name = 'UnauthorizedError';
        Object.setPrototypeOf(this, UnauthorizedError.prototype);
    }
}
/** Map error codes to error classes */
const errorMap = {
    missing_key: MissingKeyError,
    invalid_key: InvalidKeyError,
    key_too_long: KeyTooLongError,
    key_taken: KeyTakenError,
    invalid_bucket: InvalidBucketError,
    invalid_cursor: InvalidCursorError,
    invalid_order: InvalidOrderError,
    body_too_large: BodyTooLargeError,
    object_too_large: ObjectTooLargeError,
    unsupported_media_type: UnsupportedMediaTypeError,
    quota_exceeded: QuotaExceededError,
    project_paused: ProjectPausedError,
    link_expired: LinkExpiredError,
    not_found: NotFoundError,
    bucket_not_found: BucketNotFoundError,
    credential_limit: CredentialLimitError,
    invalid_body: InvalidBodyError,
    invalid_expires_in: InvalidExpiresInError,
    invalid_method: InvalidMethodError,
    unauthorized: UnauthorizedError,
};
/**
 * Create a typed error from an API response.
 * Falls back to generic MoogoError for unknown codes.
 */
export function createErrorFromResponse(response, data) {
    if (response.status === 429) {
        return RateLimitedError.fromResponse(response, data);
    }
    const errorCode = data?.error?.code;
    if (errorCode && errorMap[errorCode]) {
        return new errorMap[errorCode](data.error.detail);
    }
    return MoogoError.fromResponse(response, data);
}
