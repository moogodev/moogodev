package router

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/moogo/moogo/internal/auth"
	"github.com/moogo/moogo/internal/dbcontrol"
	"github.com/moogo/moogo/internal/handler"
	"github.com/moogo/moogo/pkg/logger"
)

// docsRouter builds the router with the real docs handler over the real
// embedded docs filesystem and a test single-page app.
func docsRouter(t *testing.T) http.Handler {
	t.Helper()

	docs := handler.NewDocsHandler(handler.GetDocsFS(), logger.Nop())
	projectID := uuid.New()
	return New(Deps{
		Health:       &stubHealth{},
		OAuth:        &stubOAuth{},
		Credentials:  &stubCredentials{},
		Control:      &stubControl{},
		Data:         &stubData{},
		Bucket:       &stubBucket{},
		Docs:         docs,
		Sessions:     auth.NewSessionManager(mustSigner(t), false),
		ProjectKeys:  stubResolver{project: &dbcontrol.Project{ID: projectID, Status: dbcontrol.ProjectReady}},
		Log:          logger.Nop(),
		StaticFS:     http.FS(testFrontend),
		IndexFS:      testFrontend,
		MaxBodyBytes: 1024,

		RequestTimeout: time.Second,
	})
}

// TestDocsPagesServeTheApp checks that /docs and /docs/... hand back the
// single-page app shell rather than a server-rendered document.
//
// The docs component is a client route: it renders the bundled markdown with
// marked and DOMPurify, under the site's own layout. Answering the same path
// with the bare DocsHandler page gave a reload a document with no sidebar, no
// search and none of the site's styling, which read as "the CSS is missing".
func TestDocsPagesServeTheApp(t *testing.T) {
	built := docsRouter(t)

	for _, path := range []string{"/docs", "/docs/quickstart", "/docs/DECISIONS"} {
		t.Run(path, func(t *testing.T) {
			rec := httptest.NewRecorder()
			built.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, path, nil))

			if rec.Code != http.StatusOK {
				t.Fatalf("expected 200, got %d (%s)", rec.Code, rec.Body.String())
			}
			if !strings.Contains(rec.Body.String(), "<title>home</title>") {
				t.Errorf("expected the SPA app shell, got %q", rec.Body.String())
			}
		})
	}
}

// TestDocsAPIServesMarkdown checks the other half of the split: /api/docs/...
// still answers with a server-rendered document out of the embedded filesystem,
// not with the app shell. A docs path answered with index.html here would hand
// untrusted markdown to the client renderer in the app origin.
func TestDocsAPIServesMarkdown(t *testing.T) {
	built := docsRouter(t)

	for _, path := range []string{"/api/docs", "/api/docs/quickstart"} {
		t.Run(path, func(t *testing.T) {
			rec := httptest.NewRecorder()
			built.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, path, nil))

			if rec.Code != http.StatusOK {
				t.Fatalf("expected 200, got %d (%s)", rec.Code, rec.Body.String())
			}
			body := rec.Body.String()
			if strings.Contains(body, "<title>home</title>") {
				t.Errorf("served the SPA app shell instead of the document")
			}
			if path == "/api/docs/quickstart" {
				if !strings.Contains(body, "<h1>Quickstart</h1>") {
					t.Errorf("expected the rendered markdown, got %q", body)
				}
				if contentType := rec.Header().Get("Content-Type"); !strings.HasPrefix(contentType, "text/html") {
					t.Errorf("expected an HTML document, got content-type %q", contentType)
				}
			}
			if path == "/api/docs" && !strings.Contains(body, `"documents"`) {
				t.Errorf("expected the JSON document list, got %q", body)
			}
		})
	}
}
