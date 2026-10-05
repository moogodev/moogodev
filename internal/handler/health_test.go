package handler

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/moogo/moogo/pkg/logger"
)

// stubPinger reports a fixed error.
type stubPinger struct {
	err        error
	callCount  int
	calledWith context.Context
}

func (pinger *stubPinger) Ping(ctx context.Context) error {
	pinger.callCount++
	pinger.calledWith = ctx
	return pinger.err
}

func TestLivenessAlwaysPasses(t *testing.T) {
	pinger := &stubPinger{err: errors.New("postgres is down")}
	handler := NewHealth(pinger, time.Second, logger.Nop())

	recorder := httptest.NewRecorder()
	handler.Liveness(recorder, httptest.NewRequest(http.MethodGet, "/healthz", nil))

	// Liveness must not consult the database. If it did, a database outage
	// would make the orchestrator restart a process that is otherwise fine.
	if recorder.Code != http.StatusOK {
		t.Errorf("expected 200 even when a dependency is down, got %d", recorder.Code)
	}
	if pinger.callCount != 0 {
		t.Error("liveness must not check dependencies")
	}
}

func TestReadinessPassesWhenControlPlaneAnswers(t *testing.T) {
	pinger := &stubPinger{}
	handler := NewHealth(pinger, time.Second, logger.Nop())

	recorder := httptest.NewRecorder()
	handler.Readiness(recorder, httptest.NewRequest(http.MethodGet, "/readyz", nil))

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", recorder.Code)
	}
	if pinger.callCount != 1 {
		t.Errorf("expected one dependency check, got %d", pinger.callCount)
	}
}

func TestReadinessFailsWhenControlPlaneIsDown(t *testing.T) {
	pinger := &stubPinger{err: errors.New("connection refused")}
	handler := NewHealth(pinger, time.Second, logger.Nop())

	recorder := httptest.NewRecorder()
	handler.Readiness(recorder, httptest.NewRequest(http.MethodGet, "/readyz", nil))

	// 503 keeps the instance out of the load balancer without triggering a
	// restart.
	if recorder.Code != http.StatusServiceUnavailable {
		t.Errorf("expected 503, got %d", recorder.Code)
	}
	if code := errorCode(t, recorder); code != "not_ready" {
		t.Errorf("expected not_ready, got %q", code)
	}
}

func TestReadinessBoundsTheCheck(t *testing.T) {
	pinger := &stubPinger{}
	handler := NewHealth(pinger, 5*time.Millisecond, logger.Nop())

	recorder := httptest.NewRecorder()
	handler.Readiness(recorder, httptest.NewRequest(http.MethodGet, "/readyz", nil))

	if pinger.calledWith == nil {
		t.Fatal("expected the check to receive a context")
	}
	// A probe that hangs is worse than no probe, because the orchestrator waits
	// on it too.
	deadline, hasDeadline := pinger.calledWith.Deadline()
	if !hasDeadline {
		t.Fatal("expected the check context to carry a deadline")
	}
	if time.Until(deadline) > time.Second {
		t.Errorf("expected a short deadline, got %s", time.Until(deadline))
	}
}
