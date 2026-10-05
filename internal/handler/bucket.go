// Package handler implements the HTTP endpoints.
package handler

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"path"
	"slices"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"

	"github.com/moogo/moogo/internal/auth"
	"github.com/moogo/moogo/internal/dbcontrol"
	"github.com/moogo/moogo/internal/dbplane"
	"github.com/moogo/moogo/pkg/httpx"
	"github.com/moogo/moogo/pkg/logger"
)

// BucketStore is the control plane operations for buckets.
type BucketStore interface {
	CreateBucket(ctx context.Context, projectID uuid.UUID, name string) (*dbcontrol.Bucket, error)
	ListBuckets(ctx context.Context, projectID uuid.UUID) ([]dbcontrol.Bucket, error)
	ListBucketsWithStats(ctx context.Context, projectID uuid.UUID) ([]dbcontrol.Bucket, error)
	BucketByName(ctx context.Context, projectID uuid.UUID, name string) (*dbcontrol.Bucket, error)
	UpdateBucketSettings(
		ctx context.Context,
		projectID uuid.UUID,
		bucketID uuid.UUID,
		allowedTypes []string,
		maxObjectSize int64,
		isPublic bool,
		quotaBytes int64,
	) (*dbcontrol.Bucket, error)
	DeleteBucket(ctx context.Context, projectID uuid.UUID, bucketID uuid.UUID) error
	DeleteBucketKeys(ctx context.Context, bucketID uuid.UUID) ([]string, error)
	SetBucketPublic(
		ctx context.Context,
		projectID uuid.UUID,
		bucketID uuid.UUID,
		isPublic bool,
	) (*dbcontrol.Bucket, int64, error)
	PutObject(
		ctx context.Context,
		projectID uuid.UUID,
		bucketID uuid.UUID,
		key string,
		sizeBytes int64,
		contentType string,
		isPublic bool,
	) (*dbcontrol.BucketObject, int64, error)
	ObjectByKey(ctx context.Context, projectID uuid.UUID, key string) (*dbcontrol.BucketObject, error)
	SetObjectPublic(ctx context.Context, projectID uuid.UUID, key string, isPublic bool) (*dbcontrol.BucketObject, error)
	RenameObject(ctx context.Context, projectID uuid.UUID, fromKey string, toKey string) (*dbcontrol.BucketObject, error)
	ListObjects(ctx context.Context, query dbcontrol.ObjectQuery) ([]dbcontrol.BucketObject, int64, error)
	DeleteObject(ctx context.Context, projectID uuid.UUID, key string) (int64, error)
	DeletePrefix(ctx context.Context, projectID uuid.UUID, prefix string) ([]string, int64, error)
	StorageUsedBytes(ctx context.Context, projectID uuid.UUID) (int64, error)
	BucketStorageUsedBytes(ctx context.Context, projectID uuid.UUID, bucketID uuid.UUID) (int64, error)
}

// FileSystem is the disk operations for bucket storage.
type FileSystem interface {
	WriteObject(projectID uuid.UUID, key string, r io.Reader) (int64, error)
	ReadObject(projectID uuid.UUID, key string) (io.ReadCloser, int64, error)
	MoveObject(projectID uuid.UUID, fromKey string, toKey string) error
	DeleteObject(projectID uuid.UUID, key string) error
	StorageUsed(projectID uuid.UUID) (int64, error)
}

// BucketPlane serves the bucket API.
type BucketPlane struct {
	store     BucketStore
	fs        FileSystem
	quota     int64
	maxKeyLen int
	log       *logger.Logger

	// publicBase is the origin used to build absolute object URLs.
	//
	// It comes from configuration rather than from the request, because a URL
	// that a user pastes into their own site outlives the request that produced
	// it. Deriving it from X-Forwarded-Host would let any caller mint an object
	// URL pointing at a host they control, which turns the copy button into a
	// phishing tool against the user's own site.
	//
	// Empty falls back to the request, which is what a test and a single-host
	// development deployment want.
	publicBase string

	// uploadLocks serializes the quota-check-then-write sequence per project.
	//
	// Reading the usage total and writing the object cannot be one atomic
	// operation across Postgres and the filesystem, so without a lock two
	// concurrent uploads both see room for 100 MB and together land 180 MB in a
	// 256 MB bucket. The lock is per project rather than global so a slow upload
	// on one project does not stall uploads on every other project.
	uploadLocks sync.Map // map[uuid.UUID]*sync.Mutex
}

// defaultObjectPageSize is how many objects a listing returns when the caller
// does not ask for a size. It matches the dashboard's page size so the first
// page is the one the UI shows without a second request.
const defaultObjectPageSize = 100

// defaultBucketName is where an upload lands when the request names no bucket.
//
// Keeping uploads working without naming a bucket is deliberate: the original
// API had no concept of buckets at all, and a client that predates them must
// keep working rather than having every upload start failing.
const defaultBucketName = "default"

// NewBucketPlane creates a BucketPlane handler.
//
// publicBase is the origin object URLs are built from, normally the configured
// public URL. It is empty in tests, where the request host is the right answer.
func NewBucketPlane(
	store BucketStore,
	fs FileSystem,
	quota int64,
	publicBase string,
	log *logger.Logger,
) *BucketPlane {
	return &BucketPlane{
		store:      store,
		fs:         fs,
		quota:      quota,
		maxKeyLen:  1024,
		publicBase: strings.TrimRight(publicBase, "/"),
		log:        log,
	}
}

// uploadLock returns the mutex guarding uploads for one project, along with a
// release function that drops the entry once the caller is finished with it.
//
// The release is not optional. A plain LoadOrStore with no delete left one
// entry in the map for every project that ever uploaded an object, and nothing
// ever removed them: the map grew for the lifetime of the process. On a
// deployment that has seen a lot of projects that is a slow leak of a map entry
// and a mutex each, held forever for projects that no longer exist.
func (handler *BucketPlane) uploadLock(projectID uuid.UUID) (*sync.Mutex, func()) {
	value, _ := handler.uploadLocks.LoadOrStore(projectID, &sync.Mutex{})
	lock := value.(*sync.Mutex)

	var released sync.Once
	release := func() {
		released.Do(func() {
			// Delete only if this exact mutex is still the one in the map. If a
			// later caller replaced it, deleting would remove a lock some
			// in-flight upload is holding, and the next upload would get a
			// third mutex and stop being serialized against the second.
			handler.uploadLocks.CompareAndDelete(projectID, value)
		})
	}
	return lock, release
}

// ObjectResponse is the wire shape of one object.
//
// It is shared by every endpoint that mentions an object, so the dashboard and
// a direct API client see identical fields. url is absolute so the dashboard does
// not have to know the deployment's public hostname to offer a copy button.
type ObjectResponse struct {
	ID          uuid.UUID `json:"id"`
	BucketID    uuid.UUID `json:"bucket_id"`
	Bucket      string    `json:"bucket"`
	Key         string    `json:"key"`
	SizeBytes   int64     `json:"size_bytes"`
	ContentType string    `json:"content_type"`
	IsPublic    bool      `json:"is_public"`
	ETag        string    `json:"etag"`
	// URL is the authenticated download route. It takes a credential, so it is
	// what an API client uses and what the dashboard must NOT put in an <img>.
	URL string `json:"url"`
	// PreviewURL is the same object over the dashboard's own session route.
	//
	// It is a separate field because the two differ in exactly one way, and that
	// difference is invisible in a URL: /p/{id}/bucket/... wants a storage
	// credential, which a browser tab does not carry, while /api/projects/{id}
	// /bucket/... wants the session cookie it already has. Pointing an <img> at
	// URL therefore renders a broken image for every private object, which is why
	// the preview needs its own field rather than a smarter frontend.
	PreviewURL string `json:"preview_url"`
	// PublicURL is set only for published objects; it is empty otherwise rather
	// than pointing at a route that would 404.
	PublicURL    string    `json:"public_url"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
	LastModified time.Time `json:"last_modified"`
}

// Upload handles POST /bucket/{project_id}/* and the dashboard's equivalent.
//
// The key is the path after the project id. Keys are normalized and validated to
// prevent traversal. The body is streamed to disk and metadata is recorded in
// Postgres.
//
// The quota is checked against the declared Content-Length before a byte is
// written, and again against the bytes actually received, so an oversized upload
// is refused immediately when the size is known and still refused when it is not.
func (handler *BucketPlane) Upload(w http.ResponseWriter, r *http.Request) {
	projectID, ok := auth.ProjectIDFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthorized", "authentication required")
		return
	}

	// The key comes from the route wildcard rather than the raw path, so this
	// handler works under any mount point (the public /bucket/{id}/... and the
	// dashboard /api/projects/{id}/bucket/... share it).
	rawKey, found := auth.ObjectKeyFromContext(r.Context())
	if !found {
		httpx.WriteError(w, http.StatusBadRequest, "missing_key", "object key is required")
		return
	}

	key, err := normalizeKey(rawKey)
	if err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid_key", err.Error())
		return
	}
	if len(key) > handler.maxKeyLen {
		httpx.WriteError(w, http.StatusBadRequest, "key_too_long", "object key exceeds maximum length")
		return
	}

	bucket, err := handler.resolveBucket(r.Context(), projectID, r.URL.Query().Get("bucket"))
	if err != nil {
		handler.writeStoreError(w, r, projectID, err, "resolve bucket")
		return
	}

	contentType := r.Header.Get("Content-Type")
	if contentType == "" {
		contentType = "application/octet-stream"
	}

	// The bucket's own rules are checked before anything else, so a refused
	// upload costs one lookup and no disk write.
	if !bucketAcceptsContentType(bucket, contentType) {
		httpx.WriteError(w, http.StatusUnsupportedMediaType, "type_not_allowed",
			fmt.Sprintf("bucket %q accepts %s uploads only", bucket.Name, describeAllowedTypes(bucket)))
		return
	}

	// Serialize against other uploads to the same project so the usage total read
	// below and the write that follows it cannot be interleaved.
	//
	// The lock is dropped again on the way out. Holding it for the whole upload
	// is what makes the quota check correct; holding it for the lifetime of the
	// process is what made the map a leak.
	lock, release := handler.uploadLock(projectID)
	lock.Lock()
	defer func() {
		lock.Unlock()
		release()
	}()

	used, err := handler.store.StorageUsedBytes(r.Context(), projectID)
	if err != nil {
		handler.writeStoreError(w, r, projectID, err, "quota check")
		return
	}

	remaining := handler.quota - used

	// The bucket's own quota is a second ceiling on the same bytes. It is read
	// here rather than derived from the project's number because they are
	// independent: two buckets at half their quotas can fill a project, and a
	// single bucket can be refused while the project still has room.
	bucketUsed, err := handler.store.BucketStorageUsedBytes(r.Context(), projectID, bucket.ID)
	if err != nil {
		handler.writeStoreError(w, r, projectID, err, "bucket quota check")
		return
	}
	bucketRemaining := bucket.QuotaBytes - bucketUsed

	// An overwrite frees the bytes it replaces, so they count as available room.
	//
	// Without this, a project at 90% of its quota could never replace a file: the
	// old version still counted against the total, so any replacement looked
	// oversized even when it was smaller. A storage bucket that cannot be
	// trimmed is worse than one with no quota at all, since there is no way back
	// once the total crosses the line.
	//
	// Only a replacement can add room, so this is one extra indexed lookup on the
	// upload path, and a miss simply leaves the budget alone.
	var replacedSize int64
	replacingInThisBucket := false
	if existing, err := handler.store.ObjectByKey(r.Context(), projectID, key); err == nil {
		replacedSize = existing.SizeBytes
		replacingInThisBucket = existing.BucketID == bucket.ID
	} else if !errors.Is(err, dbcontrol.ErrNotFound) {
		handler.writeStoreError(w, r, projectID, err, "load existing object")
		return
	}
	remaining += replacedSize

	// The same credit for the bucket, and only for the bucket that actually holds
	// the object being replaced. A key is unique per project rather than per
	// bucket, so a replacement can arrive through a different bucket than the one
	// it replaces; crediting this bucket regardless would let the same bytes be
	// reclaimed in two places and both quotas would drift above their real usage.
	if replacingInThisBucket {
		bucketRemaining += replacedSize
	}

	if remaining < 0 {
		remaining = 0
	}
	if bucketRemaining < 0 {
		bucketRemaining = 0
	}

	// The bucket's per-object cap is a separate ceiling from the project quota.
	// All three apply: a bucket can be stricter than the project (an image bucket
	// capped at 5 MB inside a 256 MB project) and the project can be stricter
	// than the bucket (a 200 MB file into the last 10 MB of a project).
	//
	// Whichever is smallest is the budget the body is measured against, so the
	// streaming guard below enforces every limit with one number rather than
	// checking each separately and risking a case where none applies.
	limit := min(remaining, bucketRemaining)
	objectCap := bucket.MaxObjectSizeBytes

	if r.ContentLength > limit {
		if bucketRemaining < remaining {
			handler.writeBucketQuotaExceeded(w, bucketUsed, bucket)
			return
		}
		handler.writeQuotaExceeded(w, used)
		return
	}
	if objectCap > 0 {
		if r.ContentLength > objectCap {
			handler.writeObjectTooLarge(w, objectCap)
			return
		}
		limit = min(limit, objectCap)
	}

	// Read one byte past the budget. If the body really fits, the copy stops at
	// the limit and the extra byte is never read; if it does not, the returned
	// size exceeds the limit and the upload is rejected with the file removed.
	// This is what bounds disk usage when Content-Length is absent or lies.
	size, err := handler.fs.WriteObject(projectID, key, io.LimitReader(r.Body, limit+1))
	if err != nil {
		handler.writeError(w, r, projectID, err, "write object")
		return
	}

	// The three failures are reported separately, because the fixes are different:
	// one means the project is full, one means this bucket is full, the other means
	// this bucket wants smaller files. Collapsing them into one "too large" message
	// leaves a user who set a 5 MB cap with a 256 MB project looking for space that
	// does not exist.
	if objectCap > 0 && size > objectCap {
		_ = handler.fs.DeleteObject(projectID, key)
		handler.writeObjectTooLarge(w, objectCap)
		return
	}
	if size > bucketRemaining {
		_ = handler.fs.DeleteObject(projectID, key)
		handler.writeBucketQuotaExceeded(w, bucketUsed, bucket)
		return
	}
	if size > remaining {
		_ = handler.fs.DeleteObject(projectID, key)
		handler.writeQuotaExceeded(w, used)
		return
	}

	object, prevSize, err := handler.store.PutObject(
		r.Context(), projectID, bucket.ID, key, size, contentType, bucket.IsPublic,
	)
	if err != nil {
		_ = handler.fs.DeleteObject(projectID, key)
		handler.writeStoreError(w, r, projectID, err, "record object metadata")
		return
	}

	// Quota accounting: if this was an overwrite, subtract the previous size.
	if prevSize > 0 {
		used = used - prevSize + size
	} else {
		used += size
	}

	response := handler.objectResponse(r, projectID, bucket.Name, object)

	httpx.WriteJSON(w, http.StatusCreated, map[string]any{
		"success":            true,
		"object":             response,
		"storage_used_bytes": used,
		"quota_bytes":        handler.quota,
	})
}

// Download handles GET /bucket/{project_id}/*.
//
// The route is behind a credential, so it serves private objects as well as
// public ones. Response validators are set so a client that already holds the
// bytes can revalidate instead of downloading them again.
func (handler *BucketPlane) Download(w http.ResponseWriter, r *http.Request) {
	handler.serveObject(w, r, false)
}

// PublicDownload handles GET /pub/{project_id}/*.
//
// This route has no credential middleware in front of it, so it serves only
// objects the owner published. An unpublished object answers 404 rather than
// 403: from outside, the difference between "private" and "does not exist" is
// not information anyone should get.
func (handler *BucketPlane) PublicDownload(w http.ResponseWriter, r *http.Request) {
	handler.serveObject(w, r, true)
}

// serveObject is the shared body of the authenticated and public downloads.
func (handler *BucketPlane) serveObject(w http.ResponseWriter, r *http.Request, requirePublic bool) {
	projectID, ok := auth.ProjectIDFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthorized", "authentication required")
		return
	}

	rawKey, found := auth.ObjectKeyFromContext(r.Context())
	if !found {
		httpx.WriteError(w, http.StatusNotFound, "not_found", "object not found")
		return
	}

	key, err := normalizeKey(rawKey)
	if err != nil {
		httpx.WriteError(w, http.StatusNotFound, "not_found", "object not found")
		return
	}

	object, err := handler.store.ObjectByKey(r.Context(), projectID, key)
	if err != nil {
		if errors.Is(err, dbcontrol.ErrNotFound) {
			httpx.WriteError(w, http.StatusNotFound, "not_found", "object not found")
			return
		}
		handler.writeStoreError(w, r, projectID, err, "load object metadata")
		return
	}

	// On the public route this is the authorization check. It runs after the load
	// rather than inside the query because ObjectByKey is shared with the
	// authenticated route, and hiding the distinction between missing and private
	// matters more here than saving one indexed lookup.
	if requirePublic && !object.IsPublic {
		httpx.WriteError(w, http.StatusNotFound, "not_found", "object not found")
		return
	}

	// Revalidation first: a client that already has this exact version is
	// answered 304 without touching the disk at all.
	etag := object.ETag()
	if etagMatches(r.Header.Get("If-None-Match"), etag) {
		writeNotModified(w, etag, object.UpdatedAt)
		return
	}
	if r.Header.Get("If-None-Match") == "" && notModifiedSince(
		r.Header.Get("If-Modified-Since"), object.UpdatedAt,
	) {
		writeNotModified(w, etag, object.UpdatedAt)
		return
	}

	reader, size, err := handler.fs.ReadObject(projectID, key)
	if err != nil {
		// A catalog row whose file is gone answers 404 like any other missing
		// object. The two stores can disagree after a failed write, and reporting
		// that as a server error would send the dashboard looking for a bug.
		if errors.Is(err, dbplane.ErrNotFound) {
			httpx.WriteError(w, http.StatusNotFound, "not_found", "object not found")
			return
		}
		handler.writeError(w, r, projectID, err, "read object from disk")
		return
	}
	defer reader.Close()

	handler.writeObjectHeaders(w, object, size, requirePublic)

	// HEAD carries the headers and no body. It is how a client checks a size or
	// an ETag without transferring the file.
	if r.Method == http.MethodHead {
		return
	}

	// A write error here means the client hung up mid-transfer. There is nothing
	// useful to say to them and nothing to clean up on our side, so it is not
	// turned into an error response that would itself fail.
	_, _ = io.Copy(w, reader)
}

// writeObjectHeaders sets the response headers for an object payload.
//
// The security headers here are the reason a published object is not a stored
// cross-site scripting vector. An SVG or HTML file served from the same origin as
// the dashboard can run script against the session cookie unless something stops
// it, and the sandbox directive below does: it makes the browser treat the
// response as an opaque origin with no script access and no cookie access.
func (handler *BucketPlane) writeObjectHeaders(
	w http.ResponseWriter,
	object *dbcontrol.BucketObject,
	size int64,
	public bool,
) {
	header := w.Header()

	contentType := object.ContentType
	if contentType == "" {
		contentType = "application/octet-stream"
	}

	disposition := "inline"
	if isActiveContent(contentType) {
		// HTML, SVG and friends are downloadable rather than rendered. Rendering
		// them would work, but the point of publishing an image is not to give
		// away an origin that shares cookies with the dashboard.
		disposition = "attachment"
	}

	header.Set("Content-Type", contentType)
	header.Set("Content-Length", strconv.FormatInt(size, 10))
	header.Set("Content-Disposition", fmt.Sprintf(`%s; filename*=UTF-8''%s`,
		disposition, urlEncodeFilename(object.Key)))
	header.Set("ETag", object.ETag())
	header.Set("Last-Modified", object.UpdatedAt.UTC().Format(http.TimeFormat))
	header.Set("Accept-Ranges", "bytes")

	// The sandbox directive is the same-origin containment for anything the
	// browser will parse as a document. It is applied to every object rather than
	// only to the active types, because the set of types a browser will parse is
	// larger and version-dependent than any list worth maintaining here.
	header.Set("Content-Security-Policy", "sandbox; default-src 'none'")

	// A public object is cacheable by the browser and by any CDN in front of the
	// service. A private one must not be: the response was authorized for one
	// caller, and storing it would let the next one read it.
	//
	// The public one is not marked immutable even though keys are stable, because
	// a key can be overwritten in place and an immutable entry would then be
	// wrong for a year. The ETag is what makes revalidation cheap instead.
	if public {
		header.Set("Cache-Control", "public, max-age=300, must-revalidate")
	} else {
		// Stored but always revalidated. no-store would make the dashboard
		// re-download a preview image every time the object table is redrawn,
		// while a plain max-age would let a browser keep serving a copy after the
		// owner replaced the file. must-revalidate plus the ETag avoids both.
		header.Set("Cache-Control", "private, no-cache")
	}
}

// UpdateRequest is the body of PATCH /bucket/{project_id}/*.
//
// Both fields are optional but at least one must be present, which is why they
// are pointers: a plain bool cannot tell "set it to false" from "not mentioned".
type UpdateRequest struct {
	IsPublic *bool  `json:"is_public"`
	NewKey   string `json:"new_key"`
}

// Update handles PATCH /bucket/{project_id}/* and the dashboard's equivalent.
//
// Rename and visibility share one route because they share one resource and both
// are rare enough that separate routes would only add surface. A body carrying
// both is applied as a rename that keeps the current visibility, since renaming
// has no reason to change it.
//
// Visibility is per object, matching how R2 works: publishing one image does not
// require publishing everything beside it.
func (handler *BucketPlane) Update(w http.ResponseWriter, r *http.Request) {
	projectID, ok := auth.ProjectIDFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthorized", "authentication required")
		return
	}

	key, valid := handler.keyFromRequest(w, r)
	if !valid {
		return
	}

	var request UpdateRequest
	if !httpx.ReadJSON(w, r, &request) {
		return
	}
	if request.IsPublic == nil && request.NewKey == "" {
		httpx.WriteError(w, http.StatusBadRequest, "invalid_body",
			"the body must set is_public or new_key")
		return
	}

	if request.NewKey != "" {
		handler.rename(w, r, projectID, key, request.NewKey)
		return
	}

	handler.setVisibility(w, r, projectID, key, *request.IsPublic)
}

// setVisibility publishes or unpublishes one object.
func (handler *BucketPlane) setVisibility(
	w http.ResponseWriter,
	r *http.Request,
	projectID uuid.UUID,
	key string,
	isPublic bool,
) {
	object, err := handler.store.SetObjectPublic(r.Context(), projectID, key, isPublic)
	if err != nil {
		handler.writeStoreError(w, r, projectID, err, "set object visibility")
		return
	}

	httpx.WriteJSON(w, http.StatusOK, map[string]any{
		"success": true,
		"object": handler.objectResponse(
			r,
			projectID,
			handler.bucketNameFor(r.Context(), projectID, object.BucketID),
			object,
		),
	})
}

// rename moves an object to a new key, keeping its visibility.
//
// The file moves on disk first. If that fails the catalog still points at the old
// key, which downloads correctly; doing it the other way round would leave
// metadata claiming a file that is not there.
func (handler *BucketPlane) rename(
	w http.ResponseWriter,
	r *http.Request,
	projectID uuid.UUID,
	fromKey string,
	rawToKey string,
) {
	toKey, err := normalizeKey(rawToKey)
	if err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid_key", err.Error())
		return
	}
	if len(toKey) > handler.maxKeyLen {
		httpx.WriteError(w, http.StatusBadRequest, "key_too_long", "object key exceeds maximum length")
		return
	}
	if toKey == fromKey {
		httpx.WriteError(w, http.StatusBadRequest, "invalid_key", "the new key is the same as the old one")
		return
	}

	if err := handler.fs.MoveObject(projectID, fromKey, toKey); err != nil {
		handler.writeError(w, r, projectID, err, "move object on disk")
		return
	}

	object, err := handler.store.RenameObject(r.Context(), projectID, fromKey, toKey)
	if err != nil {
		// Put the file back. Leaving it under the new name with no metadata row
		// would make it invisible to listings while still consuming quota on disk.
		if rollbackErr := handler.fs.MoveObject(projectID, toKey, fromKey); rollbackErr != nil {
			handler.log.Error("rename rollback failed, file orphaned under the new key", logger.Fields{
				"project_id": projectID.String(),
				"from_key":   fromKey,
				"to_key":     toKey,
				"error":      rollbackErr.Error(),
			})
		}
		handler.writeStoreError(w, r, projectID, err, "rename object metadata")
		return
	}

	httpx.WriteJSON(w, http.StatusOK, map[string]any{
		"success": true,
		"object": handler.objectResponse(
			r,
			projectID,
			handler.bucketNameFor(r.Context(), projectID, object.BucketID),
			object,
		),
	})
}

// Delete handles DELETE /bucket/{project_id}/*.
func (handler *BucketPlane) Delete(w http.ResponseWriter, r *http.Request) {
	projectID, ok := auth.ProjectIDFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthorized", "authentication required")
		return
	}

	// A prefix is an explicit opt-in to deleting everything beneath it, so it has
	// to be asked for by name. A bare delete of "photos" removes one object and
	// leaves the directory alone, which is the safer default for a request that
	// carries only a key.
	if r.URL.Query().Get("prefix") == "true" {
		handler.deletePrefix(w, r, projectID)
		return
	}

	key, valid := handler.keyFromRequest(w, r)
	if !valid {
		return
	}

	// Remove from disk first (idempotent).
	if err := handler.fs.DeleteObject(projectID, key); err != nil {
		handler.writeError(w, r, projectID, err, "delete object from disk")
		return
	}

	// Remove metadata.
	freed, err := handler.store.DeleteObject(r.Context(), projectID, key)
	if err != nil {
		if errors.Is(err, dbcontrol.ErrNotFound) {
			httpx.WriteError(w, http.StatusNotFound, "not_found", "object not found")
			return
		}
		handler.writeStoreError(w, r, projectID, err, "delete object metadata")
		return
	}

	used, _ := handler.store.StorageUsedBytes(r.Context(), projectID)

	httpx.WriteJSON(w, http.StatusOK, map[string]any{
		"success":            true,
		"deleted":            1,
		"freed_bytes":        freed,
		"storage_used_bytes": used,
		"quota_bytes":        handler.quota,
	})
}

// deletePrefix removes every object under a key prefix, used by the object
// browser's "delete folder" action.
func (handler *BucketPlane) deletePrefix(
	w http.ResponseWriter,
	r *http.Request,
	projectID uuid.UUID,
) {
	rawPrefix, found := auth.ObjectKeyFromContext(r.Context())
	if !found {
		httpx.WriteError(w, http.StatusBadRequest, "missing_key", "object key is required")
		return
	}

	prefix, err := normalizePrefix(rawPrefix)
	if err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid_prefix", err.Error())
		return
	}

	// The catalog rows go first, in one statement. Collecting the keys from the
	// same statement means the set unlinked from disk is exactly the set that
	// was in the catalog, so nothing can be left behind by a race.
	keys, freed, err := handler.store.DeletePrefix(r.Context(), projectID, prefix)
	if err != nil {
		handler.writeStoreError(w, r, projectID, err, "delete object metadata")
		return
	}

	for _, key := range keys {
		if err := handler.fs.DeleteObject(projectID, key); err != nil {
			// The metadata is already gone, so the file is now orphaned. Logged
			// loudly because it consumes quota that nothing will ever reclaim.
			handler.log.Error("orphaned file after prefix delete", logger.Fields{
				"project_id": projectID.String(),
				"key":        key,
				"error":      err.Error(),
			})
		}
	}

	used, _ := handler.store.StorageUsedBytes(r.Context(), projectID)

	httpx.WriteJSON(w, http.StatusOK, map[string]any{
		"success":            true,
		"deleted":            len(keys),
		"freed_bytes":        freed,
		"storage_used_bytes": used,
		"quota_bytes":        handler.quota,
	})
}

// List handles GET /bucket/{project_id} and the dashboard's equivalent.
//
// It returns one page of objects from one bucket. Listing every bucket at once,
// as this used to, meant a project with a large default bucket made every other
// bucket impossible to look at.
func (handler *BucketPlane) List(w http.ResponseWriter, r *http.Request) {
	projectID, ok := auth.ProjectIDFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthorized", "authentication required")
		return
	}

	query := r.URL.Query()
	limit := parseIntParam(query.Get("limit"), defaultObjectPageSize)
	offset := parseIntParam(query.Get("offset"), 0)

	bucket, err := handler.resolveBucket(r.Context(), projectID, query.Get("bucket"))
	if err != nil {
		handler.writeStoreError(w, r, projectID, err, "resolve bucket")
		return
	}

	objects, total, err := handler.store.ListObjects(r.Context(), dbcontrol.ObjectQuery{
		BucketID: bucket.ID,
		Prefix:   query.Get("prefix"),
		Search:   query.Get("search"),
		OrderBy:  query.Get("order"),
		OrderDir: query.Get("dir"),
		Limit:    limit,
		Offset:   offset,
	})
	if err != nil {
		handler.writeStoreError(w, r, projectID, err, "list objects")
		return
	}

	responses := make([]ObjectResponse, 0, len(objects))
	for i := range objects {
		responses = append(responses, handler.objectResponse(r, projectID, bucket.Name, &objects[i]))
	}

	used, _ := handler.store.StorageUsedBytes(r.Context(), projectID)

	httpx.WriteJSON(w, http.StatusOK, map[string]any{
		"success":            true,
		"bucket":             handler.bucketResponse(bucket),
		"objects":            responses,
		"total":              total,
		"limit":              limit,
		"offset":             offset,
		"storage_used_bytes": used,
		"quota_bytes":        handler.quota,
	})
}

// ListBuckets handles GET /buckets/{project_id}.
//
// The catalog is a separate route from the object routes rather than a magic
// key under the bucket prefix, so a bucket can never be named in a way that
// collides with an object key.
func (handler *BucketPlane) ListBuckets(w http.ResponseWriter, r *http.Request) {
	projectID, ok := auth.ProjectIDFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthorized", "authentication required")
		return
	}

	buckets, err := handler.store.ListBucketsWithStats(r.Context(), projectID)
	if err != nil {
		handler.writeStoreError(w, r, projectID, err, "list buckets")
		return
	}

	responses := make([]BucketCatalogResponse, 0, len(buckets))
	for _, bucket := range buckets {
		responses = append(responses, handler.bucketResponse(&bucket))
	}

	used, _ := handler.store.StorageUsedBytes(r.Context(), projectID)

	httpx.WriteJSON(w, http.StatusOK, map[string]any{
		"success":            true,
		"buckets":            responses,
		"storage_used_bytes": used,
		"quota_bytes":        handler.quota,
	})
}

// CreateBucket handles POST /buckets/{project_id}.
func (handler *BucketPlane) CreateBucket(w http.ResponseWriter, r *http.Request) {
	projectID, ok := auth.ProjectIDFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthorized", "authentication required")
		return
	}

	var request BucketCreateRequest
	if !httpx.ReadJSON(w, r, &request) {
		return
	}

	name, err := normalizeBucketName(request.Name)
	if err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid_bucket_name", err.Error())
		return
	}

	allowedTypes, err := normalizeAllowedTypes(
		defaultAllowedTypes(request.AllowedTypes))
	if err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid_allowed_types", err.Error())
		return
	}
	if err := validateMaxObjectSize(request.MaxObjectSizeBytes); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid_max_object_size", err.Error())
		return
	}
	// Zero means the caller did not ask for a quota on create, so the row keeps
	// the default. Validating it here would refuse every create that omits it.
	if request.QuotaBytes != 0 {
		if err := validateBucketQuota(request.QuotaBytes, handler.quota); err != nil {
			httpx.WriteError(w, http.StatusBadRequest, "invalid_quota_bytes", err.Error())
			return
		}
	}

	bucket, err := handler.store.CreateBucket(r.Context(), projectID, name)
	if err != nil {
		handler.writeStoreError(w, r, projectID, err, "create bucket")
		return
	}

	// The bucket exists either way, so an unusable setting is reported as a
	// validation failure on the setting itself rather than as a failed create: the
	// user gets the same 400 they would have got from the request validation, and
	// the bucket name is not left looking taken.
	//
	// A zero quota means the caller did not ask for one, so the row keeps the
	// default it was created with.
	if request.AllowedTypes != nil || request.MaxObjectSizeBytes != 0 {
		quotaBytes := bucket.QuotaBytes
		if request.QuotaBytes != 0 {
			quotaBytes = request.QuotaBytes
		}
		bucket, err = handler.store.UpdateBucketSettings(
			r.Context(), projectID, bucket.ID, allowedTypes,
			request.MaxObjectSizeBytes, bucket.IsPublic, quotaBytes)
		if err != nil {
			handler.writeStoreError(w, r, projectID, err, "set bucket settings")
			return
		}
	}

	httpx.WriteJSON(w, http.StatusCreated, map[string]any{
		"success": true,
		"bucket":  handler.bucketResponse(bucket),
	})
}

// defaultAllowedTypes fills in the policy for a create request that did not name
// one, so an omitted field means "everything" rather than "nothing is allowed".
func defaultAllowedTypes(raw []string) []string {
	if len(raw) == 0 {
		return []string{dbcontrol.AllowedAny}
	}
	return raw
}

// UpdateBucketSettings handles PATCH /buckets/{project_id}/{bucket_id}.
//
// The current values are read first because every field is optional in the
// request: a caller changing only the visibility should not have to know, or
// guess, the bucket's policy and quota to resend them.
func (handler *BucketPlane) UpdateBucketSettings(w http.ResponseWriter, r *http.Request) {
	projectID, ok := auth.ProjectIDFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthorized", "authentication required")
		return
	}

	bucketID, err := uuidParam(r, "bucket_id")
	if err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid_bucket_id",
			"the bucket id is not a valid UUID")
		return
	}

	var request BucketSettingsRequest
	if !httpx.ReadJSON(w, r, &request) {
		return
	}
	if request.AllowedTypes == nil &&
		request.MaxObjectSizeBytes == nil &&
		request.IsPublic == nil &&
		request.QuotaBytes == nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid_body",
			"the body must set allowed_types, max_object_size_bytes, is_public or quota_bytes")
		return
	}

	current, err := handler.bucketByID(r.Context(), projectID, bucketID)
	if err != nil {
		handler.writeStoreError(w, r, projectID, err, "load bucket")
		return
	}

	allowedTypes := bucketPolicyTypes(current)
	if request.AllowedTypes != nil {
		allowedTypes, err = normalizeAllowedTypes(*request.AllowedTypes)
		if err != nil {
			httpx.WriteError(w, http.StatusBadRequest, "invalid_allowed_types", err.Error())
			return
		}
	}

	maxObjectSize := current.MaxObjectSizeBytes
	if request.MaxObjectSizeBytes != nil {
		maxObjectSize = *request.MaxObjectSizeBytes
		if err := validateMaxObjectSize(maxObjectSize); err != nil {
			httpx.WriteError(w, http.StatusBadRequest, "invalid_max_object_size", err.Error())
			return
		}
	}

	isPublic := current.IsPublic
	if request.IsPublic != nil {
		isPublic = *request.IsPublic
	}

	quotaBytes := current.QuotaBytes
	if request.QuotaBytes != nil {
		quotaBytes = *request.QuotaBytes
		if err := validateBucketQuota(quotaBytes, handler.quota); err != nil {
			httpx.WriteError(w, http.StatusBadRequest, "invalid_quota_bytes", err.Error())
			return
		}
		// Shrinking a quota below what the bucket already holds would leave every
		// later upload refused with no way to tell that apart from a full project.
		// Refusing the change is the only answer that keeps the bucket usable.
		//
		// A failed lookup is a server error rather than a pass: answering "your
		// quota is fine" without having looked would accept the very state this
		// check exists to prevent.
		used, err := handler.store.BucketStorageUsedBytes(r.Context(), projectID, bucketID)
		if err != nil {
			handler.writeStoreError(w, r, projectID, err, "bucket usage check")
			return
		}
		if used > quotaBytes {
			httpx.WriteErrorWithDetail(w, http.StatusConflict, "quota_below_usage",
				fmt.Sprintf("this bucket already holds %d bytes, more than the requested quota", used),
				fmt.Sprintf("delete objects first, or set the quota above %d bytes", used))
			return
		}
	}

	updated, err := handler.store.UpdateBucketSettings(
		r.Context(), projectID, bucketID, allowedTypes, maxObjectSize, isPublic, quotaBytes)
	if err != nil {
		handler.writeStoreError(w, r, projectID, err, "update bucket settings")
		return
	}

	// Visibility through the general settings endpoint still has to reach the
	// objects already in the bucket. Without this, a user unpublishing a bucket
	// from the settings page would find every existing file still served.
	if request.IsPublic != nil && *request.IsPublic != current.IsPublic {
		updated, _, err = handler.store.SetBucketPublic(
			r.Context(), projectID, bucketID, *request.IsPublic)
		if err != nil {
			handler.writeStoreError(w, r, projectID, err, "set bucket visibility")
			return
		}
	}

	httpx.WriteJSON(w, http.StatusOK, map[string]any{
		"success": true,
		"bucket":  handler.bucketResponse(updated),
	})
}

// bucketByID loads a bucket by id within a project.
//
// The store exposes buckets by name and by listing, so this filters the listing
// rather than adding a query. It runs on a settings update and nowhere hot, and
// one fewer query on the store is one fewer thing to keep in step with the
// schema.
func (handler *BucketPlane) bucketByID(
	ctx context.Context,
	projectID uuid.UUID,
	bucketID uuid.UUID,
) (*dbcontrol.Bucket, error) {
	buckets, err := handler.store.ListBuckets(ctx, projectID)
	if err != nil {
		return nil, err
	}
	for index := range buckets {
		if buckets[index].ID == bucketID {
			return &buckets[index], nil
		}
	}
	return nil, dbcontrol.ErrNotFound
}

// validateMaxObjectSize rejects a per-object cap that cannot mean anything.
//
// A negative cap compares false against every size, so it would accept everything
// while looking like a restriction. A cap above the bucket quota is allowed: it
// is redundant rather than wrong, and the smaller of the two is the one that will
// actually stop the upload.
func validateMaxObjectSize(size int64) error {
	if size < 0 {
		return errors.New("max_object_size_bytes must be zero (no limit) or positive")
	}
	return nil
}

// validateBucketQuota rejects a per-bucket storage quota that cannot mean
// anything.
//
// Zero is refused rather than read as "unlimited" the way max_object_size_bytes
// spells it: the project quota already bounds storage, so an unlimited bucket
// would only mean "this one bucket may take all of it".
//
// projectQuota is the ceiling above it. A bucket may not promise more room than
// the project has, because such a number is never reachable and reads on the
// settings page as storage that does not exist -- the figure would promise 300 MB
// and every upload past 256 MB would still be refused by the project quota.
func validateBucketQuota(size int64, projectQuota int64) error {
	if size <= 0 {
		return errors.New("quota_bytes must be a positive number of bytes")
	}
	if projectQuota > 0 && size > projectQuota {
		return fmt.Errorf("quota_bytes cannot exceed the project storage limit of %d bytes", projectQuota)
	}
	return nil
}

// DeleteBucket handles DELETE /buckets/{project_id}/{bucket_id}.
func (handler *BucketPlane) DeleteBucket(w http.ResponseWriter, r *http.Request) {
	projectID, ok := auth.ProjectIDFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthorized", "authentication required")
		return
	}

	bucketID, err := uuidParam(r, "bucket_id")
	if err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid_bucket_id",
			"the bucket id is not a valid UUID")
		return
	}

	// The keys are read before the delete, because the catalog rows cascade away
	// with the bucket and afterwards there is nothing left to learn the filenames
	// from. A bucket holding a large number of objects is deleted in full, which
	// is why this is a separate endpoint rather than a flag on the object delete.
	keys, err := handler.store.DeleteBucketKeys(r.Context(), bucketID)
	if err != nil {
		handler.writeStoreError(w, r, projectID, err, "list bucket keys")
		return
	}

	if err := handler.store.DeleteBucket(r.Context(), projectID, bucketID); err != nil {
		if errors.Is(err, dbcontrol.ErrNotFound) {
			httpx.WriteError(w, http.StatusNotFound, "not_found", "no such bucket")
			return
		}
		handler.writeStoreError(w, r, projectID, err, "delete bucket")
		return
	}

	for _, key := range keys {
		if err := handler.fs.DeleteObject(projectID, key); err != nil {
			handler.log.Error("orphaned file after bucket delete", logger.Fields{
				"project_id": projectID.String(),
				"key":        key,
				"error":      err.Error(),
			})
		}
	}

	used, _ := handler.store.StorageUsedBytes(r.Context(), projectID)

	httpx.WriteJSON(w, http.StatusOK, map[string]any{
		"success":            true,
		"deleted_objects":    len(keys),
		"storage_used_bytes": used,
		"quota_bytes":        handler.quota,
	})
}

// SetBucketPublic handles POST /buckets/{project_id}/{bucket_id}/public.
func (handler *BucketPlane) SetBucketPublic(w http.ResponseWriter, r *http.Request) {
	projectID, ok := auth.ProjectIDFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthorized", "authentication required")
		return
	}

	bucketID, err := uuidParam(r, "bucket_id")
	if err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid_bucket_id",
			"the bucket id is not a valid UUID")
		return
	}

	var request struct {
		IsPublic *bool `json:"is_public"`
	}
	if !httpx.ReadJSON(w, r, &request) {
		return
	}
	if request.IsPublic == nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid_body", "is_public is required")
		return
	}

	bucket, affected, err := handler.store.SetBucketPublic(
		r.Context(), projectID, bucketID, *request.IsPublic)
	if err != nil {
		handler.writeStoreError(w, r, projectID, err, "set bucket visibility")
		return
	}

	httpx.WriteJSON(w, http.StatusOK, map[string]any{
		"success":   true,
		"affected":  affected,
		"is_public": *request.IsPublic,
		"bucket":    handler.bucketResponse(bucket),
	})
}

// resolveBucket finds the bucket a request targets, creating the default bucket
// when the request names none.
//
// A named bucket is not created implicitly: silently making a bucket because a
// client typo'd its name would spread objects across buckets the user never
// asked for.
func (handler *BucketPlane) resolveBucket(
	ctx context.Context,
	projectID uuid.UUID,
	name string,
) (*dbcontrol.Bucket, error) {
	if name == "" {
		name = defaultBucketName
	}

	bucket, err := handler.store.BucketByName(ctx, projectID, name)
	if err == nil {
		return bucket, nil
	}
	if !errors.Is(err, dbcontrol.ErrNotFound) {
		return nil, err
	}

	if name != defaultBucketName {
		return nil, dbcontrol.ErrNotFound
	}
	return handler.store.CreateBucket(ctx, projectID, defaultBucketName)
}

// keyFromRequest pulls and validates the object key out of the route.
//
// It writes the error response itself so callers read as a single sequence
// rather than each repeating the same two checks.
func (handler *BucketPlane) keyFromRequest(
	w http.ResponseWriter,
	r *http.Request,
) (string, bool) {
	rawKey, found := auth.ObjectKeyFromContext(r.Context())
	if !found {
		httpx.WriteError(w, http.StatusBadRequest, "missing_key", "object key is required")
		return "", false
	}

	key, err := normalizeKey(rawKey)
	if err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid_key", err.Error())
		return "", false
	}
	if len(key) > handler.maxKeyLen {
		httpx.WriteError(w, http.StatusBadRequest, "key_too_long", "object key exceeds maximum length")
		return "", false
	}
	return key, true
}

// bucketNameFor resolves a bucket id to its name.
//
// The object row carries the id, so this is the authoritative answer even when
// the request addressed a different bucket by name. It returns an empty string
// on failure: the name is decoration on a response, and failing the whole
// request over it would be worse than omitting it.
func (handler *BucketPlane) bucketNameFor(
	ctx context.Context,
	projectID uuid.UUID,
	bucketID uuid.UUID,
) string {
	buckets, err := handler.store.ListBuckets(ctx, projectID)
	if err != nil {
		return ""
	}
	for _, bucket := range buckets {
		if bucket.ID == bucketID {
			return bucket.Name
		}
	}
	return ""
}

// objectResponse renders one object with its absolute URLs.
func (handler *BucketPlane) objectResponse(
	r *http.Request,
	projectID uuid.UUID,
	bucketName string,
	object *dbcontrol.BucketObject,
) ObjectResponse {
	base := handler.publicBaseURL(r)

	// The key is escaped segment by segment rather than as a whole. Escaping the
	// whole thing would turn the slashes into %2F, which most servers refuse to
	// route; escaping per segment keeps the path shape while making spaces and
	// other characters safe.
	escapedKey := escapeKeyPath(object.Key)

	response := ObjectResponse{
		ID:          object.ID,
		BucketID:    object.BucketID,
		Bucket:      bucketName,
		Key:         object.Key,
		SizeBytes:   object.SizeBytes,
		ContentType: object.ContentType,
		IsPublic:    object.IsPublic,
		ETag:        object.ETag(),
		URL:         fmt.Sprintf("%s/p/%s/bucket/%s", base, projectID, escapedKey),
		// Relative, not absolute: this route is only ever fetched by the
		// dashboard itself, from the page it is already on, so the origin is
		// whatever the browser is using and hard-coding one would break a
		// deployment reached by more than one hostname.
		PreviewURL:   fmt.Sprintf("/api/projects/%s/bucket/%s", projectID, escapedKey),
		CreatedAt:    object.CreatedAt,
		UpdatedAt:    object.UpdatedAt,
		LastModified: object.UpdatedAt,
	}

	if object.IsPublic {
		response.PublicURL = fmt.Sprintf("%s/pub/%s/%s", base, projectID, escapedKey)
	}

	return response
}

// bucketResponse renders a bucket with its aggregate numbers.
func (handler *BucketPlane) bucketResponse(bucket *dbcontrol.Bucket) BucketCatalogResponse {
	return BucketCatalogResponse{
		ID:          bucket.ID,
		Name:        bucket.Name,
		CreatedAt:   bucket.CreatedAt,
		ObjectCount: bucket.ObjectCount,
		SizeBytes:   bucket.SizeBytes,
		IsPublic:    bucket.IsPublic,
		// A bucket whose allowed_types never got written reads as "any" so the
		// dashboard shows a real setting instead of a blank one it cannot
		// round-trip.
		AllowedTypes:       bucketPolicyTypes(bucket),
		MaxObjectSizeBytes: bucket.MaxObjectSizeBytes,
		QuotaBytes:         bucket.QuotaBytes,
	}
}

// bucketPolicyTypes normalizes a bucket's allowed-types value for the wire.
func bucketPolicyTypes(bucket *dbcontrol.Bucket) []string {
	if len(bucket.AllowedTypes) == 0 {
		return []string{dbcontrol.AllowedAny}
	}
	return bucket.AllowedTypes
}

// writeQuotaExceeded answers an upload that does not fit.
//
// The message names the numbers so the dashboard can show what happened instead
// of a bare failure. The usage figure is the total before this upload, which is
// what the client needs to decide whether to delete something first.
func (handler *BucketPlane) writeQuotaExceeded(w http.ResponseWriter, used int64) {
	httpx.WriteErrorWithDetail(
		w,
		http.StatusInsufficientStorage,
		"quota_exceeded",
		"project storage quota exceeded",
		fmt.Sprintf("in use %d bytes, quota %d bytes", used, handler.quota),
	)
}

// writeBucketQuotaExceeded answers an upload that does not fit in the bucket.
//
// It is a separate code from writeQuotaExceeded because the two mean different
// things to the person reading it: the project still has room, and emptying this
// one bucket is the fix. Answering both with "quota exceeded" sends the user
// looking for space in the project when the space is sitting in the bucket next
// to the one they uploaded to.
func (handler *BucketPlane) writeBucketQuotaExceeded(
	w http.ResponseWriter,
	used int64,
	bucket *dbcontrol.Bucket,
) {
	httpx.WriteErrorWithDetail(
		w,
		http.StatusInsufficientStorage,
		"bucket_quota_exceeded",
		fmt.Sprintf("bucket %q storage quota exceeded", bucket.Name),
		fmt.Sprintf("in use %d bytes, quota %d bytes", used, bucket.QuotaBytes),
	)
}

// writeObjectTooLarge reports a refusal caused by the bucket's per-object cap.
//
// 413 rather than 507: the request is larger than the server will accept in one
// piece, which is what 413 is for. 507 is reserved for the project total, where
// the request is individually fine and the project as a whole is full.
func (handler *BucketPlane) writeObjectTooLarge(w http.ResponseWriter, cap int64) {
	httpx.WriteErrorWithDetail(
		w,
		http.StatusRequestEntityTooLarge,
		"object_too_large",
		"the object is larger than this bucket accepts",
		fmt.Sprintf("bucket limit is %d bytes", cap),
	)
}

// writeStoreError maps a store error onto an HTTP status.
func (handler *BucketPlane) writeStoreError(
	w http.ResponseWriter,
	r *http.Request,
	projectID uuid.UUID,
	err error,
	action string,
) {
	switch {
	case errors.Is(err, dbcontrol.ErrNotFound):
		httpx.WriteError(w, http.StatusNotFound, "not_found", "no such bucket")
	case errors.Is(err, dbcontrol.ErrObjectKeyTaken):
		httpx.WriteError(w, http.StatusConflict, "key_taken",
			"an object with that key already exists in this project")
	default:
		handler.writeError(w, r, projectID, err, action)
	}
}

// writeError logs and writes a bucket error response.
func (handler *BucketPlane) writeError(
	w http.ResponseWriter,
	r *http.Request,
	projectID uuid.UUID,
	err error,
	action string,
) {
	handler.log.Warn("bucket request failed", logger.Fields{
		"project_id": projectID.String(),
		"action":     action,
		"path":       r.URL.Path,
		"error":      err.Error(),
	})
	httpx.WriteErrorWithDetail(w, http.StatusInternalServerError, "storage_error",
		"the request could not be completed", err.Error())
}

// normalizeKey validates and normalizes an object key.
//
// Rules:
//   - No leading slash, no "." or ".." segments, no empty segments
//   - No control characters or NUL
//   - No backslash, so a key cannot be a valid filename on one platform and a path
//     separator on another
//
// The database enforces the first two as well. That redundancy is intentional:
// the disk write happens before the metadata write, so the path is built and
// touched before any constraint has run.
func normalizeKey(raw string) (string, error) {
	if raw == "" {
		return "", errors.New("empty key")
	}

	for _, char := range raw {
		if char == 0 || char == '\\' {
			return "", errors.New("key contains a disallowed character")
		}
		if char < 0x20 || char == 0x7f {
			return "", errors.New("key contains a control character")
		}
	}

	cleaned := path.Clean("/" + raw)
	if cleaned == "/" || cleaned == "." {
		return "", errors.New("empty key")
	}
	if strings.HasPrefix(cleaned, "..") || strings.Contains(cleaned, "/../") || strings.HasSuffix(cleaned, "/..") {
		return "", errors.New("path traversal not allowed")
	}
	if strings.Contains(cleaned, "//") {
		return "", errors.New("empty path segment not allowed")
	}

	// path.Clean resolves ".." lexically, which is what makes the checks above
	// work, but it also means a key like "a/../b" is accepted and silently
	// becomes "b". That is correct as a path but surprising as an object key:
	// two different keys would land on one object. Rejecting the segments is
	// clearer than resolving them.
	if raw != strings.TrimPrefix(cleaned, "/") {
		return "", errors.New("key must not contain \".\" or \"..\" segments")
	}

	return strings.TrimPrefix(cleaned, "/"), nil
}

// normalizePrefix validates a key prefix, which is what a folder delete addresses.
//
// A prefix is not a key, so it differs in one way: a trailing slash is allowed and
// required in practice. "photos/2026" also matches "photos/2026x/beach.jpg", so a
// caller has no way to name one folder without the slash. Object keys get no such
// allowance, since "a/" and "a" must not be two different objects.
func normalizePrefix(raw string) (string, error) {
	prefix := strings.TrimSuffix(strings.TrimSpace(raw), "/")
	if prefix == "" {
		return "", errors.New("empty prefix")
	}
	// Validate the body as a key so traversal is refused the same way, then put
	// the slash back: HasPrefix("photos/2026x", "photos/2026/") is what keeps the
	// sibling folder out of the delete.
	if _, err := normalizeKey(prefix); err != nil {
		return "", err
	}
	return prefix + "/", nil
}

// normalizeBucketName validates a bucket name against the same shape the
// database check constraint enforces.
func normalizeBucketName(raw string) (string, error) {
	name := strings.TrimSpace(raw)
	if name == "" {
		return "", errors.New("bucket name is required")
	}
	// The constraint is ^[a-z0-9][a-z0-9_-]{1,62}$, so 2 to 63 characters.
	if len(name) < 2 || len(name) > 63 {
		return "", errors.New("bucket name must be between 2 and 63 characters")
	}
	for index, char := range name {
		isLower := char >= 'a' && char <= 'z'
		isDigit := char >= '0' && char <= '9'
		isTail := char == '_' || char == '-'
		if index == 0 && !isLower && !isDigit {
			return "", errors.New("bucket name must start with a lowercase letter or a digit")
		}
		if index > 0 && !isLower && !isDigit && !isTail {
			return "", errors.New("bucket name may only contain lowercase letters, digits, \"_\" and \"-\"")
		}
	}
	return name, nil
}

// isActiveContent reports whether a content type is one a browser will execute.
//
// These are the types that make a published object dangerous: served from the
// same origin as the dashboard, they run script, read the session cookie, and
// make authenticated requests to the control plane on the owner's behalf. They
// are sent as attachments instead, so publishing a file can never hand out a
// scripting origin.
func isActiveContent(contentType string) bool {
	mediaType, _, _ := strings.Cut(contentType, ";")
	switch strings.ToLower(strings.TrimSpace(mediaType)) {
	case "text/html",
		"application/xhtml+xml",
		"image/svg+xml",
		"application/xml",
		"text/xml",
		"application/javascript",
		"text/javascript",
		"application/ecmascript",
		"text/ecmascript",
		"application/pdf":
		return true
	default:
		return false
	}
}

// Media classes, used to match an upload against a bucket's allowed-types
// setting. Each value is also a dbcontrol.Allowed* constant; they are declared
// separately because the wire names and the class names are allowed to drift
// apart without the classifier quietly changing behaviour.
const (
	mediaImage    = dbcontrol.AllowedImage
	mediaVideo    = dbcontrol.AllowedVideo
	mediaAudio    = dbcontrol.AllowedAudio
	mediaDocument = dbcontrol.AllowedDocument
	mediaArchive  = dbcontrol.AllowedArchive
	mediaFile     = dbcontrol.AllowedFile
)

// documentTypes are the content types that are documents rather than media.
//
// They are listed rather than derived from a prefix because they have no shared
// prefix at all: text/* is a prefix, and the office formats are not. Grouping
// them under one class is what lets a bucket take "documents and images"
// without the settings page needing a separate checkbox per MIME type.
var documentTypes = map[string]bool{
	"application/pdf":      true,
	"application/rtf":      true,
	"application/epub+zip": true,
	"text/rtf":             true,
	"application/msword":   true,
	"application/vnd.openxmlformats-officedocument.wordprocessingml.document": true,
	"application/vnd.ms-excel": true,
	"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":         true,
	"application/vnd.ms-powerpoint":                                             true,
	"application/vnd.openxmlformats-officedocument.presentationml.presentation": true,
	"application/vnd.oasis.opendocument.text":                                   true,
	"application/vnd.oasis.opendocument.spreadsheet":                            true,
	"application/vnd.oasis.opendocument.presentation":                           true,
}

// archiveTypes are the content types of compressed bundles.
//
// zip is here rather than treated as a generic binary because zip is what an
// office document actually arrives as, and an office document in a zip would
// otherwise land in mediaFile and be refused by a bucket set to documents.
var archiveTypes = map[string]bool{
	"application/zip":              true,
	"application/x-zip-compressed": true,
	"application/gzip":             true,
	"application/x-gzip":           true,
	"application/x-tar":            true,
	"application/x-7z-compressed":  true,
	"application/x-rar-compressed": true,
	"application/x-bzip2":          true,
	"application/x-xz":             true,
}

// mediaClass classifies a content type into the classes a bucket policy names.
//
// mediaFile is the catch-all for whatever is none of the others, which is what
// makes it a real choice rather than a synonym for "any": a bucket set to file
// refuses a .png and accepts a compiled binary.
//
// It is checked on the declared Content-Type, which is the only signal available
// before the bytes arrive. A client can of course lie about it; the alternative
// is sniffing the body, which means buffering the upload to inspect it, and a
// user setting a restriction on their own bucket is not an adversary.
func mediaClass(contentType string) string {
	mediaType, _, _ := strings.Cut(contentType, ";")
	mediaType = strings.ToLower(strings.TrimSpace(mediaType))

	switch {
	case strings.HasPrefix(mediaType, "image/"):
		return mediaImage
	case strings.HasPrefix(mediaType, "video/"):
		return mediaVideo
	case strings.HasPrefix(mediaType, "audio/"):
		return mediaAudio
	case documentTypes[mediaType] || strings.HasPrefix(mediaType, "text/"):
		return mediaDocument
	case archiveTypes[mediaType]:
		return mediaArchive
	default:
		return mediaFile
	}
}

// bucketAcceptsContentType reports whether a bucket's policy permits an upload of
// this content type.
func bucketAcceptsContentType(bucket *dbcontrol.Bucket, contentType string) bool {
	allowed := effectiveAllowedTypes(bucket.AllowedTypes)

	// No restriction, spelled either as an absent value or as the explicit
	// "any". Both mean the same thing, and a row that predates the policy column
	// reads as the empty set.
	if len(allowed) == 0 {
		return true
	}
	for _, class := range allowed {
		if class == dbcontrol.AllowedAny {
			return true
		}
	}
	return slices.Contains(allowed, mediaClass(contentType))
}

// effectiveAllowedTypes is the policy a bucket actually enforces.
//
// It differs from the stored slice in one way: "any" collapses to the empty
// set, so callers only have one thing to test for "no restriction" instead of
// two. Everything else is passed through.
func effectiveAllowedTypes(stored []string) []string {
	if len(stored) == 1 && stored[0] == dbcontrol.AllowedAny {
		return nil
	}
	return stored
}

// describeAllowedTypes renders a bucket's policy for an error message.
//
// "any" and "file" are described in words rather than echoed, because neither is
// a class the user could recognise on their own upload.
func describeAllowedTypes(bucket *dbcontrol.Bucket) string {
	allowed := effectiveAllowedTypes(bucket.AllowedTypes)
	if len(allowed) == 0 {
		return "any"
	}

	labels := make([]string, 0, len(allowed))
	for _, class := range allowed {
		labels = append(labels, allowedTypeLabel(class))
	}
	sort.Strings(labels)
	return strings.Join(labels, " or ")
}

// allowedTypeLabel is the human name of a policy class.
func allowedTypeLabel(class string) string {
	switch class {
	case dbcontrol.AllowedImage:
		return "image"
	case dbcontrol.AllowedVideo:
		return "video"
	case dbcontrol.AllowedAudio:
		return "audio"
	case dbcontrol.AllowedDocument:
		return "document"
	case dbcontrol.AllowedArchive:
		return "archive"
	default:
		// "file" is the class of everything else, which is not something a user
		// would call their upload.
		return "other file"
	}
}

// normalizeAllowedTypes validates a requested policy and returns it in a stable
// order.
//
// The order is sorted and de-duplicated so that two requests describing the same
// policy produce byte-identical rows. Otherwise a client that sent the checkboxes
// in a different order would rewrite the array and make every later comparison
// report a change where none happened.
func normalizeAllowedTypes(raw []string) ([]string, error) {
	if len(raw) == 0 {
		return nil, errors.New("allowed_types is required")
	}

	seen := make(map[string]bool, len(raw))
	values := make([]string, 0, len(raw))
	for _, entry := range raw {
		value := strings.ToLower(strings.TrimSpace(entry))
		switch value {
		case dbcontrol.AllowedAny, dbcontrol.AllowedImage, dbcontrol.AllowedVideo,
			dbcontrol.AllowedAudio, dbcontrol.AllowedDocument, dbcontrol.AllowedArchive,
			dbcontrol.AllowedFile:
		default:
			return nil, fmt.Errorf(
				"allowed_types must be any, image, video, audio, document, archive or file (got %q)",
				entry)
		}
		if seen[value] {
			continue
		}
		seen[value] = true
		values = append(values, value)
	}

	// "any" already answers "everything", so pairing it with a class asks the
	// server to both allow and refuse the same upload. Refusing it here rather
	// than silently dropping the other entries is the point: a user who ticked
	// everything would otherwise get a bucket that quietly stops taking videos.
	if seen[dbcontrol.AllowedAny] && len(values) > 1 {
		return nil, errors.New(
			"allowed_types cannot combine \"any\" with a specific type; " +
				"either allow everything or pick the types you want")
	}

	sort.Strings(values)
	return values, nil
}

// IsPreviewableContent reports whether an object is worth rendering inline in
// the dashboard, as opposed to only offering a download.
//
// Images and video are previewed. Anything executable is not, for the reason
// given on isActiveContent: rendering it inside the app's own origin is the same
// problem, in the app's own pages.
func IsPreviewableContent(contentType string) bool {
	if isActiveContent(contentType) {
		return false
	}
	mediaType, _, _ := strings.Cut(contentType, ";")
	mediaType = strings.ToLower(strings.TrimSpace(mediaType))

	if strings.HasPrefix(mediaType, "image/") ||
		strings.HasPrefix(mediaType, "video/") ||
		strings.HasPrefix(mediaType, "audio/") {
		return true
	}
	switch mediaType {
	case "application/json",
		"text/plain",
		"text/markdown",
		"text/csv":
		return true
	default:
		return false
	}
}

// etagMatches reports whether an If-None-Match header selects the given ETag.
//
// "*" matches anything, which is the header's way of saying "I already have
// something cached here". Weak comparison is the correct semantics for
// If-None-Match: the question is whether the copy is current, not whether it is
// byte-identical.
func etagMatches(header string, etag string) bool {
	header = strings.TrimSpace(header)
	if header == "" || etag == "" {
		return false
	}
	if header == "*" {
		return true
	}
	for _, candidate := range strings.Split(header, ",") {
		candidate = strings.TrimSpace(candidate)
		candidate = strings.TrimPrefix(candidate, "W/")
		if candidate == etag {
			return true
		}
	}
	return false
}

// notModifiedSince reports whether the object is unchanged since the client
// looked at it.
//
// modified is compared without truncation. The date in the header has second
// resolution, so an object written at 12:00:00.5 advertises 12:00:00 and the
// client echoes 12:00:00 back; rounding the modification time down to the same
// second would then answer 304 and leave the client holding the previous bytes
// for as long as the cache entry lives. Erring towards a redundant download is
// cheap. Erring towards a stale one is not.
func notModifiedSince(header string, modified time.Time) bool {
	header = strings.TrimSpace(header)
	if header == "" {
		return false
	}
	since, err := http.ParseTime(header)
	if err != nil {
		return false
	}
	return !modified.After(since)
}

// writeNotModified answers a conditional request that already has the bytes.
func writeNotModified(w http.ResponseWriter, etag string, modified time.Time) {
	if etag != "" {
		w.Header().Set("ETag", etag)
	}
	w.Header().Set("Last-Modified", modified.UTC().Format(http.TimeFormat))
	w.WriteHeader(http.StatusNotModified)
}

// escapeKeyPath percent-encodes an object key for use in a URL path, leaving the
// slashes that give keys their folder structure intact.
func escapeKeyPath(key string) string {
	segments := strings.Split(key, "/")
	for index, segment := range segments {
		segments[index] = urlEncodePathSegment(segment)
	}
	return strings.Join(segments, "/")
}

// urlEncodePathSegment encodes one path segment.
//
// url.PathEscape is not used because it deliberately leaves some characters that
// are unsafe in a path unescaped, and it does not escape "/" consistently across
// Go versions.
func urlEncodePathSegment(segment string) string {
	const upperhex = "0123456789ABCDEF"
	var builder strings.Builder
	for index := 0; index < len(segment); index++ {
		char := segment[index]
		if isUnreservedPathChar(char) {
			builder.WriteByte(char)
			continue
		}
		builder.WriteByte('%')
		builder.WriteByte(upperhex[char>>4])
		builder.WriteByte(upperhex[char&0xf])
	}
	return builder.String()
}

// isUnreservedPathChar reports whether a byte can appear literally in a path
// segment.
//
// The set is RFC 3986's unreserved set plus the sub-delimiters that are legal
// inside a segment. Notably it excludes "?", "#" and "&", because the first two
// change how the rest of the URL is parsed and the third commonly separates
// query parameters in stored URLs.
func isUnreservedPathChar(char byte) bool {
	switch {
	case char >= 'a' && char <= 'z',
		char >= 'A' && char <= 'Z',
		char >= '0' && char <= '9':
		return true
	}
	switch char {
	case '-', '_', '.', '~', '!', '$', '(', ')', '*', '+', ',', ';', '=', ':', '@':
		return true
	default:
		return false
	}
}

// urlEncodeFilename encodes the key for a Content-Disposition filename parameter.
func urlEncodeFilename(key string) string {
	segments := strings.Split(key, "/")
	return urlEncodePathSegment(segments[len(segments)-1])
}

// parseIntParam reads a query parameter as an integer, falling back to a default
// when it is absent or unparseable.
func parseIntParam(raw string, fallback int) int {
	if raw == "" {
		return fallback
	}
	value, err := strconv.Atoi(raw)
	if err != nil {
		return fallback
	}
	return value
}

// publicBaseURL returns the origin object URLs are built from.
//
// The configured public URL wins when it is set, and only then are the forwarded
// headers consulted. Trusting X-Forwarded-Host unconditionally would let any
// caller pass an arbitrary host and have the server mint an object URL pointing
// at a domain they control, which turns a copy button in the dashboard into a
// way to send a user's own visitors somewhere else. A deployment that has not
// set MOOGO_PUBLIC_URL falls back to the request, which is correct for local
// development and for the tests.
//
// The forwarded headers are still honoured in the fallback because that is the
// only way a single-host deployment behind a proxy gets an https URL rather than
// one pointing at the proxy's own plain-HTTP hop.
func (handler *BucketPlane) publicBaseURL(r *http.Request) string {
	if handler.publicBase != "" {
		return handler.publicBase
	}
	return publicBaseURL(r)
}

// publicBaseURL derives the absolute origin from a request, for the fallback
// path above.
func publicBaseURL(r *http.Request) string {
	scheme := "http"
	if forwardedProto(r) != "" {
		scheme = forwardedProto(r)
	} else if r.TLS != nil {
		scheme = "https"
	}

	host := r.Host
	if forwardedHost(r) != "" {
		host = forwardedHost(r)
	}

	return scheme + "://" + host
}

func forwardedProto(r *http.Request) string {
	return firstForwardedValue(r.Header.Get("X-Forwarded-Proto"))
}

func forwardedHost(r *http.Request) string {
	return firstForwardedValue(r.Header.Get("X-Forwarded-Host"))
}

// firstForwardedValue takes the leftmost entry of a forwarded header, which is
// the value the outermost proxy recorded.
func firstForwardedValue(raw string) string {
	first, _, _ := strings.Cut(raw, ",")
	return strings.TrimSpace(first)
}

// BucketCatalogResponse is the control plane response for one bucket.
type BucketCatalogResponse struct {
	ID          uuid.UUID `json:"id"`
	Name        string    `json:"name"`
	ObjectCount int64     `json:"object_count"`
	SizeBytes   int64     `json:"size_bytes"`
	CreatedAt   time.Time `json:"created_at"`

	// IsPublic is the visibility objects uploaded here get from now on. It is
	// not the visibility of the objects already in the bucket; those keep the
	// answer the user gave them individually.
	IsPublic bool `json:"is_public"`

	// AllowedTypes, MaxObjectSizeBytes and QuotaBytes are the bucket's limits.
	// They travel with the listing so the dashboard can show and edit the current
	// settings without a second request per bucket.
	AllowedTypes []string `json:"allowed_types"`
	// MaxObjectSizeBytes is 0 when the bucket has no per-object cap.
	MaxObjectSizeBytes int64 `json:"max_object_size_bytes"`
	// QuotaBytes caps this bucket on its own, separately from the project total.
	QuotaBytes int64 `json:"quota_bytes"`
}

// BucketCreateRequest is the body for creating a bucket.
type BucketCreateRequest struct {
	Name string `json:"name"`
	// AllowedTypes, MaxObjectSizeBytes and QuotaBytes set the settings on
	// creation. All are optional; omitting them gives a bucket that accepts
	// anything up to the default quota, which is what every bucket did before
	// these fields existed.
	AllowedTypes       []string `json:"allowed_types"`
	MaxObjectSizeBytes int64    `json:"max_object_size_bytes"`
	QuotaBytes         int64    `json:"quota_bytes"`
}

// BucketSettingsRequest is the body for changing a bucket's settings.
//
// Every field is a pointer so an omitted field can be told from one set to its
// zero value: max_object_size_bytes of 0 means "remove the cap", and that is a
// real request rather than the absence of one.
type BucketSettingsRequest struct {
	AllowedTypes       *[]string `json:"allowed_types"`
	MaxObjectSizeBytes *int64    `json:"max_object_size_bytes"`
	IsPublic           *bool     `json:"is_public"`
	QuotaBytes         *int64    `json:"quota_bytes"`
}
