package cli

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// testProjectID is the project the fake API is mounted for.
const testProjectID = "11111111-2222-3333-4444-555555555555"

// apiCall is one request the CLI made, as the test saw it.
type apiCall struct {
	Method  string
	Path    string
	Query   url.Values
	Header  http.Header
	RawBody string

	// Body is the request decoded, which is what almost every assertion wants.
	Body struct {
		Statements []statement `json:"statements"`
		Query      string      `json:"query"`
		Args       []any       `json:"args"`
	}
}

// fakeAPI stands in for the data plane.
//
// It records every request and answers with whatever the test's handler says,
// which is enough to pin the parts a client can get wrong: the route it chose,
// the credential it sent, the shape of the body, and the order of a batch.
type fakeAPI struct {
	t      *testing.T
	server *httptest.Server
	handle func(call apiCall) (int, string)

	// stdin is what a command reading "-" finds on standard input.
	stdin string

	calls []apiCall
}

func newFakeAPI(t *testing.T, handle func(call apiCall) (int, string)) *fakeAPI {
	t.Helper()

	api := &fakeAPI{t: t, handle: handle}
	api.server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		raw, err := io.ReadAll(r.Body)
		if err != nil {
			t.Errorf("read request body: %v", err)
		}

		call := apiCall{
			Method: r.Method,
			// Escaped, because what the client had to spell out is the point
			// of several assertions: a key with a space in it must travel as
			// %20 and not as a raw one.
			Path:    r.URL.EscapedPath(),
			Query:   r.URL.Query(),
			Header:  r.Header.Clone(),
			RawBody: string(raw),
		}
		if len(raw) > 0 {
			if err := json.Unmarshal(raw, &call.Body); err != nil {
				t.Errorf("request body is not the JSON shape the API documents: %s", raw)
			}
		}
		api.calls = append(api.calls, call)

		status, body := api.handle(call)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(status)
		fmt.Fprint(w, body)
	}))
	t.Cleanup(api.server.Close)

	return api
}

// run executes the CLI against this fake with a complete environment, and
// returns what the process would have exited with and printed.
func (api *fakeAPI) run(args ...string) (code int, out, errOut string) {
	return api.runEnv(nil, args...)
}

// runEnv is run with parts of the environment replaced, so a test can take a
// variable away and watch the command refuse to start without it.
func (api *fakeAPI) runEnv(overrides map[string]string, args ...string) (code int, out, errOut string) {
	api.t.Helper()

	environment := map[string]string{
		EnvBaseURL:           api.server.URL,
		EnvProjectID:         testProjectID,
		EnvSQLKey:            "moogo_key_test",
		EnvBucketAccessKeyID: "moogo_access_test",
		EnvBucketSecretKey:   "moogo_bucket_secret_test",
	}
	for key, value := range overrides {
		environment[key] = value
	}
	for key, value := range environment {
		api.t.Setenv(key, value)
	}

	var stdout, stderr bytes.Buffer
	code = Run(context.Background(), args, Streams{
		In:  strings.NewReader(api.stdin),
		Out: &stdout,
		Err: &stderr,
	})
	return code, stdout.String(), stderr.String()
}

// paths is every route the CLI asked for, in order.
func (api *fakeAPI) paths() []string {
	asked := make([]string, len(api.calls))
	for index, call := range api.calls {
		asked[index] = call.Path
	}
	return asked
}

// errorBody is the API's documented error envelope.
func errorBody(status int, code, message string) string {
	return fmt.Sprintf(`{"error": {"code": %q, "message": %q, "request_id": "req_test"}}`, code, message)
}

// writeSQL puts a file where the test can point a command at it.
func writeSQL(t *testing.T, name, content string) string {
	t.Helper()

	path := filepath.Join(t.TempDir(), name)
	if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
		t.Fatalf("write %s: %v", name, err)
	}
	return path
}

// okTransaction is the answer to a successful transaction.
const okTransaction = `{"success": true, "rows_affected": 0, "size_bytes": 4096, "duration_ms": 2}`
