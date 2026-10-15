package backup

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/google/uuid"

	"github.com/moogodev/moogodev/pkg/logger"
)

func TestWebhookPostsFailingAlert(t *testing.T) {
	type received struct {
		body        webhookPayload
		contentType string
	}
	got := make(chan received, 1)

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		raw, _ := io.ReadAll(r.Body)
		var payload webhookPayload
		if err := json.Unmarshal(raw, &payload); err != nil {
			t.Errorf("alert body is not JSON: %v", err)
		}
		got <- received{body: payload, contentType: r.Header.Get("Content-Type")}
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	hook := NewWebhook(server.URL, logger.Nop())
	projectID := uuid.New()
	hook.BackupFailing(context.Background(), projectID, 3, "disk full")

	delivered := <-got
	if delivered.body.Event != "backup.failing" {
		t.Errorf("event = %q", delivered.body.Event)
	}
	if delivered.body.ProjectID != projectID.String() {
		t.Errorf("project = %q, want %q", delivered.body.ProjectID, projectID)
	}
	if delivered.body.ConsecutiveFailures != 3 {
		t.Errorf("consecutive_failures = %d", delivered.body.ConsecutiveFailures)
	}
	if delivered.body.LastError != "disk full" {
		t.Errorf("last_error = %q", delivered.body.LastError)
	}
	if delivered.contentType != "application/json" {
		t.Errorf("content-type = %q", delivered.contentType)
	}
}

func TestWebhookRecoveryAlertOmitsFailureFields(t *testing.T) {
	got := make(chan webhookPayload, 1)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		raw, _ := io.ReadAll(r.Body)
		var payload webhookPayload
		_ = json.Unmarshal(raw, &payload)
		got <- payload
		w.WriteHeader(http.StatusNoContent)
	}))
	defer server.Close()

	NewWebhook(server.URL, logger.Nop()).BackupRecovered(context.Background(), uuid.New())

	payload := <-got
	if payload.Event != "backup.recovered" {
		t.Errorf("event = %q", payload.Event)
	}
	if payload.ConsecutiveFailures != 0 || payload.LastError != "" {
		t.Errorf("recovery alert carried failure fields: %+v", payload)
	}
}

func TestWebhookWithoutURLDoesNothing(t *testing.T) {
	// A nil-url notifier must be safe to call, so the service can wire it
	// unconditionally whether or not an operator configured a webhook.
	hook := NewWebhook("", logger.Nop())
	hook.BackupFailing(context.Background(), uuid.New(), 1, "boom")
	hook.BackupRecovered(context.Background(), uuid.New())
}
