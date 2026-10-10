package handler

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/google/uuid"

	"github.com/moogodev/moogodev/internal/dbplane"
	"github.com/moogodev/moogodev/pkg/logger"
	"github.com/moogodev/moogodev/pkg/sanitizer"
)

// TestFirstKeywordSkipsLeadingComments is why FirstKeyword exists instead of a
// prefix match: a statement that opens with a comment is still the INSERT it
// is, and a table named insert is not.
func TestFirstKeywordSkipsLeadingComments(t *testing.T) {
	cases := map[string]string{
		"INSERT INTO t VALUES (1)":             "INSERT",
		"  insert into t values (1)":           "INSERT",
		"-- add the row\nINSERT INTO t":        "INSERT",
		"/* seed */ INSERT INTO t":             "INSERT",
		"UPDATE t SET a = 1":                   "UPDATE",
		"REPLACE INTO t VALUES (1)":            "REPLACE",
		"WITH c AS (SELECT 1) SELECT * FROM c": "WITH",
		"":                                     "",
		"/* only a comment */":                 "",
	}

	for statement, want := range cases {
		if got := sanitizer.FirstKeyword(statement); got != want {
			t.Errorf("FirstKeyword(%q) = %q, want %q", statement, got, want)
		}
	}
}

// TestInsertedRowIDWithholdsAStaleValue is the guard that matters: SQLite's
// last_insert_rowid is connection-scoped, so after an INSERT an UPDATE still
// reports the inserted rowid. Handing that back as this statement's rowid would
// be a plausible wrong answer, so it is withheld.
func TestInsertedRowIDWithholdsAStaleValue(t *testing.T) {
	const fromAnEarlierStatement = int64(42)

	if got := insertedRowID("INSERT INTO t VALUES (1)", fromAnEarlierStatement); got != 42 {
		t.Errorf("expected an INSERT to report its rowid, got %d", got)
	}
	if got := insertedRowID("REPLACE INTO t VALUES (1)", fromAnEarlierStatement); got != 42 {
		t.Errorf("expected a REPLACE to report its rowid, got %d", got)
	}
	if got := insertedRowID("-- seed\nINSERT INTO t VALUES (1)", fromAnEarlierStatement); got != 42 {
		t.Errorf("expected a commented INSERT to report its rowid, got %d", got)
	}

	// Everything else is withholding, including the case that would otherwise
	// be wrong: an UPDATE right after an INSERT.
	for _, statement := range []string{
		"UPDATE t SET a = 1 WHERE id = ?",
		"DELETE FROM t WHERE id = ?",
		"CREATE TABLE t (id TEXT PRIMARY KEY)",
		"DROP TABLE t",
		"WITH c AS (SELECT 1) INSERT INTO t SELECT * FROM c",
		"SELECT last_insert_rowid()",
	} {
		if got := insertedRowID(statement, fromAnEarlierStatement); got != 0 {
			t.Errorf("expected %q to report no rowid, got %d", statement, got)
		}
	}

	// A driver that had nothing to report stays silent rather than reporting 0.
	if got := insertedRowID("INSERT INTO t VALUES (1)", 0); got != 0 {
		t.Errorf("expected no rowid when the driver had none, got %d", got)
	}
}

// TestExecReportsTheInsertedRowid is the saving this feature exists for: create
// a row and learn its id from the same response, with no follow-up SELECT.
func TestExecReportsTheInsertedRowid(t *testing.T) {
	engine := &fakeEngine{execResult: dbplane.ExecResult{RowsAffected: 1, LastInsertRowID: 7}}
	projectID := uuid.New()

	recorder := httptest.NewRecorder()
	NewDataPlane(engine, logger.Nop()).Exec(
		recorder, dataPlaneRequest(t, projectID, "/p/"+projectID.String()+"/exec",
			`{"query":"INSERT INTO users (email) VALUES (?)","args":["a@example.com"]}`))

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", recorder.Code, recorder.Body.String())
	}

	var response ExecResponse
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if response.LastInsertRowID != 7 {
		t.Errorf("expected last_insert_rowid 7, got %d", response.LastInsertRowID)
	}
}

// TestExecOmitsTheRowidForAnUpdate is the counterpart: an UPDATE answers
// without the field at all, rather than with a stale id or a zero that reads
// like a real rowid.
func TestExecOmitsTheRowidForAnUpdate(t *testing.T) {
	engine := &fakeEngine{execResult: dbplane.ExecResult{RowsAffected: 1, LastInsertRowID: 7}}
	projectID := uuid.New()

	recorder := httptest.NewRecorder()
	NewDataPlane(engine, logger.Nop()).Exec(
		recorder, dataPlaneRequest(t, projectID, "/p/"+projectID.String()+"/exec",
			`{"query":"UPDATE users SET seen = 1 WHERE id = ?","args":["7c1f"]}`))

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", recorder.Code)
	}

	var raw map[string]any
	if err := json.Unmarshal(recorder.Body.Bytes(), &raw); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if _, present := raw["last_insert_rowid"]; present {
		t.Error("expected the field to be absent for an UPDATE")
	}
}
