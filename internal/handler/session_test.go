package handler

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/moogo/moogo/internal/auth"
	"github.com/moogo/moogo/internal/config"
	"github.com/moogo/moogo/pkg/logger"
	"github.com/moogo/moogo/pkg/session"
)

// newSessionProbe builds an OAuth handler wired to a real session manager but
// with no Google or store, which the /auth/session handler does not touch.
func newSessionProbe(t *testing.T) (*OAuth, *session.Signer) {
	t.Helper()
	signer, err := session.NewSigner("a-test-secret-that-is-definitely-long-enough", time.Hour)
	if err != nil {
		t.Fatalf("new signer: %v", err)
	}
	sessions := auth.NewSessionManager(signer, false)
	cfg := config.Config{}
	return NewOAuth(nil, sessions, nil, cfg, logger.Nop()), signer
}

func TestSessionProbeReportsSignedOut(t *testing.T) {
	handler, _ := newSessionProbe(t)

	recorder := httptest.NewRecorder()
	handler.Session(recorder, httptest.NewRequest(http.MethodGet, "/auth/session", nil))

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", recorder.Code)
	}
	var body struct {
		Authenticated bool `json:"authenticated"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode body: %v", err)
	}
	if body.Authenticated {
		t.Error("expected authenticated=false with no cookie")
	}
}

// TestSessionProbeReportsSignedIn guards the regression where the handler read
// the user id from the request context, which is only set by the session
// middleware — so the public /auth/session route always reported signed out.
func TestSessionProbeReportsSignedIn(t *testing.T) {
	handler, signer := newSessionProbe(t)

	token, err := signer.Issue("11111111-1111-4111-8111-111111111111", "ketut@example.com", time.Now())
	if err != nil {
		t.Fatalf("issue token: %v", err)
	}

	request := httptest.NewRequest(http.MethodGet, "/auth/session", nil)
	request.AddCookie(&http.Cookie{Name: auth.SessionCookieName, Value: token})

	recorder := httptest.NewRecorder()
	handler.Session(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", recorder.Code)
	}
	var body struct {
		Authenticated bool   `json:"authenticated"`
		Email         string `json:"email"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode body: %v", err)
	}
	if !body.Authenticated {
		t.Error("expected authenticated=true with a valid session cookie")
	}
	if body.Email != "ketut@example.com" {
		t.Errorf("expected the session email, got %q", body.Email)
	}
}
