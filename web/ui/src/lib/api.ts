// Client for the Moogo control-plane API.
//
// Every call is same-origin and relies on the session cookie, so credentials is
// always "same-origin" and there is no token to store in the browser.

export interface SessionInfo {
  authenticated: boolean;
  user_id?: string;
  email?: string;
  oauth_configured: boolean;
}

export interface SetupConfig {
  configured: boolean;
}

export interface Usage {
  project_count: number;
  max_projects: number;
  database_bytes: number;
  max_db_bytes: number;
}

export interface Account {
  id: string;
  email: string;
  name: string;
  avatar_url: string;
}

export interface Me {
  user: Account;
  max_projects: number;
  max_db_bytes: number;
  usage: Usage;

  // has_password is false for an account that only ever signed in through
  // Google: that credential lives at Google, so Moogo has no password to change
  // and must not offer to set one.
  has_password: boolean;

  // plan comes from the server rather than being assumed here, so a plan added
  // later shows up without a change to this file.
  plan: string;
}

// ChangePasswordRequest asks for the new password to replace the old one.
//
// current_password is not optional even though the session is already
// authenticated: the server re-checks it so that a stolen cookie cannot be used
// to take the account over permanently.
export interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
}

export type ProjectStatus = "pending" | "ready" | "failed" | "paused" | "deleting" | string;

export interface Project {
  id: string;
  name: string;
  status: ProjectStatus;
  status_detail?: string;
  secret_key_prefix: string;
  // secret_key is present only on the create and rotate responses.
  secret_key?: string;
  database_bytes: number;
  // Object storage held by this project. Both quotas are enforced per project,
  // so both figures are per project and are summed across projects only for an
  // account-wide total, never divided by the per-project limit.
  storage_bytes: number;
  created_at: string;
  updated_at: string;
}

// StorageCredential is one credential that authorizes object storage.
//
// The secret is deliberately absent: it exists only in the create and rotate
// responses, once, exactly like the project secret key.
export interface StorageCredential {
  id: string;
  access_key_id: string;
  secret_key_preview: string;
  label: string;
  created_at: string;
  rotated_at?: string;
  revoked_at?: string;
  active: boolean;
}

// StorageCredentialSecret is a credential plus its one-time secret and the
// environment variables a client needs to use it.
export interface StorageCredentialSecret extends StorageCredential {
  secret_access_key: string;
  env: {
    MOOGO_BUCKET_ENDPOINT: string;
    MOOGO_BUCKET_ACCESS_KEY_ID: string;
    MOOGO_BUCKET_SECRET_KEY: string;
  };
}

// RotateKeyResponse is the body returned by POST /api/projects/{id}/rotate-key.
// The plaintext key is shown only once right here.
export interface RotateKeyResponse {
  project_id: string;
  secret_key: string;
  secret_key_prefix: string;
}

export interface SQLRequest {
  query: string;
  args: any[];
}

export interface SQLResponse {
  success: boolean;
  columns?: string[];
  rows?: any[][];
  row_count?: number;
  truncated?: boolean;
  duration_ms?: number;
  rows_affected?: number;
  size_bytes?: number;
}

// Bucket is one object namespace. object_count and size_bytes are aggregates the
// server fills in for the bucket list, so the sidebar shows the same numbers the
// object table would add up.
export interface Bucket {
  id: string;
  name: string;
  object_count: number;
  size_bytes: number;
  created_at: string;
  // Whether objects uploaded here from now on are reachable without a
  // credential. It does not describe the objects already in the bucket: those
  // keep whichever answer they were given individually, and is_public on a
  // BucketObject is the truth for that object.
  is_public: boolean;
  // The bucket's upload policy, enforced by the server on every write rather
  // than only in the dashboard's file picker. More than one can be selected.
  allowed_types: BucketAllowedTypes[];
  // 0 means no per-object cap, which is not the same as a cap of zero bytes.
  max_object_size_bytes: number;
  // This bucket's own storage limit, independent of the project's total.
  quota_bytes: number;
}

// BucketAllowedTypes is the set of things a bucket accepts.
//
// "any" is the absence of a restriction and the server refuses it alongside a
// specific type, since asking to both allow and refuse the same upload has no
// answer. "file" is the class of everything the other categories do not claim --
// binaries and fonts -- so it is not a synonym for "any".
export type BucketAllowedTypes =
  | "any"
  | "image"
  | "video"
  | "audio"
  | "document"
  | "archive"
  | "file";

// BucketSettings is a partial update. Every field is optional: an omitted one
// keeps its current value, which is why max_object_size_bytes of 0 means "remove
// the cap" rather than "unset".
export interface BucketSettings {
  allowed_types?: BucketAllowedTypes[];
  max_object_size_bytes?: number;
  is_public?: boolean;
  quota_bytes?: number;
}

// BucketObject is one stored file.
//
// url and public_url come from the server already absolute, because the dashboard
// has no way to know the deployment's hostname and should not guess it from the
// browser's address bar. public_url is empty while the object is private.
export interface BucketObject {
  id: string;
  bucket_id: string;
  bucket: string;
  key: string;
  size_bytes: number;
  content_type: string;
  is_public: boolean;
  etag: string;
  url: string;
  /**
   * The same object over the dashboard's session route.
   *
   * `url` needs a storage credential, which a browser tab does not carry, so
   * putting it in an <img> renders a broken image for every private object. The
   * preview has to use this instead. It is relative on purpose: the origin is
   * whatever the browser is already using.
   */
  preview_url: string;
  public_url: string;
  created_at: string;
  updated_at: string;
  last_modified: string;
}

// ObjectPage is one page of a bucket listing. total is the count of everything
// matching the filter, not the length of objects, so the pager can show how many
// pages exist without a second request.
export interface ObjectPage {
  success: boolean;
  bucket: Bucket;
  objects: BucketObject[];
  total: number;
  limit: number;
  offset: number;
  storage_used_bytes: number;
  quota_bytes: number;
}

export interface BucketListResponse {
  success: boolean;
  buckets: Bucket[];
  storage_used_bytes: number;
  quota_bytes: number;
}

// ObjectQuery is the filter and paging for an object listing. Which fields are
// set decides the shape of the request URL, so it is built explicitly rather than
// by passing an options object straight through.
export interface ObjectQuery {
  bucket?: string;
  prefix?: string;
  search?: string;
  order?: "key" | "size" | "created" | "updated" | "contenttype";
  dir?: "asc" | "desc";
  limit?: number;
  offset?: number;
}

// uploadResponse is the body of a successful object upload.
export interface UploadResponse {
  success: boolean;
  object: BucketObject;
  storage_used_bytes: number;
  quota_bytes: number;
}

export interface ProjectList {
  projects: Project[];
  limit: number;
  offset: number;
}

// ApiError carries the code, status and optional detail so a caller can branch
// on them instead of parsing the message.
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly detail: string;

  constructor(message: string, status: number, code = "unknown", detail = "") {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.detail = detail;
  }
}

interface ErrorEnvelope {
  error?: { code?: string; message?: string; detail?: string };
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      credentials: "same-origin",
      ...init,
      headers: {
        Accept: "application/json",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...init.headers,
      },
    });
  } catch (cause) {
    // A rejected fetch means the request never reached the server: the
    // process is down, the port is wrong, or the browser blocked it. Reporting
    // this as its own error keeps a dead server from looking like bad
    // credentials. Status 0 is used because there is no HTTP response.
    throw new ApiError(
      "Cannot reach the server. Check that it is running, then try again.",
      0,
      "network_error",
      cause instanceof Error ? cause.message : "",
    );
  }

  if (!response.ok) {
    let code = "http_error";
    let message = `request failed with ${response.status}`;
    let detail = "";
    try {
      const body = (await response.json()) as ErrorEnvelope;
      code = body.error?.code ?? code;
      message = body.error?.message ?? message;
      detail = body.error?.detail ?? "";
    } catch {
      // A non-JSON error body is still an error; the status is enough.
    }
    throw new ApiError(message, response.status, code, detail);
  }

  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

export const api = {
  session: () => request<SessionInfo>("/auth/session"),
  oauthSetup: () => request<SetupConfig>("/auth/setup"),
  me: () => request<Me>("/api/me"),
  changePassword: (body: ChangePasswordRequest) =>
    request<{ success: boolean; message: string }>("/api/account/password", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateProfile: (body: { name: string }) =>
    request<{ success: boolean; message: string }>("/api/account/profile", {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  projects: () => request<ProjectList>("/api/projects"),
  createProject: (name: string) =>
    request<Project>("/api/projects", {
      method: "POST",
      body: JSON.stringify({ name }),
    }),
  rotateKey: (id: string) =>
    request<RotateKeyResponse>(`/api/projects/${id}/rotate-key`, { method: "POST" }),
  storageCredentials: (id: string) =>
    request<{ credentials: StorageCredential[]; limit: number }>(
      `/api/projects/${id}/storage-credentials`,
    ),
  createStorageCredential: (id: string, label: string) =>
    request<StorageCredentialSecret>(`/api/projects/${id}/storage-credentials`, {
      method: "POST",
      body: JSON.stringify({ label }),
    }),
  rotateStorageCredential: (id: string, credentialId: string) =>
    request<StorageCredentialSecret>(
      `/api/projects/${id}/storage-credentials/${credentialId}/rotate`,
      { method: "POST" },
    ),
  revokeStorageCredential: (id: string, credentialId: string) =>
    request<void>(`/api/projects/${id}/storage-credentials/${credentialId}`, {
      method: "DELETE",
    }),
  pauseProject: (id: string) =>
    request<void>(`/api/projects/${id}/pause`, { method: "POST" }),
  resumeProject: (id: string) =>
    request<Project>(`/api/projects/${id}/resume`, { method: "POST" }),
  deleteProject: (id: string) =>
    request<void>(`/api/projects/${id}`, { method: "DELETE" }),

  // databaseBackupUrl is a plain URL rather than a request() call, because the
  // response is a file, not JSON. It is handed to an anchor so the browser
  // handles the download and its progress UI itself.
  //
  // No project key: this is a dashboard action and the session cookie is the
  // credential, the same as every other call the console makes.
  databaseBackupUrl: (id: string) => `/api/projects/${id}/database-backup`,
  logout: () => request<void>("/auth/logout", { method: "POST" }),

  // Email/password credentials. These set or clear the session cookie on the
  // same origin, so the browser carries the session after a successful call.
  //
  // login is the one that sets a cookie. register does not: it answers 202 with
  // a message and the address the link went to, and the account stays locked
  // until the link is followed.
  login: (email: string, password: string) =>
    request<{ user: Account }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  forgotPassword: (email: string) =>
    request<{ message: string }>("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),
  resetPassword: (token: string, password: string) =>
    request<{ message: string }>("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, password }),
    }),

  // A registration returns 202 and no session: the account exists but cannot
  // sign in until the confirmation link is followed.
  register: (email: string, name: string, password: string) =>
    request<{ message: string; email: string }>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, name, password }),
    }),
  // The token is posted rather than fetched, so it never travels as a query
  // parameter and stays out of browser history and Referer headers.
  verifyEmail: (token: string) =>
    request<{ message: string }>("/auth/verify-email", {
      method: "POST",
      body: JSON.stringify({ token }),
    }),
  resendVerification: (email: string) =>
    request<{ message: string }>("/auth/resend-verification", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),

  // Dashboard SQL. These carry the session cookie instead of a project key, so
  // the console works for the project's owner without anyone pasting the
  // one-time secret. The server runs the same read/write and sanitizer rules as
  // the keyed endpoints an application uses.
  consoleQuery: (projectId: string, query: string, args: any[] = []) =>
    request<SQLResponse>(`/api/projects/${projectId}/query`, {
      method: "POST",
      body: JSON.stringify({ query, args }),
    }),
  consoleExec: (projectId: string, query: string, args: any[] = []) =>
    request<SQLResponse>(`/api/projects/${projectId}/exec`, {
      method: "POST",
      body: JSON.stringify({ query, args }),
    }),

  // Dashboard bucket operations. These hit the same handlers as the public
  // bucket API, mounted behind the session cookie and an ownership check, so
  // browsing storage from the dashboard needs no credential.
  dashboardBuckets: (projectId: string) =>
    request<BucketListResponse>(`/api/projects/${projectId}/buckets`),
  dashboardCreateBucket: (projectId: string, name: string, settings: BucketSettings = {}) =>
    request<{ bucket: Bucket }>(`/api/projects/${projectId}/buckets`, {
      method: "POST",
      body: JSON.stringify({ name, ...settings }),
    }),
  // dashboardUpdateBucketSettings saves the whole bucket settings form. Every
  // field is sent, because an omitted one keeps its stored value rather than
  // being cleared.
  dashboardUpdateBucketSettings: (projectId: string, bucketId: string, settings: BucketSettings) =>
    request<{ bucket: Bucket }>(`/api/projects/${projectId}/buckets/${bucketId}`, {
      method: "PATCH",
      body: JSON.stringify(settings),
    }),
  dashboardDeleteBucket: (projectId: string, bucketId: string) =>
    request<{ deleted_objects: number }>(
      `/api/projects/${projectId}/buckets/${bucketId}`,
      { method: "DELETE" },
    ),
  // dashboardSetBucketPublic flips the bucket default and republishes or
  // unpublishes the objects already inside it. dashboardSetObjectPublic is the
  // one-object version and leaves the bucket default alone.
  dashboardSetBucketPublic: (projectId: string, bucketId: string, isPublic: boolean) =>
    request<{ affected: number; bucket: Bucket }>(
      `/api/projects/${projectId}/buckets/${bucketId}/public`,
      { method: "POST", body: JSON.stringify({ is_public: isPublic }) },
    ),
  dashboardBucketList: (projectId: string, query: ObjectQuery = {}) =>
    request<ObjectPage>(`/api/projects/${projectId}/bucket${objectQueryString(query)}`),
  dashboardBucketUpload: (
    projectId: string,
    key: string,
    body: BodyInit,
    contentType: string,
    bucket?: string,
  ) =>
    request<UploadResponse>(
      `/api/projects/${projectId}/bucket/${encodeKey(key)}${objectQueryString({ bucket })}`,
      { method: "POST", headers: { "Content-Type": contentType }, body },
    ),
  dashboardBucketDelete: (projectId: string, key: string, prefix = false) =>
    request<{ deleted: number; freed_bytes: number }>(
      `/api/projects/${projectId}/bucket/${encodeKey(key)}${objectQueryString(
        prefix ? { prefix: "true" } : {},
      )}`,
      { method: "DELETE" },
    ),
  // setObjectPublic publishes or unpublishes one object.
  dashboardSetObjectPublic: (projectId: string, key: string, isPublic: boolean) =>
    request<{ object: BucketObject }>(
      `/api/projects/${projectId}/bucket/${encodeKey(key)}`,
      { method: "PATCH", body: JSON.stringify({ is_public: isPublic }) },
    ),
  // renameObject moves an object to a new key.
  dashboardRenameObject: (projectId: string, key: string, newKey: string) =>
    request<{ object: BucketObject }>(
      `/api/projects/${projectId}/bucket/${encodeKey(key)}`,
      { method: "PATCH", body: JSON.stringify({ new_key: newKey }) },
    ),
};

// encodeKey escapes an object key for use as a URL path.
//
// The whole key is escaped rather than its individual segments, because the
// server derives the key back from the path with the slashes left intact. A
// key's slashes are structural: "photos/2026/a.png" is one object stored in a
// folder, not three nested keys.
export function encodeKey(key: string): string {
  return key.split("/").map(encodeURIComponent).join("/");
}

// objectQueryString builds the query string for a listing, dropping empty values
// so the request reads the same whether or not a filter is active.
function objectQueryString(query: ObjectQuery): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") {
      continue;
    }
    params.set(key, String(value));
  }
  const encoded = params.toString();
  return encoded ? `?${encoded}` : "";
}

// isPreviewable reports whether an object is worth rendering inline in the
// dashboard.
//
// It mirrors the server's own notion of previewable content rather than
// duplicating the list here, because the server is what decides what is safe to
// render: an SVG is previewable as a file but not inside the app's own origin,
// since it can carry script.
export function isPreviewable(contentType: string): boolean {
  const media = contentType.split(";")[0].trim().toLowerCase();
  if (media.startsWith("image/") || media.startsWith("video/") || media.startsWith("audio/")) {
    return media !== "image/svg+xml";
  }
  return ["application/json", "text/plain", "text/markdown", "text/csv"].includes(media);
}

// fileIcon picks a short label for the object list, so a row reads as a file type
// without opening it.
export function fileBadge(object: Pick<BucketObject, "content_type" | "key">): string {
  const media = object.content_type.split(";")[0].trim().toLowerCase();
  if (media.startsWith("image/")) return "IMG";
  if (media.startsWith("video/")) return "VID";
  if (media.startsWith("audio/")) return "AUD";
  if (media === "application/pdf") return "PDF";
  if (media === "application/json") return "JSON";
  if (media === "text/csv") return "CSV";
  if (media === "text/markdown") return "MD";
  if (media.startsWith("text/")) return "TXT";

  const extension = object.key.split(".").pop();
  if (extension && extension !== object.key && extension.length <= 5) {
    return extension.toUpperCase();
  }
  return "BIN";
}

// formatBytes renders a byte count the way a person reads it, not the way a
// disk reports it.
export function formatBytes(bytes: number): string {
  if (!bytes) {
    return "0 B";
  }
  const megabytes = bytes / (1024 * 1024);
  if (megabytes >= 1) {
    return `${megabytes.toFixed(1)} MB`;
  }
  return `${Math.round(bytes / 1024)} KB`;
}

// isReadQuery decides which endpoint a statement belongs to, mirroring the
// server's routing so the console does not bounce between /query and /exec.
// The server still enforces the real rule; this only picks the right door.
const READ_KEYWORDS = new Set(["SELECT", "VALUES", "PRAGMA", "EXPLAIN"]);
const WRITE_KEYWORDS = new Set([
  "INSERT",
  "UPDATE",
  "DELETE",
  "REPLACE",
  "CREATE",
  "ALTER",
  "DROP",
  "TRUNCATE",
  "ATTACH",
  "DETACH",
  "VACUUM",
  "REINDEX",
  "ANALYZE",
  "BEGIN",
  "COMMIT",
  "ROLLBACK",
  "SAVEPOINT",
  "RELEASE",
  "GRANT",
  "REVOKE",
]);

function isWordChar(char: string): boolean {
  return (
    (char >= "a" && char <= "z") ||
    (char >= "A" && char <= "Z") ||
    (char >= "0" && char <= "9") ||
    char === "_" ||
    char === "$"
  );
}

// skipPreamble advances past whitespace and comments, returning the index of
// the first significant character.
function skipPreamble(sql: string, from: number): number {
  let index = from;
  while (index < sql.length) {
    const char = sql[index];
    if (/\s/.test(char)) {
      index++;
      continue;
    }
    if (sql.startsWith("--", index)) {
      const newline = sql.indexOf("\n", index);
      index = newline === -1 ? sql.length : newline + 1;
      continue;
    }
    if (sql.startsWith("/*", index)) {
      const end = sql.indexOf("*/", index + 2);
      index = end === -1 ? sql.length : end + 2;
      continue;
    }
    break;
  }
  return index;
}

// leadingWord returns the first bare word of a statement, uppercased.
function leadingWord(sql: string): string {
  const start = skipPreamble(sql, 0);
  let index = start;
  while (index < sql.length && isWordChar(sql[index])) {
    index++;
  }
  return sql.slice(start, index).toUpperCase();
}

// isReadAfterCTE finds the statement type behind a WITH clause, ignoring the
// bodies of the common table expressions that sit inside parentheses.
function isReadAfterCTE(sql: string): boolean {
  let index = skipPreamble(sql, 0);
  // Consume the WITH keyword itself.
  while (index < sql.length && isWordChar(sql[index])) {
    index++;
  }
  index = skipPreamble(sql, index);

  let depth = 0;
  while (index < sql.length) {
    const char = sql[index];
    if (char === "(") {
      depth++;
      index++;
      continue;
    }
    if (char === ")") {
      depth = Math.max(0, depth - 1);
      index++;
      continue;
    }
    if (char === ";" && depth === 0) {
      return false;
    }
    if (isWordChar(char)) {
      const start = index;
      while (index < sql.length && isWordChar(sql[index])) {
        index++;
      }
      if (depth === 0) {
        const keyword = sql.slice(start, index).toUpperCase();
        if (READ_KEYWORDS.has(keyword)) {
          return true;
        }
        if (WRITE_KEYWORDS.has(keyword)) {
          return false;
        }
      }
      continue;
    }
    index++;
  }
  return false;
}

export function isReadQuery(query: string): boolean {
  const keyword = leadingWord(query);
  if (READ_KEYWORDS.has(keyword)) {
    return true;
  }
  if (keyword === "WITH") {
    return isReadAfterCTE(query);
  }
  return false;
}
