package httpx

import (
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"

	"github.com/moogodev/moogodev/pkg/logger"
)

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
	request := httptest.NewRequest(method, target, nil)
	request.Header.Set("Accept", "text/html,application/xhtml+xml,*/*;q=0.8")
	recorder := httptest.NewRecorder()
	ErrorPages(handler).ServeHTTP(recorder, request)
	return recorder
}

func TestErrorPagesRenderDocumentForJSONError(t *testing.T) {
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
	for _, want := range []string{"404", "Page not found", "no such endpoint", "/askdans"} {
		if !strings.Contains(body, want) {
			t.Errorf("page missing %q", want)
		}
	}
	if cacheControl := recorder.Header().Get("Cache-Control"); cacheControl != "no-store" {
		t.Errorf("expected error pages to be uncacheable, got %q", cacheControl)
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
		ErrorPages(handler).ServeHTTP(recorder, request)

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

func TestErrorPagesKeepJSONForPostWithHTMLAccept(t *testing.T) {
	recorder := serveErrorPages(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		WriteError(w, http.StatusUnauthorized, "unauthorized", "sign in first")
	}), http.MethodPost, "/api/me")

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

func TestErrorPagesRenderPageForBodylessError(t *testing.T) {
	recorder := serveErrorPages(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusForbidden)
	}), http.MethodGet, "/secret")

	if recorder.Code != http.StatusForbidden {
		t.Errorf("expected 403, got %d", recorder.Code)
	}
	if contentType := recorder.Header().Get("Content-Type"); !strings.Contains(contentType, "text/html") {
		t.Errorf("expected html, got %q", contentType)
	}
	if body := recorder.Body.String(); !strings.Contains(body, "Access denied") {
		t.Errorf("expected the 403 copy, got %q", body)
	}
}

func TestErrorPagesCoverEveryCommonStatus(t *testing.T) {
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
			body := recorder.Body.String()
			if !strings.Contains(body, strconv.Itoa(status)) {
				t.Errorf("page missing the status number %d", status)
			}
			wantTitle := copyFor(status).title
			if !strings.Contains(body, wantTitle) {
				t.Errorf("page missing title %q", wantTitle)
			}
			if !strings.Contains(body, "test message") {
				t.Errorf("page missing the error message")
			}
		})
	}
}

func TestErrorPagesEscapeReflectedValues(t *testing.T) {
	recorder := serveErrorPages(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		WriteError(w, http.StatusNotFound, "<script>alert(1)</script>", "<img src=x onerror=alert(1)>")
	}), http.MethodGet, "/<script>")

	body := recorder.Body.String()
	if strings.Contains(body, "<script>alert(1)</script>") ||
		strings.Contains(body, "<img src=x") {
		t.Errorf("reflected values were not escaped: %q", body)
	}
	if !strings.Contains(body, "&lt;script&gt;") {
		t.Errorf("expected the escaped form in the page: %q", body)
	}
}

func TestErrorPagesConvertPanicThroughRecoverer(t *testing.T) {
	handler := ErrorPages(Recoverer(logger.Nop())(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
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
	if body := recorder.Body.String(); !strings.Contains(body, "Something went wrong") {
		t.Errorf("expected the 500 copy, got %q", body)
	}
	if strings.Contains(recorder.Body.String(), "sensitive internal detail") {
		t.Errorf("the panic value must not be reflected")
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
