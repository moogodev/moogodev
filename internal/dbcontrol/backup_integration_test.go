package dbcontrol

import (
	"context"
	"testing"
	"time"
)

// TestLatestRegularBackupSkipsPreRestore covers the lookup the backup delete
// path relies on to decide whether deleting a backup must also drop the
// latest.sqlite pointer. The pre-restore snapshot is the interesting case: it is
// the newest row but it is deliberately not what latest.sqlite mirrors, so a
// naive "newest backup" query would delete the pointer for the wrong backup.
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

	if err := store.RecordBackupSuccess(ctx, project.ID, BackupDaily,
		"daily/2026-03-04.sqlite", "sha-daily", 10, time.Now()); err != nil {
		t.Fatalf("record daily: %v", err)
	}

	// Taken second, so it is the newest row; it must not be chosen.
	if err := store.RecordBackupSuccess(ctx, project.ID, BackupPreRestore,
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

	// A newer regular backup replaces it as the one latest.sqlite mirrors.
	if err := store.RecordBackupSuccess(ctx, project.ID, BackupManual,
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
