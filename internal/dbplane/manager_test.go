package dbplane

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/moogo/moogo/pkg/logger"
)

// newTestManager creates a Manager rooted at a temporary directory.
func newTestManager(t *testing.T, maxDBBytes int64) *Manager {
	t.Helper()

	manager, err := NewManager(t.TempDir(), maxDBBytes, 5*time.Second, logger.Nop())
	if err != nil {
		t.Fatalf("create manager: %v", err)
	}
	t.Cleanup(func() { _ = manager.Close() })
	return manager
}

func TestInitializeProjectCreatesUsableDatabase(t *testing.T) {
	manager := newTestManager(t, 100*1024*1024)
	projectID := uuid.New()
	ctx := context.Background()

	if err := manager.InitializeProject(ctx, projectID); err != nil {
		t.Fatalf("initialize project: %v", err)
	}

	if !manager.ProjectExists(projectID) {
		t.Error("database file should exist after initialization")
	}

	// The pragmas the package promises must be in effect on a new connection.
	result, err := manager.Exec(ctx, projectID,
		`CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT NOT NULL)`, nil)
	if err != nil {
		t.Fatalf("create table: %v", err)
	}
	if result.SizeBytes <= 0 {
		t.Errorf("size should be positive, got %d", result.SizeBytes)
	}

	// foreign_keys defaults to OFF in SQLite, so this asserts the pragma is
	// actually applied rather than assumed.
	if _, err := manager.Exec(ctx, projectID,
		`INSERT INTO users (name) VALUES ('first')`, nil); err != nil {
		t.Fatalf("insert: %v", err)
	}
	queryResult, err := manager.Query(ctx, projectID, `SELECT name FROM users`, nil, 0)
	if err != nil {
		t.Fatalf("select: %v", err)
	}
	if len(queryResult.Rows) != 1 {
		t.Errorf("expected 1 row, got %d", len(queryResult.Rows))
	}
}

func TestForeignKeysAreEnforced(t *testing.T) {
	manager := newTestManager(t, 100*1024*1024)
	projectID := uuid.New()
	ctx := context.Background()

	if err := manager.InitializeProject(ctx, projectID); err != nil {
		t.Fatalf("initialize project: %v", err)
	}
	if _, err := manager.Exec(ctx, projectID,
		`CREATE TABLE parents (id INTEGER PRIMARY KEY)`, nil); err != nil {
		t.Fatalf("create parents: %v", err)
	}
	if _, err := manager.Exec(ctx, projectID,
		`CREATE TABLE children (id INTEGER PRIMARY KEY, parent_id INTEGER REFERENCES parents(id))`, nil); err != nil {
		t.Fatalf("create children: %v", err)
	}

	// With foreign_keys OFF this insert would silently succeed and leave a
	// dangling reference, which is exactly the bug the pragma prevents.
	_, err := manager.Exec(ctx, projectID,
		`INSERT INTO children (id, parent_id) VALUES (1, 999)`, nil)
	if err == nil {
		t.Error("expected foreign key violation, insert should have failed")
	}
}

func TestQueryUsesPreparedStatements(t *testing.T) {
	manager := newTestManager(t, 100*1024*1024)
	projectID := uuid.New()
	ctx := context.Background()

	if err := manager.InitializeProject(ctx, projectID); err != nil {
		t.Fatalf("initialize project: %v", err)
	}
	if _, err := manager.Exec(ctx, projectID,
		`CREATE TABLE users (id INTEGER PRIMARY KEY, status TEXT)`, nil); err != nil {
		t.Fatalf("create table: %v", err)
	}

	// A value that would end the statement if it were interpolated. Passing it
	// as a bound argument must be stored and returned verbatim.
	_, err := manager.Exec(ctx, projectID,
		`INSERT INTO users (status) VALUES (?)`, []any{`active'; DROP TABLE users; --`})
	if err != nil {
		t.Fatalf("insert: %v", err)
	}

	result, err := manager.Query(ctx, projectID,
		`SELECT status FROM users WHERE status = ?`, []any{`active'; DROP TABLE users; --`}, 0)
	if err != nil {
		t.Fatalf("select: %v", err)
	}
	if len(result.Rows) != 1 {
		t.Fatalf("expected 1 row, got %d", len(result.Rows))
	}

	// The table must still exist.
	if _, err := manager.Query(ctx, projectID, `SELECT count(*) FROM users`, nil, 0); err != nil {
		t.Fatalf("table should still exist: %v", err)
	}
}

func TestQueryTruncatesAtRowCap(t *testing.T) {
	manager := newTestManager(t, 100*1024*1024)
	projectID := uuid.New()
	ctx := context.Background()

	if err := manager.InitializeProject(ctx, projectID); err != nil {
		t.Fatalf("initialize project: %v", err)
	}
	if _, err := manager.Exec(ctx, projectID, `CREATE TABLE items (id INTEGER)`, nil); err != nil {
		t.Fatalf("create table: %v", err)
	}
	for index := 0; index < 50; index++ {
		if _, err := manager.Exec(ctx, projectID,
			`INSERT INTO items (id) VALUES (?)`, []any{index}); err != nil {
			t.Fatalf("insert %d: %v", index, err)
		}
	}

	result, err := manager.Query(ctx, projectID, `SELECT id FROM items`, nil, 10)
	if err != nil {
		t.Fatalf("select: %v", err)
	}
	if len(result.Rows) != 10 {
		t.Errorf("expected 10 rows, got %d", len(result.Rows))
	}
	if !result.Truncated {
		t.Error("result should be flagged as truncated")
	}
}

func TestRowsDoNotAliasEachOther(t *testing.T) {
	manager := newTestManager(t, 100*1024*1024)
	projectID := uuid.New()
	ctx := context.Background()

	if err := manager.InitializeProject(ctx, projectID); err != nil {
		t.Fatalf("initialize project: %v", err)
	}
	if _, err := manager.Exec(ctx, projectID,
		`CREATE TABLE items (id INTEGER, label TEXT)`, nil); err != nil {
		t.Fatalf("create table: %v", err)
	}
	for index := 0; index < 3; index++ {
		if _, err := manager.Exec(ctx, projectID,
			`INSERT INTO items VALUES (?, ?)`, []any{index, "row"}); err != nil {
			t.Fatalf("insert: %v", err)
		}
	}

	result, err := manager.Query(ctx, projectID, `SELECT id, label FROM items`, nil, 0)
	if err != nil {
		t.Fatalf("select: %v", err)
	}
	if len(result.Rows) != 3 {
		t.Fatalf("expected 3 rows, got %d", len(result.Rows))
	}

	// Scan targets are reused across iterations. If rows were appended without
	// copying, every row would show the last row's values.
	for index, row := range result.Rows {
		if row[0] != int64(index) {
			t.Errorf("row %d has id %v, expected %d (rows are aliasing)", index, row[0], index)
		}
	}
}

func TestConcurrentWritesSucceed(t *testing.T) {
	manager := newTestManager(t, 100*1024*1024)
	projectID := uuid.New()
	ctx := context.Background()

	if err := manager.InitializeProject(ctx, projectID); err != nil {
		t.Fatalf("initialize project: %v", err)
	}
	if _, err := manager.Exec(ctx, projectID,
		`CREATE TABLE counter (id INTEGER PRIMARY KEY AUTOINCREMENT, value INTEGER)`, nil); err != nil {
		t.Fatalf("create table: %v", err)
	}

	// Without the per-project write mutex, concurrent inserts surface
	// SQLITE_BUSY. This is the test that proves the mutex is doing its job.
	const goroutineCount = 20
	var waitGroup sync.WaitGroup
	errorsChannel := make(chan error, goroutineCount)

	for index := 0; index < goroutineCount; index++ {
		waitGroup.Add(1)
		go func() {
			defer waitGroup.Done()
			if _, err := manager.Exec(ctx, projectID,
				`INSERT INTO counter (value) VALUES (?)`, []any{1}); err != nil {
				errorsChannel <- err
			}
		}()
	}
	waitGroup.Wait()
	close(errorsChannel)

	for err := range errorsChannel {
		t.Errorf("concurrent write failed: %v", err)
	}

	result, err := manager.Query(ctx, projectID, `SELECT count(*) FROM counter`, nil, 0)
	if err != nil {
		t.Fatalf("count: %v", err)
	}
	if got := result.Rows[0][0]; got != int64(goroutineCount) {
		t.Errorf("expected %d rows, got %v", goroutineCount, got)
	}
}

func TestExecEnforcesSizeLimit(t *testing.T) {
	// A limit below the default page allocation means a single insert pushes
	// the database past the ceiling.
	manager := newTestManager(t, 1024)
	projectID := uuid.New()
	ctx := context.Background()

	if err := manager.InitializeProject(ctx, projectID); err != nil {
		t.Fatalf("initialize project: %v", err)
	}

	// Grow the database until the limit is hit.
	var lastError error
	for index := 0; index < 200; index++ {
		_, err := manager.Exec(ctx, projectID,
			`CREATE TABLE IF NOT EXISTS filler (id INTEGER PRIMARY KEY, payload BLOB)`,
			nil)
		if err != nil {
			lastError = err
			break
		}
		if _, err := manager.Exec(ctx, projectID,
			`INSERT INTO filler (payload) VALUES (?)`,
			[]any{strings.Repeat("x", 512)}); err != nil {
			lastError = err
			break
		}
	}

	if lastError == nil {
		t.Fatal("expected the size limit to be enforced, but every write succeeded")
	}
	if !errors.Is(lastError, ErrSizeExceeded) {
		t.Errorf("expected ErrSizeExceeded, got %v", lastError)
	}
}

func TestQueryUnknownProjectReturnsNotFound(t *testing.T) {
	manager := newTestManager(t, 100*1024*1024)

	_, err := manager.Query(context.Background(), uuid.New(), `SELECT 1`, nil, 0)
	if !errors.Is(err, ErrNotFound) {
		t.Errorf("expected ErrNotFound, got %v", err)
	}
}

func TestNilProjectIDIsRejected(t *testing.T) {
	manager := newTestManager(t, 100*1024*1024)
	ctx := context.Background()

	if _, err := manager.Query(ctx, uuid.Nil, `SELECT 1`, nil, 0); err == nil {
		t.Error("expected an error for a nil project id")
	}
	if _, err := manager.Exec(ctx, uuid.Nil, `CREATE TABLE t (id int)`, nil); err == nil {
		t.Error("expected an error for a nil project id")
	}
}

func TestRemoveProjectDeletesSidecarFiles(t *testing.T) {
	manager := newTestManager(t, 100*1024*1024)
	projectID := uuid.New()
	ctx := context.Background()

	if err := manager.InitializeProject(ctx, projectID); err != nil {
		t.Fatalf("initialize project: %v", err)
	}
	if _, err := manager.Exec(ctx, projectID, `CREATE TABLE t (id INTEGER)`, nil); err != nil {
		t.Fatalf("create table: %v", err)
	}

	// WAL mode leaves -wal and -shm files next to the database. Removing only
	// the .db would leak them and eventually fill the disk, so all three
	// suffixes are checked after removal.
	databasePath := manager.databasePath(projectID)

	if err := manager.RemoveProject(projectID); err != nil {
		t.Fatalf("remove project: %v", err)
	}
	if manager.ProjectExists(projectID) {
		t.Error("database file should be gone after removal")
	}

	for _, suffix := range []string{"", "-wal", "-shm"} {
		if _, err := os.Stat(databasePath + suffix); !errors.Is(err, os.ErrNotExist) {
			t.Errorf("file %q should be gone, stat returned %v", suffix, err)
		}
	}
}

// TestRemoveProjectDeletesBucket is the object-storage half of the same
// promise. Deletion has no undo, so an object left behind would be a file
// nothing reads that the nightly backup keeps archiving.
func TestRemoveProjectDeletesBucket(t *testing.T) {
	manager := newTestManager(t, 100*1024*1024)
	projectID := uuid.New()

	objectDir := filepath.Join(manager.bucketProjectPath(projectID), "default")
	if err := os.MkdirAll(objectDir, 0o700); err != nil {
		t.Fatalf("create bucket: %v", err)
	}
	objectPath := filepath.Join(objectDir, "avatar.png")
	if err := os.WriteFile(objectPath, []byte("png"), 0o600); err != nil {
		t.Fatalf("write object: %v", err)
	}

	if err := manager.RemoveProject(projectID); err != nil {
		t.Fatalf("remove project: %v", err)
	}

	if _, err := os.Stat(objectPath); !errors.Is(err, os.ErrNotExist) {
		t.Errorf("uploaded object should be gone, stat returned %v", err)
	}
	if _, err := os.Stat(manager.bucketProjectPath(projectID)); !errors.Is(err, os.ErrNotExist) {
		t.Errorf("bucket directory should be gone, stat returned %v", err)
	}

	// Removing a project that never uploaded anything is still not an error.
	other := uuid.New()
	if err := manager.RemoveProject(other); err != nil {
		t.Errorf("remove project without a bucket: %v", err)
	}
}

func TestProjectsAreIsolatedFromEachOther(t *testing.T) {
	manager := newTestManager(t, 100*1024*1024)
	ctx := context.Background()
	firstProject := uuid.New()
	secondProject := uuid.New()

	for _, projectID := range []uuid.UUID{firstProject, secondProject} {
		if err := manager.InitializeProject(ctx, projectID); err != nil {
			t.Fatalf("initialize project %s: %v", projectID, err)
		}
		if _, err := manager.Exec(ctx, projectID, `CREATE TABLE notes (id INTEGER)`, nil); err != nil {
			t.Fatalf("create table in %s: %v", projectID, err)
		}
	}

	if _, err := manager.Exec(ctx, firstProject, `INSERT INTO notes VALUES (1)`, nil); err != nil {
		t.Fatalf("insert: %v", err)
	}

	// The second project has the same table name but must not see the row.
	result, err := manager.Query(ctx, secondProject, `SELECT count(*) FROM notes`, nil, 0)
	if err != nil {
		t.Fatalf("count in second project: %v", err)
	}
	if got := result.Rows[0][0]; got != int64(0) {
		t.Errorf("second project should be empty, got %v rows", got)
	}
}

func TestManagerRejectsQueriesAfterClose(t *testing.T) {
	manager, err := NewManager(t.TempDir(), 100*1024*1024, time.Second, logger.Nop())
	if err != nil {
		t.Fatalf("create manager: %v", err)
	}
	projectID := uuid.New()
	if err := manager.InitializeProject(context.Background(), projectID); err != nil {
		t.Fatalf("initialize project: %v", err)
	}
	if err := manager.Close(); err != nil {
		t.Fatalf("close: %v", err)
	}

	// A query after close must fail loudly rather than reopening silently.
	if _, err := manager.Query(context.Background(), projectID, `SELECT 1`, nil, 0); err == nil {
		t.Error("expected an error after the manager was closed")
	}
}
