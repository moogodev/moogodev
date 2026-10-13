package mcp

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

// recordedRequest captures what a scripted data plane received.
type recordedRequest struct {
	method string
	path   string
	header http.Header
	body   []byte
}

// scriptedDataPlane stands in for one project's data plane. It answers every
// request with the same fixed response, so a test that cares about the response
// and a test that cares about the request can both use it.
func scriptedDataPlane(t *testing.T, status int, response string) (string, *[]recordedRequest) {
	t.Helper()

	requests := &[]recordedRequest{}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		*requests = append(*requests, recordedRequest{
			method: r.Method,
			path:   r.URL.Path,
			header: r.Header.Clone(),
			body:   body,
		})
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(status)
		_, _ = io.WriteString(w, response)
	}))
	t.Cleanup(server.Close)

	return server.URL + "/p/1234", requests
}

func TestClientQuery(t *testing.T) {
	t.Parallel()

	base, requests := scriptedDataPlane(t, http.StatusOK,
		`{"success":true,"columns":["id"],"rows":[[1]],"row_count":1,"truncated":false,"duration_ms":3}`)
	client := NewClient(base, "moogo_secret", nil)

	result, err := client.Query(context.Background(), "SELECT ? AS id", []any{1})
	if err != nil {
		t.Fatalf("Query() error = %v, want nil", err)
	}
	if len(result.Columns) != 1 || result.Columns[0] != "id" {
		t.Errorf("Columns = %v, want [id]", result.Columns)
	}
	if result.DurationMs != 3 {
		t.Errorf("DurationMs = %d, want 3", result.DurationMs)
	}

	assertRequest(t, requests, http.MethodPost, "/p/1234/query")

	var body struct {
		Query string `json:"query"`
		Args  []any  `json:"args"`
	}
	decodeBody(t, (*requests)[0].body, &body)
	if body.Query != "SELECT ? AS id" {
		t.Errorf("wire query = %q, want %q", body.Query, "SELECT ? AS id")
	}
	if len(body.Args) != 1 {
		t.Errorf("wire args = %v, want one value", body.Args)
	}
}

func TestClientExec(t *testing.T) {
	t.Parallel()

	base, requests := scriptedDataPlane(t, http.StatusOK,
		`{"success":true,"rows_affected":1,"size_bytes":4096,"last_insert_rowid":7,"duration_ms":2}`)
	client := NewClient(base, "moogo_secret", nil)

	result, err := client.Exec(context.Background(), "INSERT INTO todos (title) VALUES (?)", []any{"buy milk"})
	if err != nil {
		t.Fatalf("Exec() error = %v, want nil", err)
	}
	if result.LastInsertRowID != 7 {
		t.Errorf("LastInsertRowID = %d, want 7", result.LastInsertRowID)
	}
	if result.SizeBytes != 4096 {
		t.Errorf("SizeBytes = %d, want 4096", result.SizeBytes)
	}

	assertRequest(t, requests, http.MethodPost, "/p/1234/exec")
}

func TestClientTransactionRenamesQueryField(t *testing.T) {
	t.Parallel()

	base, requests := scriptedDataPlane(t, http.StatusOK,
		`{"success":true,"statements":[{"rows_affected":1}],"rows_affected":1,"size_bytes":4096,"duration_ms":4}`)
	client := NewClient(base, "moogo_secret", nil)

	_, err := client.Transaction(context.Background(), []Statement{
		{SQL: "INSERT INTO a VALUES (?)", Args: []any{1}},
		{SQL: "UPDATE b SET n = 1"},
	})
	if err != nil {
		t.Fatalf("Transaction() error = %v, want nil", err)
	}

	assertRequest(t, requests, http.MethodPost, "/p/1234/transaction")

	// The tool calls the field "sql"; the data plane calls it "query". The
	// client is the place that bridges the two, so the wire must say "query".
	var body struct {
		Statements []struct {
			Query string `json:"query"`
			Args  []any  `json:"args"`
		} `json:"statements"`
	}
	decodeBody(t, (*requests)[0].body, &body)
	if len(body.Statements) != 2 {
		t.Fatalf("wire statements = %d, want 2", len(body.Statements))
	}
	if body.Statements[0].Query != "INSERT INTO a VALUES (?)" {
		t.Errorf("wire statements[0].query = %q, want the INSERT", body.Statements[0].Query)
	}
	if body.Statements[1].Query != "UPDATE b SET n = 1" {
		t.Errorf("wire statements[1].query = %q, want the UPDATE", body.Statements[1].Query)
	}
}

func TestClientErrorEnvelope(t *testing.T) {
	t.Parallel()

	base, _ := scriptedDataPlane(t, http.StatusForbidden,
		`{"error":{"code":"not_a_read","message":"only reads are accepted","detail":"the statement is a write"}}`)
	client := NewClient(base, "moogo_secret", nil)

	_, err := client.Query(context.Background(), "INSERT INTO todos DEFAULT VALUES", nil)
	if err == nil {
		t.Fatal("Query() error = nil, want the data-plane error")
	}

	var apiError *APIError
	if !errors.As(err, &apiError) {
		t.Fatalf("error = %v (%T), want *APIError", err, err)
	}
	if apiError.Status != http.StatusForbidden {
		t.Errorf("Status = %d, want %d", apiError.Status, http.StatusForbidden)
	}
	if apiError.Code != "not_a_read" {
		t.Errorf("Code = %q, want not_a_read", apiError.Code)
	}
	if !strings.Contains(err.Error(), "not_a_read") {
		t.Errorf("Error() = %q, want the code included", err)
	}
	if strings.Contains(err.Error(), "moogo_secret") {
		t.Errorf("error = %q, must never contain the secret key", err)
	}
}

func TestClientNonEnvelopeError(t *testing.T) {
	t.Parallel()

	// A proxy answering for the data plane is the realistic case: the status is
	// real but the body is not the documented envelope.
	base, _ := scriptedDataPlane(t, http.StatusBadGateway, "<html>bad gateway</html>")
	client := NewClient(base, "moogo_secret", nil)

	_, err := client.Query(context.Background(), "SELECT 1", nil)
	if err == nil {
		t.Fatal("Query() error = nil, want an error")
	}

	var apiError *APIError
	if !errors.As(err, &apiError) {
		t.Fatalf("error = %v (%T), want *APIError even for a non-envelope body", err, err)
	}
	if apiError.Status != http.StatusBadGateway {
		t.Errorf("Status = %d, want %d", apiError.Status, http.StatusBadGateway)
	}
	if apiError.Code != "http_error" {
		t.Errorf("Code = %q, want %q", apiError.Code, "http_error")
	}
}

func TestClientTransportError(t *testing.T) {
	t.Parallel()

	// A server that is closed before the call is the simplest transport
	// failure, and unlike a made-up port it fails immediately.
	server := httptest.NewServer(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {}))
	address := server.URL
	server.Close()

	client := NewClient(address, "moogo_secret", &http.Client{Timeout: time.Second})
	_, err := client.Query(context.Background(), "SELECT 1", nil)
	if err == nil {
		t.Fatal("Query() error = nil, want a transport error")
	}

	var apiError *APIError
	if errors.As(err, &apiError) {
		t.Fatalf("Query() error = %v, want a transport error rather than *APIError", err)
	}
}

// assertRequest checks the parts every call must get right.
func assertRequest(t *testing.T, requests *[]recordedRequest, method, path string) {
	t.Helper()

	if len(*requests) != 1 {
		t.Fatalf("data plane received %d request(s), want 1", len(*requests))
	}
	request := (*requests)[0]
	if request.method != method {
		t.Errorf("method = %q, want %q", request.method, method)
	}
	if request.path != path {
		t.Errorf("path = %q, want %q", request.path, path)
	}
	if got := request.header.Get("Content-Type"); got != "application/json" {
		t.Errorf("Content-Type = %q, want application/json", got)
	}
	if got := request.header.Get("Authorization"); got != "Bearer moogo_secret" {
		t.Errorf("Authorization = %q, want a bearer token", got)
	}
}

// decodeBody unmarshals a recorded request body.
func decodeBody(t *testing.T, body []byte, target any) {
	t.Helper()

	if err := json.Unmarshal(body, target); err != nil {
		t.Fatalf("unmarshal request body %s: %v", body, err)
	}
}
