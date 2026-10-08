package httpx

import (
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
	"testing/fstest"

	"github.com/moogodev/moogodev/pkg/logger"
)

// testIndexFS stands in for the built front page: a document with an app root
// for the status marker to sit ahead of.
var testIndexFS = fstest.MapFS{
	"index.html": {Data: []byte(`<!doctype html><html><head><title>home</title></head><body><div id="root"></div><script type="module" src="/static/app.js"></script></body></html>`)},
}

func TestWantsHTMLOnlyForDocumentRequests(t *testing.T) {
	cases := []struct {
		name   string
		method string
		accept string
		want   bool
	}{
		{"browser navigation", http.MethodGet, "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8", true},
		{"head request", http.MethodHead, "text/html,*/*;q=0.8", true},
		{"api client", http.MethodGet, "application/json", false},
		{"curl default", http.MethodGet, "*/*", false},
		{"no accept header", http.MethodGet, "", false},
		{"post even with html accept", http.MethodPost, "text/html", false},
		{"image load", http.MethodGet, "image/avif,image/webp,*/*", false},
	}

	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			request := httptest.NewRequest(testCase.method, "/askdans", nil)
			if testCase.accept != "" {
				request.Header.Set("Accept", testCase.accept)
			}
			if got := wantsHTML(request); got != testCase.want {
				t.Errorf("wantsHTML = %v, want %v", got, testCase.want)
			}
		})
	}
}

// serveErrorPages runs a handler behind ErrorPages with a browser Accept.
func serveErrorPages(handler http.Handler, method, target string) *httptest.ResponseRecorder {
	return serveErrorPagesOn(testIndexFS, handler, method, target)
}

func serveErrorPagesOn(indexFS fstest.MapFS, handler http.Handler, method, target string) *httptest.ResponseRecorder {
	request := httptest.NewRequest(method, target, nil)
	request.Header.Set("Accept", "text/html,application/xhtml+xml,*/*;q=0.8")
	recorder := httptest.NewRecorder()
	ErrorPages(indexFS)(handler).ServeHTTP(recorder, request)
	return recorder
}

func TestErrorPagesServeDocumentUnderFailedStatus(t *testing.T) {
	recorder := serveErrorPages(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		WriteError(w, http.StatusNotFound, "not_found", "no such endpoint")
	}), http.MethodGet, "/askdans")

	if recorder.Code != http.StatusNotFound {
		t.Errorf("expected 404, got %d", recorder.Code)
	}
	if contentType := recorder.Header().Get("Content-Type"); !strings.Contains(contentType, "text/html") {
		t.Errorf("expected an html content type, got %q", contentType)
	}
	body := recorder.Body.String()
	if !strings.Contains(body, "<title>home</title>") {
		t.Errorf("expected the front page document, got %q", body)
	}
	if !strings.Contains(body, `id="moogo-error" hidden`) {
		t.Errorf("expected the status marker, got %q", body)
	}
	if !strings.Contains(body, `&#34;status&#34;:404`) {
		t.Errorf("expected the embedded status, got %q", body)
	}
	// The marker has to be in the document before the app root, or the client
	// would mount first and never see it.
	if marker, root := strings.Index(body, "moogo-error"), strings.Index(body, `id="root"`); marker > root {
		t.Errorf("marker at %d sits after the app root at %d", marker, root)
	}
	if cacheControl := recorder.Header().Get("Cache-Control"); cacheControl != "no-store" {
		t.Errorf("expected error documents to be uncacheable, got %q", cacheControl)
	}
	if vary := recorder.Header().Get("Vary"); !strings.Contains(vary, "Accept") {
		t.Errorf("expected Vary: Accept, got %q", vary)
	}
}

func TestErrorPagesKeepJSONForAPIClients(t *testing.T) {
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		WriteError(w, http.StatusNotFound, "not_found", "no such endpoint")
	})

	for _, accept := range []string{"application/json", "*/*", ""} {
		request := httptest.NewRequest(http.MethodGet, "/askdans", nil)
		if accept != "" {
			request.Header.Set("Accept", accept)
		}
		recorder := httptest.NewRecorder()
		ErrorPages(testIndexFS)(handler).ServeHTTP(recorder, request)

		if recorder.Code != http.StatusNotFound {
			t.Errorf("accept %q: expected 404, got %d", accept, recorder.Code)
		}
		if contentType := recorder.Header().Get("Content-Type"); !strings.Contains(contentType, "application/json") {
			t.Errorf("accept %q: expected json, got %q", accept, contentType)
		}
		if body := recorder.Body.String(); !strings.Contains(body, `"code":"not_found"`) {
			t.Errorf("accept %q: expected the json error body, got %q", accept, body)
		}
	}
}

func TestErrorPagesKeepAPIPathsJSONForBrowsers(t *testing.T) {
	for _, path := range []string{"/api/me", "/p/abc/db/query", "/auth/login", "/healthz"} {
		recorder := serveErrorPages(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			WriteError(w, http.StatusUnauthorized, "unauthorized", "sign in first")
		}), http.MethodGet, path)

		if contentType := recorder.Header().Get("Content-Type"); !strings.Contains(contentType, "application/json") {
			t.Errorf("path %q: expected json for a browser too, got %q", path, contentType)
		}
		if body := recorder.Body.String(); !strings.Contains(body, `"code":"unauthorized"`) {
			t.Errorf("path %q: expected the json error body, got %q", path, body)
		}
	}
}

func TestErrorPagesKeepJSONForPostWithHTMLAccept(t *testing.T) {
	recorder := serveErrorPages(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		WriteError(w, http.StatusUnauthorized, "unauthorized", "sign in first")
	}), http.MethodPost, "/somewhere")

	if contentType := recorder.Header().Get("Content-Type"); !strings.Contains(contentType, "application/json") {
		t.Errorf("a post must stay json, got %q", contentType)
	}
}

func TestErrorPagesPassSuccessfulResponsesThrough(t *testing.T) {
	recorder := serveErrorPages(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("<!doctype html><html><body>app</body></html>"))
	}), http.MethodGet, "/")

	if recorder.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", recorder.Code)
	}
	if body := recorder.Body.String(); !strings.Contains(body, "app") {
		t.Errorf("body altered: %q", body)
	}
}

func TestErrorPagesServeDocumentForBodylessError(t *testing.T) {
	recorder := serveErrorPages(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusForbidden)
	}), http.MethodGet, "/secret")

	if recorder.Code != http.StatusForbidden {
		t.Errorf("expected 403, got %d", recorder.Code)
	}
	if contentType := recorder.Header().Get("Content-Type"); !strings.Contains(contentType, "text/html") {
		t.Errorf("expected html, got %q", contentType)
	}
	if body := recorder.Body.String(); !strings.Contains(body, `&#34;status&#34;:403`) {
		t.Errorf("expected the embedded status, got %q", body)
	}
}

func TestErrorPagesCarryEveryCommonStatus(t *testing.T) {
	statuses := []int{
		http.StatusBadRequest,
		http.StatusUnauthorized,
		http.StatusForbidden,
		http.StatusNotFound,
		http.StatusMethodNotAllowed,
		http.StatusRequestEntityTooLarge,
		http.StatusUnsupportedMediaType,
		http.StatusTooManyRequests,
		http.StatusInternalServerError,
		http.StatusNotImplemented,
		http.StatusBadGateway,
		http.StatusServiceUnavailable,
		http.StatusGatewayTimeout,
	}

	for _, status := range statuses {
		status := status
		t.Run(strconv.Itoa(status), func(t *testing.T) {
			recorder := serveErrorPages(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				WriteError(w, status, "test_code", "test message")
			}), http.MethodGet, "/somewhere")

			if recorder.Code != status {
				t.Errorf("expected %d, got %d", status, recorder.Code)
			}
			want := `&#34;status&#34;:` + strconv.Itoa(status)
			if body := recorder.Body.String(); !strings.Contains(body, want) {
				t.Errorf("page missing %q", want)
			}
		})
	}
}

func TestErrorPagesConvertPanicThroughRecoverer(t *testing.T) {
	handler := ErrorPages(testIndexFS)(Recoverer(logger.Nop())(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		panic("sensitive internal detail")
	})))

	request := httptest.NewRequest(http.MethodGet, "/crash", nil)
	request.Header.Set("Accept", "text/html")
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusInternalServerError {
		t.Errorf("expected 500, got %d", recorder.Code)
	}
	if contentType := recorder.Header().Get("Content-Type"); !strings.Contains(contentType, "text/html") {
		t.Errorf("expected html, got %q", contentType)
	}
	body := recorder.Body.String()
	if !strings.Contains(body, `&#34;status&#34;:500`) {
		t.Errorf("expected the embedded status, got %q", body)
	}
	if strings.Contains(body, "sensitive internal detail") {
		t.Errorf("the panic value must not be reflected")
	}
}

func TestErrorPagesFallBackToJSONWithoutAnIndex(t *testing.T) {
	recorder := serveErrorPagesOn(nil, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		WriteError(w, http.StatusNotFound, "not_found", "no such endpoint")
	}), http.MethodGet, "/askdans")

	if recorder.Code != http.StatusNotFound {
		t.Errorf("expected 404, got %d", recorder.Code)
	}
	if contentType := recorder.Header().Get("Content-Type"); !strings.Contains(contentType, "application/json") {
		t.Errorf("expected json without an index, got %q", contentType)
	}
	if body := recorder.Body.String(); !strings.Contains(body, `"message":"no such endpoint"`) {
		t.Errorf("expected the original envelope, got %q", body)
	}
}

func TestErrorPagesStreamOversizedResponsesUntouched(t *testing.T) {
	payload := strings.Repeat("x", maxErrorPageBuffer+1)
	recorder := serveErrorPages(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/plain; charset=utf-8")
		w.WriteHeader(http.StatusInternalServerError)
		_, _ = w.Write([]byte(payload))
	}), http.MethodGet, "/huge")

	if recorder.Code != http.StatusInternalServerError {
		t.Errorf("expected 500, got %d", recorder.Code)
	}
	if recorder.Body.Len() != len(payload) {
		t.Errorf("expected the original body to pass through, got %d bytes", recorder.Body.Len())
	}
}
