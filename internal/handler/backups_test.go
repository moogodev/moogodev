package handler

import (
	"context"
	"net/http"
	"net/http/httptest"
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

	listErr    error
	backupErr  error
	restoreErr error

	backupCalls int
	backupKind  dbcontrol.BackupKind
	restoredID  uuid.UUID
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

func (fake *fakeBackups) RestoreProject(_ context.Context, _, backupID uuid.UUID) error {
	fake.restoredID = backupID
	return fake.restoreErr
}

func (fake *fakeBackups) DeleteProjectBackups(context.Context, uuid.UUID) error {
	return nil
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

	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", recorder.Code)
	}
	if backups.restoredID != backupID {
		t.Errorf("restored id = %v, want %v", backups.restoredID, backupID)
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
