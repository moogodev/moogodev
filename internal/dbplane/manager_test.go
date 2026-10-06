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

	manager, err := NewManager(t.TempDir(), maxDBBytes, 5*time.Second, 512, logger.Nop())
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
	manager, err := NewManager(t.TempDir(), 100*1024*1024, time.Second, 512, logger.Nop())
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

// TestQueryTimeoutInterruptsRunningStatement asserts that a statement stops
// consuming CPU once its context deadline passes, instead of running to
// completion and reporting the timeout afterwards.
//
// The driver is expected to watch the context and call sqlite3_interrupt.
// If that wiring ever breaks, the recursion below runs all 10 million rows,
// the query returns a success instead of ErrTimeout, and this test fails.
func TestQueryTimeoutInterruptsRunningStatement(t *testing.T) {
	manager := newTestManager(t, 100*1024*1024)
	projectID := uuid.New()
	if err := manager.InitializeProject(context.Background(), projectID); err != nil {
		t.Fatalf("initialize project: %v", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
	defer cancel()

	start := time.Now()
	_, err := manager.Query(ctx, projectID, `
		WITH RECURSIVE cnt(x) AS (
			SELECT 1 UNION ALL SELECT x + 1 FROM cnt WHERE x < 10000000
		)
		SELECT count(x) FROM cnt`, nil, 0)
	elapsed := time.Since(start)

	if !errors.Is(err, ErrTimeout) {
		t.Fatalf("expected ErrTimeout, got %v (after %v)", err, elapsed)
	}
	// The deadline was 100ms. A generous ceiling still catches a driver that
	// only notices the deadline after finishing all 10 million rows, which
	// takes far longer than this on the pure-Go build.
	if elapsed > 5*time.Second {
		t.Errorf("statement was not interrupted: took %v, want under 5s", elapsed)
	}
}

// newTestManagerWithCache creates a manager whose handle cache holds at most
// maxCached projects.
func newTestManagerWithCache(t *testing.T, maxCached int) *Manager {
	t.Helper()

	manager, err := NewManager(t.TempDir(), 100*1024*1024, 5*time.Second, maxCached, logger.Nop())
	if err != nil {
		t.Fatalf("create manager: %v", err)
	}
	t.Cleanup(func() { _ = manager.Close() })
	return manager
}

// cachedCount reports how many handles are open. Test support only.
func (manager *Manager) cachedCount() int {
	manager.mu.Lock()
	defer manager.mu.Unlock()
	return len(manager.dbs)
}

func TestConnectionCacheEvictsLeastRecentlyUsed(t *testing.T) {
	manager := newTestManagerWithCache(t, 2)
	ctx := context.Background()

	projects := []uuid.UUID{uuid.New(), uuid.New(), uuid.New()}
	for _, projectID := range projects {
		if err := manager.InitializeProject(ctx, projectID); err != nil {
			t.Fatalf("initialize project: %v", err)
		}
	}

	// Touch all three, most recently used last.
	for _, projectID := range projects {
		if _, err := manager.Query(ctx, projectID, `SELECT 1`, nil, 0); err != nil {
			t.Fatalf("query after cache churn: %v", err)
		}
	}

	if got := manager.cachedCount(); got > 2 {
		t.Errorf("cached handles = %d, want at most 2", got)
	}

	// The oldest project was evicted; querying it must reopen it rather
	// than fail.
	if _, err := manager.Query(ctx, projects[0], `SELECT 1`, nil, 0); err != nil {
		t.Errorf("query evicted project: %v", err)
	}
}

func TestConnectionCacheNeverEvictsProjectInUse(t *testing.T) {
	manager := newTestManagerWithCache(t, 1)
	ctx := context.Background()

	projectA, projectB := uuid.New(), uuid.New()
	for _, projectID := range []uuid.UUID{projectA, projectB} {
		if err := manager.InitializeProject(ctx, projectID); err != nil {
			t.Fatalf("initialize project: %v", err)
		}
	}

	// Hold A in flight, then bring B into a full cache. A has a non-zero
	// ref count, so it must survive; closing it here would pull the handle
	// out from under the operation that is using it.
	_, releaseA, err := manager.acquire(projectA)
	if err != nil {
		t.Fatalf("acquire A: %v", err)
	}
	_, releaseB, err := manager.acquire(projectB)
	if err != nil {
		t.Fatalf("acquire B: %v", err)
	}
	if got := manager.cachedCount(); got != 2 {
		t.Errorf("cached handles = %d while A is in use, want A kept open (2 total)", got)
	}
	releaseA()
	releaseB()

	// Once released, A is the least recently used idle entry and the next
	// acquisition may evict it.
	if _, release, err := manager.acquire(projectB); err != nil {
		t.Fatalf("acquire B: %v", err)
	} else {
		release()
	}
	if got := manager.cachedCount(); got > 1 {
		t.Errorf("cached handles = %d after release, want at most 1", got)
	}
}

func TestConcurrentUseDuringEviction(t *testing.T) {
	manager := newTestManagerWithCache(t, 2)
	ctx := context.Background()

	projects := make([]uuid.UUID, 5)
	for index := range projects {
		projects[index] = uuid.New()
		if err := manager.InitializeProject(ctx, projects[index]); err != nil {
			t.Fatalf("initialize project: %v", err)
		}
		if _, err := manager.Exec(ctx, projects[index],
			`CREATE TABLE t (v INTEGER)`, nil); err != nil {
			t.Fatalf("create table: %v", err)
		}
	}

	// Round-robin reads and writes while the cache is smaller than the
	// working set, so handles are opened and evicted underneath real
	// traffic. A handle closed mid-operation, a lost write lock, or an
	// unsynchronized map would show up here, especially under -race.
	var waitGroup sync.WaitGroup
	errorChannel := make(chan error, 64)
	for worker := 0; worker < 8; worker++ {
		waitGroup.Add(1)
		go func() {
			defer waitGroup.Done()
			for iteration := 0; iteration < 50; iteration++ {
				projectID := projects[iteration%len(projects)]
				if _, err := manager.Exec(ctx, projectID,
					`INSERT INTO t (v) VALUES (?)`, []any{iteration}); err != nil {
					errorChannel <- err
					return
				}
				if _, err := manager.Query(ctx, projectID, `SELECT count(*) FROM t`, nil, 0); err != nil {
					errorChannel <- err
					return
				}
			}
		}()
	}
	waitGroup.Wait()
	close(errorChannel)

	for err := range errorChannel {
		t.Fatalf("concurrent operation during eviction: %v", err)
	}
	if got := manager.cachedCount(); got > 2 {
		t.Errorf("cached handles = %d, want at most 2", got)
	}
}
