package handler

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"slices"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/moogo/moogo/internal/auth"
	"github.com/moogo/moogo/internal/dbcontrol"
	"github.com/moogo/moogo/internal/dbplane"
	"github.com/moogo/moogo/pkg/logger"
)

// --- fakes ---

// fakeBucketStore is a BucketStore that keeps its rows in memory.
//
// It is a map rather than a database on purpose: these tests are about the
// handler's decisions, and a real Postgres would only make them slower and
// would need a cleanup strategy for every row.
type fakeBucketStore struct {
	mu sync.Mutex

	projectID uuid.UUID
	buckets   map[string]*dbcontrol.Bucket
	objects   map[string]*dbcontrol.BucketObject

	usedBytes int64

	// errors injected per call, keyed by method name.
	failWith map[string]error

	putCalls int
	lastKey  string
}

func newFakeBucketStore(projectID uuid.UUID) *fakeBucketStore {
	return &fakeBucketStore{
		projectID: projectID,
		buckets:   map[string]*dbcontrol.Bucket{},
		objects:   map[string]*dbcontrol.BucketObject{},
		failWith:  map[string]error{},
	}
}

// testBucketQuota is the per-bucket default the migration writes, so a fixture
// bucket behaves like a real one without every test having to say so.
const testBucketQuota = 262144000 // 250 MB

func (store *fakeBucketStore) addBucket(name string) *dbcontrol.Bucket {
	store.mu.Lock()
	defer store.mu.Unlock()
	bucket := &dbcontrol.Bucket{
		ID:           uuid.New(),
		ProjectID:    store.projectID,
		Name:         name,
		CreatedAt:    time.Unix(1_700_000_000, 0).UTC(),
		AllowedTypes: []string{dbcontrol.AllowedAny},
		QuotaBytes:   testBucketQuota,
	}
	store.buckets[name] = bucket
	return bucket
}

// addObject inserts a catalog row directly, bypassing the handler.
func (store *fakeBucketStore) addObject(
	bucket *dbcontrol.Bucket,
	key string,
	size int64,
	contentType string,
) *dbcontrol.BucketObject {
	store.mu.Lock()
	defer store.mu.Unlock()
	object := &dbcontrol.BucketObject{
		ID:          uuid.New(),
		ProjectID:   store.projectID,
		BucketID:    bucket.ID,
		Key:         key,
		SizeBytes:   size,
		ContentType: contentType,
		Version:     uuid.New(),
		CreatedAt:   time.Unix(1_700_000_000, 0).UTC(),
		UpdatedAt:   time.Unix(1_700_000_000, 0).UTC(),
	}
	store.objects[key] = object
	store.usedBytes += size
	// A snapshot, so a test that captured the row before a mutation still sees
	// what the response said at the time, the way a real client would.
	snapshot := *object
	return &snapshot
}

func (store *fakeBucketStore) CreateBucket(
	_ context.Context, projectID uuid.UUID, name string,
) (*dbcontrol.Bucket, error) {
	store.mu.Lock()
	defer store.mu.Unlock()
	if err := store.failWith["CreateBucket"]; err != nil {
		return nil, err
	}
	if existing, ok := store.buckets[name]; ok {
		return existing, nil
	}
	bucket := &dbcontrol.Bucket{
		ID:           uuid.New(),
		ProjectID:    projectID,
		Name:         name,
		CreatedAt:    time.Unix(1_700_000_000, 0).UTC(),
		AllowedTypes: []string{dbcontrol.AllowedAny},
		QuotaBytes:   testBucketQuota,
	}
	store.buckets[name] = bucket
	return bucket, nil
}

func (store *fakeBucketStore) UpdateBucketSettings(
	_ context.Context,
	projectID uuid.UUID,
	bucketID uuid.UUID,
	allowedTypes []string,
	maxObjectSize int64,
	isPublic bool,
	quotaBytes int64,
) (*dbcontrol.Bucket, error) {
	store.mu.Lock()
	defer store.mu.Unlock()
	if err := validFakePolicy(allowedTypes); err != nil {
		return nil, err
	}
	if maxObjectSize < 0 || quotaBytes <= 0 {
		return nil, dbcontrol.ErrInvalidBucketPolicy
	}
	for _, bucket := range store.buckets {
		if bucket.ID == bucketID && bucket.ProjectID == projectID {
			bucket.AllowedTypes = allowedTypes
			bucket.MaxObjectSizeBytes = maxObjectSize
			bucket.IsPublic = isPublic
			bucket.QuotaBytes = quotaBytes
			updated := *bucket
			return &updated, nil
		}
	}
	return nil, dbcontrol.ErrNotFound
}

// validFakePolicy mirrors the database check constraint, so a test cannot pass
// on a value the real schema would reject.
func validFakePolicy(allowedTypes []string) error {
	known := map[string]bool{
		dbcontrol.AllowedAny: true, dbcontrol.AllowedImage: true,
		dbcontrol.AllowedVideo: true, dbcontrol.AllowedAudio: true,
		dbcontrol.AllowedDocument: true, dbcontrol.AllowedArchive: true,
		dbcontrol.AllowedFile: true,
	}
	if len(allowedTypes) == 0 {
		return dbcontrol.ErrInvalidBucketPolicy
	}
	hasAny := false
	for _, value := range allowedTypes {
		if !known[value] {
			return dbcontrol.ErrInvalidBucketPolicy
		}
		if value == dbcontrol.AllowedAny {
			hasAny = true
		}
	}
	if hasAny && len(allowedTypes) > 1 {
		return dbcontrol.ErrInvalidBucketPolicy
	}
	return nil
}

func (store *fakeBucketStore) ListBuckets(
	_ context.Context, _ uuid.UUID,
) ([]dbcontrol.Bucket, error) {
	store.mu.Lock()
	defer store.mu.Unlock()
	out := make([]dbcontrol.Bucket, 0, len(store.buckets))
	for _, bucket := range store.buckets {
		out = append(out, *bucket)
	}
	return out, nil
}

func (store *fakeBucketStore) ListBucketsWithStats(
	_ context.Context, _ uuid.UUID,
) ([]dbcontrol.Bucket, error) {
	store.mu.Lock()
	defer store.mu.Unlock()
	out := make([]dbcontrol.Bucket, 0, len(store.buckets))
	for _, bucket := range store.buckets {
		stat := *bucket
		for _, object := range store.objects {
			if object.BucketID == bucket.ID {
				stat.ObjectCount++
				stat.SizeBytes += object.SizeBytes
			}
		}
		out = append(out, stat)
	}
	return out, nil
}

func (store *fakeBucketStore) BucketByName(
	_ context.Context, _ uuid.UUID, name string,
) (*dbcontrol.Bucket, error) {
	store.mu.Lock()
	defer store.mu.Unlock()
	bucket, ok := store.buckets[name]
	if !ok {
		return nil, dbcontrol.ErrNotFound
	}
	return bucket, nil
}

func (store *fakeBucketStore) DeleteBucket(
	_ context.Context, _ uuid.UUID, bucketID uuid.UUID,
) error {
	store.mu.Lock()
	defer store.mu.Unlock()
	for name, bucket := range store.buckets {
		if bucket.ID == bucketID {
			delete(store.buckets, name)
			return nil
		}
	}
	return dbcontrol.ErrNotFound
}

func (store *fakeBucketStore) DeleteBucketKeys(
	_ context.Context, bucketID uuid.UUID,
) ([]string, error) {
	store.mu.Lock()
	defer store.mu.Unlock()
	keys := []string{}
	for key, object := range store.objects {
		if object.BucketID == bucketID {
			keys = append(keys, key)
		}
	}
	return keys, nil
}

// SetBucketPublic writes the bucket default and fans out to its objects, the way
// the real CTE does. A fake that only fanned out would pass every old test and
// still miss the case 0009 exists for.
func (store *fakeBucketStore) SetBucketPublic(
	_ context.Context, projectID uuid.UUID, bucketID uuid.UUID, isPublic bool,
) (*dbcontrol.Bucket, int64, error) {
	store.mu.Lock()
	defer store.mu.Unlock()

	var found *dbcontrol.Bucket
	for _, bucket := range store.buckets {
		if bucket.ID == bucketID && bucket.ProjectID == projectID {
			found = bucket
			break
		}
	}
	if found == nil {
		return nil, 0, dbcontrol.ErrNotFound
	}
	found.IsPublic = isPublic

	var affected int64
	for _, object := range store.objects {
		if object.BucketID != bucketID {
			continue
		}
		object.IsPublic = isPublic
		if isPublic {
			token := uuid.New().String()
			object.PublicToken = &token
		} else {
			object.PublicToken = nil
		}
		affected++
	}
	updated := *found
	return &updated, affected, nil
}

func (store *fakeBucketStore) PutObject(
	_ context.Context,
	projectID uuid.UUID,
	bucketID uuid.UUID,
	key string,
	sizeBytes int64,
	contentType string,
	isPublic bool,
) (*dbcontrol.BucketObject, int64, error) {
	store.mu.Lock()
	defer store.mu.Unlock()
	store.putCalls++
	store.lastKey = key
	if err := store.failWith["PutObject"]; err != nil {
		return nil, 0, err
	}

	previous := int64(0)
	if existing, ok := store.objects[key]; ok {
		previous = existing.SizeBytes
		store.usedBytes += sizeBytes - previous
		// A re-upload replaces the bytes, so it must also produce a new
		// validator. The store asserts this by comparing versions. Visibility is
		// deliberately left alone: replacing a file does not unpublish it.
		existing.SizeBytes = sizeBytes
		existing.ContentType = contentType
		existing.BucketID = bucketID
		existing.Version = uuid.New()
		// A copy, not the stored pointer: a caller that captured the previous
		// response must not see it change underneath.
		replaced := *existing
		return &replaced, previous, nil
	}

	object := &dbcontrol.BucketObject{
		ID:          uuid.New(),
		ProjectID:   projectID,
		BucketID:    bucketID,
		Key:         key,
		SizeBytes:   sizeBytes,
		ContentType: contentType,
		IsPublic:    isPublic,
		Version:     uuid.New(),
		CreatedAt:   time.Unix(1_700_000_000, 0).UTC(),
		UpdatedAt:   time.Unix(1_700_000_000, 0).UTC(),
	}
	if isPublic {
		token := uuid.New().String()
		object.PublicToken = &token
	}
	store.objects[key] = object
	store.usedBytes += sizeBytes
	snapshot := *object
	return &snapshot, 0, nil
}

func (store *fakeBucketStore) ObjectByKey(
	_ context.Context, _ uuid.UUID, key string,
) (*dbcontrol.BucketObject, error) {
	store.mu.Lock()
	defer store.mu.Unlock()
	object, ok := store.objects[key]
	if !ok {
		return nil, dbcontrol.ErrNotFound
	}
	return object, nil
}

func (store *fakeBucketStore) SetObjectPublic(
	_ context.Context, _ uuid.UUID, key string, isPublic bool,
) (*dbcontrol.BucketObject, error) {
	store.mu.Lock()
	defer store.mu.Unlock()
	object, ok := store.objects[key]
	if !ok {
		return nil, dbcontrol.ErrNotFound
	}
	object.IsPublic = isPublic
	if isPublic {
		token := uuid.New().String()
		object.PublicToken = &token
	} else {
		object.PublicToken = nil
	}
	return object, nil
}

func (store *fakeBucketStore) RenameObject(
	_ context.Context, _ uuid.UUID, fromKey string, toKey string,
) (*dbcontrol.BucketObject, error) {
	store.mu.Lock()
	defer store.mu.Unlock()
	if _, taken := store.objects[toKey]; taken {
		return nil, dbcontrol.ErrObjectKeyTaken
	}
	object, ok := store.objects[fromKey]
	if !ok {
		return nil, dbcontrol.ErrNotFound
	}
	delete(store.objects, fromKey)
	object.Key = toKey
	store.objects[toKey] = object
	return object, nil
}

func (store *fakeBucketStore) ListObjects(
	_ context.Context, query dbcontrol.ObjectQuery,
) ([]dbcontrol.BucketObject, int64, error) {
	store.mu.Lock()
	defer store.mu.Unlock()
	matched := []dbcontrol.BucketObject{}
	for _, object := range store.objects {
		if object.BucketID != query.BucketID {
			continue
		}
		if query.Prefix != "" && !strings.HasPrefix(object.Key, query.Prefix) {
			continue
		}
		if query.Search != "" && !strings.Contains(
			strings.ToLower(object.Key), strings.ToLower(query.Search),
		) {
			continue
		}
		matched = append(matched, *object)
	}
	total := int64(len(matched))
	return matched, total, nil
}

func (store *fakeBucketStore) DeleteObject(
	_ context.Context, _ uuid.UUID, key string,
) (int64, error) {
	store.mu.Lock()
	defer store.mu.Unlock()
	object, ok := store.objects[key]
	if !ok {
		return 0, dbcontrol.ErrNotFound
	}
	delete(store.objects, key)
	store.usedBytes -= object.SizeBytes
	return object.SizeBytes, nil
}

func (store *fakeBucketStore) DeletePrefix(
	_ context.Context, _ uuid.UUID, prefix string,
) ([]string, int64, error) {
	store.mu.Lock()
	defer store.mu.Unlock()
	keys := []string{}
	var freed int64
	for key, object := range store.objects {
		if !strings.HasPrefix(key, prefix) {
			continue
		}
		keys = append(keys, key)
		freed += object.SizeBytes
		delete(store.objects, key)
	}
	store.usedBytes -= freed
	return keys, freed, nil
}

func (store *fakeBucketStore) StorageUsedBytes(_ context.Context, _ uuid.UUID) (int64, error) {
	store.mu.Lock()
	defer store.mu.Unlock()
	return store.usedBytes, nil
}

func (store *fakeBucketStore) BucketStorageUsedBytes(
	_ context.Context, _ uuid.UUID, bucketID uuid.UUID,
) (int64, error) {
	store.mu.Lock()
	defer store.mu.Unlock()
	var used int64
	for _, object := range store.objects {
		if object.BucketID == bucketID {
			used += object.SizeBytes
		}
	}
	return used, nil
}

// fakeObjectFS is an in-memory FileSystem.
type fakeObjectFS struct {
	mu       sync.Mutex
	contents map[string][]byte

	moves     int
	moveErr   error
	writeErr  error
	deleteErr error
}

func newFakeObjectFS() *fakeObjectFS {
	return &fakeObjectFS{contents: map[string][]byte{}}
}

func (fs *fakeObjectFS) WriteObject(_ uuid.UUID, key string, r io.Reader) (int64, error) {
	if fs.writeErr != nil {
		return 0, fs.writeErr
	}
	data, err := io.ReadAll(r)
	if err != nil {
		return 0, err
	}
	fs.mu.Lock()
	defer fs.mu.Unlock()
	fs.contents[key] = data
	return int64(len(data)), nil
}

func (fs *fakeObjectFS) ReadObject(_ uuid.UUID, key string) (io.ReadCloser, int64, error) {
	fs.mu.Lock()
	defer fs.mu.Unlock()
	data, ok := fs.contents[key]
	if !ok {
		return nil, 0, dbplane.ErrNotFound
	}
	return io.NopCloser(strings.NewReader(string(data))), int64(len(data)), nil
}

func (fs *fakeObjectFS) MoveObject(_ uuid.UUID, fromKey string, toKey string) error {
	if fs.moveErr != nil {
		return fs.moveErr
	}
	fs.mu.Lock()
	defer fs.mu.Unlock()
	fs.moves++
	data, ok := fs.contents[fromKey]
	if !ok {
		return dbplane.ErrNotFound
	}
	delete(fs.contents, fromKey)
	fs.contents[toKey] = data
	return nil
}

func (fs *fakeObjectFS) DeleteObject(_ uuid.UUID, key string) error {
	if fs.deleteErr != nil {
		return fs.deleteErr
	}
	fs.mu.Lock()
	defer fs.mu.Unlock()
	delete(fs.contents, key)
	return nil
}

func (fs *fakeObjectFS) StorageUsed(_ uuid.UUID) (int64, error) {
	fs.mu.Lock()
	defer fs.mu.Unlock()
	var total int64
	for _, data := range fs.contents {
		total += int64(len(data))
	}
	return total, nil
}

// --- helpers ---

func testBucketPlane(t *testing.T, quota int64) (*BucketPlane, *fakeBucketStore, *fakeObjectFS) {
	t.Helper()
	projectID := uuid.New()
	store := newFakeBucketStore(projectID)
	fs := newFakeObjectFS()
	return NewBucketPlane(store, fs, quota, "", logger.Nop()), store, fs
}

// requestContext builds a context carrying a project id and an object key, which
// is what the router's middleware would have done.
func requestContext(projectID uuid.UUID, key string) context.Context {
	ctx := context.WithValue(context.Background(), auth.ContextKeyProjectID, projectID.String())
	return context.WithValue(ctx, auth.ContextKeyObjectKey, key)
}

// bucketRequest builds a request for a route with a {bucket_id} parameter.
//
// chi.URLParam reads from the routing context, which only chi's own handler puts
// there. These tests drive the handler directly, so the parameter has to be
// installed by hand; without it every {bucket_id} route reports an invalid id
// before reaching any of the logic worth testing.
func bucketRequest(
	method string,
	target string,
	body io.Reader,
	projectID uuid.UUID,
	bucketID uuid.UUID,
) *http.Request {
	request := httptest.NewRequest(method, target, body).WithContext(
		requestContext(projectID, ""))

	routeCtx := chi.NewRouteContext()
	routeCtx.URLParams.Add("project_id", projectID.String())
	routeCtx.URLParams.Add("bucket_id", bucketID.String())
	return request.WithContext(context.WithValue(request.Context(), chi.RouteCtxKey, routeCtx))
}

func decodeBody(t *testing.T, recorder *httptest.ResponseRecorder, target any) {
	t.Helper()
	if err := json.Unmarshal(recorder.Body.Bytes(), target); err != nil {
		t.Fatalf("decode body: %v (body was %q)", err, recorder.Body.String())
	}
}

// --- key normalization ---

func TestNormalizeKeyRejectsTraversal(t *testing.T) {
	cases := []string{
		"../etc/passwd",
		"a/../../etc/passwd",
		"a/..",
		"..",
		"",
		"/",
	}

	for _, raw := range cases {
		if _, err := normalizeKey(raw); err == nil {
			t.Errorf("normalizeKey(%q) accepted a key that should be refused", raw)
		}
	}
}

func TestNormalizeKeyRejectsDotSegmentsRatherThanResolvingThem(t *testing.T) {
	// path.Clean would silently turn this into "b". Two different keys landing on
	// one object is the reason a dot segment is refused rather than collapsed.
	if _, err := normalizeKey("a/../b"); err == nil {
		t.Fatal("normalizeKey resolved a .. segment instead of refusing it")
	}
	if _, err := normalizeKey("a/./b"); err == nil {
		t.Fatal("normalizeKey resolved a . segment instead of refusing it")
	}
}

func TestNormalizeKeyRejectsBackslashAndControlCharacters(t *testing.T) {
	// A backslash is a valid filename character on Linux and a path separator on
	// Windows, so a key containing one means two different things depending on
	// where the bucket ends up.
	for _, raw := range []string{`a\b`, "a\x00b", "a\nb", "a\x7fb"} {
		if _, err := normalizeKey(raw); err == nil {
			t.Errorf("normalizeKey(%q) accepted a disallowed key", raw)
		}
	}
}

func TestNormalizeKeyKeepsFolderStructure(t *testing.T) {
	key, err := normalizeKey("photos/2026/june/beach.jpg")
	if err != nil {
		t.Fatalf("normalizeKey: %v", err)
	}
	if key != "photos/2026/june/beach.jpg" {
		t.Fatalf("key = %q, want the path preserved", key)
	}
}

func TestNormalizeKeyAllowsSpaces(t *testing.T) {
	// Spaces are encoded on the way out rather than rejected, so "my photo.jpg"
	// is a legal key.
	key, err := normalizeKey("my photo.jpg")
	if err != nil {
		t.Fatalf("normalizeKey: %v", err)
	}
	if key != "my photo.jpg" {
		t.Fatalf("key = %q", key)
	}
}

// --- bucket names ---

func TestNormalizeBucketNameMatchesTheDatabaseConstraint(t *testing.T) {
	valid := []string{"ab", "default", "my-bucket", "my_bucket", "b2"}
	for _, name := range valid {
		if _, err := normalizeBucketName(name); err != nil {
			t.Errorf("normalizeBucketName(%q) = %v, want accepted", name, err)
		}
	}

	invalid := []string{"", " ", "a", "A", "My-Bucket", "my bucket", "my.bucket", strings.Repeat("a", 64)}
	for _, name := range invalid {
		if _, err := normalizeBucketName(name); err == nil {
			t.Errorf("normalizeBucketName(%q) accepted a name the database rejects", name)
		}
	}
}

// --- content classification ---

func TestIsActiveContentCoversWhatABrowserExecutes(t *testing.T) {
	active := []string{
		"text/html",
		"text/html; charset=utf-8",
		"IMAGE/SVG+XML",
		"application/xhtml+xml",
		"application/javascript",
		"text/xml",
		"application/pdf",
	}
	for _, contentType := range active {
		if !isActiveContent(contentType) {
			t.Errorf("isActiveContent(%q) = false, want true", contentType)
		}
	}

	passive := []string{"image/png", "image/jpeg", "text/plain", "application/json", "video/mp4"}
	for _, contentType := range passive {
		if isActiveContent(contentType) {
			t.Errorf("isActiveContent(%q) = true, want false", contentType)
		}
	}
}

func TestIsPreviewableContentExcludesSvg(t *testing.T) {
	if IsPreviewableContent("image/svg+xml") {
		t.Fatal("an SVG was treated as previewable; it can carry script")
	}
	if !IsPreviewableContent("image/png") {
		t.Fatal("a PNG was not treated as previewable")
	}
	if IsPreviewableContent("text/html") {
		t.Fatal("HTML was treated as previewable")
	}
}

// --- validators ---

func TestETagMatches(t *testing.T) {
	cases := []struct {
		header string
		etag   string
		want   bool
	}{
		{`"abc"`, `"abc"`, true},
		{`"abc", "def"`, `"abc"`, true},
		{`W/"abc"`, `"abc"`, true},
		{`"other"`, `"abc"`, false},
		{"*", `"abc"`, true},
		{"", `"abc"`, false},
		{`"abc"`, "", false},
	}

	for _, testCase := range cases {
		if got := etagMatches(testCase.header, testCase.etag); got != testCase.want {
			t.Errorf("etagMatches(%q, %q) = %v, want %v",
				testCase.header, testCase.etag, got, testCase.want)
		}
	}
}

func TestNotModifiedSinceComparesWholeSeconds(t *testing.T) {
	// HTTP dates have second resolution. An object written at 12:00:00.5 must not
	// be reported unchanged to a client that fetched at 12:00:00.
	modified := time.Date(2026, 3, 1, 12, 0, 0, 500_000_000, time.UTC)
	if notModifiedSince(modified.UTC().Format(http.TimeFormat), modified) {
		t.Fatal("a sub-second change was reported as unchanged")
	}
	if !notModifiedSince(modified.UTC().Format(http.TimeFormat), modified.Add(-time.Hour)) {
		t.Fatal("an hour-old copy was reported as stale")
	}
}

// --- URL building ---

func TestEscapeKeyPathKeepsSlashesAndEncodesTheRest(t *testing.T) {
	cases := map[string]string{
		"a.jpg":             "a.jpg",
		"photos/2026/a.png": "photos/2026/a.png",
		"my photo.jpg":      "my%20photo.jpg",
		"a?b.jpg":           "a%3Fb.jpg",
		"a#b.jpg":           "a%23b.jpg",
	}

	for key, want := range cases {
		if got := escapeKeyPath(key); got != want {
			t.Errorf("escapeKeyPath(%q) = %q, want %q", key, got, want)
		}
	}
}

func TestURLEncodeFilenameTakesTheLastSegment(t *testing.T) {
	if got := urlEncodeFilename("photos/2026/my photo.jpg"); got != "my%20photo.jpg" {
		t.Fatalf("urlEncodeFilename = %q", got)
	}
}

func TestPublicBaseURLPrefersForwardedHeaders(t *testing.T) {
	request := httptest.NewRequest(http.MethodGet, "http://internal:8080/pub/abc/x.jpg", nil)
	request.Header.Set("X-Forwarded-Proto", "https")
	request.Header.Set("X-Forwarded-Host", "moogo.dev")

	if got := publicBaseURL(request); got != "https://moogo.dev" {
		t.Fatalf("publicBaseURL = %q, want https://moogo.dev", got)
	}
}

func TestPublicBaseURLFallsBackToTheRequestHost(t *testing.T) {
	request := httptest.NewRequest(http.MethodGet, "http://localhost:8080/pub/abc/x.jpg", nil)
	if got := publicBaseURL(request); got != "http://localhost:8080" {
		t.Fatalf("publicBaseURL = %q", got)
	}
}

// --- download ---

func TestPublicDownloadServesAPublishedObject(t *testing.T) {
	plane, store, fs := testBucketPlane(t, 1<<20)
	bucket := store.addBucket("default")
	object := store.addObject(bucket, "logo.png", 4, "image/png")
	fs.contents["logo.png"] = []byte("PNG!")
	if _, err := store.SetObjectPublic(context.Background(), store.projectID, "logo.png", true); err != nil {
		t.Fatalf("publish: %v", err)
	}

	request := httptest.NewRequest(http.MethodGet, "/pub/x/logo.png", nil).WithContext(
		requestContext(store.projectID, "logo.png"),
	)
	recorder := httptest.NewRecorder()
	plane.PublicDownload(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200 (body %q)", recorder.Code, recorder.Body.String())
	}
	if recorder.Body.String() != "PNG!" {
		t.Fatalf("body = %q", recorder.Body.String())
	}
	if got := recorder.Header().Get("ETag"); got != object.ETag() {
		t.Fatalf("ETag = %q, want %q", got, object.ETag())
	}
	// A published object is cacheable; that is the point of publishing it.
	if got := recorder.Header().Get("Cache-Control"); !strings.Contains(got, "public") {
		t.Fatalf("Cache-Control = %q, want it to allow shared caching", got)
	}
	// The same-origin containment that stops an SVG from scripting the dashboard.
	if got := recorder.Header().Get("Content-Security-Policy"); !strings.Contains(got, "sandbox") {
		t.Fatalf("Content-Security-Policy = %q, want a sandbox directive", got)
	}
}

func TestPublicDownloadHidesPrivateObjectsBehindNotFound(t *testing.T) {
	plane, store, fs := testBucketPlane(t, 1<<20)
	bucket := store.addBucket("default")
	store.addObject(bucket, "secret.png", 4, "image/png")
	fs.contents["secret.png"] = []byte("PNG!")

	request := httptest.NewRequest(http.MethodGet, "/pub/x/secret.png", nil).WithContext(
		requestContext(store.projectID, "secret.png"),
	)
	recorder := httptest.NewRecorder()
	plane.PublicDownload(recorder, request)

	// 404 rather than 403: from outside, "private" and "does not exist" must look
	// the same, or the route becomes an existence oracle.
	if recorder.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want 404", recorder.Code)
	}
	if strings.Contains(recorder.Body.String(), "secret.png") {
		t.Fatalf("body leaked the key: %q", recorder.Body.String())
	}
}

func TestPublicDownloadMissesForAnUnknownKey(t *testing.T) {
	plane, store, _ := testBucketPlane(t, 1<<20)
	store.addBucket("default")

	request := httptest.NewRequest(http.MethodGet, "/pub/x/nope.png", nil).WithContext(
		requestContext(store.projectID, "nope.png"),
	)
	recorder := httptest.NewRecorder()
	plane.PublicDownload(recorder, request)

	if recorder.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want 404", recorder.Code)
	}
}

func TestDownloadAnswers304ForAnUnchangedObject(t *testing.T) {
	plane, store, fs := testBucketPlane(t, 1<<20)
	bucket := store.addBucket("default")
	object := store.addObject(bucket, "logo.png", 4, "image/png")
	fs.contents["logo.png"] = []byte("PNG!")

	request := httptest.NewRequest(http.MethodGet, "/bucket/x/logo.png", nil).WithContext(
		requestContext(store.projectID, "logo.png"),
	)
	request.Header.Set("If-None-Match", object.ETag())

	recorder := httptest.NewRecorder()
	plane.Download(recorder, request)

	if recorder.Code != http.StatusNotModified {
		t.Fatalf("status = %d, want 304", recorder.Code)
	}
	if recorder.Body.Len() != 0 {
		t.Fatalf("a 304 carried a body: %q", recorder.Body.String())
	}
}

func TestDownloadChangesETagAfterTheObjectIsReplaced(t *testing.T) {
	plane, store, fs := testBucketPlane(t, 1<<20)
	bucket := store.addBucket("default")
	before := store.addObject(bucket, "logo.png", 4, "image/png")
	fs.contents["logo.png"] = []byte("PNG!")

	request := httptest.NewRequest(http.MethodGet, "/bucket/x/logo.png", nil).WithContext(
		requestContext(store.projectID, "logo.png"),
	)
	request.Header.Set("If-None-Match", before.ETag())
	recorder := httptest.NewRecorder()
	plane.Download(recorder, request)
	if recorder.Code != http.StatusNotModified {
		t.Fatalf("status = %d, want 304 for the unchanged object", recorder.Code)
	}

	// Re-upload the same key with different bytes.
	fs.contents["logo.png"] = []byte("NEW!")
	if _, _, err := store.PutObject(
		context.Background(), store.projectID, bucket.ID, "logo.png", 4, "image/png",
		bucket.IsPublic,
	); err != nil {
		t.Fatalf("re-upload: %v", err)
	}

	// A client holding the old version must now be told to fetch again, or it
	// keeps showing the previous image for as long as the cache entry lives.
	request = httptest.NewRequest(http.MethodGet, "/bucket/x/logo.png", nil).WithContext(
		requestContext(store.projectID, "logo.png"),
	)
	request.Header.Set("If-None-Match", before.ETag())
	recorder = httptest.NewRecorder()
	plane.Download(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200 after the object was replaced", recorder.Code)
	}
	if recorder.Body.String() != "NEW!" {
		t.Fatalf("body = %q, want the new content", recorder.Body.String())
	}
}

func TestDownloadSetsContentLengthAsADecimalString(t *testing.T) {
	plane, store, fs := testBucketPlane(t, 1<<20)
	bucket := store.addBucket("default")
	// A size large enough that a rune conversion would produce a multi-byte
	// character rather than an ASCII digit.
	store.addObject(bucket, "big.bin", 4096, "application/octet-stream")
	fs.contents["big.bin"] = []byte(strings.Repeat("x", 4096))

	request := httptest.NewRequest(http.MethodGet, "/bucket/x/big.bin", nil).WithContext(
		requestContext(store.projectID, "big.bin"),
	)
	recorder := httptest.NewRecorder()
	plane.Download(recorder, request)

	if got := recorder.Header().Get("Content-Length"); got != "4096" {
		t.Fatalf("Content-Length = %q, want \"4096\"", got)
	}
}

func TestPrivateDownloadIsNotStoredByIntermediaries(t *testing.T) {
	plane, store, fs := testBucketPlane(t, 1<<20)
	bucket := store.addBucket("default")
	store.addObject(bucket, "secret.png", 4, "image/png")
	fs.contents["secret.png"] = []byte("PNG!")

	request := httptest.NewRequest(http.MethodGet, "/bucket/x/secret.png", nil).WithContext(
		requestContext(store.projectID, "secret.png"),
	)
	recorder := httptest.NewRecorder()
	plane.Download(recorder, request)

	got := recorder.Header().Get("Cache-Control")
	if strings.Contains(got, "public") || !strings.Contains(got, "private") {
		t.Fatalf("Cache-Control = %q, want a private directive for an authorized response", got)
	}
}

func TestActiveContentIsServedAsAnAttachment(t *testing.T) {
	plane, store, fs := testBucketPlane(t, 1<<20)
	bucket := store.addBucket("default")
	store.addObject(bucket, "page.html", 11, "text/html")
	fs.contents["page.html"] = []byte("<h1>hi</h1>")

	request := httptest.NewRequest(http.MethodGet, "/bucket/x/page.html", nil).WithContext(
		requestContext(store.projectID, "page.html"),
	)
	recorder := httptest.NewRecorder()
	plane.Download(recorder, request)

	disposition := recorder.Header().Get("Content-Disposition")
	if !strings.HasPrefix(disposition, "attachment") {
		t.Fatalf("Content-Disposition = %q, want an attachment so it is not rendered", disposition)
	}
}

func TestHeadReturnsTheHeadersWithoutABody(t *testing.T) {
	plane, store, fs := testBucketPlane(t, 1<<20)
	bucket := store.addBucket("default")
	store.addObject(bucket, "logo.png", 4, "image/png")
	fs.contents["logo.png"] = []byte("PNG!")

	request := httptest.NewRequest(http.MethodHead, "/bucket/x/logo.png", nil).WithContext(
		requestContext(store.projectID, "logo.png"),
	)
	recorder := httptest.NewRecorder()
	plane.Download(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", recorder.Code)
	}
	if recorder.Body.Len() != 0 {
		t.Fatalf("HEAD carried a body: %q", recorder.Body.String())
	}
	if recorder.Header().Get("Content-Length") == "" {
		t.Fatal("HEAD did not report a Content-Length")
	}
}

func TestDownloadOfACatalogRowWithoutAFileIsNotFound(t *testing.T) {
	plane, store, _ := testBucketPlane(t, 1<<20)
	bucket := store.addBucket("default")
	store.addObject(bucket, "ghost.png", 4, "image/png")
	// The file was never written, or was removed out of band.

	request := httptest.NewRequest(http.MethodGet, "/bucket/x/ghost.png", nil).WithContext(
		requestContext(store.projectID, "ghost.png"),
	)
	recorder := httptest.NewRecorder()
	plane.Download(recorder, request)

	if recorder.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want 404", recorder.Code)
	}
}

// --- upload ---

func TestUploadRecordsTheObjectAndStaysPrivate(t *testing.T) {
	plane, store, fs := testBucketPlane(t, 1<<20)
	store.addBucket("default")

	request := httptest.NewRequest(
		http.MethodPost, "/bucket/x/logo.png", strings.NewReader("PNG!"),
	).WithContext(requestContext(store.projectID, "logo.png"))
	request.Header.Set("Content-Type", "image/png")
	recorder := httptest.NewRecorder()
	plane.Upload(recorder, request)

	if recorder.Code != http.StatusCreated {
		t.Fatalf("status = %d, want 201 (body %q)", recorder.Code, recorder.Body.String())
	}

	var response struct {
		Object struct {
			Key       string `json:"key"`
			IsPublic  bool   `json:"is_public"`
			PublicURL string `json:"public_url"`
			URL       string `json:"url"`
		} `json:"object"`
	}
	decodeBody(t, recorder, &response)

	if response.Object.Key != "logo.png" {
		t.Fatalf("key = %q", response.Object.Key)
	}
	// A fresh upload must not be published. Visibility is a deliberate act.
	if response.Object.IsPublic {
		t.Fatal("a fresh upload came back public")
	}
	if response.Object.PublicURL != "" {
		t.Fatalf("public_url = %q, want empty for a private object", response.Object.PublicURL)
	}
	if !strings.HasSuffix(response.Object.URL, "/logo.png") {
		t.Fatalf("url = %q", response.Object.URL)
	}
	if got := string(fs.contents["logo.png"]); got != "PNG!" {
		t.Fatalf("stored content = %q", got)
	}
}

func TestUploadRefusesAnOversizedBodyBeforeWriting(t *testing.T) {
	plane, store, fs := testBucketPlane(t, 10)
	store.addBucket("default")

	// Content-Length says 100 bytes into a 10-byte budget.
	request := httptest.NewRequest(
		http.MethodPost, "/bucket/x/big.bin", strings.NewReader(strings.Repeat("x", 100)),
	).WithContext(requestContext(store.projectID, "big.bin"))
	recorder := httptest.NewRecorder()
	plane.Upload(recorder, request)

	if recorder.Code != http.StatusInsufficientStorage {
		t.Fatalf("status = %d, want 507", recorder.Code)
	}
	// Nothing reached the disk, which is the whole point of the pre-flight.
	if len(fs.contents) != 0 {
		t.Fatalf("a refused upload wrote %d objects", len(fs.contents))
	}
	if store.putCalls != 0 {
		t.Fatal("a refused upload recorded catalog metadata")
	}
}

func TestUploadRefusesAnUndeclaredOversizedBody(t *testing.T) {
	plane, store, fs := testBucketPlane(t, 10)
	store.addBucket("default")

	// A chunked request declares no length, so only the post-write comparison can
	// catch it.
	request := httptest.NewRequest(
		http.MethodPost, "/bucket/x/big.bin", strings.NewReader(strings.Repeat("x", 100)),
	).WithContext(requestContext(store.projectID, "big.bin"))
	request.ContentLength = -1
	recorder := httptest.NewRecorder()
	plane.Upload(recorder, request)

	if recorder.Code != http.StatusInsufficientStorage {
		t.Fatalf("status = %d, want 507", recorder.Code)
	}
	if len(fs.contents) != 0 {
		t.Fatalf("the rejected upload left %d objects on disk", len(fs.contents))
	}
}

func TestUploadCountsAnOverwriteAgainstTheQuotaOnce(t *testing.T) {
	plane, store, _ := testBucketPlane(t, 100)
	bucket := store.addBucket("default")
	store.addObject(bucket, "a.bin", 60, "application/octet-stream")

	// Replacing the 60-byte object with a 50-byte one must leave 50 bytes used,
	// not 110. The previous size has to be subtracted, or a project that
	// overwrites its files slowly loses its quota to accounting alone.
	request := httptest.NewRequest(
		http.MethodPost, "/bucket/x/a.bin", strings.NewReader(strings.Repeat("y", 50)),
	).WithContext(requestContext(store.projectID, "a.bin"))
	recorder := httptest.NewRecorder()
	plane.Upload(recorder, request)

	if recorder.Code != http.StatusCreated {
		t.Fatalf("status = %d, want 201 (body %q)", recorder.Code, recorder.Body.String())
	}

	used, err := store.StorageUsedBytes(context.Background(), store.projectID)
	if err != nil {
		t.Fatalf("usage: %v", err)
	}
	if used != 50 {
		t.Fatalf("used = %d, want 50", used)
	}
}

func TestUploadCreatesTheDefaultBucketButNotAnArbitraryOne(t *testing.T) {
	plane, store, _ := testBucketPlane(t, 1<<20)

	request := httptest.NewRequest(
		http.MethodPost, "/bucket/x/a.txt", strings.NewReader("hello"),
	).WithContext(requestContext(store.projectID, "a.txt"))
	recorder := httptest.NewRecorder()
	plane.Upload(recorder, request)
	if recorder.Code != http.StatusCreated {
		t.Fatalf("status = %d, want 201", recorder.Code)
	}
	if _, ok := store.buckets[defaultBucketName]; !ok {
		t.Fatal("the default bucket was not created")
	}

	// A typo'd bucket name must not silently scatter objects into a new bucket.
	request = httptest.NewRequest(
		http.MethodPost, "/bucket/x/b.txt?bucket=typo", strings.NewReader("hello"),
	).WithContext(requestContext(store.projectID, "b.txt"))
	recorder = httptest.NewRecorder()
	plane.Upload(recorder, request)
	if recorder.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want 404 for a bucket that does not exist", recorder.Code)
	}
}

func TestUploadIntoANamedBucket(t *testing.T) {
	plane, store, _ := testBucketPlane(t, 1<<20)
	store.addBucket("images")

	request := httptest.NewRequest(
		http.MethodPost, "/bucket/x/logo.png?bucket=images", strings.NewReader("PNG!"),
	).WithContext(requestContext(store.projectID, "logo.png"))
	recorder := httptest.NewRecorder()
	plane.Upload(recorder, request)

	if recorder.Code != http.StatusCreated {
		t.Fatalf("status = %d, want 201 (body %q)", recorder.Code, recorder.Body.String())
	}

	var response struct {
		Object struct {
			Bucket string `json:"bucket"`
		} `json:"object"`
	}
	decodeBody(t, recorder, &response)
	if response.Object.Bucket != "images" {
		t.Fatalf("bucket = %q, want images", response.Object.Bucket)
	}
}

// --- visibility ---

func TestSetPublicTogglesTheObjectAndReportsTheURL(t *testing.T) {
	plane, store, _ := testBucketPlane(t, 1<<20)
	bucket := store.addBucket("default")
	store.addObject(bucket, "logo.png", 4, "image/png")

	request := httptest.NewRequest(
		http.MethodPatch, "/bucket/x/logo.png", strings.NewReader(`{"is_public":true}`),
	).WithContext(requestContext(store.projectID, "logo.png"))
	recorder := httptest.NewRecorder()
	plane.Update(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200 (body %q)", recorder.Code, recorder.Body.String())
	}

	var response struct {
		Object struct {
			IsPublic  bool   `json:"is_public"`
			PublicURL string `json:"public_url"`
		} `json:"object"`
	}
	decodeBody(t, recorder, &response)
	if !response.Object.IsPublic {
		t.Fatal("is_public = false after publishing")
	}
	// The published URL is the one a user pastes into their own site.
	if !strings.Contains(response.Object.PublicURL, "/pub/") {
		t.Fatalf("public_url = %q, want a /pub/ path", response.Object.PublicURL)
	}
}

func TestSetPublicRequiresTheField(t *testing.T) {
	plane, store, _ := testBucketPlane(t, 1<<20)
	bucket := store.addBucket("default")
	store.addObject(bucket, "logo.png", 4, "image/png")

	// An empty body must not be read as "set it to false" and quietly unpublish.
	request := httptest.NewRequest(
		http.MethodPatch, "/bucket/x/logo.png", strings.NewReader(`{}`),
	).WithContext(requestContext(store.projectID, "logo.png"))
	recorder := httptest.NewRecorder()
	plane.Update(recorder, request)

	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", recorder.Code)
	}
}

func TestSetPublicRefusesAnUnknownField(t *testing.T) {
	plane, store, _ := testBucketPlane(t, 1<<20)
	bucket := store.addBucket("default")
	store.addObject(bucket, "logo.png", 4, "image/png")

	// A misspelled flag that was silently ignored would report success while
	// leaving the object private.
	request := httptest.NewRequest(
		http.MethodPatch, "/bucket/x/logo.png", strings.NewReader(`{"is_pubic":true}`),
	).WithContext(requestContext(store.projectID, "logo.png"))
	recorder := httptest.NewRecorder()
	plane.Update(recorder, request)

	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", recorder.Code)
	}
}

// --- rename ---

func TestRenameMovesTheFileAndTheRow(t *testing.T) {
	plane, store, fs := testBucketPlane(t, 1<<20)
	bucket := store.addBucket("default")
	store.addObject(bucket, "old.png", 4, "image/png")
	fs.contents["old.png"] = []byte("PNG!")

	request := httptest.NewRequest(
		http.MethodPatch, "/bucket/x/old.png", strings.NewReader(`{"new_key":"new.png"}`),
	).WithContext(requestContext(store.projectID, "old.png"))
	recorder := httptest.NewRecorder()
	plane.Update(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200 (body %q)", recorder.Code, recorder.Body.String())
	}
	if _, ok := fs.contents["new.png"]; !ok {
		t.Fatal("the file did not move on disk")
	}
	if _, ok := fs.contents["old.png"]; ok {
		t.Fatal("the file is still under the old key")
	}
	if _, ok := store.objects["new.png"]; !ok {
		t.Fatal("the catalog row did not move")
	}
}

func TestRenameKeepsVisibility(t *testing.T) {
	plane, store, fs := testBucketPlane(t, 1<<20)
	bucket := store.addBucket("default")
	store.addObject(bucket, "old.png", 4, "image/png")
	fs.contents["old.png"] = []byte("PNG!")
	if _, err := store.SetObjectPublic(
		context.Background(), store.projectID, "old.png", true,
	); err != nil {
		t.Fatalf("publish: %v", err)
	}

	request := httptest.NewRequest(
		http.MethodPatch, "/bucket/x/old.png", strings.NewReader(`{"new_key":"new.png"}`),
	).WithContext(requestContext(store.projectID, "old.png"))
	recorder := httptest.NewRecorder()
	plane.Update(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200 (body %q)", recorder.Code, recorder.Body.String())
	}

	var response struct {
		Object struct {
			IsPublic bool `json:"is_public"`
		} `json:"object"`
	}
	decodeBody(t, recorder, &response)
	if !response.Object.IsPublic {
		t.Fatal("renaming un-published the object")
	}
}

func TestRenameOntoATakenKeyReportsAConflict(t *testing.T) {
	plane, store, fs := testBucketPlane(t, 1<<20)
	bucket := store.addBucket("default")
	store.addObject(bucket, "a.png", 4, "image/png")
	store.addObject(bucket, "b.png", 4, "image/png")
	fs.contents["a.png"] = []byte("A")
	fs.contents["b.png"] = []byte("B")

	request := httptest.NewRequest(
		http.MethodPatch, "/bucket/x/a.png", strings.NewReader(`{"new_key":"b.png"}`),
	).WithContext(requestContext(store.projectID, "a.png"))
	recorder := httptest.NewRecorder()
	plane.Update(recorder, request)

	if recorder.Code != http.StatusConflict {
		t.Fatalf("status = %d, want 409", recorder.Code)
	}
	// The file must go back to where the catalog still says it is, or it becomes
	// an orphan that occupies quota and cannot be downloaded.
	if _, ok := fs.contents["a.png"]; !ok {
		t.Fatal("the rollback did not put the file back")
	}
	if fs.moves != 2 {
		t.Fatalf("moves = %d, want 2 (forward then rollback)", fs.moves)
	}
}

// --- delete ---

func TestDeletePrefixRemovesEverythingBeneathIt(t *testing.T) {
	plane, store, fs := testBucketPlane(t, 1<<20)
	bucket := store.addBucket("default")
	store.addObject(bucket, "photos/2026/a.png", 4, "image/png")
	store.addObject(bucket, "photos/2026/b.png", 4, "image/png")
	store.addObject(bucket, "photos/keep.png", 4, "image/png")
	fs.contents["photos/2026/a.png"] = []byte("A")
	fs.contents["photos/2026/b.png"] = []byte("B")
	fs.contents["photos/keep.png"] = []byte("K")

	request := httptest.NewRequest(
		http.MethodDelete, "/bucket/x/photos/2026/?prefix=true", nil,
	).WithContext(requestContext(store.projectID, "photos/2026/"))
	recorder := httptest.NewRecorder()
	plane.Delete(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", recorder.Code)
	}
	if _, ok := store.objects["photos/keep.png"]; !ok {
		t.Fatal("a key outside the prefix was deleted")
	}
	if _, ok := fs.contents["photos/2026/a.png"]; ok {
		t.Fatal("a matching file was left on disk")
	}
}

// --- listing ---

func TestListReturnsTheSelectedBucketOnly(t *testing.T) {
	plane, store, _ := testBucketPlane(t, 1<<20)
	defaults := store.addBucket("default")
	images := store.addBucket("images")
	store.addObject(defaults, "a.png", 4, "image/png")
	store.addObject(images, "b.png", 4, "image/png")

	request := httptest.NewRequest(
		http.MethodGet, "/bucket/x?bucket=images", nil,
	).WithContext(requestContext(store.projectID, ""))
	recorder := httptest.NewRecorder()
	plane.List(recorder, request)

	var response struct {
		Bucket struct {
			Name string `json:"name"`
		} `json:"bucket"`
		Objects []struct {
			Key string `json:"key"`
		} `json:"objects"`
		Total int64 `json:"total"`
	}
	decodeBody(t, recorder, &response)

	if response.Bucket.Name != "images" {
		t.Fatalf("bucket = %q, want images", response.Bucket.Name)
	}
	if len(response.Objects) != 1 || response.Objects[0].Key != "b.png" {
		t.Fatalf("objects = %+v, want only b.png", response.Objects)
	}
	if response.Total != 1 {
		t.Fatalf("total = %d, want 1", response.Total)
	}
}

func TestListBucketsReportsCountsAndSizes(t *testing.T) {
	plane, store, _ := testBucketPlane(t, 1<<20)
	empty := store.addBucket("empty")
	images := store.addBucket("images")
	store.addObject(images, "a.png", 100, "image/png")
	store.addObject(images, "b.png", 50, "image/png")

	request := httptest.NewRequest(http.MethodGet, "/buckets/x", nil).WithContext(
		requestContext(store.projectID, ""),
	)
	recorder := httptest.NewRecorder()
	plane.ListBuckets(recorder, request)

	var response struct {
		Buckets []struct {
			Name        string `json:"name"`
			ObjectCount int64  `json:"object_count"`
			SizeBytes   int64  `json:"size_bytes"`
		} `json:"buckets"`
	}
	decodeBody(t, recorder, &response)

	if len(response.Buckets) != 2 {
		t.Fatalf("buckets = %d, want 2", len(response.Buckets))
	}
	byName := map[string]int64{}
	for _, bucket := range response.Buckets {
		byName[bucket.Name] = bucket.ObjectCount
	}
	// An empty bucket still appears. A bucket that vanishes from the list when it
	// has no objects is indistinguishable from one that was deleted.
	if _, ok := byName["empty"]; !ok {
		t.Fatal("the empty bucket is missing from the list")
	}
	if byName["images"] != 2 {
		t.Fatalf("images count = %d, want 2", byName["images"])
	}
	_ = empty
}

func TestCreateBucketRejectsABadName(t *testing.T) {
	plane, store, _ := testBucketPlane(t, 1<<20)

	request := httptest.NewRequest(
		http.MethodPost, "/buckets/x", strings.NewReader(`{"name":"Not Valid"}`),
	).WithContext(requestContext(store.projectID, ""))
	recorder := httptest.NewRecorder()
	plane.CreateBucket(recorder, request)

	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", recorder.Code)
	}
	if len(store.buckets) != 0 {
		t.Fatal("a bucket was created despite the invalid name")
	}
}

func TestDeleteBucketRemovesItsObjectsFromDisk(t *testing.T) {
	plane, store, fs := testBucketPlane(t, 1<<20)
	bucket := store.addBucket("images")
	store.addObject(bucket, "a.png", 4, "image/png")
	store.addObject(bucket, "b.png", 4, "image/png")
	fs.contents["a.png"] = []byte("A")
	fs.contents["b.png"] = []byte("B")

	request := bucketRequest(
		http.MethodDelete, "/buckets/x/"+bucket.ID.String(), nil,
		store.projectID, bucket.ID,
	)
	recorder := httptest.NewRecorder()
	plane.DeleteBucket(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200 (body %q)", recorder.Code, recorder.Body.String())
	}
	// The files have to go too: the catalog rows cascade away, and anything left
	// on disk would occupy quota that nothing can ever reclaim.
	if len(fs.contents) != 0 {
		t.Fatalf("%d files were orphaned by the bucket delete", len(fs.contents))
	}
}

func TestDeleteUnknownBucketIsNotFound(t *testing.T) {
	plane, store, _ := testBucketPlane(t, 1<<20)

	request := bucketRequest(
		http.MethodDelete, "/buckets/x/"+uuid.NewString(), nil,
		store.projectID, uuid.New(),
	)
	recorder := httptest.NewRecorder()
	plane.DeleteBucket(recorder, request)

	if recorder.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want 404", recorder.Code)
	}
}

func TestSetBucketPublicAppliesToEveryObject(t *testing.T) {
	plane, store, _ := testBucketPlane(t, 1<<20)
	bucket := store.addBucket("images")
	store.addObject(bucket, "a.png", 4, "image/png")
	store.addObject(bucket, "b.png", 4, "image/png")

	request := bucketRequest(
		http.MethodPost,
		"/buckets/x/"+bucket.ID.String()+"/public",
		strings.NewReader(`{"is_public":true}`),
		store.projectID, bucket.ID,
	)
	recorder := httptest.NewRecorder()
	plane.SetBucketPublic(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200 (body %q)", recorder.Code, recorder.Body.String())
	}
	for key, object := range store.objects {
		if !object.IsPublic {
			t.Fatalf("%s is still private", key)
		}
	}
}

// --- upload policy ---

func TestUploadRefusesAMediaTypeTheBucketExcludes(t *testing.T) {
	plane, store, fs := testBucketPlane(t, 1<<20)
	bucket := store.addBucket("images")
	bucket.AllowedTypes = []string{dbcontrol.AllowedImage}

	request := httptest.NewRequest(
		http.MethodPost, "/bucket/x/archive.zip?bucket=images", strings.NewReader("PK"),
	).WithContext(requestContext(store.projectID, "archive.zip"))
	request.Header.Set("Content-Type", "application/zip")
	recorder := httptest.NewRecorder()
	plane.Upload(recorder, request)

	// 415 rather than 400: the request is well-formed, it is the representation
	// the bucket does not accept.
	if recorder.Code != http.StatusUnsupportedMediaType {
		t.Fatalf("status = %d, want 415 (body %q)", recorder.Code, recorder.Body.String())
	}
	if len(fs.contents) != 0 {
		t.Fatal("a refused upload wrote to disk")
	}
	if store.putCalls != 0 {
		t.Fatal("a refused upload recorded catalog metadata")
	}
}

func TestUploadAcceptsEachMediaClassItsBucketAllows(t *testing.T) {
	cases := []struct {
		allowed     []string
		contentType string
		accept      bool
	}{
		{[]string{dbcontrol.AllowedAny}, "image/png", true},
		{[]string{dbcontrol.AllowedAny}, "video/mp4", true},
		{[]string{dbcontrol.AllowedAny}, "application/zip", true},

		{[]string{dbcontrol.AllowedImage}, "image/png", true},
		{[]string{dbcontrol.AllowedImage}, "image/jpeg", true},
		{[]string{dbcontrol.AllowedImage}, "video/mp4", false},
		{[]string{dbcontrol.AllowedImage}, "application/pdf", false},

		{[]string{dbcontrol.AllowedVideo}, "video/mp4", true},
		{[]string{dbcontrol.AllowedVideo}, "image/png", false},

		// Audio was the class with nowhere to go before: a bucket taking images
		// had no reason to accept an mp3, and one taking "file" did, but nothing
		// could say so.
		{[]string{dbcontrol.AllowedAudio}, "audio/mpeg", true},
		{[]string{dbcontrol.AllowedAudio}, "image/png", false},
		{[]string{dbcontrol.AllowedImage, dbcontrol.AllowedAudio}, "audio/mpeg", true},
		{[]string{dbcontrol.AllowedImage, dbcontrol.AllowedAudio}, "audio/mpeg", true},
		{[]string{dbcontrol.AllowedImage, dbcontrol.AllowedAudio}, "video/mp4", false},
		{[]string{dbcontrol.AllowedImage, dbcontrol.AllowedVideo}, "image/png", true},
		{[]string{dbcontrol.AllowedImage, dbcontrol.AllowedVideo}, "video/mp4", true},
		{[]string{dbcontrol.AllowedImage, dbcontrol.AllowedVideo}, "audio/mpeg", false},

		{[]string{dbcontrol.AllowedDocument}, "application/pdf", true},
		{[]string{dbcontrol.AllowedDocument}, "text/csv", true},
		{[]string{dbcontrol.AllowedDocument}, "image/png", false},
		// A zip is an archive even when it is really a document underneath.
		{[]string{dbcontrol.AllowedArchive}, "application/zip", true},
		{[]string{dbcontrol.AllowedArchive}, "application/pdf", false},

		// "file" is now the class of everything none of the other categories
		// claim, rather than the complement of image and video. It used to accept
		// a PDF, and it does not any more: a user who wants documents ticks
		// Documents, and a bucket whose policy silently kept accepting them under
		// "file" would make the new checkbox meaningless.
		{[]string{dbcontrol.AllowedFile}, "application/octet-stream", true},
		{[]string{dbcontrol.AllowedFile}, "font/woff2", true},
		{[]string{dbcontrol.AllowedFile}, "application/pdf", false},
		{[]string{dbcontrol.AllowedFile}, "application/zip", false},
		{[]string{dbcontrol.AllowedFile}, "image/png", false},
		{[]string{dbcontrol.AllowedFile}, "video/mp4", false},
		{[]string{dbcontrol.AllowedFile}, "audio/mpeg", false},
	}

	for _, testCase := range cases {
		plane, store, _ := testBucketPlane(t, 1<<20)
		bucket := store.addBucket("assets")
		bucket.AllowedTypes = testCase.allowed

		request := httptest.NewRequest(
			http.MethodPost, "/bucket/x/f.bin?bucket=assets", strings.NewReader("body"),
		).WithContext(requestContext(store.projectID, "f.bin"))
		request.Header.Set("Content-Type", testCase.contentType)
		recorder := httptest.NewRecorder()
		plane.Upload(recorder, request)

		accepted := recorder.Code == http.StatusCreated
		if accepted != testCase.accept {
			t.Errorf("allowed_types=%v content_type=%s: accepted=%v, want %v (status %d)",
				testCase.allowed, testCase.contentType, accepted, testCase.accept, recorder.Code)
		}
	}
}

func TestUploadIgnoresParametersInTheContentType(t *testing.T) {
	// A browser sends "image/png" but an API client may send a charset with it,
	// and "image/png; charset=binary" is still an image.
	plane, store, _ := testBucketPlane(t, 1<<20)
	bucket := store.addBucket("images")
	bucket.AllowedTypes = []string{dbcontrol.AllowedImage}

	request := httptest.NewRequest(
		http.MethodPost, "/bucket/x/a.png?bucket=images", strings.NewReader("body"),
	).WithContext(requestContext(store.projectID, "a.png"))
	request.Header.Set("Content-Type", "image/png; charset=binary")
	recorder := httptest.NewRecorder()
	plane.Upload(recorder, request)

	if recorder.Code != http.StatusCreated {
		t.Fatalf("status = %d, want 201", recorder.Code)
	}
}

func TestUploadRefusesAnObjectOverTheBucketSizeCap(t *testing.T) {
	// The project has room; the bucket does not. Reporting this as a full project
	// would send the user looking for space that already exists.
	plane, store, fs := testBucketPlane(t, 1000)
	bucket := store.addBucket("thumbs")
	bucket.MaxObjectSizeBytes = 10

	request := httptest.NewRequest(
		http.MethodPost, "/bucket/x/big.png?bucket=thumbs",
		strings.NewReader(strings.Repeat("x", 100)),
	).WithContext(requestContext(store.projectID, "big.png"))
	recorder := httptest.NewRecorder()
	plane.Upload(recorder, request)

	if recorder.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("status = %d, want 413 (body %q)", recorder.Code, recorder.Body.String())
	}
	if len(fs.contents) != 0 {
		t.Fatal("the refused object was left on disk")
	}
}

func TestUploadEnforcesTheSizeCapWithoutAContentLength(t *testing.T) {
	plane, store, fs := testBucketPlane(t, 1000)
	bucket := store.addBucket("thumbs")
	bucket.MaxObjectSizeBytes = 10

	request := httptest.NewRequest(
		http.MethodPost, "/bucket/x/big.png?bucket=thumbs",
		strings.NewReader(strings.Repeat("x", 100)),
	).WithContext(requestContext(store.projectID, "big.png"))
	request.ContentLength = -1
	recorder := httptest.NewRecorder()
	plane.Upload(recorder, request)

	if recorder.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("status = %d, want 413 (body %q)", recorder.Code, recorder.Body.String())
	}
	if len(fs.contents) != 0 {
		t.Fatal("an undeclared oversized upload left a file on disk")
	}
}

func TestUploadAcceptsAnObjectExactlyAtTheCap(t *testing.T) {
	// Off-by-one: a limit of 10 that refuses 10 bytes is a limit of 9.
	plane, store, _ := testBucketPlane(t, 1000)
	bucket := store.addBucket("thumbs")
	bucket.MaxObjectSizeBytes = 10

	request := httptest.NewRequest(
		http.MethodPost, "/bucket/x/exact.bin?bucket=thumbs",
		strings.NewReader(strings.Repeat("x", 10)),
	).WithContext(requestContext(store.projectID, "exact.bin"))
	recorder := httptest.NewRecorder()
	plane.Upload(recorder, request)

	if recorder.Code != http.StatusCreated {
		t.Fatalf("status = %d, want 201 (body %q)", recorder.Code, recorder.Body.String())
	}
}

func TestUploadAppliesBothTheBucketCapAndTheProjectQuota(t *testing.T) {
	// The stricter of the two wins, and each failure is reported as itself: a
	// bucket capped at 1 KB inside a 20-byte project must not blame the project
	// for an object the bucket refused.
	plane, store, _ := testBucketPlane(t, 20)
	bucket := store.addBucket("thumbs")
	bucket.MaxObjectSizeBytes = 1 << 20

	// Over the project, under the bucket: 507.
	request := httptest.NewRequest(
		http.MethodPost, "/bucket/x/big.bin?bucket=thumbs",
		strings.NewReader(strings.Repeat("x", 100)),
	).WithContext(requestContext(store.projectID, "big.bin"))
	recorder := httptest.NewRecorder()
	plane.Upload(recorder, request)
	if recorder.Code != http.StatusInsufficientStorage {
		t.Fatalf("project case: status = %d, want 507", recorder.Code)
	}

	// Over the bucket, under the project: 413.
	bucket.MaxObjectSizeBytes = 10
	request = httptest.NewRequest(
		http.MethodPost, "/bucket/x/small.bin?bucket=thumbs",
		strings.NewReader(strings.Repeat("x", 15)),
	).WithContext(requestContext(store.projectID, "small.bin"))
	recorder = httptest.NewRecorder()
	plane.Upload(recorder, request)
	if recorder.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("bucket case: status = %d, want 413", recorder.Code)
	}
}

// --- policy settings ---

func TestUpdatePolicyStoresBothSettings(t *testing.T) {
	plane, store, _ := testBucketPlane(t, 1<<20)
	bucket := store.addBucket("images")

	request := bucketRequest(
		http.MethodPatch,
		"/buckets/x/"+bucket.ID.String(),
		strings.NewReader(`{"allowed_types":["image"],"max_object_size_bytes":5242880}`),
		store.projectID, bucket.ID,
	)
	recorder := httptest.NewRecorder()
	plane.UpdateBucketSettings(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200 (body %q)", recorder.Code, recorder.Body.String())
	}

	var response struct {
		Bucket struct {
			AllowedTypes       []string `json:"allowed_types"`
			MaxObjectSizeBytes int64    `json:"max_object_size_bytes"`
		} `json:"bucket"`
	}
	decodeBody(t, recorder, &response)

	if !slices.Equal(response.Bucket.AllowedTypes, []string{dbcontrol.AllowedImage}) {
		t.Fatalf("allowed_types = %v", response.Bucket.AllowedTypes)
	}
	if response.Bucket.MaxObjectSizeBytes != 5*1024*1024 {
		t.Fatalf("max_object_size_bytes = %d", response.Bucket.MaxObjectSizeBytes)
	}
}

func TestUpdatePolicyKeepsTheSettingItWasNotAskedToChange(t *testing.T) {
	plane, store, _ := testBucketPlane(t, 1<<20)
	bucket := store.addBucket("images")
	bucket.AllowedTypes = []string{dbcontrol.AllowedImage}
	bucket.MaxObjectSizeBytes = 4096

	// Changing only the size must not silently reset the type to "any".
	request := bucketRequest(
		http.MethodPatch,
		"/buckets/x/"+bucket.ID.String(),
		strings.NewReader(`{"max_object_size_bytes":8192}`),
		store.projectID, bucket.ID,
	)
	recorder := httptest.NewRecorder()
	plane.UpdateBucketSettings(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200 (body %q)", recorder.Code, recorder.Body.String())
	}

	var response struct {
		Bucket struct {
			AllowedTypes       []string `json:"allowed_types"`
			MaxObjectSizeBytes int64    `json:"max_object_size_bytes"`
		} `json:"bucket"`
	}
	decodeBody(t, recorder, &response)

	if !slices.Equal(response.Bucket.AllowedTypes, []string{dbcontrol.AllowedImage}) {
		t.Fatalf("allowed_types = %v, want it left at image", response.Bucket.AllowedTypes)
	}
	if response.Bucket.MaxObjectSizeBytes != 8192 {
		t.Fatalf("max_object_size_bytes = %d, want 8192", response.Bucket.MaxObjectSizeBytes)
	}
}

func TestUpdatePolicyCanRemoveTheSizeCap(t *testing.T) {
	plane, store, _ := testBucketPlane(t, 1<<20)
	bucket := store.addBucket("images")
	bucket.MaxObjectSizeBytes = 4096

	// Zero is a request to lift the cap, not an attempt to set a zero-byte one.
	request := bucketRequest(
		http.MethodPatch,
		"/buckets/x/"+bucket.ID.String(),
		strings.NewReader(`{"max_object_size_bytes":0}`),
		store.projectID, bucket.ID,
	)
	recorder := httptest.NewRecorder()
	plane.UpdateBucketSettings(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200 (body %q)", recorder.Code, recorder.Body.String())
	}

	var response struct {
		Bucket struct {
			MaxObjectSizeBytes int64 `json:"max_object_size_bytes"`
		} `json:"bucket"`
	}
	decodeBody(t, recorder, &response)
	if response.Bucket.MaxObjectSizeBytes != 0 {
		t.Fatalf("max_object_size_bytes = %d, want 0 for no cap", response.Bucket.MaxObjectSizeBytes)
	}
}

func TestUpdatePolicyRejectsBadValues(t *testing.T) {
	cases := []struct {
		name string
		body string
	}{
		{"unknown type", `{"allowed_types":["documents"]}`},
		{"negative size", `{"max_object_size_bytes":-1}`},
		{"empty body", `{}`},
	}

	for _, testCase := range cases {
		plane, store, _ := testBucketPlane(t, 1<<20)
		bucket := store.addBucket("images")

		request := bucketRequest(
			http.MethodPatch,
			"/buckets/x/"+bucket.ID.String(),
			strings.NewReader(testCase.body),
			store.projectID, bucket.ID,
		)
		recorder := httptest.NewRecorder()
		plane.UpdateBucketSettings(recorder, request)

		if recorder.Code != http.StatusBadRequest {
			t.Errorf("%s: status = %d, want 400 (body %q)",
				testCase.name, recorder.Code, recorder.Body.String())
		}
	}
}

func TestUpdatePolicyOnAnUnknownBucketIsNotFound(t *testing.T) {
	plane, store, _ := testBucketPlane(t, 1<<20)
	store.addBucket("images")

	request := bucketRequest(
		http.MethodPatch,
		"/buckets/x/"+uuid.NewString(),
		strings.NewReader(`{"allowed_types":["image"]}`),
		store.projectID, uuid.New(),
	)
	recorder := httptest.NewRecorder()
	plane.UpdateBucketSettings(recorder, request)

	if recorder.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want 404 (body %q)", recorder.Code, recorder.Body.String())
	}
}

func TestBucketListingReportsThePolicy(t *testing.T) {
	plane, store, _ := testBucketPlane(t, 1<<20)
	bucket := store.addBucket("images")
	bucket.AllowedTypes = []string{dbcontrol.AllowedVideo}
	bucket.MaxObjectSizeBytes = 1024

	request := httptest.NewRequest(http.MethodGet, "/buckets/x", nil).WithContext(
		requestContext(store.projectID, ""),
	)
	recorder := httptest.NewRecorder()
	plane.ListBuckets(recorder, request)

	var response struct {
		Buckets []struct {
			Name               string   `json:"name"`
			AllowedTypes       []string `json:"allowed_types"`
			MaxObjectSizeBytes int64    `json:"max_object_size_bytes"`
		} `json:"buckets"`
	}
	decodeBody(t, recorder, &response)

	if len(response.Buckets) != 1 {
		t.Fatalf("buckets = %d, want 1", len(response.Buckets))
	}
	if !slices.Equal(response.Buckets[0].AllowedTypes, []string{dbcontrol.AllowedVideo}) {
		t.Fatalf("allowed_types = %v", response.Buckets[0].AllowedTypes)
	}
	if response.Buckets[0].MaxObjectSizeBytes != 1024 {
		t.Fatalf("max_object_size_bytes = %d", response.Buckets[0].MaxObjectSizeBytes)
	}
}

func TestCreateBucketAppliesAPolicyFromTheRequest(t *testing.T) {
	plane, store, _ := testBucketPlane(t, 1<<20)

	request := httptest.NewRequest(
		http.MethodPost,
		"/buckets/x",
		strings.NewReader(`{"name":"images","allowed_types":["image"],"max_object_size_bytes":2048}`),
	).WithContext(requestContext(store.projectID, ""))
	recorder := httptest.NewRecorder()
	plane.CreateBucket(recorder, request)

	if recorder.Code != http.StatusCreated {
		t.Fatalf("status = %d, want 201 (body %q)", recorder.Code, recorder.Body.String())
	}

	var response struct {
		Bucket struct {
			AllowedTypes       []string `json:"allowed_types"`
			MaxObjectSizeBytes int64    `json:"max_object_size_bytes"`
		} `json:"bucket"`
	}
	decodeBody(t, recorder, &response)

	if !slices.Equal(response.Bucket.AllowedTypes, []string{dbcontrol.AllowedImage}) {
		t.Fatalf("allowed_types = %v", response.Bucket.AllowedTypes)
	}
	if response.Bucket.MaxObjectSizeBytes != 2048 {
		t.Fatalf("max_object_size_bytes = %d", response.Bucket.MaxObjectSizeBytes)
	}
}

func TestCreateBucketDefaultsToAcceptingAnything(t *testing.T) {
	plane, store, _ := testBucketPlane(t, 1<<20)

	request := httptest.NewRequest(
		http.MethodPost, "/buckets/x", strings.NewReader(`{"name":"scratch"}`),
	).WithContext(requestContext(store.projectID, ""))
	recorder := httptest.NewRecorder()
	plane.CreateBucket(recorder, request)

	var response struct {
		Bucket struct {
			AllowedTypes []string `json:"allowed_types"`
		} `json:"bucket"`
	}
	decodeBody(t, recorder, &response)

	// A bucket created without a policy must behave as it did before the feature
	// existed, or every existing workflow starts failing on an upload.
	if !slices.Equal(response.Bucket.AllowedTypes, []string{dbcontrol.AllowedAny}) {
		t.Fatalf("allowed_types = %v, want any", response.Bucket.AllowedTypes)
	}
}

// --- bucket visibility ---

func TestSetBucketPublicAlsoSetsTheBucketDefault(t *testing.T) {
	// The case 0009 exists for: a bucket marked public whose uploads land private
	// because the column the toggle wrote was not the one the upload read.
	plane, store, _ := testBucketPlane(t, 1<<20)
	bucket := store.addBucket("site")

	request := bucketRequest(
		http.MethodPost,
		"/buckets/x/"+bucket.ID.String()+"/public",
		strings.NewReader(`{"is_public":true}`),
		store.projectID, bucket.ID,
	)
	recorder := httptest.NewRecorder()
	plane.SetBucketPublic(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200 (body %q)", recorder.Code, recorder.Body.String())
	}
	if !bucket.IsPublic {
		t.Fatal("the bucket row itself is still private")
	}

	upload := httptest.NewRequest(
		http.MethodPost, "/bucket/x/logo.png?bucket=site", strings.NewReader("PNG"),
	).WithContext(requestContext(store.projectID, "logo.png"))
	upload.Header.Set("Content-Type", "image/png")
	uploadRecorder := httptest.NewRecorder()
	plane.Upload(uploadRecorder, upload)

	if uploadRecorder.Code != http.StatusCreated {
		t.Fatalf("upload status = %d, want 201 (body %q)",
			uploadRecorder.Code, uploadRecorder.Body.String())
	}
	if !store.objects["logo.png"].IsPublic {
		t.Fatal("an object uploaded into a public bucket came out private")
	}
}

func TestUploadIntoAPrivateBucketStaysPrivate(t *testing.T) {
	plane, store, _ := testBucketPlane(t, 1<<20)
	bucket := store.addBucket("site")
	bucket.IsPublic = false

	upload := httptest.NewRequest(
		http.MethodPost, "/bucket/x/logo.png?bucket=site", strings.NewReader("PNG"),
	).WithContext(requestContext(store.projectID, "logo.png"))
	upload.Header.Set("Content-Type", "image/png")
	recorder := httptest.NewRecorder()
	plane.Upload(recorder, upload)

	if store.objects["logo.png"].IsPublic {
		t.Fatal("an object uploaded into a private bucket came out public")
	}
}

func TestReuploadKeepsTheObjectsOwnVisibility(t *testing.T) {
	// Replacing the bytes is not a decision to publish or unpublish. If the
	// upload re-seeded visibility from the bucket, replacing a file in a public
	// bucket would silently unpublish a file the user had made private.
	plane, store, _ := testBucketPlane(t, 1<<20)
	bucket := store.addBucket("site")
	bucket.IsPublic = true
	object := store.addObject(bucket, "logo.png", 4, "image/png")
	object.IsPublic = false

	upload := httptest.NewRequest(
		http.MethodPost, "/bucket/x/logo.png?bucket=site", strings.NewReader("NEW!"),
	).WithContext(requestContext(store.projectID, "logo.png"))
	upload.Header.Set("Content-Type", "image/png")
	recorder := httptest.NewRecorder()
	plane.Upload(recorder, upload)

	if recorder.Code != http.StatusCreated {
		t.Fatalf("status = %d, want 201 (body %q)", recorder.Code, recorder.Body.String())
	}
	if store.objects["logo.png"].IsPublic {
		t.Fatal("re-uploading republished an object the user had made private")
	}
}

func TestUnpublishingFromSettingsReachesExistingObjects(t *testing.T) {
	plane, store, _ := testBucketPlane(t, 1<<20)
	bucket := store.addBucket("site")
	bucket.IsPublic = true
	store.addObject(bucket, "a.png", 4, "image/png")
	store.addObject(bucket, "b.png", 4, "image/png")

	request := bucketRequest(
		http.MethodPatch,
		"/buckets/x/"+bucket.ID.String(),
		strings.NewReader(`{"is_public":false}`),
		store.projectID, bucket.ID,
	)
	recorder := httptest.NewRecorder()
	plane.UpdateBucketSettings(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200 (body %q)", recorder.Code, recorder.Body.String())
	}
	for key, object := range store.objects {
		if object.IsPublic {
			t.Fatalf("%s is still served from a bucket that was unpublished", key)
		}
	}
}

// --- per-bucket quota ---

func TestUploadRefusesAnObjectOverTheBucketQuota(t *testing.T) {
	// The project has plenty of room and this bucket does not. Answering with the
	// project's quota error sends the user to look for space that already exists.
	plane, store, fs := testBucketPlane(t, 1<<20)
	bucket := store.addBucket("images")
	bucket.QuotaBytes = 8
	store.addObject(bucket, "big.png", 8, "image/png")

	request := httptest.NewRequest(
		http.MethodPost, "/bucket/x/next.png?bucket=images", strings.NewReader("12345"),
	).WithContext(requestContext(store.projectID, "next.png"))
	request.Header.Set("Content-Type", "image/png")
	recorder := httptest.NewRecorder()
	plane.Upload(recorder, request)

	if recorder.Code != http.StatusInsufficientStorage {
		t.Fatalf("status = %d, want 507 (body %q)", recorder.Code, recorder.Body.String())
	}
	if !strings.Contains(recorder.Body.String(), "bucket_quota_exceeded") {
		t.Fatalf("body = %q, want the bucket-specific code", recorder.Body.String())
	}
	if store.putCalls != 0 {
		t.Fatal("a refused upload recorded catalog metadata")
	}
	if len(fs.contents) != 0 {
		t.Fatalf("on-disk objects = %d, want none written", len(fs.contents))
	}
}

func TestBucketQuotaIsIndependentOfTheProjectQuota(t *testing.T) {
	// Two buckets that each fit, together exceeding nothing: the point of a
	// per-bucket quota is that one bucket cannot starve the others.
	plane, store, _ := testBucketPlane(t, 1<<20)
	full := store.addBucket("full")
	full.QuotaBytes = 4
	store.addObject(full, "big.bin", 4, "application/octet-stream")

	other := store.addBucket("other")
	other.QuotaBytes = 4

	for _, testCase := range []struct {
		bucket string
		want   int
	}{
		{"full", http.StatusInsufficientStorage},
		{"other", http.StatusCreated},
	} {
		request := httptest.NewRequest(
			http.MethodPost,
			"/bucket/x/f.bin?bucket="+testCase.bucket,
			strings.NewReader("1234"),
		).WithContext(requestContext(store.projectID, testCase.bucket+"/f.bin"))
		request.Header.Set("Content-Type", "application/octet-stream")
		recorder := httptest.NewRecorder()
		plane.Upload(recorder, request)

		if recorder.Code != testCase.want {
			t.Errorf("bucket %s: status = %d, want %d (body %q)",
				testCase.bucket, recorder.Code, testCase.want, recorder.Body.String())
		}
	}
}

func TestReplacingAnObjectFreesItsBucketRoom(t *testing.T) {
	// A bucket at its quota must still be able to replace a file, or there is no
	// way back once it fills up.
	plane, store, _ := testBucketPlane(t, 1<<20)
	bucket := store.addBucket("images")
	bucket.QuotaBytes = 8
	store.addObject(bucket, "logo.png", 8, "image/png")

	request := httptest.NewRequest(
		http.MethodPost, "/bucket/x/logo.png?bucket=images", strings.NewReader("NEW"),
	).WithContext(requestContext(store.projectID, "logo.png"))
	request.Header.Set("Content-Type", "image/png")
	recorder := httptest.NewRecorder()
	plane.Upload(recorder, request)

	if recorder.Code != http.StatusCreated {
		t.Fatalf("status = %d, want 201 (body %q)", recorder.Code, recorder.Body.String())
	}
}

func TestShrinkingTheQuotaBelowUsageIsRefused(t *testing.T) {
	// Accepting it would leave every later upload refused with no way to tell
	// that apart from a full project.
	plane, store, _ := testBucketPlane(t, 1<<20)
	bucket := store.addBucket("images")
	bucket.QuotaBytes = 1024
	store.addObject(bucket, "a.png", 512, "image/png")

	request := bucketRequest(
		http.MethodPatch,
		"/buckets/x/"+bucket.ID.String(),
		strings.NewReader(`{"quota_bytes":256}`),
		store.projectID, bucket.ID,
	)
	recorder := httptest.NewRecorder()
	plane.UpdateBucketSettings(recorder, request)

	if recorder.Code != http.StatusConflict {
		t.Fatalf("status = %d, want 409 (body %q)", recorder.Code, recorder.Body.String())
	}
	if bucket.QuotaBytes != 1024 {
		t.Fatalf("quota_bytes = %d, want the old 1024 left alone", bucket.QuotaBytes)
	}
}

func TestUpdateSettingsStoresVisibilityAndQuotaTogether(t *testing.T) {
	plane, store, _ := testBucketPlane(t, 1<<20)
	bucket := store.addBucket("assets")

	request := bucketRequest(
		http.MethodPatch,
		"/buckets/x/"+bucket.ID.String(),
		strings.NewReader(
			`{"allowed_types":["image","video"],"max_object_size_bytes":5242880,`+
				`"is_public":true,"quota_bytes":786432}`),
		store.projectID, bucket.ID,
	)
	recorder := httptest.NewRecorder()
	plane.UpdateBucketSettings(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200 (body %q)", recorder.Code, recorder.Body.String())
	}

	var response struct {
		Bucket struct {
			AllowedTypes       []string `json:"allowed_types"`
			MaxObjectSizeBytes int64    `json:"max_object_size_bytes"`
			IsPublic           bool     `json:"is_public"`
			QuotaBytes         int64    `json:"quota_bytes"`
		} `json:"bucket"`
	}
	decodeBody(t, recorder, &response)

	if !slices.Equal(response.Bucket.AllowedTypes,
		[]string{dbcontrol.AllowedImage, dbcontrol.AllowedVideo}) {
		t.Fatalf("allowed_types = %v", response.Bucket.AllowedTypes)
	}
	if response.Bucket.MaxObjectSizeBytes != 5*1024*1024 {
		t.Fatalf("max_object_size_bytes = %d", response.Bucket.MaxObjectSizeBytes)
	}
	if !response.Bucket.IsPublic {
		t.Fatal("is_public = false, want true")
	}
	if response.Bucket.QuotaBytes != 786432 {
		t.Fatalf("quota_bytes = %d", response.Bucket.QuotaBytes)
	}
}

func TestNormalizeAllowedTypesRefusesAnyMixedWithAClass(t *testing.T) {
	// Dropping the other entry silently would turn a bucket the user meant to take
	// images and video into one that takes video only, with no error anywhere.
	for _, raw := range [][]string{
		{dbcontrol.AllowedAny, dbcontrol.AllowedImage},
		{dbcontrol.AllowedImage, dbcontrol.AllowedAny},
		{dbcontrol.AllowedAny, dbcontrol.AllowedImage, dbcontrol.AllowedVideo},
	} {
		if _, err := normalizeAllowedTypes(raw); err == nil {
			t.Errorf("normalizeAllowedTypes(%v) accepted any mixed with a class", raw)
		}
	}
}

func TestNormalizeAllowedTypesSortsAndDeduplicates(t *testing.T) {
	got, err := normalizeAllowedTypes([]string{
		dbcontrol.AllowedVideo, dbcontrol.AllowedImage, dbcontrol.AllowedImage,
	})
	if err != nil {
		t.Fatalf("normalizeAllowedTypes: %v", err)
	}
	want := []string{dbcontrol.AllowedImage, dbcontrol.AllowedVideo}
	if !slices.Equal(got, want) {
		t.Fatalf("normalizeAllowedTypes = %v, want %v", got, want)
	}
}

func TestNormalizeAllowedTypesRefusesAnEmptyPolicy(t *testing.T) {
	// An empty set is not the same as "no restriction": read literally it accepts
	// nothing, which is the opposite of what an unchecked form means.
	if _, err := normalizeAllowedTypes(nil); err == nil {
		t.Fatal("normalizeAllowedTypes(nil) accepted an empty policy")
	}
}

// --- preview URLs ---

func TestObjectResponseCarriesASessionPreviewURL(t *testing.T) {
	plane, store, _ := testBucketPlane(t, 1<<20)
	bucket := store.addBucket("default")
	object := store.addObject(bucket, "logo.png", 4, "image/png")

	request := httptest.NewRequest(http.MethodGet, "/bucket/x/logo.png", nil).WithContext(
		requestContext(store.projectID, "logo.png"),
	)
	response := plane.objectResponse(request, store.projectID, bucket.Name, object)

	// url needs a credential, so putting it in an <img> renders nothing for every
	// private object. The preview has to go through the session route.
	if !strings.HasPrefix(response.PreviewURL, "/api/projects/"+store.projectID.String()+"/bucket/") {
		t.Fatalf("preview_url = %q, want the dashboard session route", response.PreviewURL)
	}
	if !strings.HasSuffix(response.PreviewURL, "/logo.png") {
		t.Fatalf("preview_url = %q, want it to end with the key", response.PreviewURL)
	}
	if !strings.Contains(response.URL, "/p/"+store.projectID.String()+"/bucket/logo.png") {
		t.Fatalf("url = %q, want the credential route", response.URL)
	}
}

func TestObjectResponseEscapesThePreviewURLKey(t *testing.T) {
	plane, store, _ := testBucketPlane(t, 1<<20)
	bucket := store.addBucket("default")
	object := store.addObject(bucket, "my photo.png", 4, "image/png")

	request := httptest.NewRequest(http.MethodGet, "/bucket/x", nil).WithContext(
		requestContext(store.projectID, ""),
	)
	response := plane.objectResponse(request, store.projectID, bucket.Name, object)

	if !strings.HasSuffix(response.PreviewURL, "/my%20photo.png") {
		t.Fatalf("preview_url = %q, want the space encoded", response.PreviewURL)
	}
}

func TestPublicURLUsesTheConfiguredOriginNotTheRequestHost(t *testing.T) {
	// A deployment reached by more than one hostname, or behind a proxy that
	// forwards an arbitrary Host: the URL handed to the user has to be the one
	// that will still work when they paste it into their own site.
	store := newFakeBucketStore(uuid.New())
	fs := newFakeObjectFS()
	plane := NewBucketPlane(store, fs, 1<<20, "https://moogo.dev", logger.Nop())
	bucket := store.addBucket("default")
	store.addObject(bucket, "logo.png", 4, "image/png")
	if _, err := store.SetObjectPublic(
		context.Background(), store.projectID, "logo.png", true,
	); err != nil {
		t.Fatalf("publish: %v", err)
	}

	request := httptest.NewRequest(http.MethodGet, "http://evil.example/bucket/x", nil).WithContext(
		requestContext(store.projectID, "logo.png"),
	)
	request.Header.Set("X-Forwarded-Host", "attacker.test")
	request.Header.Set("X-Forwarded-Proto", "http")

	published, err := store.ObjectByKey(context.Background(), store.projectID, "logo.png")
	if err != nil {
		t.Fatalf("reload: %v", err)
	}
	response := plane.objectResponse(request, store.projectID, bucket.Name, published)

	if !strings.HasPrefix(response.PublicURL, "https://moogo.dev/pub/") {
		t.Fatalf("public_url = %q, want the configured origin", response.PublicURL)
	}
}

func TestBucketQuotaCannotPromiseMoreThanTheProjectHas(t *testing.T) {
	// A bucket allowed to claim 300 MB in a 256 MB project shows a number on the
	// settings page that no upload can ever reach, and every refusal past the
	// real ceiling looks like a bug rather than the project's own limit.
	plane, store, _ := testBucketPlane(t, 1<<20)
	bucket := store.addBucket("images")

	request := bucketRequest(
		http.MethodPatch,
		"/buckets/x/"+bucket.ID.String(),
		strings.NewReader(`{"quota_bytes":2097152}`),
		store.projectID, bucket.ID,
	)
	recorder := httptest.NewRecorder()
	plane.UpdateBucketSettings(recorder, request)

	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400 (body %q)", recorder.Code, recorder.Body.String())
	}
	if bucket.QuotaBytes == 2097152 {
		t.Fatal("a bucket quota above the project limit was stored")
	}
}
