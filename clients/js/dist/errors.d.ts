/**
 * Error classes for Moogo client.
 * All errors follow the API error codes.
 */
export declare class MoogoError extends Error {
    readonly code: string;
    readonly status: number;
    readonly detail?: string;
    constructor(code: string, message: string, status: number, detail?: string);
    static fromResponse(response: Response, data: any): MoogoError;
}
/** 400 - Missing or invalid object key */
export declare class MissingKeyError extends MoogoError {
    constructor(detail?: string);
}
export declare class InvalidKeyError extends MoogoError {
    constructor(detail?: string);
}
export declare class KeyTooLongError extends MoogoError {
    constructor(detail?: string);
}
export declare class KeyTakenError extends MoogoError {
    constructor(detail?: string);
}
export declare class InvalidBucketError extends MoogoError {
    constructor(detail?: string);
}
export declare class InvalidCursorError extends MoogoError {
    constructor(detail?: string);
}
export declare class InvalidOrderError extends MoogoError {
    constructor(detail?: string);
}
export declare class BodyTooLargeError extends MoogoError {
    constructor(detail?: string);
}
export declare class ObjectTooLargeError extends MoogoError {
    constructor(detail?: string);
}
export declare class UnsupportedMediaTypeError extends MoogoError {
    constructor(detail?: string);
}
export declare class QuotaExceededError extends MoogoError {
    constructor(detail?: string);
}
export declare class ProjectPausedError extends MoogoError {
    constructor(detail?: string);
}
export declare class LinkExpiredError extends MoogoError {
    constructor(detail?: string);
}
export declare class NotFoundError extends MoogoError {
    constructor(detail?: string);
}
export declare class BucketNotFoundError extends MoogoError {
    constructor(detail?: string);
}
export declare class CredentialLimitError extends MoogoError {
    constructor(detail?: string);
}
export declare class RateLimitedError extends MoogoError {
    readonly retryAfter: number;
    readonly resetAt: number | null;
    constructor(retryAfter: number, resetAt: number | null, detail?: string);
    static fromResponse(response: Response, data: any): RateLimitedError;
}
export declare class InvalidBodyError extends MoogoError {
    constructor(detail?: string);
}
export declare class InvalidExpiresInError extends MoogoError {
    constructor(detail?: string);
}
export declare class InvalidMethodError extends MoogoError {
    constructor(detail?: string);
}
export declare class UnauthorizedError extends MoogoError {
    constructor(detail?: string);
}
/**
 * Create a typed error from an API response.
 * Falls back to generic MoogoError for unknown codes.
 */
export declare function createErrorFromResponse(response: Response, data: any): MoogoError;
//# sourceMappingURL=errors.d.ts.map