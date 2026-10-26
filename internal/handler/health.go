package handler

import (
	"context"
	"fmt"
	"net/http"
	"strings"
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
	controlPlane    ControlPlanePinger
	readinessTimeout time.Duration
	log             *logger.Logger
	publicURL       string
	baseURL         string
	cdnURL          string
}

// NewHealth creates a Health handler.
func NewHealth(
	controlPlane ControlPlanePinger,
	readinessTimeout time.Duration,
	log *logger.Logger,
	publicURL string,
	baseURL string,
	cdnURL string,
) *Health {
	if readinessTimeout <= 0 {
		readinessTimeout = 2 * time.Second
	}
	return &Health{
		controlPlane:     controlPlane,
		readinessTimeout: readinessTimeout,
		log:              log,
		publicURL:        publicURL,
		baseURL:          baseURL,
		cdnURL:           cdnURL,
	}
}

// Liveness handles GET /healthz.
//
// It checks nothing on purpose: a probe that depends on the database reports
// the database as broken and the orchestrator restarts a process that is fine.
// It also exposes the configured origins so deploy scripts and uptime monitors
// can assert the correct data plane / CDN host.
//
// For human visitors, this renders a nice HTML page. For probes
// (Accept: application/json), it returns JSON as before.
func (handler *Health) Liveness(w http.ResponseWriter, r *http.Request) {
	accept := r.Header.Get("Accept")
	wantsHTML := accept == "text/html" || accept == "*/*" || strings.Contains(accept, "text/html")

	if wantsHTML {
		renderHealthHTML(w, handler)
		return
	}

	httpx.WriteJSON(w, http.StatusOK, map[string]string{
		"status":      "ok",
		"public_url":  handler.publicURL,
		"base_url":    handler.baseURL,
		"cdn_url":     handler.cdnURL,
	})
}

// renderHealthHTML renders a human-friendly HTML health page.
func renderHealthHTML(w http.ResponseWriter, handler *Health) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	fmt.Fprintf(w, `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Moogo Health Check</title>
  <style>
    body {font-family: system-ui, sans-serif; max-width: 600px; margin: 2rem auto; padding: 1rem; line-height: 1.5; color: #333;}
    .status-ok {color: #28a745; font-weight: bold;}
    .status-err {color: #dc3545; font-weight: bold;}
    .url-group {background: #f8f9fa; padding: 1rem; margin: 1rem 0; border-radius: 4px;}
    .url-group h3 {margin-top: 0; border-bottom: 1px solid #dee2e6; padding-bottom: 0.5rem; color: #6c757d;}
    .url {word-break: break-all; font-family: monospace; color: #495057;}
    .note {font-size: 0.875rem; color: #6c757d; margin-top: 1rem;}
  </style>
</head>
<body>
  <h1>Moogo Health Check</h1>
  <div class="status-ok">Status: ok</div>

  <div class="url-group">
    <h3>Configured URLs</h3>
    <div class="url">Base URL: <span class="url">%s</span></div>
    <div class="url">CDN URL: <span class="url">%s</span></div>
    <div class="url">Public URL: <span class="url">%s</span></div>
  </div>

  <p class="note">This page serves as both a health monitor for humans and a JSON API for probes.
  Request with <code>Accept: application/json</code> to get the machine-readable response.</p>
</body>
</html>`, handler.baseURL, handler.cdnURL, handler.publicURL)
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

	accept := r.Header.Get("Accept")
	wantsHTML := accept == "text/html" || accept == "*/*" || strings.Contains(accept, "text/html")

	if wantsHTML {
		renderHealthHTML(w, handler)
		return
	}

	httpx.WriteJSON(w, http.StatusOK, map[string]string{"status": "ready"})
}