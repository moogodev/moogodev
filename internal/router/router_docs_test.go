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

// TestDocsRouteActuallyServesMarkdown builds the router with the real docs
// handler over the real embedded docs filesystem and checks that /docs/... is
// served as a document rather than as the single-page app shell.
//
// A docs path answered with index.html is the XSS-prone case: the client
// would render untrusted markdown inside the app origin.
func TestDocsRouteActuallyServesMarkdown(t *testing.T) {
	docs := handler.NewDocsHandler(handler.GetDocsFS(), logger.Nop())
	projectID := uuid.New()
	built := New(Deps{
		Health:      &stubHealth{},
		OAuth:       &stubOAuth{},
		Credentials: &stubCredentials{},
		Control:     &stubControl{},
		Data:        &stubData{},
		Bucket:      &stubBucket{},
		Docs:        docs,
		Sessions:    auth.NewSessionManager(mustSigner(t), false),
		ProjectKeys: stubResolver{project: &dbcontrol.Project{ID: projectID, Status: dbcontrol.ProjectReady}},
		Log:         logger.Nop(),
		StaticFS:    http.FS(testFrontend),
		IndexFS:     testFrontend,
		MaxBodyBytes: 1024,

		RequestTimeout: time.Second,
	})

	for _, path := range []string{"/docs", "/docs/quickstart", "/docs/DECISIONS", "/api/docs/quickstart"} {
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
			if contentType := rec.Header().Get("Content-Type"); !strings.HasPrefix(contentType, "text/html") {
				t.Errorf("expected an HTML document, got content-type %q", contentType)
			}
		})
	}
}
