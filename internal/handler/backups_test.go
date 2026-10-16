package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/moogodev/moogodev/internal/auth"
	"github.com/moogodev/moogodev/internal/backup"
	"github.com/moogodev/moogodev/internal/dbcontrol"
	"github.com/moogodev/moogodev/internal/dbplane"
	"github.com/moogodev/moogodev/pkg/session"
)

// fakeBackups is a scripted backup service. It records the calls the handlers
// make so a test can tell "the handler refused" from "the handler never asked".
type fakeBackups struct {
	backups []dbcontrol.DatabaseBackup
	state   *dbcontrol.DatabaseBackupState

	listErr          error
	backupErr        error
	restoreErr       error
	restoreStatusErr error
	getErr           error
	deleteErr        error
	snapErr          error

	backupCalls   int
	backupKind    dbcontrol.BackupKind
	restoredID    uuid.UUID
	activeRestore *dbcontrol.DatabaseRestore
	deletedID     uuid.UUID
	snapshotID    uuid.UUID
	sweptProjects []uuid.UUID
	downloadBytes []byte
}

func (fake *fakeBackups) ListBackups(
	context.Context, uuid.UUID, int,
) ([]dbcontrol.DatabaseBackup, *dbcontrol.DatabaseBackupState, error) {
	if fake.listErr != nil {
		return nil, nil, fake.listErr
	}
	return fake.backups, fake.state, nil
}

func (fake *fakeBackups) BackupProject(
	_ context.Context, _ uuid.UUID, kind dbcontrol.BackupKind,
) (*backup.Result, error) {
	fake.backupCalls++
	fake.backupKind = kind
	if fake.backupErr != nil {
		return nil, fake.backupErr
	}
	return &backup.Result{ObjectKey: "key", SizeBytes: 10, SHA256: "abc"}, nil
}

func (fake *fakeBackups) StartRestore(_ context.Context, projectID, backupID uuid.UUID) (*dbcontrol.DatabaseRestore, error) {
	fake.restoredID = backupID
	if fake.restoreErr != nil {
		return nil, fake.restoreErr
	}
	return &dbcontrol.DatabaseRestore{
		ID:          uuid.New(),
		ProjectID:   projectID,
		BackupID:    backupID,
		Status:      dbcontrol.RestorePending,
		RequestedAt: time.Now(),
	}, nil
}

func (fake *fakeBackups) RestoreStatus(_ context.Context, projectID, restoreID uuid.UUID) (*dbcontrol.DatabaseRestore, error) {
	if fake.restoreStatusErr != nil {
		return nil, fake.restoreStatusErr
	}
	return &dbcontrol.DatabaseRestore{
		ID:        restoreID,
		ProjectID: projectID,
		Status:    dbcontrol.RestoreSucceeded,
	}, nil
}

func (fake *fakeBackups) ActiveRestore(context.Context, uuid.UUID) (*dbcontrol.DatabaseRestore, error) {
	return fake.activeRestore, nil
}

func (fake *fakeBackups) GetBackup(_ context.Context, _, backupID uuid.UUID) (*dbcontrol.DatabaseBackup, error) {
	if fake.getErr != nil {
		return nil, fake.getErr
	}
	for index := range fake.backups {
		if fake.backups[index].ID == backupID {
			return &fake.backups[index], nil
		}
	}
	return &dbcontrol.DatabaseBackup{
		ID: backupID, Kind: dbcontrol.BackupDaily, SizeBytes: 10, SHA256: "abc",
	}, nil
}

func (fake *fakeBackups) DownloadBackup(_ context.Context, _, backupID uuid.UUID) (io.ReadCloser, *dbcontrol.DatabaseBackup, error) {
	if fake.getErr != nil {
		return nil, nil, fake.getErr
	}
	body := io.NopCloser(bytes.NewReader(fake.downloadBytes))
	return body, &dbcontrol.DatabaseBackup{
		ID: backupID, Kind: dbcontrol.BackupDaily, SizeBytes: int64(len(fake.downloadBytes)),
	}, nil
}

func (fake *fakeBackups) DeleteBackup(_ context.Context, _, backupID uuid.UUID) error {
	fake.deletedID = backupID
	return fake.deleteErr
}

func (fake *fakeBackups) SnapshotPath(_ context.Context, _, backupID uuid.UUID) (string, error) {
	fake.snapshotID = backupID
	if fake.snapErr != nil {
		return "", fake.snapErr
	}
	return "/tmp/snapshot.sqlite", nil
}

func (fake *fakeBackups) DeleteProjectBackups(_ context.Context, projectID uuid.UUID) error {
	fake.sweptProjects = append(fake.sweptProjects, projectID)
	return nil
}

func (fake *fakeBackups) LatestRegularBackup(_ context.Context, projectID uuid.UUID) (*dbcontrol.DatabaseBackup, error) {
	if fake.getErr != nil {
		return nil, fake.getErr
	}
	if fake.backups != nil && len(fake.backups) > 0 {
		return &fake.backups[len(fake.backups)-1], nil
	}
	return nil, dbcontrol.ErrNotFound
}

// backupRequest builds a signed-in request for a project, with the project id
// and the user id already in the context.
func backupRequest(
	t *testing.T, method, path string, projectID uuid.UUID,
) *http.Request {
	t.Helper()

	signer, err := session.NewSigner("a-test-secret-that-is-definitely-long-enough", time.Hour)
	if err != nil {
		t.Fatalf("new signer: %v", err)
	}
	token, err := signer.Issue(testUserID.String(), "ketut@example.com", 0, time.Now())
	if err != nil {
		t.Fatalf("issue: %v", err)
	}

	request := httptest.NewRequest(method, path, nil)
	request.AddCookie(&http.Cookie{Name: auth.SessionCookieName, Value: token})
	request = withProjectID(request, projectID)
	return request.WithContext(context.WithValue(
		request.Context(), auth.ContextKeyUserID, testUserID.String()))
}

// withBackupID attaches the {backup_id} route parameter the way the router does.
func withBackupID(request *http.Request, backupID uuid.UUID) *http.Request {
	routeContext := chi.NewRouteContext()
	routeContext.URLParams.Add("backup_id", backupID.String())
	return request.WithContext(context.WithValue(
		request.Context(), chi.RouteCtxKey, routeContext))
}

// backupPlane wires a handler with a live fake backup service and a project the
// test user owns.
func backupPlane(t *testing.T) (*ControlPlane, *fakeBackups, uuid.UUID) {
	t.Helper()

	handler, store, _ := testControlPlane(testUserID)
	projectID := uuid.New()
	store.projects[projectID] = &dbcontrol.Project{
		ID:     projectID,
		UserID: testUserID,
		Name:   "demo",
		Status: dbcontrol.ProjectReady,
	}

	backups := &fakeBackups{}
	handler.backups = backups
	return handler, backups, projectID
}

func TestListBackupsDisabled(t *testing.T) {
	handler, store, _ := testControlPlane(testUserID)
	projectID := uuid.New()
	store.projects[projectID] = &dbcontrol.Project{
		ID: projectID, UserID: testUserID, Status: dbcontrol.ProjectReady,
	}
	// handler.backups is nil, which is how a server without backup storage is
	// wired.

	recorder := httptest.NewRecorder()
	handler.ListBackups(recorder, backupRequest(t, http.MethodGet, "/", projectID))

	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", recorder.Code)
	}

	var body BackupsResponse
	decodeBody(t, recorder, &body)
	if body.Enabled {
		t.Errorf("enabled = true, want false when backups are off")
	}
	if len(body.Backups) != 0 {
		t.Errorf("backups = %v, want empty", body.Backups)
	}
}

func TestListBackupsEnabled(t *testing.T) {
	handler, backups, projectID := backupPlane(t)
	lastSuccess := time.Now().Add(-time.Hour)
	backups.backups = []dbcontrol.DatabaseBackup{
		{ID: uuid.New(), Kind: dbcontrol.BackupDaily, SizeBytes: 2048, SHA256: "deadbeef", CreatedAt: time.Now()},
	}
	backups.state = &dbcontrol.DatabaseBackupState{
		LastSuccessAt: &lastSuccess,
		LastSizeBytes: 2048,
	}

	recorder := httptest.NewRecorder()
	handler.ListBackups(recorder, backupRequest(t, http.MethodGet, "/", projectID))

	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", recorder.Code)
	}
	var body BackupsResponse
	decodeBody(t, recorder, &body)
	if !body.Enabled {
		t.Errorf("enabled = false, want true")
	}
	if len(body.Backups) != 1 {
		t.Fatalf("backups = %d, want 1", len(body.Backups))
	}
	if body.Backups[0].Kind != "daily" {
		t.Errorf("kind = %q, want daily", body.Backups[0].Kind)
	}
	if body.State.LastSuccessAt == nil {
		t.Errorf("last_success_at = nil, want a time")
	}
}

func TestCreateBackupDisabled(t *testing.T) {
	handler, store, _ := testControlPlane(testUserID)
	projectID := uuid.New()
	store.projects[projectID] = &dbcontrol.Project{
		ID: projectID, UserID: testUserID, Status: dbcontrol.ProjectReady,
	}

	recorder := httptest.NewRecorder()
	handler.CreateBackup(recorder, backupRequest(t, http.MethodPost, "/", projectID))

	if recorder.Code != http.StatusServiceUnavailable {
		t.Fatalf("status = %d, want 503", recorder.Code)
	}
	if code := errorCode(t, recorder); code != "backups_disabled" {
		t.Errorf("code = %q, want backups_disabled", code)
	}
}

func TestCreateBackupRecordsManualKind(t *testing.T) {
	handler, backups, projectID := backupPlane(t)

	recorder := httptest.NewRecorder()
	handler.CreateBackup(recorder, backupRequest(t, http.MethodPost, "/", projectID))

	if recorder.Code != http.StatusCreated {
		t.Fatalf("status = %d, want 201", recorder.Code)
	}
	if backups.backupCalls != 1 {
		t.Fatalf("backup calls = %d, want 1", backups.backupCalls)
	}
	if backups.backupKind != dbcontrol.BackupManual {
		t.Errorf("kind = %q, want manual", backups.backupKind)
	}
}

func TestRestoreBackupRejectsBadID(t *testing.T) {
	handler, backups, projectID := backupPlane(t)

	request := backupRequest(t, http.MethodPost, "/", projectID)
	routeContext := chi.NewRouteContext()
	routeContext.URLParams.Add("backup_id", "not-a-uuid")
	request = request.WithContext(context.WithValue(request.Context(), chi.RouteCtxKey, routeContext))

	recorder := httptest.NewRecorder()
	handler.RestoreBackup(recorder, request)

	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", recorder.Code)
	}
	if backups.restoredID != uuid.Nil {
		t.Errorf("restore ran with a malformed id")
	}
}

func TestRestoreBackupSuccess(t *testing.T) {
	handler, backups, projectID := backupPlane(t)
	backupID := uuid.New()

	recorder := httptest.NewRecorder()
	handler.RestoreBackup(recorder, withBackupID(
		backupRequest(t, http.MethodPost, "/", projectID), backupID))

	if recorder.Code != http.StatusAccepted {
		t.Fatalf("status = %d, want 202", recorder.Code)
	}
	if backups.restoredID != backupID {
		t.Errorf("restored id = %v, want %v", backups.restoredID, backupID)
	}

	var body RestoreResponse
	if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode restore: %v", err)
	}
	if body.Status != string(dbcontrol.RestorePending) {
		t.Errorf("status = %q, want pending", body.Status)
	}
	if body.BackupID != backupID {
		t.Errorf("backup id = %v, want %v", body.BackupID, backupID)
	}
}

func TestGetRestoreReturnsStatus(t *testing.T) {
	handler, _, projectID := backupPlane(t)
	restoreID := uuid.New()

	request := backupRequest(t, http.MethodGet, "/", projectID)
	routeContext := chi.NewRouteContext()
	routeContext.URLParams.Add("restore_id", restoreID.String())
	request = request.WithContext(context.WithValue(request.Context(), chi.RouteCtxKey, routeContext))

	recorder := httptest.NewRecorder()
	handler.GetRestore(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", recorder.Code)
	}

	var body RestoreResponse
	if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode restore: %v", err)
	}
	if body.ID != restoreID {
		t.Errorf("id = %v, want %v", body.ID, restoreID)
	}
}

func TestGetRestoreMissingIsNotFound(t *testing.T) {
	handler, backups, projectID := backupPlane(t)
	backups.restoreStatusErr = dbcontrol.ErrNotFound

	request := backupRequest(t, http.MethodGet, "/", projectID)
	routeContext := chi.NewRouteContext()
	routeContext.URLParams.Add("restore_id", uuid.New().String())
	request = request.WithContext(context.WithValue(request.Context(), chi.RouteCtxKey, routeContext))

	recorder := httptest.NewRecorder()
	handler.GetRestore(recorder, request)

	if recorder.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want 404", recorder.Code)
	}
}

func TestRestoreBackupErrors(t *testing.T) {
	cases := []struct {
		name   string
		err    error
		status int
		code   string
	}{
		{"not found", dbcontrol.ErrNotFound, http.StatusNotFound, "backup_not_found"},
		{"corrupt", backup.ErrBackupCorrupt, http.StatusUnprocessableEntity, "backup_unusable"},
		{"invalid snapshot", dbplane.ErrInvalidSnapshot, http.StatusUnprocessableEntity, "backup_unusable"},
		{"already restoring", dbplane.ErrRestoring, http.StatusConflict, "restore_in_progress"},
		{"already queued", dbcontrol.ErrRestoreInProgress, http.StatusConflict, "restore_in_progress"},
	}

	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			handler, backups, projectID := backupPlane(t)
			backups.restoreErr = testCase.err

			recorder := httptest.NewRecorder()
			handler.RestoreBackup(recorder, withBackupID(
				backupRequest(t, http.MethodPost, "/", projectID), uuid.New()))

			if recorder.Code != testCase.status {
				t.Fatalf("status = %d, want %d", recorder.Code, testCase.status)
			}
			if code := errorCode(t, recorder); code != testCase.code {
				t.Errorf("code = %q, want %q", code, testCase.code)
			}
		})
	}
}

func TestListBackupsRejectsForeignProject(t *testing.T) {
	handler, store, _ := testControlPlane(testUserID)
	foreign := uuid.New()
	store.projects[foreign] = &dbcontrol.Project{
		ID: foreign, UserID: otherUserID, Status: dbcontrol.ProjectReady,
	}

	recorder := httptest.NewRecorder()
	handler.ListBackups(recorder, backupRequest(t, http.MethodGet, "/", foreign))

	// 404, not 403: the response must not confirm the project exists.
	if recorder.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want 404", recorder.Code)
	}
	if code := errorCode(t, recorder); code != "project_not_found" {
		t.Errorf("code = %q, want project_not_found", code)
	}
}

// backupQueryRequest builds the viewer's POST: the console's JSON body against
// a backup id.
func backupQueryRequest(t *testing.T, projectID uuid.UUID, backupID uuid.UUID, body string) *http.Request {
	t.Helper()
	request := backupRequest(t, http.MethodPost, "/query", projectID)
	request.Body = io.NopCloser(strings.NewReader(body))
	request.Header.Set("Content-Type", "application/json")
	return withBackupID(request, backupID)
}

func TestGetBackupReturnsEntry(t *testing.T) {
	handler, backups, projectID := backupPlane(t)
	backupID := uuid.New()
	backups.backups = []dbcontrol.DatabaseBackup{
		{ID: backupID, Kind: dbcontrol.BackupDaily, SizeBytes: 4096, SHA256: "abc", CreatedAt: time.Now()},
	}

	recorder := httptest.NewRecorder()
	handler.GetBackup(recorder, withBackupID(
		backupRequest(t, http.MethodGet, "/", projectID), backupID))

	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", recorder.Code)
	}
	var body BackupResponse
	decodeBody(t, recorder, &body)
	if body.ID != backupID {
		t.Errorf("id = %v, want %v", body.ID, backupID)
	}
	if body.Kind != "daily" {
		t.Errorf("kind = %q, want daily", body.Kind)
	}
}

func TestBackupActionsDisabled(t *testing.T) {
	// A server without backup storage answers 503 to the mutating actions
	// rather than pretending the backup does not exist.
	handler, store, _ := testControlPlane(testUserID)
	projectID := uuid.New()
	store.projects[projectID] = &dbcontrol.Project{
		ID: projectID, UserID: testUserID, Status: dbcontrol.ProjectReady,
	}

	recorder := httptest.NewRecorder()
	handler.GetBackup(recorder, withBackupID(
		backupRequest(t, http.MethodGet, "/", projectID), uuid.New()))
	if recorder.Code != http.StatusServiceUnavailable {
		t.Fatalf("get status = %d, want 503", recorder.Code)
	}
	if code := errorCode(t, recorder); code != "backups_disabled" {
		t.Errorf("get code = %q, want backups_disabled", code)
	}

	recorder = httptest.NewRecorder()
	handler.DeleteBackup(recorder, withBackupID(
		backupRequest(t, http.MethodDelete, "/", projectID), uuid.New()))
	if recorder.Code != http.StatusServiceUnavailable {
		t.Fatalf("delete status = %d, want 503", recorder.Code)
	}

	recorder = httptest.NewRecorder()
	handler.QueryBackup(recorder, backupQueryRequest(t, projectID, uuid.New(),
		`{"query":"SELECT 1","args":[]}`))
	if recorder.Code != http.StatusServiceUnavailable {
		t.Fatalf("query status = %d, want 503", recorder.Code)
	}
}

func TestDownloadBackupStreamsObject(t *testing.T) {
	handler, backups, projectID := backupPlane(t)
	backupID := uuid.New()
	backups.downloadBytes = []byte("SQLite format 3\x00 one database")

	recorder := httptest.NewRecorder()
	handler.DownloadBackup(recorder, withBackupID(
		backupRequest(t, http.MethodGet, "/download", projectID), backupID))

	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", recorder.Code)
	}
	if got := recorder.Body.Bytes(); !bytes.Equal(got, backups.downloadBytes) {
		t.Errorf("body = %q, want %q", got, backups.downloadBytes)
	}
	if disposition := recorder.Header().Get("Content-Disposition"); !strings.Contains(disposition, "attachment") {
		t.Errorf("Content-Disposition = %q, want an attachment", disposition)
	}
	if length := recorder.Header().Get("Content-Length"); length != strconv.Itoa(len(backups.downloadBytes)) {
		t.Errorf("Content-Length = %q, want %d", length, len(backups.downloadBytes))
	}
}

// publicDownloadPlane wires a handler whose public download endpoint works,
// returning the handler and store so a test can issue and inspect tokens.
func publicDownloadPlane(t *testing.T) (*ControlPlane, *fakeStore, *fakeBackups, uuid.UUID) {
	t.Helper()

	handler, store, _ := testControlPlane(testUserID)
	handler.cfg.BackupDownloadTTL = time.Hour

	projectID := uuid.New()
	store.projects[projectID] = &dbcontrol.Project{
		ID: projectID, UserID: testUserID, Name: "demo", Status: dbcontrol.ProjectReady,
	}

	backups := &fakeBackups{downloadBytes: []byte("SQLite format 3\x00 one database")}
	handler.backups = backups
	return handler, store, backups, projectID
}

// publicDownloadRequest builds the POST that the site's /backup-download page
// makes when the owner clicks Download. The token is in the JSON body, not the
// URL, which is what keeps a mail scanner that opens the emailed link from
// spending it.
func publicDownloadRequest(token string) *http.Request {
	body := strings.NewReader(`{"token":` + strconv.Quote(token) + `}`)
	request := httptest.NewRequest(http.MethodPost, "/api/backup-download", body)
	request.Header.Set("Content-Type", "application/json")
	return request
}

func TestPublicBackupDownloadIsSingleUse(t *testing.T) {
	// The link from a notification email must work once and then die: a second
	// click — or a leaked URL — is refused rather than replayable.
	handler, _, backups, projectID := publicDownloadPlane(t)

	token, err := handler.generateBackupDownloadToken(context.Background(), projectID, uuid.New())
	if err != nil {
		t.Fatalf("generate token: %v", err)
	}

	first := httptest.NewRecorder()
	handler.DownloadBackupPublic(first, publicDownloadRequest(token))
	if first.Code != http.StatusOK {
		t.Fatalf("first download status = %d, want 200", first.Code)
	}
	if !bytes.Equal(first.Body.Bytes(), backups.downloadBytes) {
		t.Errorf("first download body = %q, want the object", first.Body.Bytes())
	}

	second := httptest.NewRecorder()
	handler.DownloadBackupPublic(second, publicDownloadRequest(token))
	if second.Code != http.StatusUnauthorized {
		t.Fatalf("second download status = %d, want 401", second.Code)
	}
	if code := errorCode(t, second); code != "invalid_token" {
		t.Errorf("second download code = %q, want invalid_token", code)
	}
}

func TestPublicBackupDownloadRejectsUnknownToken(t *testing.T) {
	handler, _, _, _ := publicDownloadPlane(t)

	recorder := httptest.NewRecorder()
	handler.DownloadBackupPublic(recorder, publicDownloadRequest("not-a-real-token"))

	if recorder.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401", recorder.Code)
	}
	if code := errorCode(t, recorder); code != "invalid_token" {
		t.Errorf("code = %q, want invalid_token", code)
	}
}

func TestPublicBackupDownloadRequiresToken(t *testing.T) {
	handler, _, _, _ := publicDownloadPlane(t)

	recorder := httptest.NewRecorder()
	handler.DownloadBackupPublic(recorder, publicDownloadRequest(""))

	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", recorder.Code)
	}
	if code := errorCode(t, recorder); code != "missing_token" {
		t.Errorf("code = %q, want missing_token", code)
	}
}

func TestPublicBackupDownloadRejectsExpiredToken(t *testing.T) {
	// An unused link that aged out is refused, and the raw token is never the
	// key: the store is asked for the hash of what the client sent.
	handler, store, _, projectID := publicDownloadPlane(t)

	raw := "expired-token-value"
	store.downloadTokens[hashOpaqueToken(raw)] = downloadTokenRow{
		projectID: projectID,
		backupID:  uuid.New(),
		expiresAt: time.Now().Add(-time.Minute),
	}

	recorder := httptest.NewRecorder()
	handler.DownloadBackupPublic(recorder, publicDownloadRequest(raw))

	if recorder.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401", recorder.Code)
	}
}

func TestPublicBackupDownloadHidesStoreFailure(t *testing.T) {
	// The endpoint answers an anonymous caller, so a store failure must not
	// hand back the internal error text the session routes include.
	handler, store, _, _ := publicDownloadPlane(t)
	store.downloadConsumeErr = errors.New("connection refused to the control plane")

	recorder := httptest.NewRecorder()
	handler.DownloadBackupPublic(recorder, publicDownloadRequest("whatever"))

	if recorder.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want 500", recorder.Code)
	}
	if body := recorder.Body.String(); strings.Contains(body, "connection refused") {
		t.Errorf("500 body leaked the internal error: %q", body)
	}
}

func TestDeleteBackupSuccess(t *testing.T) {
	handler, backups, projectID := backupPlane(t)
	backupID := uuid.New()

	recorder := httptest.NewRecorder()
	handler.DeleteBackup(recorder, withBackupID(
		backupRequest(t, http.MethodDelete, "/", projectID), backupID))

	if recorder.Code != http.StatusNoContent {
		t.Fatalf("status = %d, want 204", recorder.Code)
	}
	if backups.deletedID != backupID {
		t.Errorf("deleted id = %v, want %v", backups.deletedID, backupID)
	}
}

func TestDeleteBackupRejectsBadID(t *testing.T) {
	handler, backups, projectID := backupPlane(t)

	request := backupRequest(t, http.MethodDelete, "/", projectID)
	routeContext := chi.NewRouteContext()
	routeContext.URLParams.Add("backup_id", "not-a-uuid")
	request = request.WithContext(context.WithValue(request.Context(), chi.RouteCtxKey, routeContext))

	recorder := httptest.NewRecorder()
	handler.DeleteBackup(recorder, request)

	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", recorder.Code)
	}
	if backups.deletedID != uuid.Nil {
		t.Errorf("delete ran with a malformed id")
	}
}

func TestDeleteBackupNotFound(t *testing.T) {
	handler, backups, projectID := backupPlane(t)
	backups.deleteErr = dbcontrol.ErrNotFound

	recorder := httptest.NewRecorder()
	handler.DeleteBackup(recorder, withBackupID(
		backupRequest(t, http.MethodDelete, "/", projectID), uuid.New()))

	if recorder.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want 404", recorder.Code)
	}
	if code := errorCode(t, recorder); code != "backup_not_found" {
		t.Errorf("code = %q, want backup_not_found", code)
	}
}

func TestQueryBackupRunsReadAgainstSnapshot(t *testing.T) {
	handler, backups, projectID := backupPlane(t)
	plane := handler.databases.(*fakeDatabases)
	backupID := uuid.New()

	recorder := httptest.NewRecorder()
	handler.QueryBackup(recorder, backupQueryRequest(t, projectID, backupID,
		`{"query":"SELECT 1","args":[]}`))

	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200: %s", recorder.Code, recorder.Body.String())
	}
	if backups.snapshotID != backupID {
		t.Errorf("snapshot id = %v, want %v", backups.snapshotID, backupID)
	}
	if len(plane.snapshotCalls) != 1 {
		t.Fatalf("snapshot calls = %d, want 1", len(plane.snapshotCalls))
	}
	if plane.snapshotCalls[0].query != "SELECT 1" {
		t.Errorf("statement = %q, want SELECT 1", plane.snapshotCalls[0].query)
	}

	var response QueryResponse
	decodeBody(t, recorder, &response)
	if !response.Success {
		t.Error("expected a successful response")
	}
	if response.RowCount != 1 {
		t.Errorf("row_count = %d, want 1", response.RowCount)
	}
}

func TestQueryBackupRefusesWrite(t *testing.T) {
	handler, backups, projectID := backupPlane(t)
	plane := handler.databases.(*fakeDatabases)
	backupID := uuid.New()

	recorder := httptest.NewRecorder()
	handler.QueryBackup(recorder, backupQueryRequest(t, projectID, backupID,
		`{"query":"DELETE FROM users","args":[]}`))

	// A viewer must never write, and it must refuse before the snapshot is
	// even opened.
	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", recorder.Code)
	}
	if code := errorCode(t, recorder); code != "not_a_read" {
		t.Errorf("code = %q, want not_a_read", code)
	}
	if len(plane.snapshotCalls) != 0 {
		t.Errorf("a write reached the snapshot")
	}
	if backups.snapshotID != uuid.Nil {
		t.Errorf("the snapshot was opened for a write")
	}
}

func TestQueryBackupMissingSnapshot(t *testing.T) {
	handler, backups, projectID := backupPlane(t)
	backups.snapErr = dbcontrol.ErrNotFound

	recorder := httptest.NewRecorder()
	handler.QueryBackup(recorder, backupQueryRequest(t, projectID, uuid.New(),
		`{"query":"SELECT 1","args":[]}`))

	if recorder.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want 404", recorder.Code)
	}
	if code := errorCode(t, recorder); code != "backup_not_found" {
		t.Errorf("code = %q, want backup_not_found", code)
	}
}
