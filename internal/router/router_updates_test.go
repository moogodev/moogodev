package router

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/moogodev/moogodev/internal/auth"
	"github.com/moogodev/moogodev/internal/dbcontrol"
	"github.com/moogodev/moogodev/pkg/logger"
)

// stubUpdates is a minimal updates handler for tests.
type stubUpdates struct{ called bool }

func (stub *stubUpdates) Updates(w http.ResponseWriter, r *http.Request) {
	stub.called = true
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(`{"updates":[]}`))
}

// updatesRouter builds the router with a stub for every handler the updates
// route needs, and nothing wired for the route itself when wired is false.
func updatesRouter(t *testing.T, wired bool) (http.Handler, *stubUpdates) {
	t.Helper()

	projectID := uuid.New()
	updatesStub := &stubUpdates{}
	deps := Deps{
		Health:         &stubHealth{},
		OAuth:          &stubOAuth{},
		Credentials:    &stubCredentials{},
		Control:        &stubControl{},
		Data:           &stubData{},
		Bucket:         &stubBucket{},
		Sessions:       auth.NewSessionManager(mustSigner(t), false),
		ProjectKeys:    stubResolver{project: &dbcontrol.Project{ID: projectID, Status: dbcontrol.ProjectReady}},
		Log:            logger.Nop(),
		StaticFS:       http.FS(testFrontend),
		IndexFS:        testFrontend,
		MaxBodyBytes:   1024,
		RequestTimeout: time.Second,
	}
	if wired {
		deps.Updates = updatesStub
	}
	return New(deps), updatesStub
}

// TestUpdatesRouteIsPublicAndWired checks the two things a handler test
// cannot see: that GET /api/updates is mounted at that exact path, and that
// it answers without a session cookie — the dashboard's widget must not
// depend on auth state to read public post titles.
func TestUpdatesRouteIsPublicAndWired(t *testing.T) {
	built, stub := updatesRouter(t, true)

	rec := httptest.NewRecorder()
	built.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/updates", nil))

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 with no session, got %d (%s)", rec.Code, rec.Body.String())
	}
	if !stub.called {
		t.Error("expected the updates handler to be called")
	}
}

// TestUpdatesRouteAbsentWhenUnwired keeps a nil Updates — as in every test
// that does not care about the widget — from panicking on mount or silently
// answering 200 with someone else's page.
func TestUpdatesRouteAbsentWhenUnwired(t *testing.T) {
	built, stub := updatesRouter(t, false)

	rec := httptest.NewRecorder()
	built.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/updates", nil))

	if rec.Code != http.StatusNotFound {
		t.Errorf("expected 404 when Updates is nil, got %d", rec.Code)
	}
	if stub.called {
		t.Error("expected no handler call when Updates is nil")
	}
}
