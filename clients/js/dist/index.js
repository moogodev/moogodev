"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSQLClient = exports.createStorageClient = exports.createClientFromEnv = exports.MoogoClient = exports.createErrorFromResponse = exports.UnauthorizedError = exports.InvalidMethodError = exports.InvalidExpiresInError = exports.InvalidBodyError = exports.RateLimitedError = exports.CredentialLimitError = exports.BucketNotFoundError = exports.NotFoundError = exports.LinkExpiredError = exports.ProjectPausedError = exports.QuotaExceededError = exports.UnsupportedMediaTypeError = exports.ObjectTooLargeError = exports.BodyTooLargeError = exports.InvalidOrderError = exports.InvalidCursorError = exports.InvalidBucketError = exports.KeyTakenError = exports.KeyTooLongError = exports.InvalidKeyError = exports.MissingKeyError = exports.MoogoError = void 0;
// Errors
var errors_js_1 = require("./errors.js");
Object.defineProperty(exports, "MoogoError", { enumerable: true, get: function () { return errors_js_1.MoogoError; } });
Object.defineProperty(exports, "MissingKeyError", { enumerable: true, get: function () { return errors_js_1.MissingKeyError; } });
Object.defineProperty(exports, "InvalidKeyError", { enumerable: true, get: function () { return errors_js_1.InvalidKeyError; } });
Object.defineProperty(exports, "KeyTooLongError", { enumerable: true, get: function () { return errors_js_1.KeyTooLongError; } });
Object.defineProperty(exports, "KeyTakenError", { enumerable: true, get: function () { return errors_js_1.KeyTakenError; } });
Object.defineProperty(exports, "InvalidBucketError", { enumerable: true, get: function () { return errors_js_1.InvalidBucketError; } });
Object.defineProperty(exports, "InvalidCursorError", { enumerable: true, get: function () { return errors_js_1.InvalidCursorError; } });
Object.defineProperty(exports, "InvalidOrderError", { enumerable: true, get: function () { return errors_js_1.InvalidOrderError; } });
Object.defineProperty(exports, "BodyTooLargeError", { enumerable: true, get: function () { return errors_js_1.BodyTooLargeError; } });
Object.defineProperty(exports, "ObjectTooLargeError", { enumerable: true, get: function () { return errors_js_1.ObjectTooLargeError; } });
Object.defineProperty(exports, "UnsupportedMediaTypeError", { enumerable: true, get: function () { return errors_js_1.UnsupportedMediaTypeError; } });
Object.defineProperty(exports, "QuotaExceededError", { enumerable: true, get: function () { return errors_js_1.QuotaExceededError; } });
Object.defineProperty(exports, "ProjectPausedError", { enumerable: true, get: function () { return errors_js_1.ProjectPausedError; } });
Object.defineProperty(exports, "LinkExpiredError", { enumerable: true, get: function () { return errors_js_1.LinkExpiredError; } });
Object.defineProperty(exports, "NotFoundError", { enumerable: true, get: function () { return errors_js_1.NotFoundError; } });
Object.defineProperty(exports, "BucketNotFoundError", { enumerable: true, get: function () { return errors_js_1.BucketNotFoundError; } });
Object.defineProperty(exports, "CredentialLimitError", { enumerable: true, get: function () { return errors_js_1.CredentialLimitError; } });
Object.defineProperty(exports, "RateLimitedError", { enumerable: true, get: function () { return errors_js_1.RateLimitedError; } });
Object.defineProperty(exports, "InvalidBodyError", { enumerable: true, get: function () { return errors_js_1.InvalidBodyError; } });
Object.defineProperty(exports, "InvalidExpiresInError", { enumerable: true, get: function () { return errors_js_1.InvalidExpiresInError; } });
Object.defineProperty(exports, "InvalidMethodError", { enumerable: true, get: function () { return errors_js_1.InvalidMethodError; } });
Object.defineProperty(exports, "UnauthorizedError", { enumerable: true, get: function () { return errors_js_1.UnauthorizedError; } });
Object.defineProperty(exports, "createErrorFromResponse", { enumerable: true, get: function () { return errors_js_1.createErrorFromResponse; } });
// Client
var client_js_1 = require("./client.js");
Object.defineProperty(exports, "MoogoClient", { enumerable: true, get: function () { return client_js_1.MoogoClient; } });
Object.defineProperty(exports, "createClientFromEnv", { enumerable: true, get: function () { return client_js_1.createClientFromEnv; } });
Object.defineProperty(exports, "createStorageClient", { enumerable: true, get: function () { return client_js_1.createStorageClient; } });
Object.defineProperty(exports, "createSQLClient", { enumerable: true, get: function () { return client_js_1.createSQLClient; } });
