package dbplane

import (
	"context"
	"database/sql"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// snapshotFromProject backs a seeded project up and returns the snapshot path.
func snapshotFromProject(t *testing.T, manager *Manager, rows int) string {
	t.Helper()
	projectID, _, release := newSeededProject(t, manager, rows)
	defer release()

	path, err := manager.BackupDatabase(context.Background(), projectID)
	if err != nil {
		t.Fatalf("backup: %v", err)
	}
	t.Cleanup(func() { _ = os.RemoveAll(filepath.Dir(path)) })
	return path
}

func TestQuerySnapshotReadsADownloadedBackup(t *testing.T) {
	manager := newBackupManager(t)
	path := snapshotFromProject(t, manager, 3)

	result, err := manager.QuerySnapshot(context.Background(), path, `SELECT v FROM t ORDER BY id`, nil, 0)
	if err != nil {
		t.Fatalf("query snapshot: %v", err)
	}
	if len(result.Rows) != 3 {
		t.Fatalf("rows = %d, want 3", len(result.Rows))
	}
	if result.Columns[0] != "v" {
		t.Errorf("column = %q, want v", result.Columns[0])
	}
}

// TestQuerySnapshotIsReadOnly proves a write cannot run even though the handler
// is expected to have refused it first: the connection is the backstop.
func TestQuerySnapshotIsReadOnly(t *testing.T) {
	manager := newBackupManager(t)
	path := snapshotFromProject(t, manager, 1)

	if _, err := manager.QuerySnapshot(context.Background(), path, `DELETE FROM t`, nil, 0); err == nil {
		t.Fatal("expected a write against a snapshot to fail")
	}

	// The file must be untouched: still exactly one row.
	result, err := manager.QuerySnapshot(context.Background(), path, `SELECT COUNT(*) FROM t`, nil, 0)
	if err != nil {
		t.Fatalf("count: %v", err)
	}
	if got := result.Rows[0][0]; got != int64(1) {
		t.Errorf("rows after a refused write = %v, want 1", got)
	}
}

func TestQuerySnapshotMissingFile(t *testing.T) {
	manager := newBackupManager(t)

	_, err := manager.QuerySnapshot(context.Background(),
		filepath.Join(t.TempDir(), "absent.sqlite"), `SELECT 1`, nil, 0)
	if err == nil {
		t.Fatal("expected a missing snapshot to be an error")
	}
	if !strings.Contains(err.Error(), "not found") {
		t.Errorf("error = %v, want a not-found error", err)
	}
}

func TestQuerySnapshotRejectsRelativePath(t *testing.T) {
	manager := newBackupManager(t)

	if _, err := manager.QuerySnapshot(context.Background(), "relative.sqlite", `SELECT 1`, nil, 0); err == nil {
		t.Fatal("expected a relative path to be refused")
	}
}

// TestQuerySnapshotRejectsForeignFile checks the application_id guard: a file
// that is not a Moogo database is refused rather than queried.
func TestQuerySnapshotRejectsForeignFile(t *testing.T) {
	manager := newBackupManager(t)

	// A plausible SQLite file that was never branded with our application_id.
	path := filepath.Join(t.TempDir(), "foreign.sqlite")
	database, err := sql.Open("sqlite", "file:"+path)
	if err != nil {
		t.Fatalf("open foreign database: %v", err)
	}
	if _, err := database.Exec(`CREATE TABLE t (v TEXT)`); err != nil {
		database.Close()
		t.Fatalf("create table: %v", err)
	}
	database.Close()

	if _, err := manager.QuerySnapshot(context.Background(), path, `SELECT * FROM t`, nil, 0); err == nil {
		t.Fatal("expected a foreign database to be refused")
	}
}

func TestQuerySnapshotRejectsDirectory(t *testing.T) {
	manager := newBackupManager(t)

	if _, err := manager.QuerySnapshot(context.Background(), t.TempDir(), `SELECT 1`, nil, 0); err == nil {
		t.Fatal("expected a directory to be refused")
	}
}
