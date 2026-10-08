package dbplane

import (
	"context"
	"encoding/json"
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

	// One statement far beyond the limit, built row by row so no single
	// value trips the per-value length limit first: the point is the file
	// growth, not a big literal.
	_, err := manager.Exec(ctx, projectID,
		`WITH RECURSIVE seq(i) AS (SELECT 1 UNION ALL SELECT i+1 FROM seq WHERE i < 2048) `+
			`INSERT INTO items (payload) SELECT zeroblob(4096) FROM seq`, nil)
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

// TestQueryRefusesAnOversizedResult is MG-05's Go-side byte cap: the row cap
// bounds how many rows come back, not how many bytes, so one wide column
// times the row cap could pin hundreds of megabytes before the response is
// written. The result that would exceed the response budget fails instead.
func TestQueryRefusesAnOversizedResult(t *testing.T) {
	manager := newTestManager(t, 100*1024*1024)
	projectID := uuid.New()
	ctx := context.Background()

	if err := manager.InitializeProject(ctx, projectID); err != nil {
		t.Fatalf("initialize project: %v", err)
	}
	if _, err := manager.Exec(ctx, projectID, `CREATE TABLE items (payload BLOB)`, nil); err != nil {
		t.Fatalf("create table: %v", err)
	}
	if _, err := manager.Exec(ctx, projectID,
		`INSERT INTO items (payload) VALUES (zeroblob(17825792))`, nil); err != nil {
		t.Fatalf("insert: %v", err)
	}

	if _, err := manager.Query(ctx, projectID, `SELECT payload FROM items`, nil, 0); !errors.Is(err, ErrResultTooLarge) {
		t.Fatalf("query: err = %v, want ErrResultTooLarge", err)
	}
}

// TestHugeSynthesizedValueIsRefused is MG-05's SQLite-side length limit: a
// value larger than the project's whole database never has to exist --
// zeroblob builds one from a two-word statement, so the database size cap
// says nothing about it. sqlite3_limit refuses it before SQLite materializes
// the bytes.
func TestHugeSynthesizedValueIsRefused(t *testing.T) {
	manager := newTestManager(t, 4*1024*1024)
	projectID := uuid.New()
	ctx := context.Background()

	if err := manager.InitializeProject(ctx, projectID); err != nil {
		t.Fatalf("initialize project: %v", err)
	}

	if _, err := manager.Query(ctx, projectID, `SELECT zeroblob(8388608)`, nil, 0); err == nil {
		t.Fatal("expected a value twice the database's limit to be refused")
	}
}

// TestJSONNumberArgumentsBindAsNumbers: after UseNumber the decoder hands
// the engine json.Number. database/sql's default converter would turn that
// into TEXT -- "SELECT ?" would answer with a quoted number -- so the
// engine converts to int64/float64 before the driver sees it. The digit
// beyond 2^53 is the case that proves no float64 rode along.
func TestJSONNumberArgumentsBindAsNumbers(t *testing.T) {
	manager := newTestManager(t, 100*1024*1024)
	projectID := uuid.New()
	ctx := context.Background()

	if err := manager.InitializeProject(ctx, projectID); err != nil {
		t.Fatalf("initialize project: %v", err)
	}

	result, err := manager.Query(ctx, projectID,
		`SELECT ?, ?, ?, typeof(?)`,
		[]any{json.Number("9007199254740993"), json.Number("2.5"), json.Number("42"), json.Number("42")},
		0)
	if err != nil {
		t.Fatalf("query: %v", err)
	}
	if len(result.Rows) != 1 || len(result.Rows[0]) != 4 {
		t.Fatalf("unexpected rows: %+v", result.Rows)
	}

	row := result.Rows[0]
	if row[0] != int64(9007199254740993) {
		t.Errorf("integer arg: got %#v, want int64 9007199254740993", row[0])
	}
	if row[1] != 2.5 {
		t.Errorf("real arg: got %#v, want float64 2.5", row[1])
	}
	if row[2] != int64(42) {
		t.Errorf("small integer arg: got %#v, want int64 42", row[2])
	}
	if row[3] != "integer" {
		t.Errorf("typeof: got %#v, want integer", row[3])
	}
}
