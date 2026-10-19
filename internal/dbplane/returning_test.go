package dbplane

import (
	"context"
	"testing"

	"github.com/google/uuid"
)

// TestHasReturningClause pins the detector that decides ExecContext versus
// QueryContext. A false negative silently discards the rows a caller asked for,
// which is the bug this whole path exists to fix; a false positive is safe (a
// plain write returns an empty result set) but would misreport rows_affected,
// so both directions are exercised.
func TestHasReturningClause(t *testing.T) {
	testCases := []struct {
		name      string
		statement string
		want      bool
	}{
		{"insert returning", `INSERT INTO t (x) VALUES (1) RETURNING id`, true},
		{"update returning", `UPDATE t SET x = 1 WHERE id = 2 RETURNING *`, true},
		{"delete returning", `DELETE FROM t RETURNING old.x`, true},
		{"replace returning", `REPLACE INTO t (id) VALUES (1) RETURNING id, x`, true},
		{"returning is case insensitive", `insert into t (x) values (1) returning ID`, true},
		{"returning across lines", "INSERT INTO t (x) VALUES (1)\nRETURNING id", true},

		{"plain insert", `INSERT INTO t (x) VALUES (1)`, false},
		{"plain update", `UPDATE t SET x = 1`, false},
		{"plain delete", `DELETE FROM t`, false},
		{"create table", `CREATE TABLE t (id INTEGER PRIMARY KEY)`, false},

		// A literal reading "returning" is data, not the clause.
		{"string literal", `INSERT INTO t (x) VALUES ('returning')`, false},
		{"column named returning", `INSERT INTO t (returning) VALUES (1)`, false},
		// A subquery's own RETURNING (or a column list) sits in parens and is
		// not the statement's clause.
		{"returning inside parens", `INSERT INTO t (x) SELECT y FROM (SELECT returning FROM u)`, false},
		// "INTO returning" is a table named returning, not the clause.
		{"table named returning", `INSERT INTO returning (x) VALUES (1)`, false},
		{"commented out", "INSERT INTO t (x) VALUES (1) -- RETURNING id", false},
		{"returning in block comment", `INSERT INTO t (x) VALUES (1) /* RETURNING id */`, false},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			if got := hasReturningClause(testCase.statement); got != testCase.want {
				t.Errorf("hasReturningClause(%q) = %v, want %v",
					testCase.statement, got, testCase.want)
			}
		})
	}
}

// TestExecReturnsReturningRows is the end-to-end behaviour: an INSERT ... RETURNING
// through Exec hands back the rows the statement touched, so a caller learns the
// generated id and defaults in one round trip instead of a write plus a SELECT.
// Before this, ExecContext discarded those rows and the caller got only a count.
func TestExecReturnsReturningRows(t *testing.T) {
	manager := newTestManager(t, 100*1024*1024)
	projectID := uuid.New()
	ctx := context.Background()

	if err := manager.InitializeProject(ctx, projectID); err != nil {
		t.Fatalf("initialize project: %v", err)
	}
	if _, err := manager.Exec(ctx, projectID,
		`CREATE TABLE notes (id INTEGER PRIMARY KEY AUTOINCREMENT, body TEXT NOT NULL DEFAULT 'hi')`,
		nil); err != nil {
		t.Fatalf("create table: %v", err)
	}

	result, err := manager.Exec(ctx, projectID,
		`INSERT INTO notes (body) VALUES ('first') RETURNING id, body`, nil)
	if err != nil {
		t.Fatalf("insert with returning: %v", err)
	}

	if len(result.Columns) != 2 || result.Columns[0] != "id" || result.Columns[1] != "body" {
		t.Fatalf("columns = %#v, want [id body]", result.Columns)
	}
	if len(result.Rows) != 1 {
		t.Fatalf("expected one returned row, got %d: %#v", len(result.Rows), result.Rows)
	}
	row := result.Rows[0]
	if len(row) != 2 {
		t.Fatalf("returned row has %d values, want 2: %#v", len(row), row)
	}
	if body, _ := row[1].(string); body != "first" {
		t.Errorf("returned body = %v, want \"first\"", row[1])
	}
	// The count must agree with the rows handed back: one row returned, one
	// row inserted.
	if result.RowsAffected != 1 {
		t.Errorf("rows_affected = %d, want 1", result.RowsAffected)
	}
}

// TestExecWithoutReturningLeavesRowsEmpty is the other half: an ordinary write
// reports its count and id but carries no rows, so a caller can tell a plain
// insert from one that asked data back.
func TestExecWithoutReturningLeavesRowsEmpty(t *testing.T) {
	manager := newTestManager(t, 100*1024*1024)
	projectID := uuid.New()
	ctx := context.Background()

	if err := manager.InitializeProject(ctx, projectID); err != nil {
		t.Fatalf("initialize project: %v", err)
	}
	if _, err := manager.Exec(ctx, projectID,
		`CREATE TABLE notes (body TEXT NOT NULL)`, nil); err != nil {
		t.Fatalf("create table: %v", err)
	}

	result, err := manager.Exec(ctx, projectID,
		`INSERT INTO notes (body) VALUES ('plain')`, nil)
	if err != nil {
		t.Fatalf("plain insert: %v", err)
	}

	if result.Columns != nil || result.Rows != nil {
		t.Errorf("plain insert should carry no rows, got columns=%#v rows=%#v",
			result.Columns, result.Rows)
	}
	if result.RowsAffected != 1 {
		t.Errorf("rows_affected = %d, want 1", result.RowsAffected)
	}
}

// TestExecReturningMatchesNothingReportsZero covers the RETURNING clause that
// matched no rows: the write path still reports a count of zero and the rows it
// returns are empty, not an error.
func TestExecReturningMatchesNothingReportsZero(t *testing.T) {
	manager := newTestManager(t, 100*1024*1024)
	projectID := uuid.New()
	ctx := context.Background()

	if err := manager.InitializeProject(ctx, projectID); err != nil {
		t.Fatalf("initialize project: %v", err)
	}
	if _, err := manager.Exec(ctx, projectID,
		`CREATE TABLE notes (body TEXT NOT NULL)`, nil); err != nil {
		t.Fatalf("create table: %v", err)
	}

	result, err := manager.Exec(ctx, projectID,
		`UPDATE notes SET body = 'x' WHERE 0 RETURNING body`, nil)
	if err != nil {
		t.Fatalf("update with non-matching returning: %v", err)
	}

	if result.RowsAffected != 0 {
		t.Errorf("rows_affected = %d, want 0", result.RowsAffected)
	}
	if len(result.Rows) != 0 {
		t.Errorf("expected no returned rows, got %#v", result.Rows)
	}
	// Columns are still reported even with no rows, so the caller knows the
	// clause was honoured rather than dropped.
	if len(result.Columns) != 1 || result.Columns[0] != "body" {
		t.Errorf("columns = %#v, want [body]", result.Columns)
	}
}
