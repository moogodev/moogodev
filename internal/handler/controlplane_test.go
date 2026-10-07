package handler

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/moogodev/moogodev/internal/auth"
	"github.com/moogodev/moogodev/internal/config"
	"github.com/moogodev/moogodev/internal/dbcontrol"
	"github.com/moogodev/moogodev/internal/dbplane"
	"github.com/moogodev/moogodev/pkg/bucketkey"
	"github.com/moogodev/moogodev/pkg/logger"
	"github.com/moogodev/moogodev/pkg/secretkey"
	"github.com/moogodev/moogodev/pkg/session"
)

// testUserID is the account every authenticated request in these tests belongs
// to. It is a package-level constant so ownership bugs are obvious when the
// expected owner and the request owner differ.
var testUserID = uuid.MustParse("11111111-1111-4111-8111-111111111111")

// otherUserID stands in for a different account, used to prove that ownership
// is actually checked.
var otherUserID = uuid.MustParse("22222222-2222-4222-8222-222222222222")

// fakeStore is a scripted control plane.
type fakeStore struct {
	projects map[uuid.UUID]*dbcontrol.Project
	user     *dbcontrol.User
	buckets  map[uuid.UUID][]*dbcontrol.Bucket

	// Counters prove which code path ran, which is how the tests tell a real
	// authorization failure apart from a handler that never looked.
	createdCalls      int
	rotateCalls       int
	deleteCalls       int
	readyCalls        int
	failedCalls       int
	activityCalls     int
	listBucketsCalls  int
	createBucketCalls int
	setPasswordCalls  int

	// Failure injection.
	createErr      error
	rotateErr      error
	deleteErr      error
	setPasswordErr error

	lastCreatedName string

	// Storage credentials, keyed by id.
	credentials map[uuid.UUID]*dbcontrol.StorageCredential
	// credentialErr injects a failure on create, standing in for the
	// per-project limit.
	credentialErr error
}

func newFakeStore(userID uuid.UUID) *fakeStore {
	return &fakeStore{
		projects: map[uuid.UUID]*dbcontrol.Project{},
		user: &dbcontrol.User{
			ID:                   userID,
			Email:                "ketut@example.com",
			Name:                 "Ketut",
			QuotaMaxProjects:     5,
			QuotaMaxDBBytes:      100 * 1024 * 1024,
			QuotaMaxStorageBytes: 256 * 1024 * 1024,
		},
		credentials: map[uuid.UUID]*dbcontrol.StorageCredential{},
	}
}

func (store *fakeStore) UpsertUserByEmail(
	context.Context, string, string, string, int, int64, int64,
) (*dbcontrol.User, error) {
	return store.user, nil
}

func (store *fakeStore) UserByID(context.Context, uuid.UUID) (*dbcontrol.User, error) {
	return store.user, nil
}

// SetPasswordHash records the write so a test can assert that a refused change
// left the stored hash alone.
func (store *fakeStore) SetPasswordHash(_ context.Context, _ uuid.UUID, passwordHash string) error {
	if store.setPasswordErr != nil {
		return store.setPasswordErr
	}
	if store.user != nil {
		store.user.PasswordHash = passwordHash
	}
	store.setPasswordCalls++
	return nil
}

func (store *fakeStore) UpdateUserName(_ context.Context, _ uuid.UUID, name string) error {
	if store.user != nil {
		store.user.Name = strings.TrimSpace(name)
	}
	return nil
}

func (store *fakeStore) CreateProject(
	_ context.Context, userID uuid.UUID, name string, key secretkey.Generated,
) (*dbcontrol.CreateProjectResult, error) {
	store.createdCalls++
	store.lastCreatedName = name
	if store.createErr != nil {
		return nil, store.createErr
	}

	project := &dbcontrol.Project{
		ID:              uuid.New(),
		UserID:          userID,
		Name:            name,
		Status:          dbcontrol.ProjectPending,
		SecretKeyHash:   key.Hash,
		SecretKeyPrefix: secretkey.Prefix(key.Plaintext),
		CreatedAt:       time.Now(),
		UpdatedAt:       time.Now(),
	}
	store.projects[project.ID] = project

	return &dbcontrol.CreateProjectResult{Project: project, SecretKeyPlaintext: key.Plaintext}, nil
}

func (store *fakeStore) MarkProjectReady(_ context.Context, projectID uuid.UUID) error {
	store.readyCalls++
	if project, found := store.projects[projectID]; found {
		project.Status = dbcontrol.ProjectReady
	}
	return nil
}

func (store *fakeStore) MarkProjectFailed(_ context.Context, projectID uuid.UUID, reason string) error {
	store.failedCalls++
	if project, found := store.projects[projectID]; found {
		project.Status = dbcontrol.ProjectFailed
		detail := reason
		project.StatusDetail = &detail
	}
	return nil
}

func (store *fakeStore) ListProjects(
	_ context.Context, userID uuid.UUID, limit int, offset int,
) ([]dbcontrol.Project, error) {
	var owned []dbcontrol.Project
	for _, project := range store.projects {
		if project.UserID == userID {
			owned = append(owned, *project)
		}
	}
	if offset >= len(owned) {
		return nil, nil
	}
	owned = owned[offset:]
	if limit < len(owned) {
		owned = owned[:limit]
	}
	return owned, nil
}

func (store *fakeStore) ProjectOwnedBy(
	_ context.Context, projectID uuid.UUID, userID uuid.UUID,
) (*dbcontrol.Project, error) {
	project, found := store.projects[projectID]
	if !found || project.UserID != userID {
		// The same error for a missing row and for someone else's row, so the
		// response cannot be used to discover which project ids exist.
		return nil, dbcontrol.ErrProjectNotOwned
	}
	return project, nil
}

func (store *fakeStore) RotateSecretKey(_ context.Context, projectID uuid.UUID) (string, error) {
	store.rotateCalls++
	if store.rotateErr != nil {
		return "", store.rotateErr
	}
	key, err := secretkey.Generate()
	if err != nil {
		return "", err
	}
	if project, found := store.projects[projectID]; found {
		project.SecretKeyHash = key.Hash
		project.SecretKeyPrefix = secretkey.Prefix(key.Plaintext)
	}
	return key.Plaintext, nil
}

func (store *fakeStore) PauseProject(_ context.Context, projectID uuid.UUID) error {
	if project, found := store.projects[projectID]; found {
		project.Status = dbcontrol.ProjectPaused
	}
	return nil
}

func (store *fakeStore) ResumeProject(_ context.Context, projectID uuid.UUID) error {
	if project, found := store.projects[projectID]; found {
		project.Status = dbcontrol.ProjectReady
	}
	return nil
}

func (store *fakeStore) SoftDeleteProject(
	_ context.Context, projectID uuid.UUID, userID uuid.UUID,
) error {
	store.deleteCalls++
	if store.deleteErr != nil {
		return store.deleteErr
	}
	if project, found := store.projects[projectID]; found && project.UserID == userID {
		delete(store.projects, projectID)
	}
	return nil
}

func (store *fakeStore) ListActivity(
	context.Context, uuid.UUID, int,
) ([]dbcontrol.ActivityEntry, error) {
	store.activityCalls++
	return nil, nil
}

func (store *fakeStore) ListBuckets(
	_ context.Context, projectID uuid.UUID,
) ([]dbcontrol.Bucket, error) {
	store.listBucketsCalls++
	if store.buckets == nil {
		return nil, nil
	}
	var result []dbcontrol.Bucket
	for _, b := range store.buckets[projectID] {
		result = append(result, *b)
	}
	return result, nil
}

func (store *fakeStore) CreateBucket(
	_ context.Context, projectID uuid.UUID, name string,
) (*dbcontrol.Bucket, error) {
	store.createBucketCalls++
	if store.buckets == nil {
		store.buckets = make(map[uuid.UUID][]*dbcontrol.Bucket)
	}
	bucket := &dbcontrol.Bucket{
		ID:        uuid.New(),
		ProjectID: projectID,
		Name:      name,
		CreatedAt: time.Now(),
	}
	store.buckets[projectID] = append(store.buckets[projectID], bucket)
	return bucket, nil
}

func (store *fakeStore) StorageUsedBytes(
	_ context.Context, projectID uuid.UUID,
) (int64, error) {
	var total int64
	for _, bucket := range store.buckets[projectID] {
		total += bucket.SizeBytes
	}
	return total, nil
}

func (store *fakeStore) StorageCredentials(
	_ context.Context, projectID uuid.UUID,
) ([]dbcontrol.StorageCredential, error) {
	var owned []dbcontrol.StorageCredential
	for _, credential := range store.credentials {
		if credential.ProjectID == projectID {
			owned = append(owned, *credential)
		}
	}
	return owned, nil
}

func (store *fakeStore) CreateStorageCredential(
	_ context.Context, projectID uuid.UUID, label string, key bucketkey.Generated,
) (*dbcontrol.StorageCredential, error) {
	if store.credentialErr != nil {
		return nil, store.credentialErr
	}
	credential := &dbcontrol.StorageCredential{
		ID:               uuid.New(),
		ProjectID:        projectID,
		AccessKeyID:      key.AccessKeyID,
		SecretKeyHash:    key.SecretKeyHash,
		SecretKeyPreview: key.SecretKeyPreview,
		Label:            label,
		CreatedAt:        time.Now(),
	}
	store.credentials[credential.ID] = credential
	return credential, nil
}

func (store *fakeStore) RotateStorageCredentialSecret(
	_ context.Context, projectID uuid.UUID, credentialID uuid.UUID, key bucketkey.Generated,
) (*dbcontrol.StorageCredential, error) {
	credential, found := store.credentials[credentialID]
	if !found || credential.ProjectID != projectID || !credential.Active() {
		return nil, dbcontrol.ErrNotFound
	}
	credential.SecretKeyHash = key.SecretKeyHash
	credential.SecretKeyPreview = key.SecretKeyPreview
	rotated := time.Now()
	credential.RotatedAt = &rotated
	return credential, nil
}

func (store *fakeStore) RevokeStorageCredential(
	_ context.Context, projectID uuid.UUID, credentialID uuid.UUID,
) error {
	credential, found := store.credentials[credentialID]
	if !found || credential.ProjectID != projectID || !credential.Active() {
		return dbcontrol.ErrNotFound
	}
	revoked := time.Now()
	credential.RevokedAt = &revoked
	// The hash goes too, so a revoked credential cannot verify even if some
	// future code path forgets to check RevokedAt.
	credential.SecretKeyHash = ""
	return nil
}

// fakeDatabases is a scripted data plane.
type fakeDatabases struct {
	initCalls   int
	removeCalls int
	sizes       map[uuid.UUID]int64
	initErr     error
	removed     []uuid.UUID

	// Backup behaviour.
	backupCalls    int
	backupErr      error
	backupContents []byte
	backupPaths    []string

	// Console statements, so a test can assert the dashboard reached the
	// engine with the right text and project.
	queryCalls  []consoleStatement
	execCalls   []consoleStatement
	queryResult *dbplane.QueryResult
	execResult  *dbplane.ExecResult
	queryErr    error
	execErr     error
}

// consoleStatement records one statement the dashboard console sent.
type consoleStatement struct {
	projectID uuid.UUID
	query     string
	args      []any
}

// Query records the console read.
func (plane *fakeDatabases) Query(
	_ context.Context, projectID uuid.UUID, statement string, args []any, _ int,
) (*dbplane.QueryResult, error) {
	plane.queryCalls = append(plane.queryCalls,
		consoleStatement{projectID: projectID, query: statement, args: args})
	if plane.queryErr != nil {
		return nil, plane.queryErr
	}
	if plane.queryResult != nil {
		return plane.queryResult, nil
	}
	return &dbplane.QueryResult{Columns: []string{"n"}, Rows: [][]any{{int64(1)}}}, nil
}

// Exec records the console write.
func (plane *fakeDatabases) Exec(
	_ context.Context, projectID uuid.UUID, statement string, args []any,
) (*dbplane.ExecResult, error) {
	plane.execCalls = append(plane.execCalls,
		consoleStatement{projectID: projectID, query: statement, args: args})
	if plane.execErr != nil {
		return nil, plane.execErr
	}
	if plane.execResult != nil {
		return plane.execResult, nil
	}
	return &dbplane.ExecResult{RowsAffected: 1}, nil
}

func (plane *fakeDatabases) InitializeProject(context.Context, uuid.UUID) error {
	plane.initCalls++
	return plane.initErr
}

func (plane *fakeDatabases) RemoveProject(projectID uuid.UUID) error {
	plane.removeCalls++
	plane.removed = append(plane.removed, projectID)
	return nil
}

func (plane *fakeDatabases) DatabaseSize(_ context.Context, projectID uuid.UUID) (int64, error) {
	return plane.sizes[projectID], nil
}

// BackupDatabase writes a real file so the handler can serve it, and records the
// call so a test can assert the backup was refused before reaching this point.
func (plane *fakeDatabases) BackupDatabase(
	_ context.Context, projectID uuid.UUID,
) (string, error) {
	plane.backupCalls++
	if plane.backupErr != nil {
		return "", plane.backupErr
	}

	dir, err := os.MkdirTemp("", "fake-backup-")
	if err != nil {
		return "", err
	}
	path := filepath.Join(dir, "database.sqlite")
	if err := os.WriteFile(path, plane.backupContents, 0o600); err != nil {
		return "", err
	}
	plane.backupPaths = append(plane.backupPaths, path)
	return path, nil
}

// testControlPlane builds a handler over fakes.
func testControlPlane(userID uuid.UUID) (*ControlPlane, *fakeStore, *fakeDatabases) {
	store := newFakeStore(userID)
	plane := &fakeDatabases{sizes: map[uuid.UUID]int64{}}

	cfg := config.Config{
		PublicURL:          "https://moogo.dev",
		DefaultMaxProjects: 5,
	}

	return NewControlPlane(store, plane, cfg, logger.Nop()), store, plane
}

// signedIn returns a request carrying a valid session for the given user.
func signedIn(t *testing.T, userID uuid.UUID, path string) *http.Request {
	t.Helper()

	signer, err := session.NewSigner("a-test-secret-that-is-definitely-long-enough", time.Hour)
	if err != nil {
		t.Fatalf("new signer: %v", err)
	}
	token, err := signer.Issue(userID.String(), "ketut@example.com", time.Now())
	if err != nil {
		t.Fatalf("issue: %v", err)
	}

	request := httptest.NewRequest(http.MethodGet, path, nil)
	request.AddCookie(&http.Cookie{Name: auth.SessionCookieName, Value: token})

	// The context value is set here rather than by running the middleware, so
	// each test targets one handler in isolation.
	request = request.WithContext(context.WithValue(
		request.Context(), auth.ContextKeyUserID, userID.String()))

	return request
}

// withProjectID attaches a project id the way the router's ProjectContext
// middleware does, so a test can target a specific project.
func withProjectID(request *http.Request, projectID uuid.UUID) *http.Request {
	return request.WithContext(context.WithValue(
		request.Context(), auth.ContextKeyProjectID, projectID.String()))
}

// errorCode extracts the machine-readable code from an error body.
func errorCode(t *testing.T, recorder *httptest.ResponseRecorder) string {
	t.Helper()

	var body struct {
		Error struct {
			Code    string `json:"code"`
			Message string `json:"message"`
		} `json:"error"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode error body %q: %v", recorder.Body.String(), err)
	}
	return body.Error.Code
}

func TestCreateProjectReturnsSecretOnce(t *testing.T) {
	handler, store, plane := testControlPlane(testUserID)

	request := signedIn(t, testUserID, "/api/projects")
	request.Method = http.MethodPost
	request.Body = http.NoBody
	request.Body = io.NopCloser(strings.NewReader(`{"name":"  my project  "}`))
	request.Header.Set("Content-Type", "application/json")

	recorder := httptest.NewRecorder()
	handler.CreateProject(recorder, request)

	if recorder.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", recorder.Code, recorder.Body.String())
	}

	var response ProjectResponse
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatalf("decode: %v", err)
	}

	// The plaintext key is the whole reason the caller keeps the response, and
	// it must be present exactly once, at creation.
	if response.SecretKey == "" {
		t.Error("expected the secret key in the create response")
	}
	// The prefix is what stays in the database. It is taken from the middle of
	// the key, after the fixed "moogo_" marker, so it appears inside the key
	// rather than at the front. A mismatch would mean the stored prefix does not
	// identify the key the caller was just handed.
	if response.SecretKeyPrefix == "" {
		t.Error("expected the prefix in the create response")
	}
	if !strings.Contains(response.SecretKey, response.SecretKeyPrefix) {
		t.Errorf("key %q does not contain prefix %q",
			response.SecretKey, response.SecretKeyPrefix)
	}
	if response.Status != string(dbcontrol.ProjectReady) {
		t.Errorf("expected status ready, got %q", response.Status)
	}

	// The name is trimmed before it is stored, so "  my project  " and "my
	// project" cannot both be created and confuse the dashboard listing.
	if store.lastCreatedName != "my project" {
		t.Errorf("expected trimmed name, got %q", store.lastCreatedName)
	}
	if plane.initCalls != 1 {
		t.Errorf("expected the database to be materialized once, got %d", plane.initCalls)
	}
	if store.readyCalls != 1 {
		t.Errorf("expected the project to be marked ready, got %d", store.readyCalls)
	}
}

func TestCreateProjectHidesSecretOnLaterReads(t *testing.T) {
	handler, store, _ := testControlPlane(testUserID)

	created := createProject(t, handler, store, "first")

	// The raw key is never returned again, so a leaked response body from a
	// later request is not enough to impersonate the project.
	recorder := httptest.NewRecorder()
	request := signedIn(t, testUserID, "/api/projects/"+created.ID.String())
	handler.GetProject(recorder, withProjectID(request, created.ID))

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", recorder.Code)
	}

	var response ProjectResponse
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if response.SecretKey != "" {
		t.Error("the secret key must not be returned after creation")
	}
	if response.SecretKeyPrefix == "" {
		t.Error("the prefix should still be shown so the key can be recognised")
	}
}

func TestCreateProjectRejectsBlankName(t *testing.T) {
	handler, store, plane := testControlPlane(testUserID)

	request := signedIn(t, testUserID, "/api/projects")
	request.Method = http.MethodPost
	request.Body = io.NopCloser(strings.NewReader(`{"name":"   "}`))
	request.Header.Set("Content-Type", "application/json")

	recorder := httptest.NewRecorder()
	handler.CreateProject(recorder, request)

	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", recorder.Code)
	}
	// Nothing may be created, not even a pending row, for a rejected request.
	if store.createdCalls != 0 {
		t.Error("a rejected request must not reach the store")
	}
	if plane.initCalls != 0 {
		t.Error("a rejected request must not create a file")
	}
}

func TestCreateProjectMarksFailedWhenFileCannotBeCreated(t *testing.T) {
	handler, store, plane := testControlPlane(testUserID)
	plane.initErr = errors.New("disk full")

	request := signedIn(t, testUserID, "/api/projects")
	request.Method = http.MethodPost
	request.Body = io.NopCloser(strings.NewReader(`{"name":"doomed"}`))
	request.Header.Set("Content-Type", "application/json")

	recorder := httptest.NewRecorder()
	handler.CreateProject(recorder, request)

	if recorder.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500, got %d", recorder.Code)
	}
	// The row exists in Postgres but has no file, so it is marked failed rather
	// than left pending or deleted outright.
	if store.failedCalls != 1 {
		t.Errorf("expected the project to be marked failed, got %d calls", store.failedCalls)
	}
	if store.readyCalls != 0 {
		t.Error("a project with no file must not be marked ready")
	}
}

func TestCreateProjectSurfacesQuotaLimit(t *testing.T) {
	handler, store, _ := testControlPlane(testUserID)
	store.createErr = dbcontrol.ErrQuotaExceeded

	request := signedIn(t, testUserID, "/api/projects")
	request.Method = http.MethodPost
	request.Body = io.NopCloser(strings.NewReader(`{"name":"sixth"}`))
	request.Header.Set("Content-Type", "application/json")

	recorder := httptest.NewRecorder()
	handler.CreateProject(recorder, request)

	// 429, not 500: the client can do something about it by deleting a project.
	if recorder.Code != http.StatusTooManyRequests {
		t.Fatalf("expected 429, got %d", recorder.Code)
	}
	if code := errorCode(t, recorder); code != "quota_exceeded" {
		t.Errorf("expected quota_exceeded, got %q", code)
	}
}

func TestGetProjectRejectsOtherUsersProject(t *testing.T) {
	handler, store, _ := testControlPlane(testUserID)

	// The project belongs to somebody else, so the row exists but the owner
	// does not match.
	foreign := &dbcontrol.Project{ID: uuid.New(), UserID: otherUserID, Name: "theirs"}
	store.projects[foreign.ID] = foreign

	request := signedIn(t, testUserID, "/api/projects/"+foreign.ID.String())
	recorder := httptest.NewRecorder()
	handler.GetProject(recorder, withProjectID(request, foreign.ID))

	// 404, not 403: a 403 would confirm the id exists.
	if recorder.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", recorder.Code)
	}
	if code := errorCode(t, recorder); code != "project_not_found" {
		t.Errorf("expected project_not_found, got %q", code)
	}
}

func TestGetProjectRejectsMalformedID(t *testing.T) {
	handler, _, _ := testControlPlane(testUserID)

	// No project id in the context is what a malformed id looks like by the
	// time it reaches the handler.
	recorder := httptest.NewRecorder()
	handler.GetProject(recorder, signedIn(t, testUserID, "/api/projects/not-a-uuid"))

	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", recorder.Code)
	}
	if code := errorCode(t, recorder); code != "invalid_project_id" {
		t.Errorf("expected invalid_project_id, got %q", code)
	}
}

func TestRotateKeyReturnsNewKeyOnce(t *testing.T) {
	handler, store, _ := testControlPlane(testUserID)
	created := createProject(t, handler, store, "rotate me")

	before := store.projects[created.ID].SecretKeyHash

	request := signedIn(t, testUserID, "/api/projects/"+created.ID.String()+"/rotate-key")
	recorder := httptest.NewRecorder()
	handler.RotateKey(recorder, withProjectID(request, created.ID))

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", recorder.Code, recorder.Body.String())
	}

	var response struct {
		SecretKey string `json:"secret_key"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if response.SecretKey == "" {
		t.Fatal("expected the new key in the response")
	}
	if store.projects[created.ID].SecretKeyHash == before {
		t.Error("the stored hash should change when the key is rotated")
	}
}

func TestPauseProjectSetsPausedStatus(t *testing.T) {
	handler, store, _ := testControlPlane(testUserID)
	created := createProject(t, handler, store, "pause me")

	request := signedIn(t, testUserID, "/api/projects/"+created.ID.String()+"/pause")
	recorder := httptest.NewRecorder()
	handler.PauseProject(recorder, withProjectID(request, created.ID))

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", recorder.Code, recorder.Body.String())
	}

	var response ProjectResponse
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if response.Status != string(dbcontrol.ProjectPaused) {
		t.Errorf("expected status paused, got %q", response.Status)
	}
	if store.projects[created.ID].Status != dbcontrol.ProjectPaused {
		t.Error("the stored project should be paused")
	}
}

func TestResumeProjectRestoresReadyStatus(t *testing.T) {
	handler, store, _ := testControlPlane(testUserID)
	created := createProject(t, handler, store, "resume me")
	store.projects[created.ID].Status = dbcontrol.ProjectPaused

	request := signedIn(t, testUserID, "/api/projects/"+created.ID.String()+"/resume")
	recorder := httptest.NewRecorder()
	handler.ResumeProject(recorder, withProjectID(request, created.ID))

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", recorder.Code, recorder.Body.String())
	}

	var response ProjectResponse
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if response.Status != string(dbcontrol.ProjectReady) {
		t.Errorf("expected status ready, got %q", response.Status)
	}
}

func TestPauseProjectRejectsOtherUsersProject(t *testing.T) {
	handler, store, _ := testControlPlane(testUserID)
	foreign := &dbcontrol.Project{ID: uuid.New(), UserID: otherUserID, Name: "theirs"}
	store.projects[foreign.ID] = foreign

	request := signedIn(t, testUserID, "/api/projects/"+foreign.ID.String()+"/pause")
	recorder := httptest.NewRecorder()
	handler.PauseProject(recorder, withProjectID(request, foreign.ID))

	// 404, not 403: a 403 would confirm the id exists.
	if recorder.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", recorder.Code)
	}
	if foreign.Status == dbcontrol.ProjectPaused {
		t.Error("a project owned by somebody else must not be paused")
	}
}

// consoleRequest builds a session-authenticated console request. Note there is
// no Authorization header anywhere: that is the point of these tests.
func consoleRequest(t *testing.T, userID uuid.UUID, projectID uuid.UUID, path string) *http.Request {
	t.Helper()

	request := signedIn(t, userID, path)
	request.Method = http.MethodPost
	request.Body = io.NopCloser(strings.NewReader(`{"query":"SELECT 1","args":[]}`))
	request.Header.Set("Content-Type", "application/json")
	return withProjectID(request, projectID)
}

func TestConsoleQueryRunsWithoutProjectKey(t *testing.T) {
	handler, store, plane := testControlPlane(testUserID)
	created := createProject(t, handler, store, "console me")

	request := consoleRequest(t, testUserID, created.ID, "/api/projects/"+created.ID.String()+"/query")
	recorder := httptest.NewRecorder()
	handler.Query(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", recorder.Code, recorder.Body.String())
	}

	// The statement has to reach the engine against the right project, or the
	// console would render an empty table forever.
	if len(plane.queryCalls) != 1 {
		t.Fatalf("expected one query, got %d", len(plane.queryCalls))
	}
	if plane.queryCalls[0].projectID != created.ID {
		t.Errorf("expected project %s, got %s", created.ID, plane.queryCalls[0].projectID)
	}
	if plane.queryCalls[0].query != "SELECT 1" {
		t.Errorf("expected the statement to pass through, got %q", plane.queryCalls[0].query)
	}

	var response QueryResponse
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if !response.Success {
		t.Error("expected a successful response")
	}
}

func TestConsoleQueryRejectsOtherUsersProject(t *testing.T) {
	handler, store, plane := testControlPlane(testUserID)
	foreign := &dbcontrol.Project{ID: uuid.New(), UserID: otherUserID, Name: "theirs"}
	store.projects[foreign.ID] = foreign

	request := consoleRequest(t, testUserID, foreign.ID, "/api/projects/"+foreign.ID.String()+"/query")
	recorder := httptest.NewRecorder()
	handler.Query(recorder, request)

	// The session path must not become a way around ownership. 404 rather than
	// 403 so the id cannot be probed for existence.
	if recorder.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", recorder.Code)
	}
	if len(plane.queryCalls) != 0 {
		t.Error("another user's project must never reach the engine")
	}
}

func TestConsoleQueryRefusesPausedProject(t *testing.T) {
	handler, store, plane := testControlPlane(testUserID)
	created := createProject(t, handler, store, "paused console")
	store.projects[created.ID].Status = dbcontrol.ProjectPaused

	request := consoleRequest(t, testUserID, created.ID, "/api/projects/"+created.ID.String()+"/query")
	recorder := httptest.NewRecorder()
	handler.Query(recorder, request)

	// The pause check lives in the key middleware, which this path skips, so
	// without an explicit check the console would keep reading a paused project.
	if recorder.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", recorder.Code)
	}
	if code := errorCode(t, recorder); code != "project_paused" {
		t.Errorf("expected project_paused, got %q", code)
	}
	if len(plane.queryCalls) != 0 {
		t.Error("a paused project must not reach the engine")
	}
}

func TestConsoleQueryRefusesUnreadyProject(t *testing.T) {
	handler, store, plane := testControlPlane(testUserID)
	created := createProject(t, handler, store, "pending console")
	store.projects[created.ID].Status = dbcontrol.ProjectPending

	request := consoleRequest(t, testUserID, created.ID, "/api/projects/"+created.ID.String()+"/query")
	recorder := httptest.NewRecorder()
	handler.Query(recorder, request)

	if recorder.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", recorder.Code)
	}
	if code := errorCode(t, recorder); code != "project_not_ready" {
		t.Errorf("expected project_not_ready, got %q", code)
	}
	if len(plane.queryCalls) != 0 {
		t.Error("an unready project must not reach the engine")
	}
}

func TestConsoleExecRejectsReadStatement(t *testing.T) {
	handler, store, plane := testControlPlane(testUserID)
	created := createProject(t, handler, store, "wrong door")

	request := signedIn(t, testUserID, "/api/projects/"+created.ID.String()+"/exec")
	request.Method = http.MethodPost
	request.Body = io.NopCloser(strings.NewReader(`{"query":"SELECT 1","args":[]}`))
	request.Header.Set("Content-Type", "application/json")
	recorder := httptest.NewRecorder()
	handler.Exec(recorder, withProjectID(request, created.ID))

	// Sharing the runner is what guarantees the console keeps the same read and
	// write split as the public API.
	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", recorder.Code)
	}
	if code := errorCode(t, recorder); code != "not_a_write" {
		t.Errorf("expected not_a_write, got %q", code)
	}
	if len(plane.execCalls) != 0 {
		t.Error("a read sent to exec must not reach the engine")
	}
}

func TestConsoleExecRunsWriteWithoutProjectKey(t *testing.T) {
	handler, store, plane := testControlPlane(testUserID)
	created := createProject(t, handler, store, "write from console")

	request := signedIn(t, testUserID, "/api/projects/"+created.ID.String()+"/exec")
	request.Method = http.MethodPost
	request.Body = io.NopCloser(strings.NewReader(`{"query":"INSERT INTO t VALUES (?)","args":["x"]}`))
	request.Header.Set("Content-Type", "application/json")
	recorder := httptest.NewRecorder()
	handler.Exec(recorder, withProjectID(request, created.ID))

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", recorder.Code, recorder.Body.String())
	}
	if len(plane.execCalls) != 1 {
		t.Fatalf("expected one exec, got %d", len(plane.execCalls))
	}
	if len(plane.execCalls[0].args) != 1 || plane.execCalls[0].args[0] != "x" {
		t.Errorf("expected the bound argument to survive, got %v", plane.execCalls[0].args)
	}
}

func TestConsoleRejectsUnsafeStatement(t *testing.T) {
	handler, store, plane := testControlPlane(testUserID)
	created := createProject(t, handler, store, "sneaky")

	request := signedIn(t, testUserID, "/api/projects/"+created.ID.String()+"/query")
	request.Method = http.MethodPost
	request.Body = io.NopCloser(strings.NewReader(`{"query":"SELECT load_extension('x')","args":[]}`))
	request.Header.Set("Content-Type", "application/json")
	recorder := httptest.NewRecorder()
	handler.Query(recorder, withProjectID(request, created.ID))

	// The sanitizer is part of the shared runner, so being on the session path
	// must not be a way around it.
	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", recorder.Code, recorder.Body.String())
	}
	if len(plane.queryCalls) != 0 {
		t.Error("a rejected statement must not reach the engine")
	}
}

func TestDeleteProjectRemovesFile(t *testing.T) {
	handler, store, plane := testControlPlane(testUserID)
	created := createProject(t, handler, store, "delete me")

	request := signedIn(t, testUserID, "/api/projects/"+created.ID.String())
	recorder := httptest.NewRecorder()
	handler.DeleteProject(recorder, withProjectID(request, created.ID))

	if recorder.Code != http.StatusNoContent {
		t.Fatalf("expected 204, got %d", recorder.Code)
	}
	if store.deleteCalls != 1 {
		t.Errorf("expected one soft delete, got %d", store.deleteCalls)
	}
	// The files go too, otherwise the disk keeps growing after the user has
	// already forgotten the project existed.
	if len(plane.removed) != 1 || plane.removed[0] != created.ID {
		t.Errorf("expected the project file to be removed, got %v", plane.removed)
	}
}

func TestDeleteProjectRejectsOtherUsersProject(t *testing.T) {
	handler, store, plane := testControlPlane(testUserID)
	foreign := &dbcontrol.Project{ID: uuid.New(), UserID: otherUserID, Name: "theirs"}
	store.projects[foreign.ID] = foreign

	request := signedIn(t, testUserID, "/api/projects/"+foreign.ID.String())
	recorder := httptest.NewRecorder()
	handler.DeleteProject(recorder, withProjectID(request, foreign.ID))

	if recorder.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", recorder.Code)
	}
	if store.deleteCalls != 0 || plane.removeCalls != 0 {
		t.Error("a project owned by somebody else must not be touched")
	}
}

func TestUnauthenticatedRequestIsRejected(t *testing.T) {
	handler, _, _ := testControlPlane(testUserID)

	// No session cookie and no context value, which is what a stranger's
	// request looks like.
	recorder := httptest.NewRecorder()
	handler.ListProjects(recorder, httptest.NewRequest(http.MethodGet, "/api/projects", nil))

	if recorder.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", recorder.Code)
	}
}

func TestActivityIsScopedToOwnedProject(t *testing.T) {
	handler, store, _ := testControlPlane(testUserID)
	created := createProject(t, handler, store, "audit me")

	request := signedIn(t, testUserID, "/api/projects/"+created.ID.String()+"/activity")
	recorder := httptest.NewRecorder()
	handler.Activity(recorder, withProjectID(request, created.ID))

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", recorder.Code)
	}
	if store.activityCalls != 1 {
		t.Errorf("expected one activity read, got %d", store.activityCalls)
	}
}

// createProject runs the handler and returns the created project.
func createProject(t *testing.T, handler *ControlPlane, store *fakeStore, name string) *dbcontrol.Project {
	t.Helper()

	request := signedIn(t, testUserID, "/api/projects")
	request.Method = http.MethodPost
	request.Body = io.NopCloser(strings.NewReader(`{"name":"` + name + `"}`))
	request.Header.Set("Content-Type", "application/json")

	recorder := httptest.NewRecorder()
	handler.CreateProject(recorder, request)

	if recorder.Code != http.StatusCreated {
		t.Fatalf("create project %q: %d %s", name, recorder.Code, recorder.Body.String())
	}

	var response ProjectResponse
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatalf("decode: %v", err)
	}

	project, found := store.projects[response.ID]
	if !found {
		t.Fatal("the project was not stored")
	}
	return project
}

// --- account: password and plan ---

func TestMeReportsWhetherTheAccountHasAPassword(t *testing.T) {
	// The settings page decides between a password form and an explanation from
	// this flag alone, so it has to be false for an account that never chose one.
	handler, store, _ := testControlPlane(testUserID)
	store.user.PasswordHash = ""

	recorder := httptest.NewRecorder()
	handler.Me(recorder, signedIn(t, testUserID, "/api/me"))

	var body struct {
		HasPassword bool   `json:"has_password"`
		Plan        string `json:"plan"`
		User        struct {
			PasswordHash string `json:"password_hash"`
		} `json:"user"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode body %q: %v", recorder.Body.String(), err)
	}
	if body.HasPassword {
		t.Fatal("has_password = true for an account with no password")
	}
	if body.User.PasswordHash != "" {
		t.Fatal("the password hash reached the response")
	}

	store.user.PasswordHash = "a-bcrypt-hash"
	recorder = httptest.NewRecorder()
	handler.Me(recorder, signedIn(t, testUserID, "/api/me"))
	if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode body %q: %v", recorder.Body.String(), err)
	}
	if !body.HasPassword {
		t.Fatal("has_password = false for a password account")
	}
}

func TestMeReportsTheStoredPlan(t *testing.T) {
	// The plan is read from the row, not decided by the dashboard, so a plan
	// added later shows up without a frontend change.
	handler, store, _ := testControlPlane(testUserID)
	store.user.BillingPlan = "team"

	recorder := httptest.NewRecorder()
	handler.Me(recorder, signedIn(t, testUserID, "/api/me"))

	var body struct {
		Plan string `json:"plan"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode body %q: %v", recorder.Body.String(), err)
	}
	if body.Plan != "team" {
		t.Fatalf("plan = %q, want %q", body.Plan, "team")
	}
}

func TestChangePasswordStoresTheNewHash(t *testing.T) {
	handler, store, _ := testControlPlane(testUserID)
	hash, err := auth.HashPassword("correct horse battery")
	if err != nil {
		t.Fatalf("hash: %v", err)
	}
	store.user.PasswordHash = hash

	request := passwordRequest(t,
		`{"current_password":"correct horse battery","new_password":"a whole new passphrase"}`)
	recorder := httptest.NewRecorder()
	handler.ChangePassword(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200 (body %q)", recorder.Code, recorder.Body.String())
	}
	if store.setPasswordCalls != 1 {
		t.Fatalf("set password calls = %d, want 1", store.setPasswordCalls)
	}
	if !auth.VerifyPassword("a whole new passphrase", store.user.PasswordHash) {
		t.Fatal("the stored hash does not match the new password")
	}
	if auth.VerifyPassword("correct horse battery", store.user.PasswordHash) {
		t.Fatal("the old password still works")
	}
}

func TestChangePasswordRefusesAWrongCurrentPassword(t *testing.T) {
	// Without this check a stolen session could set a password and lock the real
	// owner out with no way back in.
	handler, store, _ := testControlPlane(testUserID)
	hash, err := auth.HashPassword("correct horse battery")
	if err != nil {
		t.Fatalf("hash: %v", err)
	}
	store.user.PasswordHash = hash

	request := passwordRequest(t,
		`{"current_password":"not the password","new_password":"a whole new passphrase"}`)
	recorder := httptest.NewRecorder()
	handler.ChangePassword(recorder, request)

	if recorder.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401 (body %q)", recorder.Code, recorder.Body.String())
	}
	if code := errorCode(t, recorder); code != "invalid_credentials" {
		t.Fatalf("code = %q, want invalid_credentials", code)
	}
	if store.user.PasswordHash != hash {
		t.Fatal("a refused change still wrote a new hash")
	}
}

func TestChangePasswordIsRefusedForAGoogleAccount(t *testing.T) {
	// Moogo never sees a Google password, so writing one here would create a
	// second way in that Google cannot revoke.
	handler, store, _ := testControlPlane(testUserID)
	store.user.PasswordHash = ""

	request := passwordRequest(t, `{"current_password":"","new_password":"a whole new passphrase"}`)
	recorder := httptest.NewRecorder()
	handler.ChangePassword(recorder, request)

	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400 (body %q)", recorder.Code, recorder.Body.String())
	}
	if code := errorCode(t, recorder); code != "password_managed_externally" {
		t.Fatalf("code = %q, want password_managed_externally", code)
	}
	if store.setPasswordCalls != 0 {
		t.Fatal("a Google account was given a Moogo password")
	}
}

func TestChangePasswordRefusesATooShortPassword(t *testing.T) {
	handler, store, _ := testControlPlane(testUserID)
	hash, err := auth.HashPassword("correct horse battery")
	if err != nil {
		t.Fatalf("hash: %v", err)
	}
	store.user.PasswordHash = hash

	request := passwordRequest(t, `{"current_password":"correct horse battery","new_password":"short"}`)
	recorder := httptest.NewRecorder()
	handler.ChangePassword(recorder, request)

	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400 (body %q)", recorder.Code, recorder.Body.String())
	}
	if code := errorCode(t, recorder); code != "invalid_password" {
		t.Fatalf("code = %q, want invalid_password", code)
	}
	if store.setPasswordCalls != 0 {
		t.Fatal("a refused password was stored anyway")
	}
}

func TestChangePasswordRefusesReusingTheSamePassword(t *testing.T) {
	// Otherwise the request would succeed and report a change that did not
	// change anything.
	handler, store, _ := testControlPlane(testUserID)
	hash, err := auth.HashPassword("correct horse battery")
	if err != nil {
		t.Fatalf("hash: %v", err)
	}
	store.user.PasswordHash = hash

	request := passwordRequest(t,
		`{"current_password":"correct horse battery","new_password":"correct horse battery"}`)
	recorder := httptest.NewRecorder()
	handler.ChangePassword(recorder, request)

	if code := errorCode(t, recorder); code != "password_unchanged" {
		t.Fatalf("code = %q, want password_unchanged (status %d)",
			code, recorder.Code)
	}
	if store.setPasswordCalls != 0 {
		t.Fatal("the same password was rehashed and stored")
	}
}

func TestChangePasswordNeedsASession(t *testing.T) {
	handler, _, _ := testControlPlane(testUserID)

	recorder := httptest.NewRecorder()
	handler.ChangePassword(recorder, httptest.NewRequest(
		http.MethodPost, "/api/account/password", strings.NewReader(`{}`)))

	if recorder.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401", recorder.Code)
	}
}

// passwordRequest builds a signed-in change-password request with a JSON body.
func passwordRequest(t *testing.T, body string) *http.Request {
	t.Helper()

	request := signedIn(t, testUserID, "/api/account/password")
	request.Method = http.MethodPost
	request.Body = io.NopCloser(strings.NewReader(body))
	request.Header.Set("Content-Type", "application/json")
	return request
}

func TestChangePasswordReportsAStoreThatRefusedTheRow(t *testing.T) {
	// The store guards the same rule the handler checks first, so reaching this
	// means the row lost its password in between. A 500 would tell a Google-only
	// user their password is broken rather than that the request does not apply.
	handler, store, _ := testControlPlane(testUserID)
	hash, err := auth.HashPassword("correct horse battery")
	if err != nil {
		t.Fatalf("hash: %v", err)
	}
	store.user.PasswordHash = hash
	store.setPasswordErr = dbcontrol.ErrPasswordNotSet

	request := passwordRequest(t,
		`{"current_password":"correct horse battery","new_password":"a whole new passphrase"}`)
	recorder := httptest.NewRecorder()
	handler.ChangePassword(recorder, request)

	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400 (body %q)", recorder.Code, recorder.Body.String())
	}
	if code := errorCode(t, recorder); code != "password_managed_externally" {
		t.Fatalf("code = %q, want password_managed_externally", code)
	}
}

func TestChangePasswordDoesNotClaimSuccessWhenTheWriteFails(t *testing.T) {
	handler, store, _ := testControlPlane(testUserID)
	hash, err := auth.HashPassword("correct horse battery")
	if err != nil {
		t.Fatalf("hash: %v", err)
	}
	store.user.PasswordHash = hash
	store.setPasswordErr = errors.New("connection reset")

	request := passwordRequest(t,
		`{"current_password":"correct horse battery","new_password":"a whole new passphrase"}`)
	recorder := httptest.NewRecorder()
	handler.ChangePassword(recorder, request)

	if recorder.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want 500 (body %q)", recorder.Code, recorder.Body.String())
	}
	if strings.Contains(recorder.Body.String(), "success") {
		t.Fatalf("the response claims a change that was lost: %q", recorder.Body.String())
	}
}
