package backup

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/google/uuid"

	"github.com/moogodev/moogodev/pkg/logger"
)

// Notifier receives backup alerts. It is deliberately tiny: the service calls
// it once when a project's failure streak crosses a threshold and once when a
// project recovers, and a notifier must never be able to slow a backup down or
// turn a successful backup into a failed one. Implementations therefore do
// their work best-effort and return nothing.
type Notifier interface {
	// BackupFailing is called when a project reaches the configured consecutive
	// failure count.
	BackupFailing(ctx context.Context, projectID uuid.UUID, consecutiveFailures int, lastError string)
	// BackupRecovered is called when a project that had reached the threshold
	// succeeds again.
	BackupRecovered(ctx context.Context, projectID uuid.UUID)
}

// Webhook posts alerts as JSON to one URL.
//
// It is the built-in Notifier because it needs no new dependency and no
// credentials: any endpoint that accepts a POST -- a chat bridge, an alerting
// relay, a small function -- can receive it. A failure to deliver is logged and
// dropped; there is no retry queue, because the metric and the dashboard remain
// the source of truth whether or not the alert arrived.
type Webhook struct {
	url    string
	client *http.Client
	log    *logger.Logger
}

// webhookTimeout bounds one delivery. It is short: an alert that cannot be
// delivered within it is more useful logged as undelivered than held open.
const webhookTimeout = 10 * time.Second

// NewWebhook builds the webhook notifier. An empty url yields a notifier that
// does nothing, so the caller can wire it unconditionally.
func NewWebhook(url string, log *logger.Logger) *Webhook {
	if log == nil {
		log = logger.Nop()
	}
	return &Webhook{
		url:    url,
		client: &http.Client{Timeout: webhookTimeout},
		log:    log,
	}
}

// webhookPayload is the alert body. Field names are spelled out rather than
// abbreviated because the receiver is a third party and the payload is part of
// the interface.
type webhookPayload struct {
	Event               string `json:"event"`
	ProjectID           string `json:"project_id"`
	ConsecutiveFailures int    `json:"consecutive_failures,omitempty"`
	LastError           string `json:"last_error,omitempty"`
	At                  string `json:"at"`
}

// BackupFailing posts a backup.failing alert.
func (hook *Webhook) BackupFailing(ctx context.Context, projectID uuid.UUID, consecutiveFailures int, lastError string) {
	hook.post(ctx, webhookPayload{
		Event:               "backup.failing",
		ProjectID:           projectID.String(),
		ConsecutiveFailures: consecutiveFailures,
		LastError:           lastError,
		At:                  time.Now().UTC().Format(time.RFC3339),
	})
}

// BackupRecovered posts a backup.recovered alert.
func (hook *Webhook) BackupRecovered(ctx context.Context, projectID uuid.UUID) {
	hook.post(ctx, webhookPayload{
		Event:     "backup.recovered",
		ProjectID: projectID.String(),
		At:        time.Now().UTC().Format(time.RFC3339),
	})
}

func (hook *Webhook) post(ctx context.Context, payload webhookPayload) {
	if hook == nil || hook.url == "" {
		return
	}

	body, err := json.Marshal(payload)
	if err != nil {
		hook.log.Warn("encode backup alert failed", logger.Fields{
			"event": payload.Event,
			"error": err.Error(),
		})
		return
	}

	// Detach from the caller's context: a backup that failed because it timed
	// out would otherwise cancel the alert about its own failure.
	postCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), webhookTimeout)
	defer cancel()

	request, err := http.NewRequestWithContext(postCtx, http.MethodPost, hook.url, bytes.NewReader(body))
	if err != nil {
		hook.log.Warn("build backup alert request failed", logger.Fields{
			"event": payload.Event,
			"error": err.Error(),
		})
		return
	}
	request.Header.Set("Content-Type", "application/json")

	response, err := hook.client.Do(request)
	if err != nil {
		hook.log.Warn("deliver backup alert failed", logger.Fields{
			"event": payload.Event,
			"error": err.Error(),
		})
		return
	}
	response.Body.Close()

	if response.StatusCode >= http.StatusMultipleChoices {
		hook.log.Warn("backup alert rejected", logger.Fields{
			"event":  payload.Event,
			"status": response.StatusCode,
		})
	}
}
