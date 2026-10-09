package httpx

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// TestSameOriginRefusesCrossOriginWrites: a write that names another host in
// Origin never reaches the handler. The cookie is SameSite=Lax and the body
// must be application/json, and this is the layer that keeps both of those
// from ever being relaxed in silence.
func TestSameOriginRefusesCrossOriginWrites(t *testing.T) {
	testCases := []struct {
		name   string
		method string
		origin string
	}{
		{"post", http.MethodPost, "https://evil.example"},
		{"put", http.MethodPut, "https://evil.example"},
		{"patch", http.MethodPatch, "https://evil.example"},
		{"delete", http.MethodDelete, "https://evil.example"},
		{"origin null", http.MethodPost, "null"},
		{"unparseable origin", http.MethodPost, "://no-scheme"},
		{"different port", http.MethodPost, "http://example.com:9999"},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			request := httptest.NewRequest(testCase.method, "http://example.com/write", nil)
			request.Host = "example.com"
			request.Header.Set("Origin", testCase.origin)

			called := false
			handler := SameOrigin(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				called = true
				w.WriteHeader(http.StatusNoContent)
			}))
			handler.ServeHTTP(recorder, request)

			if called {
				t.Fatal("the handler was reached with a cross-origin write")
			}
			if recorder.Code != http.StatusForbidden {
				t.Fatalf("expected 403, got %d", recorder.Code)
			}
			if !strings.Contains(recorder.Body.String(), "forbidden") {
				t.Errorf("expected a forbidden error body, got %q", recorder.Body.String())
			}
		})
	}
}

// TestSameOriginPassesLegitimateTraffic: the same write with this server's own
// Origin succeeds, a request without an Origin header (curl, tests, any
// non-browser client) is not browser CSRF and passes, and a GET is exempt
// because browsers do not attach Origin to navigations or simple reads.
func TestSameOriginPassesLegitimateTraffic(t *testing.T) {
	testCases := []struct {
		name   string
		method string
		origin string
	}{
		{"own origin", http.MethodPost, "https://example.com"},
		{"own origin other scheme", http.MethodPost, "http://example.com"},
		{"own origin uppercase host", http.MethodPost, "https://EXAMPLE.com"},
		{"no origin", http.MethodPost, ""},
		{"get with foreign origin", http.MethodGet, "https://evil.example"},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			request := httptest.NewRequest(testCase.method, "http://example.com/anything", nil)
			request.Host = "example.com"
			if testCase.origin != "" {
				request.Header.Set("Origin", testCase.origin)
			}

			called := false
			handler := SameOrigin(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				called = true
				w.WriteHeader(http.StatusNoContent)
			}))
			handler.ServeHTTP(recorder, request)

			if !called {
				t.Fatalf("the handler was not reached: %d %s", recorder.Code, recorder.Body.String())
			}
			if recorder.Code != http.StatusNoContent {
				t.Errorf("expected 204, got %d", recorder.Code)
			}
		})
	}
}
