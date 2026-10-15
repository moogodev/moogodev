package dbcontrol

import (
	"context"
	"testing"
	"time"
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
