package dbcontrol

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
)

// TestLatestRegularBackupSkipsPreRestore covers the lookup the backup delete
// path relies on to decide whether deleting a backup must also drop the latest
// pointer. The pre-restore snapshot is the interesting case: it is the newest
// row but it is deliberately not what the latest pointer mirrors, so a naive
// "newest backup" query would delete the pointer for the wrong backup.
func TestLatestRegularBackupSkipsPreRestore(t *testing.T) {
	store := testStore(t)
	user := newTestUser(t, store, 1)
	project := newTestProject(t, store, user.ID)
	ctx := context.Background()

	// Before any backup there is nothing to point at, which is a normal state
	// rather than an error.
	latest, err := store.LatestRegularBackup(ctx, project.ID)
	if err != nil {
		t.Fatalf("latest with no backups: %v", err)
	}
	if latest != nil {
		t.Fatalf("latest = %v, want nil before any backup", latest)
	}

	if _, err := store.RecordBackupSuccess(ctx, project.ID, BackupDaily,
		"daily/2026-03-04.sqlite", "sha-daily", 10, time.Now()); err != nil {
		t.Fatalf("record daily: %v", err)
	}

	// Taken second, so it is the newest row; it must not be chosen.
	if _, err := store.RecordBackupSuccess(ctx, project.ID, BackupPreRestore,
		"pre-restore/1.sqlite", "sha-pre", 10, time.Now()); err != nil {
		t.Fatalf("record pre-restore: %v", err)
	}

	latest, err = store.LatestRegularBackup(ctx, project.ID)
	if err != nil {
		t.Fatalf("latest: %v", err)
	}
	if latest == nil {
		t.Fatal("expected the daily backup to be the latest regular backup")
	}
	if latest.Kind != BackupDaily {
		t.Errorf("kind = %q, want daily", latest.Kind)
	}
	if latest.ObjectKey != "daily/2026-03-04.sqlite" {
		t.Errorf("key = %q, want the daily object", latest.ObjectKey)
	}

	// A newer regular backup replaces it as the one the latest pointer mirrors.
	if _, err := store.RecordBackupSuccess(ctx, project.ID, BackupManual,
		"manual/1.sqlite", "sha-manual", 10, time.Now()); err != nil {
		t.Fatalf("record manual: %v", err)
	}

	latest, err = store.LatestRegularBackup(ctx, project.ID)
	if err != nil {
		t.Fatalf("latest: %v", err)
	}
	if latest == nil || latest.Kind != BackupManual {
		t.Fatalf("latest = %v, want the manual backup", latest)
	}
}

// TestTryProjectBackupLockSerializesOneProject covers the cross-process lock
// that keeps two backup runs off the same project. Two attempts on one project
// must not both succeed, while a different project and a re-attempt after
// release must.
func TestTryProjectBackupLockSerializesOneProject(t *testing.T) {
	store := testStore(t)
	user := newTestUser(t, store, 5)
	project := newTestProject(t, store, user.ID)
	other := newTestProject(t, store, user.ID)
	ctx := context.Background()

	release, ok, err := store.TryProjectBackupLock(ctx, project.ID)
	if err != nil || !ok {
		t.Fatalf("first lock: ok=%v err=%v, want granted", ok, err)
	}

	// Another pooled connection is a different session, so this is the
	// second-runner contention the lock exists to refuse.
	if _, ok, err := store.TryProjectBackupLock(ctx, project.ID); err != nil || ok {
		t.Fatalf("second lock: ok=%v err=%v, want contention", ok, err)
	}

	// A different project is a different lock.
	otherRelease, ok, err := store.TryProjectBackupLock(ctx, other.ID)
	if err != nil || !ok {
		t.Fatalf("other project lock: ok=%v err=%v, want granted", ok, err)
	}
	otherRelease()

	release()

	// Once released, the project can be locked again.
	againRelease, ok, err := store.TryProjectBackupLock(ctx, project.ID)
	if err != nil || !ok {
		t.Fatalf("relock after release: ok=%v err=%v, want granted", ok, err)
	}
	againRelease()
}

// TestVerificationSchedule covers the drill queue and its verdict storage: a
// project with nothing backed up is not due, a fresh backup is due at once, a
// passing drill clears the queue, and a later failing drill records its reason
// without clearing the previous pass's verdict timestamp.
func TestVerificationSchedule(t *testing.T) {
	store := testStore(t)
	user := newTestUser(t, store, 5)
	project := newTestProject(t, store, user.ID)
	ctx := context.Background()
	window := 7 * 24 * time.Hour

	// No backup state yet: there is nothing to verify.
	due, err := store.ProjectsDueForVerification(ctx, window, 10)
	if err != nil {
		t.Fatalf("due before any backup: %v", err)
	}
	if len(due) != 0 {
		t.Fatalf("due = %v, want none before any backup", due)
	}

	if _, err := store.RecordBackupSuccess(ctx, project.ID, BackupDaily,
		"daily/2026-03-04.sqlite", "sha", 1, time.Now()); err != nil {
		t.Fatalf("record backup: %v", err)
	}

	// A backup that has never been verified is due immediately.
	due, err = store.ProjectsDueForVerification(ctx, window, 10)
	if err != nil {
		t.Fatalf("due after backup: %v", err)
	}
	if len(due) != 1 || due[0].ID != project.ID {
		t.Fatalf("due = %v, want the backed-up project", due)
	}

	// A passing drill clears the queue for the whole window.
	if err := store.RecordBackupVerification(ctx, project.ID, nil); err != nil {
		t.Fatalf("record pass: %v", err)
	}
	state, err := store.ProjectBackupState(ctx, project.ID)
	if err != nil {
		t.Fatalf("state: %v", err)
	}
	if state.LastVerifiedAt == nil {
		t.Error("passing drill did not record a verification time")
	}
	if state.LastVerifyError != nil {
		t.Errorf("passing drill recorded an error: %v", state.LastVerifyError)
	}
	due, err = store.ProjectsDueForVerification(ctx, window, 10)
	if err != nil {
		t.Fatalf("due after pass: %v", err)
	}
	if len(due) != 0 {
		t.Fatalf("due = %v, want none right after a passing drill", due)
	}

	// A failing drill records its reason and keeps the queue honest: the error
	// must be visible, distinct from the backup's own last_error.
	failure := "integrity check failed"
	if err := store.RecordBackupVerification(ctx, project.ID, &failure); err != nil {
		t.Fatalf("record failure: %v", err)
	}
	state, err = store.ProjectBackupState(ctx, project.ID)
	if err != nil {
		t.Fatalf("state after failure: %v", err)
	}
	if state.LastVerifyError == nil || *state.LastVerifyError != failure {
		t.Errorf("last_verify_error = %v, want %q", state.LastVerifyError, failure)
	}
	if state.LastError != nil {
		t.Errorf("a verification failure must not overwrite the backup error: %v", state.LastError)
	}
}

// TestRestoreQueueLifecycle covers the durable restore queue: one active restore
// per project enforced by the database, an exclusive claim, and the project
// becoming restorable again once the active one reaches a terminal state.
func TestRestoreQueueLifecycle(t *testing.T) {
	store := testStore(t)
	user := newTestUser(t, store, 5)
	project := newTestProject(t, store, user.ID)
	other := newTestProject(t, store, user.ID)
	ctx := context.Background()
	backupID := uuid.New()

	restore, err := store.CreateRestore(ctx, project.ID, backupID)
	if err != nil {
		t.Fatalf("create restore: %v", err)
	}
	if restore.Status != RestorePending {
		t.Fatalf("status = %q, want pending", restore.Status)
	}

	// A second restore of the same project is refused while the first is active.
	if _, err := store.CreateRestore(ctx, project.ID, backupID); !errors.Is(err, ErrRestoreInProgress) {
		t.Fatalf("second restore err = %v, want ErrRestoreInProgress", err)
	}

	// A different project has its own slot.
	if _, err := store.CreateRestore(ctx, other.ID, backupID); err != nil {
		t.Fatalf("restore for other project: %v", err)
	}

	active, err := store.ActiveRestore(ctx, project.ID)
	if err != nil {
		t.Fatalf("active restore: %v", err)
	}
	if active == nil || active.ID != restore.ID {
		t.Fatalf("active restore = %v, want %v", active, restore.ID)
	}

	// The claim is exclusive: the second attempt loses.
	claimed, err := store.MarkRestoreRunning(ctx, restore.ID)
	if err != nil || !claimed {
		t.Fatalf("claim: claimed=%v err=%v", claimed, err)
	}
	if again, _ := store.MarkRestoreRunning(ctx, restore.ID); again {
		t.Error("a restore was claimed twice")
	}

	// A running restore still blocks a new one.
	if _, err := store.CreateRestore(ctx, project.ID, backupID); !errors.Is(err, ErrRestoreInProgress) {
		t.Fatalf("restore while running err = %v, want ErrRestoreInProgress", err)
	}

	// Finishing it frees the project.
	if err := store.MarkRestoreFinished(ctx, restore.ID, nil); err != nil {
		t.Fatalf("finish restore: %v", err)
	}
	if active, err := store.ActiveRestore(ctx, project.ID); err != nil || active != nil {
		t.Fatalf("active after finish = %v (err %v), want none", active, err)
	}
	if _, err := store.CreateRestore(ctx, project.ID, backupID); err != nil {
		t.Fatalf("restore after finish: %v", err)
	}
}

// TestMarkAbandonedRestoresFailsRunning covers crash recovery: a restore left
// running by a dead process is failed with a reason, and its project is freed.
func TestMarkAbandonedRestoresFailsRunning(t *testing.T) {
	store := testStore(t)
	user := newTestUser(t, store, 1)
	project := newTestProject(t, store, user.ID)
	ctx := context.Background()
	backupID := uuid.New()

	restore, err := store.CreateRestore(ctx, project.ID, backupID)
	if err != nil {
		t.Fatalf("create restore: %v", err)
	}
	if _, err := store.MarkRestoreRunning(ctx, restore.ID); err != nil {
		t.Fatalf("mark running: %v", err)
	}

	failed, err := store.MarkAbandonedRestores(ctx)
	if err != nil {
		t.Fatalf("fail abandoned: %v", err)
	}
	if failed != 1 {
		t.Fatalf("failed = %d, want 1", failed)
	}

	stored, err := store.RestoreByID(ctx, project.ID, restore.ID)
	if err != nil {
		t.Fatalf("load restore: %v", err)
	}
	if stored.Status != RestoreFailed {
		t.Errorf("status = %q, want failed", stored.Status)
	}
	if stored.Error == nil {
		t.Error("an abandoned restore must record a reason")
	}

	// The project must be restorable again.
	if _, err := store.CreateRestore(ctx, project.ID, backupID); err != nil {
		t.Fatalf("restore after abandonment: %v", err)
	}
}
