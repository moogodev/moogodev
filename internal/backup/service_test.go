package backup

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/moogodev/moogodev/internal/dbcontrol"
	"github.com/moogodev/moogodev/internal/storage"
	"github.com/moogodev/moogodev/pkg/logger"
)

// --- fakes ---------------------------------------------------------------

type fakeDatabases struct {
	snapshotPath string
	modTime      time.Time
	modErr       error
	backupErr    error

	restoreErr       error
	restored         string
	restoredContents []byte
	restores         int

	// verifyErr is returned by VerifySnapshot; verified records the paths the
	// drill asked to check.
	verifyErr error
	verified  []string
}

func (fake *fakeDatabases) BackupDatabase(_ context.Context, _ uuid.UUID) (string, error) {
	if fake.backupErr != nil {
		return "", fake.backupErr
	}
	return fake.snapshotPath, nil
}

func (fake *fakeDatabases) DatabaseModTime(_ uuid.UUID) (time.Time, error) {
	return fake.modTime, fake.modErr
}

func (fake *fakeDatabases) RestoreDatabase(_ context.Context, _ uuid.UUID, snapshotPath string) error {
	fake.restores++
	fake.restored = snapshotPath
	if fake.restoreErr == nil {
		// Read the bytes now: the caller removes the temp file once the call
		// returns, exactly as the real restore would.
		if contents, err := os.ReadFile(snapshotPath); err == nil {
			fake.restoredContents = contents
		}
	}
	return fake.restoreErr
}

func (fake *fakeDatabases) VerifySnapshot(_ context.Context, path string) error {
	fake.verified = append(fake.verified, path)
	return fake.verifyErr
}

type fakeObjects struct {
	mu      sync.Mutex
	stored  map[string][]byte
	putErr  error
	getErr  error
	delete  map[string]error
	deleted []string
	listed  []storage.Object
	listErr error
}

func newFakeObjects() *fakeObjects {
	return &fakeObjects{stored: map[string][]byte{}, delete: map[string]error{}}
}

func (fake *fakeObjects) PutObject(_ context.Context, key string, body io.ReadSeeker, size int64, sha256Hex, _ string) error {
	if fake.putErr != nil {
		return fake.putErr
	}
	data, err := io.ReadAll(body)
	if err != nil {
		return err
	}
	if int64(len(data)) != size {
		return errors.New("size mismatch in fake put")
	}
	fake.mu.Lock()
	defer fake.mu.Unlock()
	fake.stored[key] = data
	return nil
}

func (fake *fakeObjects) GetObject(_ context.Context, key string) (io.ReadCloser, storage.Object, error) {
	if fake.getErr != nil {
		return nil, storage.Object{}, fake.getErr
	}
	fake.mu.Lock()
	data, ok := fake.stored[key]
	fake.mu.Unlock()
	if !ok {
		return nil, storage.Object{}, storage.ErrObjectNotFound
	}
	return io.NopCloser(bytes.NewReader(data)), storage.Object{Key: key, Size: int64(len(data))}, nil
}

func (fake *fakeObjects) DeleteObject(_ context.Context, key string) error {
	if err, ok := fake.delete[key]; ok && err != nil {
		return err
	}
	fake.mu.Lock()
	defer fake.mu.Unlock()
	delete(fake.stored, key)
	fake.deleted = append(fake.deleted, key)
	return nil
}

func (fake *fakeObjects) ListPrefix(_ context.Context, _ string) ([]storage.Object, error) {
	return fake.listed, fake.listErr
}

type recordedSuccess struct {
	projectID uuid.UUID
	kind      dbcontrol.BackupKind
	objectKey string
	sha256    string
	size      int64
	watermark time.Time
}

type fakeProjects struct {
	due        []dbcontrol.Project
	dueErr     error
	state      *dbcontrol.DatabaseBackupState
	stateErr   error
	byID       *dbcontrol.DatabaseBackup
	byIDErr    error
	latest     *dbcontrol.DatabaseBackup
	latestErr  error
	expired    []dbcontrol.DatabaseBackup
	expiredErr error
	recordErr  error

	successes   []recordedSuccess
	failures    []uuid.UUID
	failureMsgs []string
	failureErr  error
	current     []uuid.UUID
	deletedRows [][]uuid.UUID
	deletedProj []uuid.UUID

	// failureCount is the streak the fake tracks so a suite can simulate a
	// project that failed repeatedly before succeeding.
	failureCount int

	// lockBusy makes the per-project lock report contention, simulating another
	// run already backing the project up.
	lockBusy bool
	lockErr  error
	locked   []uuid.UUID

	// verifyDue is the drill queue; verifications records what was recorded.
	verifyDue       []dbcontrol.Project
	verifyDueErr    error
	verifications   []*string
	verificationErr error
}

func (fake *fakeProjects) ProjectsDueForBackup(_ context.Context, _ time.Duration, _ int) ([]dbcontrol.Project, error) {
	return fake.due, fake.dueErr
}

func (fake *fakeProjects) ProjectBackupState(_ context.Context, projectID uuid.UUID) (*dbcontrol.DatabaseBackupState, error) {
	if fake.stateErr != nil {
		return nil, fake.stateErr
	}
	if fake.state != nil {
		return fake.state, nil
	}
	return &dbcontrol.DatabaseBackupState{ProjectID: projectID}, nil
}

func (fake *fakeProjects) RecordBackupSuccess(_ context.Context, projectID uuid.UUID, kind dbcontrol.BackupKind, objectKey, sha256 string, sizeBytes int64, sourceModifiedAt time.Time) (int, error) {
	if fake.recordErr != nil {
		return 0, fake.recordErr
	}
	fake.successes = append(fake.successes, recordedSuccess{
		projectID: projectID, kind: kind, objectKey: objectKey,
		sha256: sha256, size: sizeBytes, watermark: sourceModifiedAt,
	})
	previous := fake.failureCount
	fake.failureCount = 0
	return previous, nil
}

func (fake *fakeProjects) MarkBackupCurrent(_ context.Context, projectID uuid.UUID) error {
	fake.current = append(fake.current, projectID)
	return nil
}

func (fake *fakeProjects) RecordBackupFailure(_ context.Context, projectID uuid.UUID, reason string) (int, error) {
	fake.failures = append(fake.failures, projectID)
	fake.failureMsgs = append(fake.failureMsgs, reason)
	if fake.failureErr != nil {
		return 0, fake.failureErr
	}
	fake.failureCount++
	return fake.failureCount, nil
}

func (fake *fakeProjects) DatabaseBackupByID(_ context.Context, _, _ uuid.UUID) (*dbcontrol.DatabaseBackup, error) {
	return fake.byID, fake.byIDErr
}

func (fake *fakeProjects) LatestRegularBackup(_ context.Context, _ uuid.UUID) (*dbcontrol.DatabaseBackup, error) {
	return fake.latest, fake.latestErr
}

func (fake *fakeProjects) ListDatabaseBackups(_ context.Context, _ uuid.UUID, _ int, _ int) ([]dbcontrol.DatabaseBackup, error) {
	return nil, nil
}

func (fake *fakeProjects) ExpiredBackups(_ context.Context, _ uuid.UUID, _ time.Time) ([]dbcontrol.DatabaseBackup, error) {
	return fake.expired, fake.expiredErr
}

func (fake *fakeProjects) DeleteBackupRows(_ context.Context, ids []uuid.UUID) error {
	fake.deletedRows = append(fake.deletedRows, ids)
	return nil
}

func (fake *fakeProjects) DeleteProjectBackups(_ context.Context, projectID uuid.UUID) error {
	fake.deletedProj = append(fake.deletedProj, projectID)
	return nil
}

func (fake *fakeProjects) TryProjectBackupLock(_ context.Context, projectID uuid.UUID) (func(), bool, error) {
	if fake.lockErr != nil {
		return nil, false, fake.lockErr
	}
	if fake.lockBusy {
		return nil, false, nil
	}
	fake.locked = append(fake.locked, projectID)
	return func() {}, true, nil
}

func (fake *fakeProjects) ProjectsDueForVerification(_ context.Context, _ time.Duration, _ int) ([]dbcontrol.Project, error) {
	return fake.verifyDue, fake.verifyDueErr
}

func (fake *fakeProjects) RecordBackupVerification(_ context.Context, _ uuid.UUID, verifyErr *string) error {
	fake.verifications = append(fake.verifications, verifyErr)
	return fake.verificationErr
}

// --- helpers -------------------------------------------------------------

func writeSnapshot(t *testing.T, contents string) string {
	t.Helper()
	dir := t.TempDir()
	path := filepath.Join(dir, "snapshot.sqlite")
	if err := os.WriteFile(path, []byte(contents), 0o600); err != nil {
		t.Fatalf("write snapshot: %v", err)
	}
	return path
}

func newTestService(t *testing.T, cfg Config) (*Service, *fakeProjects, *fakeDatabases, *fakeObjects) {
	t.Helper()
	projects := &fakeProjects{}
	databases := &fakeDatabases{modTime: time.Unix(1000, 0)}
	objects := newFakeObjects()
	service := New(projects, databases, objects, cfg, logger.Nop())
	return service, projects, databases, objects
}

// --- tests ---------------------------------------------------------------

// fakeNotifier records the alerts the service raises, so a test can assert on
// how many fired and when.
type fakeNotifier struct {
	failing   []uuid.UUID
	recovered []uuid.UUID
}

func (n *fakeNotifier) BackupFailing(_ context.Context, projectID uuid.UUID, _ int, _ string) {
	n.failing = append(n.failing, projectID)
}

func (n *fakeNotifier) BackupRecovered(_ context.Context, projectID uuid.UUID) {
	n.recovered = append(n.recovered, projectID)
}

func TestBackupAlertsAtThresholdAndOnRecovery(t *testing.T) {
	service, _, databases, _ := newTestService(t, Config{Prefix: "db", AlertAfter: 2})
	notifier := &fakeNotifier{}
	service.notifier = notifier
	databases.snapshotPath = writeSnapshot(t, "bytes")
	projectID := uuid.New()

	databases.backupErr = errors.New("disk full")
	if _, err := service.BackupProject(context.Background(), projectID, dbcontrol.BackupDaily); err == nil {
		t.Fatal("expected the first attempt to fail")
	}
	if len(notifier.failing) != 0 {
		t.Fatalf("alerted before the threshold: %v", notifier.failing)
	}

	if _, err := service.BackupProject(context.Background(), projectID, dbcontrol.BackupDaily); err == nil {
		t.Fatal("expected the second attempt to fail")
	}
	if len(notifier.failing) != 1 {
		t.Fatalf("failing alerts = %v, want one at the threshold", notifier.failing)
	}

	// A project that keeps failing must not alert again on every attempt.
	if _, err := service.BackupProject(context.Background(), projectID, dbcontrol.BackupDaily); err == nil {
		t.Fatal("expected the third attempt to fail")
	}
	if len(notifier.failing) != 1 {
		t.Fatalf("failing alerts = %v, want exactly one", notifier.failing)
	}

	databases.backupErr = nil
	if _, err := service.BackupProject(context.Background(), projectID, dbcontrol.BackupDaily); err != nil {
		t.Fatalf("recovery backup: %v", err)
	}
	if len(notifier.recovered) != 1 {
		t.Fatalf("recovery alerts = %v, want one", notifier.recovered)
	}
}

func TestBackupRecoveryDoesNotAlertWithoutPriorThreshold(t *testing.T) {
	service, _, databases, _ := newTestService(t, Config{Prefix: "db", AlertAfter: 3})
	notifier := &fakeNotifier{}
	service.notifier = notifier
	databases.snapshotPath = writeSnapshot(t, "bytes")

	// No prior failures: an ordinary successful backup must stay quiet.
	if _, err := service.BackupProject(context.Background(), uuid.New(), dbcontrol.BackupDaily); err != nil {
		t.Fatalf("backup: %v", err)
	}
	if len(notifier.recovered) != 0 {
		t.Fatalf("unexpected recovery alert: %v", notifier.recovered)
	}
}

func TestBackupProjectUploadsAndRecords(t *testing.T) {
	service, projects, databases, objects := newTestService(t, Config{Prefix: "db", MaxAge: time.Hour})
	databases.snapshotPath = writeSnapshot(t, "sqlite-bytes")
	projectID := uuid.New()

	result, err := service.BackupProject(context.Background(), projectID, dbcontrol.BackupDaily)
	if err != nil {
		t.Fatalf("backup: %v", err)
	}

	prefix := "db/" + projectID.String() + "/"
	wantKey := prefix + "daily/" + time.Now().UTC().Format("2006-01-02") + ".sqlite"
	if result.ObjectKey != wantKey {
		t.Errorf("object key = %q, want %q", result.ObjectKey, wantKey)
	}
	if _, ok := objects.stored[wantKey]; !ok {
		t.Errorf("daily object not uploaded")
	}
	// The latest pointer is a small JSON document naming the object, not a
	// second full copy of the database.
	pointerBytes, ok := objects.stored[prefix+"latest.json"]
	if !ok {
		t.Fatalf("latest.json not uploaded")
	}
	if _, ok := objects.stored[prefix+"latest.sqlite"]; ok {
		t.Errorf("latest.sqlite full copy should no longer be written")
	}
	var pointer latestPointer
	if err := json.Unmarshal(pointerBytes, &pointer); err != nil {
		t.Fatalf("latest.json is not valid JSON: %v", err)
	}
	if pointer.ObjectKey != wantKey {
		t.Errorf("pointer key = %q, want %q", pointer.ObjectKey, wantKey)
	}
	if pointer.SizeBytes != int64(len("sqlite-bytes")) {
		t.Errorf("pointer size = %d", pointer.SizeBytes)
	}
	if bytes.Equal(pointerBytes, []byte("sqlite-bytes")) {
		t.Errorf("the latest pointer must not be a copy of the database bytes")
	}

	if len(projects.successes) != 1 {
		t.Fatalf("recorded %d successes, want 1", len(projects.successes))
	}
	success := projects.successes[0]
	if success.kind != dbcontrol.BackupDaily {
		t.Errorf("kind = %q", success.kind)
	}
	if success.size != int64(len("sqlite-bytes")) {
		t.Errorf("size = %d", success.size)
	}
	if success.watermark != databases.modTime {
		t.Errorf("watermark = %v, want %v", success.watermark, databases.modTime)
	}
	if len(projects.failures) != 0 {
		t.Errorf("unexpected failures: %v", projects.failures)
	}
}

func TestBackupProjectRecordsFailureOnUploadError(t *testing.T) {
	service, projects, databases, _ := newTestService(t, Config{Prefix: "db"})
	databases.snapshotPath = writeSnapshot(t, "bytes")
	// The object store is unreachable.
	objects := newFakeObjects()
	objects.putErr = errors.New("network down")
	service.objects = objects

	if _, err := service.BackupProject(context.Background(), uuid.New(), dbcontrol.BackupManual); err == nil {
		t.Fatal("expected an error")
	}
	if len(projects.failures) != 1 {
		t.Fatalf("recorded %d failures, want 1", len(projects.failures))
	}
	if len(projects.successes) != 0 {
		t.Errorf("recorded a success despite the failure")
	}
}

func TestVerifyProjectRecordsSuccessfulDrill(t *testing.T) {
	service, projects, databases, objects := newTestService(t, Config{Prefix: "db"})
	projectID := uuid.New()

	// The fake download verifies size and checksum, so store matching bytes.
	body := []byte("sqlite-bytes")
	objectKey := "db/" + projectID.String() + "/daily/2026-01-01.sqlite"
	objects.stored[objectKey] = body
	projects.latest = &dbcontrol.DatabaseBackup{
		ObjectKey: objectKey,
		SHA256:    sha256Hex(body),
		SizeBytes: int64(len(body)),
	}

	if err := service.VerifyProject(context.Background(), projectID); err != nil {
		t.Fatalf("verify: %v", err)
	}
	if len(databases.verified) != 1 {
		t.Fatalf("verify snapshot calls = %d, want one", len(databases.verified))
	}
	if len(projects.verifications) != 1 || projects.verifications[0] != nil {
		t.Fatalf("recorded verifications = %v, want one nil (passing) record", projects.verifications)
	}
}

func TestVerifyProjectRecordsCorruptBackup(t *testing.T) {
	service, projects, databases, objects := newTestService(t, Config{Prefix: "db"})
	projectID := uuid.New()
	objectKey := "db/" + projectID.String() + "/daily/2026-01-01.sqlite"

	// The stored bytes do not match the checksum the history recorded, so the
	// drill must fail at the checksum before it ever opens the file.
	objects.stored[objectKey] = []byte("tampered")
	projects.latest = &dbcontrol.DatabaseBackup{
		ObjectKey: objectKey,
		SHA256:    sha256Hex([]byte("original")),
		SizeBytes: int64(len("original")),
	}

	err := service.VerifyProject(context.Background(), projectID)
	if !errors.Is(err, ErrBackupCorrupt) {
		t.Fatalf("err = %v, want ErrBackupCorrupt", err)
	}
	if len(databases.verified) != 0 {
		t.Errorf("a corrupt download must not reach the integrity check: %v", databases.verified)
	}
	if len(projects.verifications) != 1 || projects.verifications[0] == nil {
		t.Fatalf("recorded verifications = %v, want one non-nil (failing) record", projects.verifications)
	}
}

func TestVerifyDueProcessesTheQueue(t *testing.T) {
	service, projects, _, _ := newTestService(t, Config{Prefix: "db", VerifyBatchSize: 2})
	projects.verifyDue = []dbcontrol.Project{{ID: uuid.New()}, {ID: uuid.New()}}

	// No latest backup for either, so each records a vacuous pass; the point is
	// that the pass visits the whole queue.
	count, err := service.VerifyDue(context.Background(), 0)
	if err != nil {
		t.Fatalf("verify due: %v", err)
	}
	if count != 2 {
		t.Fatalf("count = %d, want 2", count)
	}
	if len(projects.verifications) != 2 {
		t.Fatalf("recorded verifications = %d, want 2", len(projects.verifications))
	}
}

func TestBackupProjectSkipsWhenLockHeld(t *testing.T) {
	service, projects, databases, objects := newTestService(t, Config{Prefix: "db"})
	databases.snapshotPath = writeSnapshot(t, "bytes")
	projects.lockBusy = true

	_, err := service.BackupProject(context.Background(), uuid.New(), dbcontrol.BackupManual)
	if !errors.Is(err, ErrBackupInProgress) {
		t.Fatalf("err = %v, want ErrBackupInProgress", err)
	}
	// Contention is not a failure: nothing is recorded and nothing is uploaded.
	if len(projects.failures) != 0 {
		t.Errorf("contention recorded as a failure: %v", projects.failures)
	}
	if len(objects.stored) != 0 {
		t.Errorf("a contended backup uploaded an object: %v", objects.stored)
	}
}

func TestRunOnceSkipsUnchangedProject(t *testing.T) {
	projectID := uuid.New()
	service, projects, databases, objects := newTestService(t, Config{Prefix: "db"})
	databases.snapshotPath = writeSnapshot(t, "bytes")

	sameTime := time.Unix(2000, 0)
	databases.modTime = sameTime
	projects.due = []dbcontrol.Project{{ID: projectID}}
	projects.state = &dbcontrol.DatabaseBackupState{
		ProjectID:            projectID,
		LastSuccessAt:        &sameTime,
		LastSourceModifiedAt: &sameTime,
	}

	processed, err := service.RunOnce(context.Background())
	if err != nil {
		t.Fatalf("run once: %v", err)
	}
	if processed != 1 {
		t.Errorf("processed = %d, want 1", processed)
	}
	if len(projects.current) != 1 {
		t.Errorf("project was not marked current")
	}
	if len(objects.stored) != 0 {
		t.Errorf("unchanged project was uploaded anyway: %v", objects.stored)
	}
}

func TestRunOnceBacksUpChangedProject(t *testing.T) {
	projectID := uuid.New()
	service, projects, databases, objects := newTestService(t, Config{Prefix: "db"})
	databases.snapshotPath = writeSnapshot(t, "changed-bytes")

	older := time.Unix(1000, 0)
	newer := time.Unix(2000, 0)
	databases.modTime = newer
	projects.due = []dbcontrol.Project{{ID: projectID}}
	projects.state = &dbcontrol.DatabaseBackupState{
		ProjectID:            projectID,
		LastSuccessAt:        &older,
		LastSourceModifiedAt: &older,
	}

	if _, err := service.RunOnce(context.Background()); err != nil {
		t.Fatalf("run once: %v", err)
	}
	if len(objects.stored) == 0 {
		t.Errorf("changed project was not uploaded")
	}
	if len(projects.successes) != 1 {
		t.Errorf("recorded %d successes, want 1", len(projects.successes))
	}
}

func TestRunOnceContinuesAfterProjectFailure(t *testing.T) {
	first, second := uuid.New(), uuid.New()
	service, projects, databases, _ := newTestService(t, Config{Prefix: "db"})
	databases.snapshotPath = writeSnapshot(t, "bytes")
	databases.modErr = nil
	projects.due = []dbcontrol.Project{{ID: first}, {ID: second}}

	// Make the first project fail by having the state lookup break; the second
	// must still be handled. The simplest lever is a state error for all, which
	// records a failure but keeps the loop going.
	projects.stateErr = errors.New("state unavailable")

	processed, err := service.RunOnce(context.Background())
	if err != nil {
		t.Fatalf("run once: %v", err)
	}
	if processed != 2 {
		t.Errorf("processed = %d, want 2", processed)
	}
	if len(projects.failures) != 2 {
		t.Errorf("recorded %d failures, want 2", len(projects.failures))
	}
}

func TestRestoreProjectTakesSafetySnapshotAndVerifies(t *testing.T) {
	projectID := uuid.New()
	backupID := uuid.New()
	payload := []byte("restore-me")

	service, projects, databases, objects := newTestService(t, Config{Prefix: "db"})
	databases.snapshotPath = writeSnapshot(t, "current-live")

	key := "db/" + projectID.String() + "/daily/2026-01-01.sqlite"
	objects.stored[key] = payload
	projects.byID = &dbcontrol.DatabaseBackup{
		ID: backupID, ProjectID: projectID, Kind: dbcontrol.BackupDaily,
		ObjectKey: key, SizeBytes: int64(len(payload)), SHA256: sha256Hex(payload),
	}

	if err := service.RestoreProject(context.Background(), projectID, backupID); err != nil {
		t.Fatalf("restore: %v", err)
	}

	// A pre-restore snapshot must have been recorded before the swap.
	var sawPreRestore bool
	for _, success := range projects.successes {
		if success.kind == dbcontrol.BackupPreRestore {
			sawPreRestore = true
		}
	}
	if !sawPreRestore {
		t.Errorf("no pre-restore snapshot recorded")
	}
	if databases.restores != 1 {
		t.Fatalf("restore called %d times, want 1", databases.restores)
	}
	if !bytes.Equal(databases.restoredContents, payload) {
		t.Errorf("restored bytes = %q, want %q", databases.restoredContents, payload)
	}
}

func TestRestoreProjectRejectsCorruptDownload(t *testing.T) {
	projectID := uuid.New()
	backupID := uuid.New()

	service, projects, databases, objects := newTestService(t, Config{Prefix: "db"})
	databases.snapshotPath = writeSnapshot(t, "current-live")

	key := "db/" + projectID.String() + "/daily/2026-01-01.sqlite"
	objects.stored[key] = []byte("tampered")
	// The recorded checksum is for different bytes, so the download must fail.
	projects.byID = &dbcontrol.DatabaseBackup{
		ID: backupID, ProjectID: projectID, Kind: dbcontrol.BackupDaily,
		ObjectKey: key, SizeBytes: int64(len("expected")), SHA256: sha256Hex([]byte("expected")),
	}

	err := service.RestoreProject(context.Background(), projectID, backupID)
	if !errors.Is(err, ErrBackupCorrupt) {
		t.Fatalf("err = %v, want ErrBackupCorrupt", err)
	}
	if databases.restores != 0 {
		t.Errorf("restore ran despite a corrupt download")
	}
}

func TestDeleteProjectBackupsSweepsPrefix(t *testing.T) {
	projectID := uuid.New()
	service, projects, _, objects := newTestService(t, Config{Prefix: "db"})
	prefix := "db/" + projectID.String() + "/"
	objects.listed = []storage.Object{
		{Key: prefix + "daily/2026-01-01.sqlite"},
		{Key: prefix + "latest.json"},
	}

	if err := service.DeleteProjectBackups(context.Background(), projectID); err != nil {
		t.Fatalf("delete project backups: %v", err)
	}
	if len(objects.deleted) != 2 {
		t.Errorf("deleted %d objects, want 2", len(objects.deleted))
	}
	if len(projects.deletedProj) != 1 || projects.deletedProj[0] != projectID {
		t.Errorf("metadata not deleted: %v", projects.deletedProj)
	}
}

func TestDeleteProjectBackupsReportsFailedSweep(t *testing.T) {
	projectID := uuid.New()
	service, projects, _, objects := newTestService(t, Config{Prefix: "db"})
	prefix := "db/" + projectID.String() + "/"
	objects.listed = []storage.Object{{Key: prefix + "latest.json"}}
	objects.delete[prefix+"latest.json"] = errors.New("denied")

	if err := service.DeleteProjectBackups(context.Background(), projectID); err == nil {
		t.Fatal("expected an error when an object cannot be deleted")
	}
	if len(projects.deletedProj) != 1 {
		t.Errorf("metadata should still be removed after the sweep")
	}
}

func TestPruneDeletesExpiredObjectsThenRows(t *testing.T) {
	projectID := uuid.New()
	service, projects, _, objects := newTestService(t, Config{Prefix: "db", Retention: time.Hour})

	oldID := uuid.New()
	projects.expired = []dbcontrol.DatabaseBackup{
		{ID: oldID, ProjectID: projectID, ObjectKey: "db/p/daily/2020-01-01.sqlite"},
	}

	service.prune(context.Background(), projectID)

	if len(objects.deleted) != 1 {
		t.Fatalf("deleted %d objects, want 1", len(objects.deleted))
	}
	if len(projects.deletedRows) != 1 || len(projects.deletedRows[0]) != 1 || projects.deletedRows[0][0] != oldID {
		t.Fatalf("rows not deleted correctly: %v", projects.deletedRows)
	}
}

func TestPruneKeepsRowWhenObjectDeleteFails(t *testing.T) {
	projectID := uuid.New()
	service, projects, _, objects := newTestService(t, Config{Prefix: "db", Retention: time.Hour})

	key := "db/p/daily/2020-01-01.sqlite"
	projects.expired = []dbcontrol.DatabaseBackup{{ID: uuid.New(), ProjectID: projectID, ObjectKey: key}}
	objects.delete[key] = errors.New("denied")

	service.prune(context.Background(), projectID)

	// The row must survive so the next sweep retries it.
	if len(projects.deletedRows) != 1 || len(projects.deletedRows[0]) != 0 {
		t.Fatalf("expected no rows deleted, got %v", projects.deletedRows)
	}
}

func TestObjectKeyLayout(t *testing.T) {
	service, _, _, _ := newTestService(t, Config{Prefix: "backups"})
	projectID := uuid.New()
	when := time.Date(2026, 3, 4, 5, 6, 7, 0, time.UTC)
	prefix := "backups/" + projectID.String() + "/"

	cases := map[dbcontrol.BackupKind]string{
		dbcontrol.BackupDaily:      prefix + "daily/2026-03-04.sqlite",
		dbcontrol.BackupManual:     prefix + "manual/20260304T050607.000Z.sqlite",
		dbcontrol.BackupPreRestore: prefix + "pre-restore/20260304T050607.000Z.sqlite",
		dbcontrol.BackupInitial:    prefix + "initial/20260304T050607.000Z.sqlite",
	}
	for kind, want := range cases {
		if got := service.objectKey(projectID, kind, when); got != want {
			t.Errorf("key for %s = %q, want %q", kind, got, want)
		}
	}
}

func TestProjectPrefixIsScoped(t *testing.T) {
	service, _, _, _ := newTestService(t, Config{Prefix: "backups"})
	projectID := uuid.New()
	prefix := service.projectPrefix(projectID)
	if !strings.HasSuffix(prefix, "/") {
		t.Errorf("prefix %q must end with a slash", prefix)
	}
	if !strings.Contains(prefix, projectID.String()) {
		t.Errorf("prefix %q must contain the project id", prefix)
	}
}

func sha256Hex(data []byte) string {
	sum := sha256.Sum256(data)
	return hex.EncodeToString(sum[:])
}

// --- download, delete and snapshot (the viewer's actions) ----------------

// storedBackup puts an object in the fake bucket and returns the history row
// that points at it.
func storedBackup(t *testing.T, objects *fakeObjects, projectID uuid.UUID, key string, data []byte) dbcontrol.DatabaseBackup {
	t.Helper()
	objects.stored[key] = data
	return dbcontrol.DatabaseBackup{
		ID:        uuid.New(),
		ProjectID: projectID,
		Kind:      dbcontrol.BackupDaily,
		ObjectKey: key,
		SizeBytes: int64(len(data)),
		SHA256:    sha256Hex(data),
		CreatedAt: time.Now(),
	}
}

func TestDownloadBackupStreamsStoredObject(t *testing.T) {
	service, projects, _, objects := newTestService(t, Config{Prefix: "backups"})
	projectID := uuid.New()
	stored := storedBackup(t, objects, projectID, service.objectKey(projectID, dbcontrol.BackupDaily, time.Now()), []byte("payload"))
	projects.byID = &stored

	body, meta, err := service.DownloadBackup(context.Background(), projectID, stored.ID)
	if err != nil {
		t.Fatalf("download: %v", err)
	}
	defer body.Close()

	if meta.ID != stored.ID {
		t.Errorf("id = %v, want %v", meta.ID, stored.ID)
	}
	got, _ := io.ReadAll(body)
	if string(got) != "payload" {
		t.Errorf("body = %q, want payload", got)
	}
}

func TestDownloadBackupUnknownBackup(t *testing.T) {
	service, projects, _, _ := newTestService(t, Config{Prefix: "backups"})
	projects.byIDErr = dbcontrol.ErrNotFound

	if _, _, err := service.DownloadBackup(context.Background(), uuid.New(), uuid.New()); !errors.Is(err, dbcontrol.ErrNotFound) {
		t.Fatalf("error = %v, want ErrNotFound", err)
	}
}

func TestDeleteBackupRemovesObjectAndRow(t *testing.T) {
	service, projects, _, objects := newTestService(t, Config{Prefix: "backups"})
	projectID := uuid.New()
	key := service.objectKey(projectID, dbcontrol.BackupDaily, time.Now())
	stored := storedBackup(t, objects, projectID, key, []byte("older"))
	projects.byID = &stored
	// A different, newer backup is what the latest pointer mirrors.
	newer := stored
	newer.ID = uuid.New()
	projects.latest = &newer

	if err := service.DeleteBackup(context.Background(), projectID, stored.ID); err != nil {
		t.Fatalf("delete: %v", err)
	}

	if _, ok := objects.stored[key]; ok {
		t.Error("the backup object should be gone")
	}
	if _, ok := objects.stored[service.latestKey(projectID)]; ok {
		t.Error("the latest pointer belongs to a different backup and must survive")
	}
	if len(projects.deletedRows) != 1 || len(projects.deletedRows[0]) != 1 || projects.deletedRows[0][0] != stored.ID {
		t.Errorf("deleted rows = %v, want [%v]", projects.deletedRows, stored.ID)
	}
}

func TestDeleteBackupRemovesLatestPointerWhenNewest(t *testing.T) {
	service, projects, _, objects := newTestService(t, Config{Prefix: "backups"})
	projectID := uuid.New()
	key := service.objectKey(projectID, dbcontrol.BackupDaily, time.Now())
	stored := storedBackup(t, objects, projectID, key, []byte("newest"))
	projects.byID = &stored
	// The backup being deleted is the newest regular one.
	projects.latest = &stored
	objects.stored[service.latestKey(projectID)] = []byte("newest")

	if err := service.DeleteBackup(context.Background(), projectID, stored.ID); err != nil {
		t.Fatalf("delete: %v", err)
	}

	if _, ok := objects.stored[service.latestKey(projectID)]; ok {
		t.Error("deleting the newest backup must also remove the latest pointer")
	}
}

// TestDeleteBackupSurvivesLatestLookupFailure pins the tradeoff: the backup the
// owner asked to delete is gone, so a failure to look up the latest pointer is
// logged and stepped over rather than reported as a failed delete.
func TestDeleteBackupSurvivesLatestLookupFailure(t *testing.T) {
	service, projects, _, objects := newTestService(t, Config{Prefix: "backups"})
	projectID := uuid.New()
	key := service.objectKey(projectID, dbcontrol.BackupDaily, time.Now())
	stored := storedBackup(t, objects, projectID, key, []byte("data"))
	projects.byID = &stored
	projects.latestErr = errors.New("database down")

	if err := service.DeleteBackup(context.Background(), projectID, stored.ID); err != nil {
		t.Fatalf("delete should tolerate a latest lookup failure, got %v", err)
	}
	if len(projects.deletedRows) != 1 {
		t.Errorf("the history row should still be removed")
	}
}

func TestSnapshotPathDownloadsAndVerifies(t *testing.T) {
	service, projects, _, objects := newTestService(t, Config{Prefix: "backups"})
	projectID := uuid.New()
	content := []byte("SQLite format 3\x00 snapshot body")
	key := service.objectKey(projectID, dbcontrol.BackupDaily, time.Now())
	stored := storedBackup(t, objects, projectID, key, content)
	projects.byID = &stored

	path, err := service.SnapshotPath(context.Background(), projectID, stored.ID)
	if err != nil {
		t.Fatalf("snapshot: %v", err)
	}
	t.Cleanup(func() { _ = os.Remove(path) })

	got, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read snapshot: %v", err)
	}
	if !bytes.Equal(got, content) {
		t.Errorf("snapshot = %q, want %q", got, content)
	}

	// A second call must reuse the cached copy rather than downloading again.
	second, err := service.SnapshotPath(context.Background(), projectID, stored.ID)
	if err != nil {
		t.Fatalf("second snapshot: %v", err)
	}
	if second != path {
		t.Errorf("second call re-downloaded: %q vs %q", second, path)
	}
}

func TestSnapshotPathRejectsCorruptObject(t *testing.T) {
	service, projects, _, objects := newTestService(t, Config{Prefix: "backups"})
	projectID := uuid.New()
	key := service.objectKey(projectID, dbcontrol.BackupDaily, time.Now())
	stored := storedBackup(t, objects, projectID, key, []byte("honest bytes"))
	stored.SHA256 = sha256Hex([]byte("something else"))
	projects.byID = &stored

	if _, err := service.SnapshotPath(context.Background(), projectID, stored.ID); !errors.Is(err, ErrBackupCorrupt) {
		t.Fatalf("error = %v, want ErrBackupCorrupt", err)
	}
}
