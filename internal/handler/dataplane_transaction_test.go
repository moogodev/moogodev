package handler

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/google/uuid"

	"github.com/moogodev/moogodev/internal/dbplane"
	"github.com/moogodev/moogodev/pkg/logger"
)

// transactionRequest builds an authenticated request for the batch endpoint.
func transactionRequest(
	t *testing.T, projectID uuid.UUID, body string,
) *http.Request {
	t.Helper()
	return dataPlaneRequest(t, projectID, "/p/"+projectID.String()+"/transaction", body)
}

// runTransaction sends body to the handler and returns the recorder.
func runTransaction(
	t *testing.T, engine *fakeEngine, projectID uuid.UUID, body string,
) *httptest.ResponseRecorder {
	t.Helper()
	recorder := httptest.NewRecorder()
	NewDataPlane(engine, logger.Nop()).Transaction(
		recorder, transactionRequest(t, projectID, body))
	return recorder
}

// TestTransactionRunsEveryStatement is the endpoint working: a batch is
// forwarded intact and the per-statement results come back in order.
func TestTransactionRunsEveryStatement(t *testing.T) {
	engine := &fakeEngine{}
	projectID := uuid.New()

	recorder := runTransaction(t, engine, projectID, `{"statements":[
		{"query":"INSERT INTO todos (id) VALUES (?)","args":["a"]},
		{"query":"INSERT INTO todos (id) VALUES (?)","args":["b"]}
	]}`)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", recorder.Code, recorder.Body.String())
	}

	var response TransactionResponse
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if !response.Success {
		t.Error("expected success true")
	}
	if len(response.Statements) != 2 {
		t.Fatalf("expected 2 statement results, got %d", len(response.Statements))
	}
	if response.RowsAffected != 2 {
		t.Errorf("expected a total of 2 rows, got %d", response.RowsAffected)
	}

	// The batch reached the engine unchanged, with the arguments still bound
	// rather than interpolated.
	if engine.txCalls != 1 {
		t.Fatalf("expected the engine to be called once, got %d", engine.txCalls)
	}
	if len(engine.lastBatch) != 2 {
		t.Fatalf("expected 2 statements, got %d", len(engine.lastBatch))
	}
	if engine.lastBatch[0].Query != "INSERT INTO todos (id) VALUES (?)" {
		t.Errorf("statement text was altered: %q", engine.lastBatch[0].Query)
	}
	if got := engine.lastBatch[0].Args; len(got) != 1 || got[0] != "a" {
		t.Errorf("expected the argument to be bound, got %#v", got)
	}
}

// TestTransactionRefusesReads keeps the invariant that reads come from /query.
// A SELECT inside a batch would have to be returned as rows, and the row cap
// and read-only pool behind /query are not on the other side of it.
func TestTransactionRefusesReads(t *testing.T) {
	engine := &fakeEngine{}
	projectID := uuid.New()

	recorder := runTransaction(t, engine, projectID,
		`{"statements":[{"query":"SELECT id FROM todos"}]}`)

	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", recorder.Code)
	}
	if code := errorCode(t, recorder); code != "not_a_write" {
		t.Errorf("expected not_a_write, got %q", code)
	}
	// Nothing may run when part of the batch is refused.
	if engine.txCalls != 0 {
		t.Errorf("expected the engine to be left alone, got %d calls", engine.txCalls)
	}
}

// TestTransactionRefusesReadsAfterAWrite is the same rule applied to the second
// statement, where a validator that only looked at the first would let a read
// through.
func TestTransactionRefusesReadsAfterAWrite(t *testing.T) {
	engine := &fakeEngine{}
	projectID := uuid.New()

	recorder := runTransaction(t, engine, projectID, `{"statements":[
		{"query":"INSERT INTO todos (id) VALUES (?)","args":["a"]},
		{"query":"SELECT count(*) FROM todos"}
	]}`)

	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", recorder.Code)
	}
	if code := errorCode(t, recorder); code != "not_a_write" {
		t.Errorf("expected not_a_write, got %q", code)
	}
	if engine.txCalls != 0 {
		t.Errorf("expected the engine to be left alone, got %d calls", engine.txCalls)
	}
}

// TestTransactionValidatesEveryStatementBeforeRunning is the reason validation
// happens up front rather than relying on the rollback: the refusal names which
// statement carried it, and the database is never touched.
func TestTransactionValidatesEveryStatementBeforeRunning(t *testing.T) {
	engine := &fakeEngine{}
	projectID := uuid.New()

	recorder := runTransaction(t, engine, projectID, `{"statements":[
		{"query":"INSERT INTO files (name) VALUES (?)","args":["a"]},
		{"query":"ATTACH DATABASE '/etc/passwd' AS leak"}
	]}`)

	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", recorder.Code)
	}
	if code := errorCode(t, recorder); code != "sql_forbidden_keyword" {
		t.Errorf("expected sql_forbidden_keyword, got %q", code)
	}

	var body struct {
		Error struct {
			Detail string `json:"detail"`
		} `json:"error"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode error body: %v", err)
	}
	// The position is what makes a forty-statement migration fixable.
	if !strings.Contains(body.Error.Detail, "statement 2") {
		t.Errorf("expected the detail to name statement 2, got %q", body.Error.Detail)
	}
	if engine.txCalls != 0 {
		t.Errorf("expected nothing to run, got %d calls", engine.txCalls)
	}
}

// TestTransactionRefusesAReadOnlyViolationThroughArgs is the check that a
// multi-statement payload cannot smuggle a second statement past the
// single-statement rule.
func TestTransactionRefusesASecondStatementInOneEntry(t *testing.T) {
	engine := &fakeEngine{}
	projectID := uuid.New()

	recorder := runTransaction(t, engine, projectID,
		`{"statements":[{"query":"DELETE FROM todos; DROP TABLE todos"}]}`)

	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", recorder.Code)
	}
	if code := errorCode(t, recorder); code != "sql_multiple_statements" {
		t.Errorf("expected sql_multiple_statements, got %q", code)
	}
	if engine.txCalls != 0 {
		t.Errorf("expected nothing to run, got %d calls", engine.txCalls)
	}
}

// TestTransactionRefusesAnEmptyBatch: a batch of nothing is a client bug, and
// a 200 would hide it.
func TestTransactionRefusesAnEmptyBatch(t *testing.T) {
	engine := &fakeEngine{}
	projectID := uuid.New()

	for _, body := range []string{`{"statements":[]}`, `{}`} {
		recorder := runTransaction(t, engine, projectID, body)
		if recorder.Code != http.StatusBadRequest {
			t.Fatalf("expected 400 for %s, got %d", body, recorder.Code)
		}
		if code := errorCode(t, recorder); code != "transaction_empty" {
			t.Errorf("expected transaction_empty, got %q", code)
		}
	}
	if engine.txCalls != 0 {
		t.Errorf("expected nothing to run, got %d calls", engine.txCalls)
	}
}

// TestTransactionRefusesTooManyStatements: the cap is what keeps one batch
// from holding the project's write lock indefinitely.
func TestTransactionRefusesTooManyStatements(t *testing.T) {
	engine := &fakeEngine{}
	projectID := uuid.New()

	statement := `{"query":"UPDATE todos SET seen = 1"}`
	body := `{"statements":[` +
		strings.Repeat(statement+",", dbplane.MaxTransactionStatements) + statement + `]}`

	recorder := runTransaction(t, engine, projectID, body)
	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", recorder.Code)
	}
	if code := errorCode(t, recorder); code != "too_many_statements" {
		t.Errorf("expected too_many_statements, got %q", code)
	}
	if engine.txCalls != 0 {
		t.Errorf("expected nothing to run, got %d calls", engine.txCalls)
	}
}

// TestTransactionRejectsUnknownFields keeps the contract /query and /exec
// already have: a typo is an error rather than a field silently ignored.
func TestTransactionRejectsUnknownFields(t *testing.T) {
	engine := &fakeEngine{}
	projectID := uuid.New()

	recorder := runTransaction(t, engine, projectID,
		`{"statements":[{"query":"DELETE FROM todos","args":null}],"rollback":true}`)
	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", recorder.Code)
	}
	if code := errorCode(t, recorder); code != "invalid_json" {
		t.Errorf("expected invalid_json, got %q", code)
	}
}

// TestTransactionMapsAStatementFailure is the error path a caller will hit most:
// one statement breaks a constraint, the whole batch rolls back, and the status
// is the one /exec would have returned for the same statement.
func TestTransactionMapsAStatementFailure(t *testing.T) {
	engine := &fakeEngine{err: dbplane.ErrSizeExceeded}
	projectID := uuid.New()

	recorder := runTransaction(t, engine, projectID,
		`{"statements":[{"query":"INSERT INTO todos (id) VALUES ('a')"}]}`)

	if recorder.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("expected 413, got %d", recorder.Code)
	}
	if code := errorCode(t, recorder); code != "database_too_large" {
		t.Errorf("expected database_too_large, got %q", code)
	}
}

// TestTransactionRequiresAProjectID: the handler is mounted behind
// authorization, but it still checks, the way Query and Exec do.
func TestTransactionRequiresAProjectID(t *testing.T) {
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/p/x/transaction",
		strings.NewReader(`{"statements":[{"query":"DELETE FROM t"}]}`))
	request.Header.Set("Content-Type", "application/json")

	NewDataPlane(&fakeEngine{}, logger.Nop()).Transaction(recorder, request)

	if recorder.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", recorder.Code)
	}
}
