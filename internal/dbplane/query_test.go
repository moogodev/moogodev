package dbplane

import (
	"context"
	"testing"

	"github.com/google/uuid"
)

// TestQueryRefusesWritesOnReadOnlyPool is the MG-01 defense in depth: the
// handler classifies before routing, but the classification is a hint, so the
// pool Manager.Query runs on must make a write impossible no matter what the
// caller believed. A DELETE handed straight to Query must fail, and the row
// must survive.
func TestQueryRefusesWritesOnReadOnlyPool(t *testing.T) {
	manager := newTestManager(t, 100*1024*1024)
	projectID := uuid.New()
	ctx := context.Background()

	if err := manager.InitializeProject(ctx, projectID); err != nil {
		t.Fatalf("initialize project: %v", err)
	}
	if _, err := manager.Exec(ctx, projectID,
		`CREATE TABLE items (name TEXT NOT NULL)`, nil); err != nil {
		t.Fatalf("create table: %v", err)
	}
	if _, err := manager.Exec(ctx, projectID,
		`INSERT INTO items (name) VALUES ('keep')`, nil); err != nil {
		t.Fatalf("insert: %v", err)
	}

	if _, err := manager.Query(ctx, projectID, `DELETE FROM items`, nil, 0); err == nil {
		t.Fatal("expected the read pool to refuse a write statement")
	}

	count, err := manager.Query(ctx, projectID, `SELECT count(*) FROM items`, nil, 0)
	if err != nil {
		t.Fatalf("count after refused write: %v", err)
	}
	if len(count.Rows) != 1 || len(count.Rows[0]) != 1 {
		t.Fatalf("expected one count row, got %#v", count.Rows)
	}
	if got := count.Rows[0][0]; got != int64(1) {
		t.Errorf("expected the row to survive, count = %v", got)
	}
}

// TestReadOnlyPoolStillServesDashboardReads guards the other side of the fix:
// query_only must not break what /query exists for -- SELECT, PRAGMA (the
// schema inspector), EXPLAIN, and CTE reads.
func TestReadOnlyPoolStillServesDashboardReads(t *testing.T) {
	manager := newTestManager(t, 100*1024*1024)
	projectID := uuid.New()
	ctx := context.Background()

	if err := manager.InitializeProject(ctx, projectID); err != nil {
		t.Fatalf("initialize project: %v", err)
	}
	if _, err := manager.Exec(ctx, projectID,
		`CREATE TABLE items (name TEXT NOT NULL)`, nil); err != nil {
		t.Fatalf("create table: %v", err)
	}

	statements := []string{
		`SELECT name FROM items`,
		`PRAGMA table_info(items)`,
		`EXPLAIN SELECT * FROM items`,
		`WITH recent AS (SELECT name FROM items) SELECT * FROM recent`,
	}
	for _, statement := range statements {
		if _, err := manager.Query(ctx, projectID, statement, nil, 0); err != nil {
			t.Errorf("Query(%q) failed on the read pool: %v", statement, err)
		}
	}
}
