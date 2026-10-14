package dbplane

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/google/uuid"
)

// liveRowCount opens the project through the manager (so it reads the live
// file, not a snapshot) and counts the seeded table's rows.
func liveRowCount(t *testing.T, manager *Manager, projectID uuid.UUID) int {
	t.Helper()
	connection, release, err := manager.acquire(projectID)
	if err != nil {
		t.Fatalf("acquire: %v", err)
	}
	defer release()

	var count int
	if err := connection.db.QueryRow(`SELECT COUNT(*) FROM t`).Scan(&count); err != nil {
		t.Fatalf("count rows: %v", err)
	}
	return count
}

// TestRestoreDatabaseReplacesLiveContent is the core guarantee: restoring an
// older snapshot must make the live database match the snapshot exactly,
// discarding the writes made after it.
func TestRestoreDatabaseReplacesLiveContent(t *testing.T) {
	manager := newBackupManager(t)
	projectID, connection, release := newSeededProject(t, manager, 3)
	defer release()

	snapshot, err := manager.BackupDatabase(context.Background(), projectID)
	if err != nil {
		t.Fatalf("backup: %v", err)
	}
	defer os.RemoveAll(filepath.Dir(snapshot))

	// Write past the snapshot so the live database and the snapshot differ.
	for i := 0; i < 4; i++ {
		if _, err := connection.db.Exec(`INSERT INTO t (v) VALUES ('after')`); err != nil {
			t.Fatalf("insert after snapshot: %v", err)
		}
	}
	if got := liveRowCount(t, manager, projectID); got != 7 {
		t.Fatalf("pre-restore live rows = %d, want 7", got)
	}

	if err := manager.RestoreDatabase(context.Background(), projectID, snapshot); err != nil {
		t.Fatalf("restore: %v", err)
	}

	// Check the sidecars before anything reopens the project: a fresh WAL-mode
	// connection recreates them, so this has to be asserted while no handle is
	// open. A stale -wal left behind would be replayed on the next open and
	// could reintroduce the discarded rows.
	for _, suffix := range []string{"-wal", "-shm"} {
		if _, err := os.Stat(manager.databasePath(projectID) + suffix); err == nil {
			t.Errorf("sidecar %s present immediately after restore", suffix)
		}
	}
	if _, err := os.Stat(manager.databasePath(projectID)); err != nil {
		t.Fatalf("restored database missing: %v", err)
	}

	if got := liveRowCount(t, manager, projectID); got != 3 {
		t.Fatalf("post-restore live rows = %d, want 3", got)
	}
}

func TestRestoreRejectsForeignFile(t *testing.T) {
	manager := newBackupManager(t)
	projectID, _, release := newSeededProject(t, manager, 2)
	defer release()

	foreign := filepath.Join(t.TempDir(), "not-a-database.sqlite")
	if err := os.WriteFile(foreign, []byte("this is not a sqlite file"), 0o600); err != nil {
		t.Fatalf("write foreign file: %v", err)
	}

	err := manager.RestoreDatabase(context.Background(), projectID, foreign)
	if !errors.Is(err, ErrInvalidSnapshot) {
		t.Fatalf("err = %v, want ErrInvalidSnapshot", err)
	}

	// The live database must be untouched.
	if got := liveRowCount(t, manager, projectID); got != 2 {
		t.Fatalf("live rows after refused restore = %d, want 2", got)
	}
}

func TestRestoreRejectsEmptyFile(t *testing.T) {
	manager := newBackupManager(t)
	projectID, _, release := newSeededProject(t, manager, 1)
	defer release()

	empty := filepath.Join(t.TempDir(), "empty.sqlite")
	if err := os.WriteFile(empty, nil, 0o600); err != nil {
		t.Fatalf("write empty file: %v", err)
	}

	if err := manager.RestoreDatabase(context.Background(), projectID, empty); !errors.Is(err, ErrInvalidSnapshot) {
		t.Fatalf("err = %v, want ErrInvalidSnapshot", err)
	}
}

// TestAcquireRefusedWhileRestoring checks the guard that keeps a new handle
// from being opened against the file being replaced.
func TestAcquireRefusedWhileRestoring(t *testing.T) {
	manager := newBackupManager(t)
	projectID, _, release := newSeededProject(t, manager, 1)
	defer release()

	manager.mu.Lock()
	manager.restoring[projectID] = true
	manager.mu.Unlock()

	if _, _, err := manager.acquire(projectID); !errors.Is(err, ErrRestoring) {
		t.Fatalf("acquire during restore err = %v, want ErrRestoring", err)
	}

	manager.mu.Lock()
	delete(manager.restoring, projectID)
	manager.mu.Unlock()

	if _, rel, err := manager.acquire(projectID); err != nil {
		t.Fatalf("acquire after restore: %v", err)
	} else {
		rel()
	}
}

func TestDatabaseModTimeTracksWrites(t *testing.T) {
	manager := newBackupManager(t)
	projectID, connection, release := newSeededProject(t, manager, 1)
	defer release()

	before, err := manager.DatabaseModTime(projectID)
	if err != nil {
		t.Fatalf("mod time: %v", err)
	}

	// A write must move the watermark forward. Sleep a hair so the filesystem
	// timestamp (which can be coarse) is guaranteed to differ.
	time.Sleep(10 * time.Millisecond)
	if _, err := connection.db.Exec(`INSERT INTO t (v) VALUES ('later')`); err != nil {
		t.Fatalf("insert: %v", err)
	}

	after, err := manager.DatabaseModTime(projectID)
	if err != nil {
		t.Fatalf("mod time after write: %v", err)
	}

	if !after.After(before) {
		t.Fatalf("mod time did not advance: before=%v after=%v", before, after)
	}
}

func TestDatabaseModTimeUnknownProject(t *testing.T) {
	manager := newBackupManager(t)
	if _, err := manager.DatabaseModTime(uuid.New()); !errors.Is(err, ErrNotFound) {
		t.Fatalf("err = %v, want ErrNotFound", err)
	}
}

func TestRestoreUnknownProject(t *testing.T) {
	manager := newBackupManager(t)
	// A valid snapshot for a project that does not exist still cannot be
	// restored: validateSnapshot passes, but the target is created fresh.
	projectID, _, release := newSeededProject(t, manager, 1)
	snapshot, err := manager.BackupDatabase(context.Background(), projectID)
	if err != nil {
		t.Fatalf("backup: %v", err)
	}
	release()
	defer os.RemoveAll(filepath.Dir(snapshot))

	if err := manager.RestoreDatabase(context.Background(), uuid.Nil, snapshot); err == nil {
		t.Fatal("expected an error restoring to the nil project id")
	}
}
