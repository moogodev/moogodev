package dbplane

import (
	"context"
	"errors"
	"testing"

	"github.com/google/uuid"
)

// TestProjectDatabasesUseFourKilobytePages guards the arithmetic behind
// max_page_count: the cap is computed as maxDBBytes / pageSize, so every
// database the platform creates must sit on SQLite's default page size.
func TestProjectDatabasesUseFourKilobytePages(t *testing.T) {
	manager := newTestManager(t, 100*1024*1024)
	projectID := uuid.New()
	ctx := context.Background()

	if err := manager.InitializeProject(ctx, projectID); err != nil {
		t.Fatalf("initialize project: %v", err)
	}

	var pageSize int64
	queryResult, err := manager.Query(ctx, projectID, `PRAGMA page_size`, nil, 0)
	if err != nil {
		t.Fatalf("page_size: %v", err)
	}
	if len(queryResult.Rows) != 1 || len(queryResult.Rows[0]) != 1 {
		t.Fatalf("expected one page_size row, got %#v", queryResult.Rows)
	}
	switch value := queryResult.Rows[0][0].(type) {
	case int64:
		pageSize = value
	default:
		t.Fatalf("unexpected page_size type %T (%v)", value, value)
	}
	if pageSize != 4096 {
		t.Errorf("page_size = %d, want 4096 (max_page_count is computed from it)", pageSize)
	}
}

// TestSingleStatementCannotCrossTheSizeLimit is MG-02's hard cap: the
// pre-check runs before the statement, so one large INSERT could always grow
// the file past the limit and only be refused afterwards. With
// max_page_count SQLite refuses mid-statement, the statement rolls back, and
// the file never exceeds the limit.
func TestSingleStatementCannotCrossTheSizeLimit(t *testing.T) {
	const limit = 512 * 1024
	manager := newTestManager(t, limit)
	projectID := uuid.New()
	ctx := context.Background()

	if err := manager.InitializeProject(ctx, projectID); err != nil {
		t.Fatalf("initialize project: %v", err)
	}
	if _, err := manager.Exec(ctx, projectID, `CREATE TABLE items (payload BLOB)`, nil); err != nil {
		t.Fatalf("create table: %v", err)
	}

	_, err := manager.Exec(ctx, projectID,
		`INSERT INTO items (payload) VALUES (zeroblob(4194304))`, nil)
	if !errors.Is(err, ErrSizeExceeded) {
		t.Fatalf("crossing statement: err = %v, want ErrSizeExceeded", err)
	}

	size, err := DatabaseSizeBytes(manager.databasePath(projectID))
	if err != nil {
		t.Fatalf("database size: %v", err)
	}
	if size > limit {
		t.Errorf("database grew to %d bytes, limit is %d", size, limit)
	}
}

// TestFullDatabaseStillAcceptsDeletesAndRecovers is MG-02's lockout check:
// size accounting must count data pages, not allocated ones, so a database
// at its limit still accepts a DELETE and can grow again afterwards by
// reusing the freed pages.
func TestFullDatabaseStillAcceptsDeletesAndRecovers(t *testing.T) {
	const limit = 256 * 1024
	manager := newTestManager(t, limit)
	projectID := uuid.New()
	ctx := context.Background()

	if err := manager.InitializeProject(ctx, projectID); err != nil {
		t.Fatalf("initialize project: %v", err)
	}
	if _, err := manager.Exec(ctx, projectID, `CREATE TABLE items (payload BLOB)`, nil); err != nil {
		t.Fatalf("create table: %v", err)
	}

	// Fill until the limit refuses the write.
	var fillErr error
	for i := 0; i < 10000; i++ {
		_, fillErr = manager.Exec(ctx, projectID,
			`INSERT INTO items (payload) VALUES (zeroblob(8192))`, nil)
		if fillErr != nil {
			break
		}
	}
	if !errors.Is(fillErr, ErrSizeExceeded) {
		t.Fatalf("fill: err = %v, want ErrSizeExceeded", fillErr)
	}

	// A full database must still accept the statement that empties it.
	if _, err := manager.Exec(ctx, projectID, `DELETE FROM items`, nil); err != nil {
		t.Fatalf("delete on a full database: %v", err)
	}

	// And after the rows are gone the freed pages are reusable, so a small
	// insert fits again without anyone raising the limit.
	if _, err := manager.Exec(ctx, projectID,
		`INSERT INTO items (payload) VALUES (zeroblob(4096))`, nil); err != nil {
		t.Fatalf("insert after delete: %v", err)
	}
}
