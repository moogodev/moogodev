package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/google/uuid"

	"github.com/moogo/moogo/internal/auth"
	"github.com/moogo/moogo/internal/dbplane"
	"github.com/moogo/moogo/pkg/logger"
)

// testDataPlane builds a DataPlane handler over a scripted engine.
func testDataPlane(t *testing.T) (*DataPlane, *fakeEngine) {
	t.Helper()
	engine := &fakeEngine{}
	return NewDataPlane(engine, logger.Nop()), engine
}

// fakeEngine stands in for the SQLite engine so the handler can be tested
// without touching disk.
type fakeEngine struct {
	queryResult dbplane.QueryResult
	execResult  dbplane.ExecResult
	err         error

	queryCalls  int
	execCalls   int
	lastQuery   string
	lastArgs    []any
	lastProject uuid.UUID
}

func (engine *fakeEngine) Query(
	_ context.Context, projectID uuid.UUID, statement string, args []any, limit int,
) (*dbplane.QueryResult, error) {
	engine.queryCalls++
	engine.lastQuery = statement
	engine.lastArgs = args
	engine.lastProject = projectID
	if engine.err != nil {
		return nil, engine.err
	}
	result := engine.queryResult
	return &result, nil
}

func (engine *fakeEngine) Exec(
	_ context.Context, projectID uuid.UUID, statement string, args []any,
) (*dbplane.ExecResult, error) {
	engine.execCalls++
	engine.lastQuery = statement
	engine.lastArgs = args
	engine.lastProject = projectID
	if engine.err != nil {
		return nil, engine.err
	}
	result := engine.execResult
	return &result, nil
}

// dataPlaneRequest builds an authenticated SQL request.
func dataPlaneRequest(t *testing.T, projectID uuid.UUID, path string, body string) *http.Request {
	t.Helper()

	request := httptest.NewRequest(http.MethodPost, path, strings.NewReader(body))
	request = request.WithContext(context.WithValue(
		request.Context(), auth.ContextKeyProjectID, projectID.String()))
	return request
}

func TestQueryRejectsFileAccess(t *testing.T) {
	handler, engine := testDataPlane(t)
	projectID := uuid.New()

	testCases := []struct {
		name  string
		query string
	}{
		{"readfile", "SELECT readfile('/etc/passwd')"},
		{"writefile", "SELECT writefile('/tmp/x', 'y')"},
		{"attach", "ATTACH DATABASE '/etc/passwd' AS stolen"},
		{"load extension", "SELECT load_extension('evil')"},
		{"multi statement", "SELECT 1; DROP TABLE users"},
		{"pragma write", "PRAGMA journal_mode = WAL"},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			body := `{"query":` + jsonString(testCase.query) + `}`

			recorder := httptest.NewRecorder()
			handler.Query(recorder, dataPlaneRequest(t, projectID, "/db/x/query", body))

			if recorder.Code != http.StatusBadRequest {
				t.Fatalf("expected 400 for %q, got %d", testCase.query, recorder.Code)
			}
			// The engine must not have been reached at all: rejection happens in
			// the handler, before any connection is opened.
			if engine.queryCalls != 0 {
				t.Errorf("the engine ran for a rejected statement (%d calls)", engine.queryCalls)
			}
		})
	}
}

func TestQueryRejectsWrites(t *testing.T) {
	handler, engine := testDataPlane(t)
	projectID := uuid.New()

	body := `{"query":"DELETE FROM users"}`

	recorder := httptest.NewRecorder()
	handler.Query(recorder, dataPlaneRequest(t, projectID, "/db/x/query", body))

	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", recorder.Code)
	}
	if code := errorCode(t, recorder); code != "not_a_read" {
		t.Errorf("expected not_a_read, got %q", code)
	}
	if engine.queryCalls != 0 {
		t.Error("a write sent to /query must not reach the engine")
	}
}

func TestExecRejectsReads(t *testing.T) {
	handler, engine := testDataPlane(t)
	projectID := uuid.New()

	body := `{"query":"SELECT * FROM users"}`

	recorder := httptest.NewRecorder()
	handler.Exec(recorder, dataPlaneRequest(t, projectID, "/db/x/exec", body))

	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", recorder.Code)
	}
	if code := errorCode(t, recorder); code != "not_a_write" {
		t.Errorf("expected not_a_write, got %q", code)
	}
	if engine.execCalls != 0 {
		t.Error("a read sent to /exec must not reach the engine")
	}
}

func TestQueryReturnsRows(t *testing.T) {
	handler, engine := testDataPlane(t)
	projectID := uuid.New()

	engine.queryResult = dbplane.QueryResult{
		Columns: []string{"id", "name"},
		Rows:    [][]any{{"1", "ketut"}},
	}

	body := `{"query":"SELECT id, name FROM users WHERE id = ?","args":["1"]}`

	recorder := httptest.NewRecorder()
	handler.Query(recorder, dataPlaneRequest(t, projectID, "/db/x/query", body))

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", recorder.Code, recorder.Body.String())
	}

	var response QueryResponse
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if !response.Success {
		t.Error("expected success true")
	}
	if response.RowCount != 1 || len(response.Rows) != 1 {
		t.Errorf("expected one row, got %d", response.RowCount)
	}

	// Arguments must be forwarded untouched, which is what keeps values out of
	// the SQL text.
	if len(engine.lastArgs) != 1 || engine.lastArgs[0] != "1" {
		t.Errorf("expected the argument to be forwarded, got %v", engine.lastArgs)
	}
	if engine.lastProject != projectID {
		t.Errorf("expected the project from the context, got %s", engine.lastProject)
	}
}

func TestQueryReportsTruncation(t *testing.T) {
	handler, engine := testDataPlane(t)
	engine.queryResult = dbplane.QueryResult{
		Columns:   []string{"id"},
		Rows:      [][]any{{"1"}},
		Truncated: true,
	}

	body := `{"query":"SELECT id FROM users"}`

	recorder := httptest.NewRecorder()
	handler.Query(recorder, dataPlaneRequest(t, uuid.New(), "/db/x/query", body))

	var response QueryResponse
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatalf("decode: %v", err)
	}
	// Without this flag a client would treat a capped page as the whole table.
	if !response.Truncated {
		t.Error("expected truncated to be reported")
	}
}

func TestExecReportsRowsAffected(t *testing.T) {
	handler, engine := testDataPlane(t)
	engine.execResult = dbplane.ExecResult{RowsAffected: 3, SizeBytes: 4096}

	body := `{"query":"UPDATE users SET active = 1"}`

	recorder := httptest.NewRecorder()
	handler.Exec(recorder, dataPlaneRequest(t, uuid.New(), "/db/x/exec", body))

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", recorder.Code, recorder.Body.String())
	}

	var response ExecResponse
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if response.RowsAffected != 3 {
		t.Errorf("expected 3 rows affected, got %d", response.RowsAffected)
	}
	if response.SizeBytes != 4096 {
		t.Errorf("expected the size to be reported, got %d", response.SizeBytes)
	}
}

func TestQueryRequiresProjectContext(t *testing.T) {
	handler, _ := testDataPlane(t)

	// No project in the context: the router normally guarantees one, and a
	// missing one means the middleware was skipped.
	recorder := httptest.NewRecorder()
	handler.Query(recorder, httptest.NewRequest(http.MethodPost, "/db/x/query", strings.NewReader(`{"query":"SELECT 1"}`)))

	if recorder.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", recorder.Code)
	}
}

func TestSizeLimitIsAClientError(t *testing.T) {
	handler, engine := testDataPlane(t)
	engine.err = dbplane.ErrSizeExceeded

	body := `{"query":"INSERT INTO blobs VALUES (randomblob(900000000))"}`

	recorder := httptest.NewRecorder()
	handler.Exec(recorder, dataPlaneRequest(t, uuid.New(), "/db/x/exec", body))

	// 413, so a client can tell "your statement is too big" apart from "your
	// statement is wrong".
	if recorder.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("expected 413, got %d", recorder.Code)
	}
	if code := errorCode(t, recorder); code != "database_too_large" {
		t.Errorf("expected database_too_large, got %q", code)
	}
}

func TestTimeoutIsReportedAsGatewayTimeout(t *testing.T) {
	handler, engine := testDataPlane(t)
	engine.err = dbplane.ErrTimeout

	body := `{"query":"WITH RECURSIVE c(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM c) SELECT count(*) FROM c"}`

	recorder := httptest.NewRecorder()
	handler.Query(recorder, dataPlaneRequest(t, uuid.New(), "/db/x/query", body))

	if recorder.Code != http.StatusGatewayTimeout {
		t.Fatalf("expected 504, got %d", recorder.Code)
	}
	if code := errorCode(t, recorder); code != "statement_timeout" {
		t.Errorf("expected statement_timeout, got %q", code)
	}
}

func TestInvalidJSONIsRejected(t *testing.T) {
	handler, engine := testDataPlane(t)

	recorder := httptest.NewRecorder()
	handler.Query(recorder, dataPlaneRequest(t, uuid.New(), "/db/x/query", `{"query":`))

	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", recorder.Code)
	}
	if engine.queryCalls != 0 {
		t.Error("a malformed body must not reach the engine")
	}
}

func TestUnknownFieldIsRejected(t *testing.T) {
	handler, engine := testDataPlane(t)

	// A typo in a field name is silently ignored by encoding/json unless
	// unknown fields are refused, and a caller would then get an empty query.
	body := `{"query":"SELECT 1","limit":10}`

	recorder := httptest.NewRecorder()
	handler.Query(recorder, dataPlaneRequest(t, uuid.New(), "/db/x/query", body))

	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for an unknown field, got %d", recorder.Code)
	}
	if engine.queryCalls != 0 {
		t.Error("an unknown field must not reach the engine")
	}
}

func TestIsReadStatement(t *testing.T) {
	testCases := []struct {
		statement string
		want      bool
	}{
		{"SELECT 1", true},
		{"  select * from t", true},
		{"-- a comment\nSELECT 1", true},
		{"/* comment */ SELECT 1", true},
		{"EXPLAIN SELECT 1", true},
		{"PRAGMA table_info(users)", true},
		{"WITH c AS (SELECT 1) SELECT * FROM c", true},
		{"INSERT INTO t VALUES (1)", false},
		{"UPDATE t SET a = 1", false},
		{"DELETE FROM t", false},
		{"DROP TABLE t", false},
		{"CREATE TABLE t (a INT)", false},
		{"-- a comment\nINSERT INTO t VALUES (1)", false},
		{"", false},
	}

	for _, testCase := range testCases {
		t.Run(testCase.statement, func(t *testing.T) {
			if got := isReadStatement(testCase.statement); got != testCase.want {
				t.Errorf("isReadStatement(%q) = %v, want %v", testCase.statement, got, testCase.want)
			}
		})
	}
}

// jsonString encodes a string as a JSON literal.
func jsonString(value string) string {
	encoded, err := json.Marshal(value)
	if err != nil {
		panic(err)
	}
	return string(encoded)
}
