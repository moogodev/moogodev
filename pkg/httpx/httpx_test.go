package httpx

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/moogodev/moogodev/pkg/logger"
)

func TestWriteJSONEncodesPayload(t *testing.T) {
	recorder := httptest.NewRecorder()
	WriteJSON(recorder, http.StatusCreated, map[string]int{"count": 2})

	if recorder.Code != http.StatusCreated {
		t.Errorf("expected 201, got %d", recorder.Code)
	}
	if contentType := recorder.Header().Get("Content-Type"); !strings.HasPrefix(contentType, "application/json") {
		t.Errorf("expected a JSON content type, got %q", contentType)
	}
	if strings.TrimSpace(recorder.Body.String()) != `{"count":2}` {
		t.Errorf("unexpected body %q", recorder.Body.String())
	}
}

func TestWriteJSONFallsBackWhenEncodingFails(t *testing.T) {
	// A channel cannot be encoded as JSON. The status must still come out as a
	// 500 rather than a truncated 200.
	recorder := httptest.NewRecorder()
	WriteJSON(recorder, http.StatusOK, make(chan int))

	if recorder.Code != http.StatusInternalServerError {
		t.Errorf("expected 500, got %d", recorder.Code)
	}
	if !strings.Contains(recorder.Body.String(), "encoding_failed") {
		t.Errorf("expected an encoding error, got %q", recorder.Body.String())
	}
}

func TestWriteErrorShapeIsStable(t *testing.T) {
	recorder := httptest.NewRecorder()
	WriteError(recorder, http.StatusTooManyRequests, "quota_exceeded", "a quota has been reached")

	var body ErrorBody
	if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if body.Error.Code != "quota_exceeded" {
		t.Errorf("expected the code to survive the round trip, got %q", body.Error.Code)
	}
	// Detail is omitted when empty, so a client cannot tell the difference
	// between "no detail" and "empty detail".
	if body.Error.Detail != "" {
		t.Errorf("expected no detail, got %q", body.Error.Detail)
	}
}

func TestWriteErrorWithDetail(t *testing.T) {
	recorder := httptest.NewRecorder()
	WriteErrorWithDetail(recorder, http.StatusBadRequest, "sql_error", "could not run", "no such table: users")

	var body ErrorBody
	if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if body.Error.Detail != "no such table: users" {
		t.Errorf("expected the detail to be included, got %q", body.Error.Detail)
	}
}

func TestRecovererTurnsPanicInto500(t *testing.T) {
	handler := Recoverer(logger.Nop())(http.HandlerFunc(
		func(w http.ResponseWriter, r *http.Request) {
			panic("boom")
		}))

	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/", nil))

	if recorder.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500, got %d", recorder.Code)
	}

	var body ErrorBody
	if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if body.Error.Code != "internal_error" {
		t.Errorf("expected internal_error, got %q", body.Error.Code)
	}
}

func TestRecovererHidesPanicValueFromClient(t *testing.T) {
	handler := Recoverer(logger.Nop())(http.HandlerFunc(
		func(w http.ResponseWriter, r *http.Request) {
			panic("postgres://user:hunter2@db.internal")
		}))

	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/", nil))

	// A connection string in a response body is how credentials leak.
	if strings.Contains(recorder.Body.String(), "hunter2") {
		t.Error("the panic value must not reach the client")
	}
}

func TestRecovererRethrowsAbortHandler(t *testing.T) {
	handler := Recoverer(logger.Nop())(http.HandlerFunc(
		func(w http.ResponseWriter, r *http.Request) {
			panic(http.ErrAbortHandler)
		}))

	defer func() {
		recovered := recover()
		if recovered == nil {
			t.Fatal("expected ErrAbortHandler to be re-panicked")
		}
		if recovered != http.ErrAbortHandler {
			t.Errorf("expected ErrAbortHandler, got %v", recovered)
		}
	}()

	handler.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "/", nil))
}

func TestMaxBodyBytesStopsLargeBody(t *testing.T) {
	large := strings.Repeat("x", 4096)

	handler := MaxBodyBytes(64)(http.HandlerFunc(
		func(w http.ResponseWriter, r *http.Request) {
			buffer := make([]byte, 4096)
			read, err := r.Body.Read(buffer)
			if err == nil && read == len(buffer) {
				w.WriteHeader(http.StatusOK)
				return
			}
			w.WriteHeader(http.StatusRequestEntityTooLarge)
		}))

	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, httptest.NewRequest(http.MethodPost, "/", strings.NewReader(large)))

	if recorder.Code != http.StatusRequestEntityTooLarge {
		t.Errorf("expected the read to stop at the limit, got %d", recorder.Code)
	}
}

func TestTimeoutCutsOffHungHandler(t *testing.T) {
	handler := Timeout(10 * time.Millisecond)(http.HandlerFunc(
		func(w http.ResponseWriter, r *http.Request) {
			// Never return on its own; the timeout must.
			<-make(chan struct{})
		}))

	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/", nil))

	// The standard library fixes this at 503; only the body is customizable.
	if recorder.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503, got %d", recorder.Code)
	}
	// The body must still be parseable by the same client code that reads every
	// other error.
	var body ErrorBody
	if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode timeout body %q: %v", recorder.Body.String(), err)
	}
	if body.Error.Code != "timeout" {
		t.Errorf("expected the timeout code, got %q", body.Error.Code)
	}
}

func TestTimeoutPassesFastHandlerThrough(t *testing.T) {
	handler := Timeout(5 * time.Second)(http.HandlerFunc(
		func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusAccepted)
		}))

	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/", nil))

	if recorder.Code != http.StatusAccepted {
		t.Errorf("expected 202, got %d", recorder.Code)
	}
}

func TestRequestIDKeepsInboundValue(t *testing.T) {
	handler := RequestID(logger.Nop())(http.HandlerFunc(
		func(w http.ResponseWriter, r *http.Request) {
			if got := RequestIDFromContext(r.Context()); got != "trace-9" {
				t.Errorf("expected the id in the context, got %q", got)
			}
			w.WriteHeader(http.StatusOK)
		}))

	request := httptest.NewRequest(http.MethodGet, "/", nil)
	request.Header.Set(RequestIDHeader, "trace-9")

	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, request)

	if got := recorder.Header().Get(RequestIDHeader); got != "trace-9" {
		t.Errorf("expected the id to be echoed, got %q", got)
	}
}

func TestRequestIDReplacesOversizedValue(t *testing.T) {
	handler := RequestID(logger.Nop())(http.HandlerFunc(
		func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
		}))

	request := httptest.NewRequest(http.MethodGet, "/", nil)
	request.Header.Set(RequestIDHeader, strings.Repeat("x", 500))

	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, request)

	got := recorder.Header().Get(RequestIDHeader)
	if len(got) > 128 {
		t.Errorf("expected a bounded request id, got %d characters", len(got))
	}
	if strings.HasPrefix(got, "xxxx") {
		t.Error("expected an oversized inbound id to be replaced")
	}
}

func TestRequestIDGeneratedWhenAbsent(t *testing.T) {
	var seen string

	handler := RequestID(logger.Nop())(http.HandlerFunc(
		func(w http.ResponseWriter, r *http.Request) {
			seen = RequestIDFromContext(r.Context())
			w.WriteHeader(http.StatusOK)
		}))

	handler.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "/", nil))

	if seen == "" {
		t.Error("expected a generated request id")
	}
}

func TestAccessLogRecordsStatus(t *testing.T) {
	var captured string

	log := logger.NewWithWriter(&captureWriter{store: &captured}, "development")

	handler := AccessLog(log)(http.HandlerFunc(
		func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusTeapot)
		}))

	handler.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "/things", nil))

	if !strings.Contains(captured, "418") {
		t.Errorf("expected the status in the log line, got %q", captured)
	}
	if !strings.Contains(captured, "/things") {
		t.Errorf("expected the path in the log line, got %q", captured)
	}
}

func TestAccessLogExcludesQueryString(t *testing.T) {
	var captured string

	log := logger.NewWithWriter(&captureWriter{store: &captured}, "development")

	handler := AccessLog(log)(http.HandlerFunc(
		func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
		}))

	handler.ServeHTTP(httptest.NewRecorder(),
		httptest.NewRequest(http.MethodGet, "/db?key=moogo_secret", nil))

	// Query strings carry object keys and tokens. Logging the path alone keeps
	// them out of the log file.
	if strings.Contains(captured, "moogo_secret") {
		t.Errorf("query strings must not be logged, got %q", captured)
	}
}

// A JSON endpoint must refuse a body declared as anything else. An HTML form
// cannot set this header, so the check is what keeps a page on another origin
// from driving the endpoint; see RequireJSON.
func TestReadJSONRefusesNonJSONContentType(t *testing.T) {
	for _, header := range []string{"", "text/plain", "application/x-www-form-urlencoded"} {
		recorder := httptest.NewRecorder()
		request := httptest.NewRequest(http.MethodPost, "/x", strings.NewReader(`{"a":1}`))
		if header != "" {
			request.Header.Set("Content-Type", header)
		}

		var target struct {
			A int `json:"a"`
		}
		if ReadJSON(recorder, request, &target) {
			t.Errorf("Content-Type %q: expected the body to be refused", header)
			continue
		}
		if recorder.Code != http.StatusUnsupportedMediaType {
			t.Errorf("Content-Type %q: status = %d, want 415", header, recorder.Code)
			continue
		}
		var body ErrorBody
		if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
			t.Errorf("Content-Type %q: decode: %v", header, err)
		} else if body.Error.Code != "unsupported_media_type" {
			t.Errorf("Content-Type %q: code = %q, want unsupported_media_type", header, body.Error.Code)
		}
	}
}

// A charset parameter is legal on any media type and must not be mistaken for
// a different one.
func TestReadJSONAcceptsJSONContentTypeParameters(t *testing.T) {
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/x", strings.NewReader(`{"a":42}`))
	request.Header.Set("Content-Type", "application/json; charset=utf-8")

	var target struct {
		A int `json:"a"`
	}
	if !ReadJSON(recorder, request, &target) {
		t.Fatalf("a charset parameter must still count as JSON, got %d: %s",
			recorder.Code, recorder.Body.String())
	}
	if target.A != 42 {
		t.Errorf("a = %d, want 42", target.A)
	}
}

// captureWriter collects log output for assertions.
type captureWriter struct {
	store *string
}

func (writer *captureWriter) Write(payload []byte) (int, error) {
	*writer.store += string(payload)
	return len(payload), nil
}
