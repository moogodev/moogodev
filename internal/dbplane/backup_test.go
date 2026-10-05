package dbplane

import (
	"context"
	"database/sql"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/moogo/moogo/pkg/logger"
)

func newBackupManager(t *testing.T) *Manager {
	t.Helper()
	manager, err := NewManager(t.TempDir(), 100*1024*1024, 5*time.Second, logger.Nop())
	if err != nil {
		t.Fatalf("create manager: %v", err)
	}
	t.Cleanup(func() { _ = manager.Close() })
	return manager
}

func newSeededProject(t *testing.T, manager *Manager, rows int) (uuid.UUID, *projectConnection) {
	t.Helper()
	ctx := context.Background()
	projectID := uuid.New()
	if err := manager.InitializeProject(ctx, projectID); err != nil {
		t.Fatalf("initialize: %v", err)
	}
	connection, err := manager.connect(ctx, projectID)
	if err != nil {
		t.Fatalf("connect: %v", err)
	}
	if _, err := connection.db.Exec(`CREATE TABLE t (id INTEGER PRIMARY KEY, v TEXT)`); err != nil {
		t.Fatalf("create table: %v", err)
	}
	for i := 0; i < rows; i++ {
		if _, err := connection.db.Exec(`INSERT INTO t (v) VALUES (?)`, "x"); err != nil {
			t.Fatalf("insert: %v", err)
		}
	}
	return projectID, connection
}

// countRowsIn opens a snapshot as an independent database and counts its rows.
// Opening it as a separate connection is the point: it proves the file is
// self-contained and does not need the original WAL beside it.
func countRowsIn(t *testing.T, path string) int {
	t.Helper()
	database, err := sql.Open("sqlite", "file:"+path+"?_pragma=journal_mode(DELETE)")
	if err != nil {
		t.Fatalf("open snapshot: %v", err)
	}
	defer database.Close()

	var count int
	if err := database.QueryRow(`SELECT COUNT(*) FROM t`).Scan(&count); err != nil {
		t.Fatalf("count snapshot rows: %v", err)
	}
	return count
}

// TestBackupDatabaseIsSelfContained is the regression this method exists for.
//
// The databases run in WAL mode, so a row committed most recently can still be
// sitting in the -wal sidecar. A backup that copies the .db file would silently
// omit it. The snapshot is checked by opening it on its own, with the original
// database directory nowhere in sight.
func TestBackupDatabaseIsSelfContained(t *testing.T) {
	manager := newBackupManager(t)
	projectID, _ := newSeededProject(t, manager, 500)

	path, err := manager.BackupDatabase(context.Background(), projectID)
	if err != nil {
		t.Fatalf("backup: %v", err)
	}
	defer os.RemoveAll(filepath.Dir(path))

	if got := countRowsIn(t, path); got != 500 {
		t.Fatalf("snapshot has %d rows, want 500", got)
	}
}

// TestBackupIncludesUncheckpointedWrites writes a row and snapshots immediately,
// without closing the connection, so the row is still only in the WAL. This is
// the case a plain file copy gets wrong.
func TestBackupIncludesUncheckpointedWrites(t *testing.T) {
	manager := newBackupManager(t)
	ctx := context.Background()
	projectID, connection := newSeededProject(t, manager, 10)

	if _, err := connection.db.Exec(`INSERT INTO t (v) VALUES ('latest')`); err != nil {
		t.Fatalf("insert: %v", err)
	}

	path, err := manager.BackupDatabase(ctx, projectID)
	if err != nil {
		t.Fatalf("backup: %v", err)
	}
	defer os.RemoveAll(filepath.Dir(path))

	if got := countRowsIn(t, path); got != 11 {
		t.Fatalf("snapshot has %d rows, want 11 (the newest write must be included)", got)
	}
}

// TestBackupReplacesTheTargetEachTime covers the download being pressed twice:
// each snapshot gets a fresh directory, so the second never collides with the
// first.
func TestBackupReplacesTheTargetEachTime(t *testing.T) {
	manager := newBackupManager(t)
	projectID, _ := newSeededProject(t, manager, 5)

	first, err := manager.BackupDatabase(context.Background(), projectID)
	if err != nil {
		t.Fatalf("first backup: %v", err)
	}
	defer os.RemoveAll(filepath.Dir(first))

	if _, err := manager.BackupDatabase(context.Background(), projectID); err != nil {
		t.Fatalf("second backup should not collide with the first: %v", err)
	}
}

// TestBackupUnknownProject checks a project that was never initialized is an
// error rather than an empty file that looks like a valid backup.
func TestBackupUnknownProject(t *testing.T) {
	manager := newBackupManager(t)
	if _, err := manager.BackupDatabase(context.Background(), uuid.New()); err == nil {
		t.Fatal("expected an error backing up a project that does not exist")
	}
}
