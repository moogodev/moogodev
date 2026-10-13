package mcp

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"testing"

	mcplib "github.com/mark3labs/mcp-go/mcp"
)

// toolRequest builds the CallToolRequest an MCP client would send.
func toolRequest(t *testing.T, name string, args map[string]any) mcplib.CallToolRequest {
	t.Helper()

	raw, err := json.Marshal(args)
	if err != nil {
		t.Fatalf("marshal arguments: %v", err)
	}
	return mcplib.CallToolRequest{
		Params: mcplib.CallToolParams{
			Name:         name,
			Arguments:    args,
			RawArguments: raw,
		},
	}
}

// testHandlers wires the tool handlers to a scripted data plane.
func testHandlers(t *testing.T, status int, response string) (*Server, *[]recordedRequest) {
	t.Helper()

	base, requests := scriptedDataPlane(t, status, response)
	return &Server{client: NewClient(base, "moogo_secret", nil)}, requests
}

// structuredBody returns the structured content of a successful result.
func structuredBody(t *testing.T, result *mcplib.CallToolResult) map[string]any {
	t.Helper()

	if result.IsError {
		t.Fatalf("IsError = true, want a successful result; text = %s", resultText(t, result))
	}
	body, ok := result.StructuredContent.(map[string]any)
	if !ok {
		t.Fatalf("StructuredContent = %T, want map[string]any", result.StructuredContent)
	}
	return body
}

// resultText returns the first text block of a result.
func resultText(t *testing.T, result *mcplib.CallToolResult) string {
	t.Helper()

	if len(result.Content) == 0 {
		t.Fatal("result has no content")
	}
	text, ok := result.Content[0].(mcplib.TextContent)
	if !ok {
		t.Fatalf("content type = %T, want mcplib.TextContent", result.Content[0])
	}
	return text.Text
}

func TestNewServerRegistersEveryTool(t *testing.T) {
	t.Parallel()

	instance := NewServer(&Client{})
	tools := instance.ListTools()

	for _, name := range []string{"query", "exec", "transaction", "list_schema"} {
		if _, ok := tools[name]; !ok {
			t.Errorf("tool %q is not registered", name)
		}
	}
	if len(tools) != 4 {
		t.Errorf("registered %d tool(s), want 4", len(tools))
	}

	// A missing description is the mistake an agent pays for, so assert the
	// tools carry one.
	for name, tool := range tools {
		if strings.TrimSpace(tool.Tool.Description) == "" {
			t.Errorf("tool %q has no description", name)
		}
	}
}

func TestQueryReturnsRows(t *testing.T) {
	t.Parallel()

	handlers, requests := testHandlers(t, http.StatusOK,
		`{"success":true,"columns":["id","title"],"rows":[[1,"a"],[2,"b"]],"row_count":2,"truncated":false,"duration_ms":5}`)

	result, err := handlers.query(context.Background(),
		toolRequest(t, "query", map[string]any{"sql": "SELECT id, title FROM todos"}))
	if err != nil {
		t.Fatalf("query handler error = %v, want nil", err)
	}

	body := structuredBody(t, result)
	if got := body["row_count"]; got != 2 {
		t.Errorf("row_count = %v, want 2", got)
	}
	if truncated, _ := body["truncated"].(bool); truncated {
		t.Error("truncated = true, want false")
	}
	columns, ok := body["columns"].([]string)
	if !ok || len(columns) != 2 {
		t.Fatalf("columns = %#v, want two names", body["columns"])
	}
	rows, ok := body["rows"].([][]any)
	if !ok || len(rows) != 2 {
		t.Fatalf("rows = %v, want 2", body["rows"])
	}

	assertRequest(t, requests, http.MethodPost, "/p/1234/query")
}

func TestQueryAppliesLimitAndMarksTruncated(t *testing.T) {
	t.Parallel()

	handlers, _ := testHandlers(t, http.StatusOK,
		`{"success":true,"columns":["id"],"rows":[[1],[2],[3],[4],[5]],"row_count":5,"truncated":false,"duration_ms":1}`)

	result, err := handlers.query(context.Background(),
		toolRequest(t, "query", map[string]any{"sql": "SELECT id FROM t", "limit": 2}))
	if err != nil {
		t.Fatalf("query handler = %v, want nil", err)
	}

	body := structuredBody(t, result)
	rows, ok := body["rows"].([][]any)
	if !ok || len(rows) != 2 {
		t.Fatalf("rows = %v, want them trimmed to 2", body["rows"])
	}
	if truncated, _ := body["truncated"].(bool); !truncated {
		t.Error("truncated = false, want true when the limit trims rows")
	}
}

func TestQueryKeepsServerTruncatedFlag(t *testing.T) {
	t.Parallel()

	// The server cap is separate from the tool limit: with no limit asked for,
	// the tool must still pass the server's truncated flag through.
	handlers, _ := testHandlers(t, http.StatusOK,
		`{"success":true,"columns":["id"],"rows":[[1]],"row_count":1,"truncated":true,"duration_ms":1}`)

	result, err := handlers.query(context.Background(),
		toolRequest(t, "query", map[string]any{"sql": "SELECT id FROM t"}))
	if err != nil {
		t.Fatalf("query handler = %v, want nil", err)
	}

	body := structuredBody(t, result)
	if truncated, _ := body["truncated"].(bool); !truncated {
		t.Error("truncated = false, want the server's true passed through")
	}
}

func TestQueryRequiresSQL(t *testing.T) {
	t.Parallel()

	handlers, requests := testHandlers(t, http.StatusOK, `{}`)

	result, err := handlers.query(context.Background(), toolRequest(t, "query", map[string]any{}))
	if err != nil {
		t.Fatalf("query handler = %v, want nil", err)
	}
	if !result.IsError {
		t.Fatal("IsError = false, want a tool error for a missing sql")
	}
	if len(*requests) != 0 {
		t.Error("the data plane was called despite the missing sql")
	}
}

func TestQueryReportsDataPlaneError(t *testing.T) {
	t.Parallel()

	handlers, _ := testHandlers(t, http.StatusForbidden,
		`{"error":{"code":"not_a_read","message":"only reads are accepted"}}`)

	result, err := handlers.query(context.Background(),
		toolRequest(t, "query", map[string]any{"sql": "DELETE FROM t"}))
	if err != nil {
		t.Fatalf("query handler = %v, want the error reported in the result", err)
	}
	if !result.IsError {
		t.Fatal("IsError = false, want a tool error")
	}
	if text := resultText(t, result); !strings.Contains(text, "not_a_read") {
		t.Errorf("text = %q, want the stable code included", text)
	}
}

func TestExecReportsInsertedRow(t *testing.T) {
	t.Parallel()

	handlers, requests := testHandlers(t, http.StatusOK,
		`{"success":true,"rows_affected":1,"size_bytes":8192,"last_insert_rowid":42,"duration_ms":2}`)

	result, err := handlers.exec(context.Background(),
		toolRequest(t, "exec", map[string]any{"sql": "INSERT INTO t (a) VALUES (?)", "args": []any{"x"}}))
	if err != nil {
		t.Fatalf("exec handler = %v, want nil", err)
	}

	body := structuredBody(t, result)
	if body["last_insert_rowid"] != int64(42) {
		t.Errorf("last_insert_rowid = %v, want 42", body["last_insert_rowid"])
	}
	assertRequest(t, requests, http.MethodPost, "/p/1234/exec")
}

func TestExecRequiresSQL(t *testing.T) {
	t.Parallel()

	handlers, requests := testHandlers(t, http.StatusOK, `{}`)

	result, err := handlers.exec(context.Background(), toolRequest(t, "exec", map[string]any{}))
	if err != nil {
		t.Fatalf("exec handler = %v, want nil", err)
	}
	if !result.IsError {
		t.Fatal("IsError = false, want a tool error for a missing sql")
	}
	if len(*requests) != 0 {
		t.Error("the data plane was called despite the missing sql")
	}
}

func TestTransactionRejectsTooManyStatements(t *testing.T) {
	t.Parallel()

	handlers, requests := testHandlers(t, http.StatusOK, `{}`)

	statements := make([]any, 0, 101)
	for index := 0; index <= 100; index++ {
		statements = append(statements, map[string]any{"sql": "INSERT INTO t DEFAULT VALUES"})
	}

	result, err := handlers.transaction(context.Background(),
		toolRequest(t, "transaction", map[string]any{"statements": statements}))
	if err != nil {
		t.Fatalf("transaction handler = %v, want nil", err)
	}
	if !result.IsError {
		t.Fatal("IsError = false, want a tool error for an oversized batch")
	}
	if len(*requests) != 0 {
		t.Error("the data plane was called despite the oversized batch")
	}
}

func TestTransactionRejectsEmptyBatch(t *testing.T) {
	t.Parallel()

	handlers, requests := testHandlers(t, http.StatusOK, `{}`)

	result, err := handlers.transaction(context.Background(),
		toolRequest(t, "transaction", map[string]any{"statements": []any{}}))
	if err != nil {
		t.Fatalf("transaction handler = %v, want nil", err)
	}
	if !result.IsError {
		t.Fatal("IsError = false, want a tool error for an empty batch")
	}
	if len(*requests) != 0 {
		t.Error("the data plane was called despite the empty batch")
	}
}

func TestTransactionCommitsBatch(t *testing.T) {
	t.Parallel()

	handlers, requests := testHandlers(t, http.StatusOK,
		`{"success":true,"statements":[{"rows_affected":1},{"rows_affected":0}],"rows_affected":1,"size_bytes":8192,"duration_ms":5}`)

	result, err := handlers.transaction(context.Background(), toolRequest(t, "transaction", map[string]any{
		"statements": []any{
			map[string]any{"sql": "INSERT INTO a (n) VALUES (?)", "args": []any{1}},
			map[string]any{"sql": "UPDATE b SET n = 1"},
		},
	}))
	if err != nil {
		t.Fatalf("transaction handler = %v, want nil", err)
	}

	body := structuredBody(t, result)
	if body["rows_affected"] != int64(1) {
		t.Errorf("rows_affected = %v, want 1", body["rows_affected"])
	}
	assertRequest(t, requests, http.MethodPost, "/p/1234/transaction")
}

func TestListSchemaUsesCatalog(t *testing.T) {
	t.Parallel()

	handlers, requests := testHandlers(t, http.StatusOK,
		`{"success":true,"columns":["name","type","sql"],"rows":[["todos","table","CREATE TABLE todos (...)"]],"row_count":1,"truncated":false,"duration_ms":0}`)

	result, err := handlers.listSchema(context.Background(), toolRequest(t, "list_schema", map[string]any{}))
	if err != nil {
		t.Fatalf("listSchema handler = %v, want nil", err)
	}
	if result.IsError {
		t.Fatal("IsError = true, want a successful result")
	}

	if len(*requests) != 1 {
		t.Fatalf("data plane received %d request(s), want 1", len(*requests))
	}
	var body struct {
		Query string `json:"query"`
	}
	decodeBody(t, (*requests)[0].body, &body)
	if body.Query != listSchemaStatement {
		t.Errorf("wire query = %q, want %q", body.Query, listSchemaStatement)
	}
}
