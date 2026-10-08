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

// TestUpdatesRouteIsRateLimited: the widget is public, but each call can
// spend up to three seconds waiting on an outbound fetch, so the route
// carries its own address-keyed ceiling rather than none. The first request
// must reach the handler; a burst well past the allowance must end in a 429
// with a Retry-After.
func TestUpdatesRouteIsRateLimited(t *testing.T) {
	built, _ := updatesRouter(t, true)

	get := func() *httptest.ResponseRecorder {
		rec := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/api/updates", nil)
		// One caller address, so the allowance is spent in one bucket.
		req.RemoteAddr = "198.51.100.7:2345"
		built.ServeHTTP(rec, req)
		return rec
	}

	if code := get().Code; code != http.StatusOK {
		t.Fatalf("first request should reach the handler, got %d", code)
	}

	limited := false
	for attempt := 0; attempt < 130; attempt++ {
		rec := get()
		if rec.Code == http.StatusTooManyRequests {
			limited = true
			if rec.Header().Get("Retry-After") == "" {
				t.Error("expected a Retry-After header on the 429")
			}
			break
		}
	}
	if !limited {
		t.Error("expected /api/updates to start refusing with 429")
	}
}
