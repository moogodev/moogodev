package mail

import (
	"bytes"
	"context"
	"strings"
	"testing"

	"github.com/moogodev/moogodev/pkg/logger"
)

// TestLogOnlyRedactsTheLinkInProduction: a production deployment can reach the
// log-only path -- configuration accepts RESEND_API_KEY empty as long as Google
// sign-in is set -- and neither forgot-password nor resend-verification gates
// on Enabled(). The line would then carry a live reset link, which turns the
// log file into a credential store.
func TestLogOnlyRedactsTheLinkInProduction(t *testing.T) {
	var output bytes.Buffer
	sender := New("", "Moogo <onboarding@resend.dev>", "https://moogo.dev",
		logger.NewWithWriter(&output, "development"), true)

	token := "reset-ABCDEFGH-abcdefghijkl"
	if err := sender.SendPasswordReset(context.Background(),
		"person@example.com", token); err != nil {
		t.Fatalf("send in log-only mode: %v", err)
	}

	log := output.String()
	if strings.Contains(log, token) {
		t.Fatalf("full reset token in log: %s", log)
	}
	if strings.Contains(log, "/reset-password?token=") {
		t.Fatalf("working reset link in log: %s", log)
	}
	if !strings.Contains(log, "[redacted]") {
		t.Fatalf("redacted marker missing from log: %s", log)
	}
	if !strings.Contains(log, token[:8]) {
		t.Fatalf("token prefix missing from log: %s", log)
	}
}

// TestLogOnlyShowsTheLinkInDevelopment: the other half of the same behavior.
// With no Resend account the console line is the only way to follow the link
// locally, and the package documents that flow -- development keeps the full
// URL in the log.
func TestLogOnlyShowsTheLinkInDevelopment(t *testing.T) {
	var output bytes.Buffer
	sender := New("", "Moogo <onboarding@resend.dev>", "https://moogo.dev",
		logger.NewWithWriter(&output, "development"), false)

	token := "verify-ABCDEFGH-abcdefghijkl"
	if err := sender.SendEmailVerification(context.Background(),
		"person@example.com", token); err != nil {
		t.Fatalf("send in log-only mode: %v", err)
	}

	log := output.String()
	if !strings.Contains(log, "/verify-email?token="+token) {
		t.Fatalf("verification link missing from development log: %s", log)
	}
	if !strings.Contains(log, "person@example.com") {
		t.Fatalf("recipient missing from log: %s", log)
	}
}
