package handler

import (
	"context"
	"net/http"
	"time"

	"github.com/moogodev/moogodev/pkg/httpx"
	"github.com/moogodev/moogodev/pkg/logger"
)

// ControlPlanePinger reports whether Postgres is reachable.
type ControlPlanePinger interface {
	Ping(ctx context.Context) error
}

// Health serves the liveness and readiness probes.
//
// The two are separate on purpose. Liveness answers "should this process be
// restarted"; readiness answers "should traffic be sent here". Conflating them
// means a slow database takes the whole service out of rotation, when the only
// thing broken is one dependency.
type Health struct {
	controlPlane ControlPlanePinger
	// readinessTimeout bounds the dependency check so a hung database cannot
	// hang the probe itself.
	readinessTimeout time.Duration
	log              *logger.Logger
}

// NewHealth creates a Health handler.
func NewHealth(
	controlPlane ControlPlanePinger,
	readinessTimeout time.Duration,
	log *logger.Logger,
) *Health {
	if readinessTimeout <= 0 {
		readinessTimeout = 2 * time.Second
	}
	return &Health{
		controlPlane:     controlPlane,
		readinessTimeout: readinessTimeout,
		log:              log,
	}
}

// Liveness handles GET /healthz.
//
// It checks nothing on purpose: a probe that depends on the database reports
// the database as broken and the orchestrator restarts a process that is fine.
func (handler *Health) Liveness(w http.ResponseWriter, r *http.Request) {
	httpx.WriteJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

// Readiness handles GET /readyz.
func (handler *Health) Readiness(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), handler.readinessTimeout)
	defer cancel()

	if err := handler.controlPlane.Ping(ctx); err != nil {
		handler.log.Warn("readiness check failed", logger.Fields{"error": err.Error()})
		httpx.WriteError(w, http.StatusServiceUnavailable, "not_ready",
			"the control plane is not reachable")
		return
	}

	httpx.WriteJSON(w, http.StatusOK, map[string]string{"status": "ready"})
}
