package dbplane

import (
	"context"
	"strings"
	"testing"

	"github.com/google/uuid"
)

// countRows reads one integer out of the project database, which is how every
// assertion here checks what actually survived rather than what the engine
// reported.
func countRows(t *testing.T, manager *Manager, projectID uuid.UUID, table string) int64 {
	t.Helper()
	result, err := manager.Query(context.Background(), projectID,
		`SELECT count(*) FROM `+table, nil, 0)
	if err != nil {
		t.Fatalf("count %s: %v", table, err)
	}
	if len(result.Rows) != 1 || len(result.Rows[0]) != 1 {
		t.Fatalf("expected one count row, got %#v", result.Rows)
	}
	value, ok := result.Rows[0][0].(int64)
	if !ok {
		t.Fatalf("expected an int64 count, got %T", result.Rows[0][0])
	}
	return value
}

// TestTransactionCommitsEveryStatement is the feature working: several writes,
// one atomic unit, all of them visible afterwards.
func TestTransactionCommitsEveryStatement(t *testing.T) {
	manager := newTestManager(t, 100*1024*1024)
	projectID := uuid.New()
	ctx := context.Background()

	if err := manager.InitializeProject(ctx, projectID); err != nil {
		t.Fatalf("initialize project: %v", err)
	}
	if _, err := manager.Exec(ctx, projectID,
		`CREATE TABLE todos (id TEXT PRIMARY KEY, done INTEGER NOT NULL DEFAULT 0)`, nil); err != nil {
		t.Fatalf("create table: %v", err)
	}

	result, err := manager.Transaction(ctx, projectID, []TransactionStatement{
		{Query: `INSERT INTO todos (id) VALUES (?)`, Args: []any{"a"}},
		{Query: `INSERT INTO todos (id) VALUES (?)`, Args: []any{"b"}},
		{Query: `UPDATE todos SET done = 1 WHERE id = ?`, Args: []any{"a"}},
	})
	if err != nil {
		t.Fatalf("transaction: %v", err)
	}

	// One result per statement, in order: two inserts and one update.
	if len(result.Statements) != 3 {
		t.Fatalf("expected 3 statement results, got %d", len(result.Statements))
	}
	if result.Statements[0].RowsAffected != 1 || result.Statements[1].RowsAffected != 1 {
		t.Errorf("expected each insert to report 1 row, got %#v", result.Statements)
	}
	if result.Statements[2].RowsAffected != 1 {
		t.Errorf("expected the update to report 1 row, got %#v", result.Statements[2])
	}
	if result.RowsAffected != 3 {
		t.Errorf("expected a total of 3, got %d", result.RowsAffected)
	}
	if result.SizeBytes <= 0 {
		t.Error("expected a database size in the response")
	}

	if got := countRows(t, manager, projectID, "todos"); got != 2 {
		t.Errorf("expected 2 committed rows, got %d", got)
	}
}

// TestTransactionRollsBackEveryStatement is the guarantee that makes the
// endpoint worth having: a batch that fails half way leaves nothing behind, so
// a caller can retry it without first working out which step already took
// effect.
func TestTransactionRollsBackEveryStatement(t *testing.T) {
	manager := newTestManager(t, 100*1024*1024)
	projectID := uuid.New()
	ctx := context.Background()

	if err := manager.InitializeProject(ctx, projectID); err != nil {
		t.Fatalf("initialize project: %v", err)
	}
	if _, err := manager.Exec(ctx, projectID,
		`CREATE TABLE todos (id TEXT PRIMARY KEY)`, nil); err != nil {
		t.Fatalf("create table: %v", err)
	}

	// The second statement violates the primary key, so the third must never
	// run and the first must be undone.
	_, err := manager.Transaction(ctx, projectID, []TransactionStatement{
		{Query: `INSERT INTO todos (id) VALUES (?)`, Args: []any{"a"}},
		{Query: `INSERT INTO todos (id) VALUES (?)`, Args: []any{"a"}},
		{Query: `INSERT INTO todos (id) VALUES (?)`, Args: []any{"c"}},
	})
	if err == nil {
		t.Fatal("expected the duplicate key to fail the transaction")
	}

	// The failing statement is named, so a hundred-statement batch can be fixed
	// without bisecting it by hand.
	if !strings.Contains(err.Error(), "statement 2") {
		t.Errorf("expected the error to name statement 2, got %q", err)
	}

	if got := countRows(t, manager, projectID, "todos"); got != 0 {
		t.Errorf("expected the whole batch to roll back, found %d row(s)", got)
	}
}

// TestTransactionRollsBackOnForeignKeyViolation ties the batch semantics to a
// constraint: a write that breaks referential integrity takes the rest of the
// batch with it. foreign_keys is already on for every connection, and this is
// what that setting buys in a transaction.
func TestTransactionRollsBackOnForeignKeyViolation(t *testing.T) {
	manager := newTestManager(t, 100*1024*1024)
	projectID := uuid.New()
	ctx := context.Background()

	if err := manager.InitializeProject(ctx, projectID); err != nil {
		t.Fatalf("initialize project: %v", err)
	}
	if _, err := manager.Transaction(ctx, projectID, []TransactionStatement{
		{Query: `CREATE TABLE authors (id TEXT PRIMARY KEY)`},
		{Query: `CREATE TABLE books (
			id TEXT PRIMARY KEY,
			author_id TEXT NOT NULL REFERENCES authors(id))`},
	}); err != nil {
		t.Fatalf("create schema: %v", err)
	}

	_, err := manager.Transaction(ctx, projectID, []TransactionStatement{
		{Query: `INSERT INTO authors (id) VALUES ('a1')`},
		{Query: `INSERT INTO books (id, author_id) VALUES ('b1', 'missing')`},
	})
	if err == nil {
		t.Fatal("expected the orphan row to be refused")
	}

	if got := countRows(t, manager, projectID, "authors"); got != 0 {
		t.Errorf("expected the author insert to roll back too, found %d", got)
	}
	if got := countRows(t, manager, projectID, "books"); got != 0 {
		t.Errorf("expected no books, found %d", got)
	}
}

// TestTransactionRefusesDDLAndWritesMixed covers the other shape a migration
// takes: schema and data in one batch, which is how a migration that adds a
// column and backfills it stays consistent.
func TestTransactionRefusesDDLAndWritesMixed(t *testing.T) {
	manager := newTestManager(t, 100*1024*1024)
	projectID := uuid.New()
	ctx := context.Background()

	if err := manager.InitializeProject(ctx, projectID); err != nil {
		t.Fatalf("initialize project: %v", err)
	}
	if _, err := manager.Exec(ctx, projectID, `CREATE TABLE users (id TEXT PRIMARY KEY)`, nil); err != nil {
		t.Fatalf("create table: %v", err)
	}

	if _, err := manager.Transaction(ctx, projectID, []TransactionStatement{
		{Query: `ALTER TABLE users ADD COLUMN email TEXT`},
		{Query: `UPDATE users SET email = 'a@example.com'`},
	}); err != nil {
		t.Fatalf("ddl and write in one batch: %v", err)
	}

	result, err := manager.Query(ctx, projectID, `SELECT email FROM users`, nil, 0)
	if err != nil {
		t.Fatalf("read after migration: %v", err)
	}
	// The column exists: a failed migration would have rolled the ALTER back and
	// left this query failing on a missing column.
	if len(result.Columns) != 1 || result.Columns[0] != "email" {
		t.Fatalf("expected the added column, got %#v", result.Columns)
	}
}

// TestTransactionRefusesAnEmptyBatch: a batch of nothing is a client bug, and
// committing it as a success would hide it.
func TestTransactionRefusesAnEmptyBatch(t *testing.T) {
	manager := newTestManager(t, 1024*1024)
	projectID := uuid.New()

	if err := manager.InitializeProject(context.Background(), projectID); err != nil {
		t.Fatalf("initialize project: %v", err)
	}

	if _, err := manager.Transaction(context.Background(), projectID, nil); err == nil {
		t.Fatal("expected an empty transaction to be refused")
	}
}

// TestTransactionRefusesTooManyStatements: the count cap exists because the
// write lock is held for the whole batch, and a batch of ten thousand statements
// holds it for ten thousand driver round trips.
func TestTransactionRefusesTooManyStatements(t *testing.T) {
	manager := newTestManager(t, 1024*1024)
	projectID := uuid.New()

	if err := manager.InitializeProject(context.Background(), projectID); err != nil {
		t.Fatalf("initialize project: %v", err)
	}

	statements := make([]TransactionStatement, MaxTransactionStatements+1)
	for index := range statements {
		statements[index] = TransactionStatement{Query: `UPDATE users SET seen = 1`}
	}

	_, err := manager.Transaction(context.Background(), projectID, statements)
	if err == nil {
		t.Fatal("expected an oversized transaction to be refused")
	}
	if !strings.Contains(err.Error(), "too many statements") {
		t.Errorf("expected a count refusal, got %q", err)
	}
}
