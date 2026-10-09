package router

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/google/uuid"
)

// A hashed asset is a promise: the name changed because the bytes changed, so
// the response can be cached forever under that exact name. Everything else
// under /static/ has to be revalidated, or a replaced logo sticks around for
// as long as the cache feels like.
func TestStaticAssetCacheControl(t *testing.T) {
	built, _, _, _ := testRouter(t, uuid.New())

	cases := []struct {
		path string
		want string
	}{
		{"/static/assets/index-Ab12Cd34.js", "public, max-age=31536000, immutable"},
		{"/static/assets/app.css", "no-cache"},
		{"/static/img/favicon.svg", "no-cache"},
	}

	for _, testCase := range cases {
		recorder := httptest.NewRecorder()
		built.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, testCase.path, nil))

		if recorder.Code != http.StatusOK {
			t.Errorf("%s: expected 200, got %d", testCase.path, recorder.Code)
			continue
		}

		headers := recorder.Header().Values("Cache-Control")
		if len(headers) != 1 {
			t.Errorf("%s: expected exactly one Cache-Control header, got %d: %v",
				testCase.path, len(headers), headers)
			continue
		}
		if headers[0] != testCase.want {
			t.Errorf("%s: expected Cache-Control %q, got %q", testCase.path, testCase.want, headers[0])
		}
	}
}

// The HTML shell carries no Cache-Control from the application on purpose:
// nginx adds the text/html header on the way out, and a second one from the
// origin would arrive alongside it. This pins the division of labour — the
// app owns /static/, the edge owns the shell.
func TestShellHasNoCacheControlFromTheApp(t *testing.T) {
	built, _, _, _ := testRouter(t, uuid.New())

	recorder := httptest.NewRecorder()
	built.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/", nil))

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", recorder.Code)
	}
	if headers := recorder.Header().Values("Cache-Control"); len(headers) != 0 {
		t.Errorf("expected no Cache-Control from the app on the shell, got %v", headers)
	}
}
