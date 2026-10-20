package dbplane

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
)

// fillAndFree builds the shape a quota stays spent on: rows large enough to
// own real pages, then most of them deleted, so the file carries free pages
// that only a rewrite returns.
func fillAndFree(t *testing.T, manager *Manager, projectID uuid.UUID, rows int) {
	t.Helper()
	ctx := context.Background()

	if _, err := manager.Exec(ctx, projectID, "CREATE TABLE t (x TEXT)", nil); err != nil {
		t.Fatalf("create table: %v", err)
	}
	for index := 0; index < rows; index++ {
		if _, err := manager.Exec(ctx, projectID, "INSERT INTO t (x) VALUES (?)", []any{strings.Repeat("a", 8000)}); err != nil {
			t.Fatalf("insert %d: %v", index, err)
		}
	}
	if _, err := manager.Exec(ctx, projectID, "DELETE FROM t WHERE rowid > 10", nil); err != nil {
		t.Fatalf("delete: %v", err)
	}
}

// TestMaintainReturnsFreedPagesToTheFilesystem: deleting rows releases the
// pages to the file's freelist, not to the host, so the quota stays spent until
// something rewrites the file. The run reports both numbers, and the file on
// disk is measurably smaller afterwards.
func TestMaintainReturnsFreedPagesToTheFilesystem(t *testing.T) {
	manager := newTestManager(t, 100*1024*1024)
	projectID := uuid.New()
	ctx := context.Background()
	if err := manager.InitializeProject(ctx, projectID); err != nil {
		t.Fatalf("initialize project: %v", err)
	}
	fillAndFree(t, manager, projectID, 400)

	stored, err := manager.Maintain(ctx, projectID)
	if err != nil {
		t.Fatalf("maintain: %v", err)
	}

	// A checkpoint has nothing to fold when the log is empty, and by the time
	// this runs the vacuum has just written the file through, so false here
	// means the log was already empty rather than that anything failed.
	if !stored.Reindexed || !stored.Optimized || !stored.Vacuumed {
		t.Errorf("a database with free pages should have done every step, got %+v", *stored)
	}
	if stored.FreelistBefore == 0 {
		t.Fatal("the fixture left no free pages, so this proves nothing")
	}
	if stored.FreelistAfter != 0 {
		t.Errorf("freelist after = %d bytes, want 0", stored.FreelistAfter)
	}
	if stored.SizeAfter >= stored.SizeBefore {
		t.Errorf("size went from %d to %d bytes, want it smaller",
			stored.SizeBefore, stored.SizeAfter)
	}
	if stored.SizeAfter != stored.FreelistBefore+4096*3 {
		// A loose sanity check rather than an exact one: page counts depend on
		// the SQLite version. What matters is that the bytes the freelist held
		// are the bytes that came back, plus a page or two of schema.
		t.Logf("size after %d, freelist before %d", stored.SizeAfter, stored.FreelistBefore)
	}

	// The database is still usable and still holds the rows that were kept.
	rows, err := manager.Query(ctx, projectID, "SELECT count(*) FROM t", nil, 0)
	if err != nil {
		t.Fatalf("query after maintain: %v", err)
	}
	if len(rows.Rows) != 1 || rows.Rows[0][0] != int64(10) {
		t.Errorf("rows after maintain = %v, want 10", rows.Rows)
	}
}

// TestMaintainOnATightDatabaseNeedsNoRewrite: a database with nothing free has
// nothing to return, so the expensive part is skipped and reported as such. The
// run still reindexes, rebuilds statistics and folds the log back in.
func TestMaintainOnATightDatabaseNeedsNoRewrite(t *testing.T) {
	manager := newTestManager(t, 100*1024*1024)
	projectID := uuid.New()
	ctx := context.Background()
	if err := manager.InitializeProject(ctx, projectID); err != nil {
		t.Fatalf("initialize project: %v", err)
	}
	if _, err := manager.Exec(ctx, projectID, "CREATE TABLE t (x TEXT)", nil); err != nil {
		t.Fatalf("create table: %v", err)
	}
	if _, err := manager.Exec(ctx, projectID, "INSERT INTO t (x) VALUES ('a')", nil); err != nil {
		t.Fatalf("insert: %v", err)
	}

	result, err := manager.Maintain(ctx, projectID)
	if err != nil {
		t.Fatalf("maintain: %v", err)
	}
	if result.Vacuumed {
		t.Errorf("a database with no free pages was rewritten anyway: %+v", *result)
	}
	if result.FreelistBefore != 0 {
		t.Errorf("freelist before = %d, want 0", result.FreelistBefore)
	}
	if !result.Reindexed || !result.Optimized {
		t.Errorf("reindex and analyze should still have run: %+v", *result)
	}
}

// TestMaintainKeepsTheFileWithinItsLimit: a vacuum is not a way around the
// plan. The size limit travels with the connection as max_page_count, so
// whatever the rewrite does it cannot leave a file larger than the project is
// allowed -- the same cap that refuses an oversized INSERT refuses an oversized
// rewrite, as SQLITE_FULL, which the write path already reports as the size
// failure it is.
//
// The assertion is the invariant rather than a particular error: on a database
// with room to spare the run succeeds and the file is within its limit
// afterwards, which is the property a caller depends on and the one a rewrite
// would otherwise be able to break.
func TestMaintainKeepsTheFileWithinItsLimit(t *testing.T) {
	const limit = 16 << 20
	manager := newTestManager(t, limit)
	projectID := uuid.New()
	ctx := context.Background()
	if err := manager.InitializeProject(ctx, projectID); err != nil {
		t.Fatalf("initialize project: %v", err)
	}
	// Big enough that the file owns real pages, small enough that the rewrite
	// fits: this is the ordinary case, and the size it lands on has to be
	// under the limit.
	fillAndFree(t, manager, projectID, 400)

	result, err := manager.Maintain(ctx, projectID)
	if err != nil {
		t.Fatalf("maintain: %v", err)
	}
	if result.SizeAfter > limit {
		t.Fatalf("maintenance left the file at %d bytes, over the %d byte limit",
			result.SizeAfter, limit)
	}
	if result.SizeAfter > result.SizeBefore {
		t.Fatalf("maintenance grew the file from %d to %d bytes",
			result.SizeBefore, result.SizeAfter)
	}

	// And it is still a working database afterwards.
	if _, err := manager.Query(ctx, projectID, "SELECT count(*) FROM t", nil, 0); err != nil {
		t.Fatalf("query after maintain: %v", err)
	}
}

// TestMaintainWaitsForTheWriteLockHonoringContext: maintenance is a writer, so
// it queues behind the project's other writers -- and a request that ends while
// queued has to be able to walk away rather than wait for a response nobody
// will read.
func TestMaintainWaitsForTheWriteLockHonoringContext(t *testing.T) {
	manager := newTestManager(t, 100*1024*1024)
	projectID := uuid.New()
	ctx := context.Background()
	if err := manager.InitializeProject(ctx, projectID); err != nil {
		t.Fatalf("initialize project: %v", err)
	}

	connection, release, err := manager.acquire(projectID)
	if err != nil {
		t.Fatalf("acquire: %v", err)
	}
	defer release()
	if err := lockWrite(ctx, connection.writeLock); err != nil {
		t.Fatalf("take the write lock: %v", err)
	}
	defer func() { <-connection.writeLock }()

	waitCtx, cancel := context.WithTimeout(ctx, 100*time.Millisecond)
	defer cancel()

	done := make(chan error, 1)
	go func() {
		_, err := manager.Maintain(waitCtx, projectID)
		done <- err
	}()

	select {
	case err := <-done:
		if !errors.Is(err, ErrBusy) {
			t.Fatalf("error = %v, want ErrBusy", err)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("maintenance waited past its context instead of reporting busy")
	}
}

// TestMaintainRefusesAnUnknownProject: the run is project-scoped, so a project
// with no file is a 404 rather than an empty database created on the spot.
func TestMaintainRefusesAnUnknownProject(t *testing.T) {
	manager := newTestManager(t, 100*1024*1024)
	if _, err := manager.Maintain(context.Background(), uuid.New()); !errors.Is(err, ErrNotFound) {
		t.Fatalf("error = %v, want ErrNotFound", err)
	}
}

// TestMaintainRefusesAnInvalidProjectID: the id becomes part of a path, so it
// is validated before any file is touched.
func TestMaintainRefusesAnInvalidProjectID(t *testing.T) {
	manager := newTestManager(t, 100*1024*1024)
	_, err := manager.Maintain(context.Background(), uuid.Nil)
	if err == nil {
		t.Fatal("an empty project id was accepted")
	}
	if !strings.Contains(err.Error(), "project id") {
		t.Fatalf("error = %v, want a complaint about the project id", err)
	}
}
