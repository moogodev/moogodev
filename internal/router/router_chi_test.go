package router

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
)

func TestChiDocsPattern(t *testing.T) {
	r := chi.NewRouter()
	r.Get("/docs", func(w http.ResponseWriter, r *http.Request) { w.Write([]byte("docs")) })
	r.Get("/docs/*", func(w http.ResponseWriter, r *http.Request) { w.Write([]byte("wild")) })
	for _, path := range []string{"/docs", "/docs/quickstart", "/docs/what-is-moogo"} {
		rec := httptest.NewRecorder()
		r.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, path, nil))
		t.Logf("%s -> %d (%q)", path, rec.Code, rec.Body.String())
	}
}
