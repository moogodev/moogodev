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

// TestProjectCreatedEmailLinksToTheDashboard: the welcome email's button has to
// open a dashboard page. It once pointed at the data-plane API base, which
// answers a bare GET with "authentication required" instead of rendering
// anything, so the owner who clicked it got a 401 rather than their project.
func TestProjectCreatedEmailLinksToTheDashboard(t *testing.T) {
	var output bytes.Buffer
	sender := New("", "Moogo <onboarding@resend.dev>", "https://app.moogo.dev",
		logger.NewWithWriter(&output, "development"), false)

	const projectID = "27e6612a-51d8-4d2c-988c-79a06226fcc0"
	if err := sender.SendProjectCreated(context.Background(),
		"person@example.com", "demo", projectID, "moogo_secret",
		"https://api.moogo.dev"); err != nil {
		t.Fatalf("send in log-only mode: %v", err)
	}

	want := "https://app.moogo.dev/app/projects/" + projectID
	log := output.String()
	if !strings.Contains(log, want) {
		t.Fatalf("dashboard link %q missing from log: %s", want, log)
	}
	if strings.Contains(log, "api.moogo.dev/p/"+projectID) {
		t.Fatalf("link points at the API base, not the dashboard: %s", log)
	}
}

// TestProjectCreatedEmailEndpointsAreTheDataPlane: the endpoint rows must name
// real routes. The API base is MOOGO_BASE_URL joined with /p/{project_id}, the
// prefix a client appends "/query" or "/bucket/<key>" to: there is no "/db"
// under it, and the bucket takes a storage credential rather than the project's
// SQL key.
func TestProjectCreatedEmailEndpointsAreTheDataPlane(t *testing.T) {
	const (
		projectID = "27e6612a-51d8-4d2c-988c-79a06226fcc0"
		baseURL   = "https://api.moogo.dev"
		apiBase   = baseURL + "/p/" + projectID
	)
	html := projectCreatedHTML("demo", projectID, "moogo_secret",
		"https://app.moogo.dev/app/projects/"+projectID, apiBase, baseURL,
		"https://app.moogo.dev/static/img/logo-light.png")

	if !strings.Contains(html, apiBase) {
		t.Errorf("email is missing the API base %q", apiBase)
	}
	if !strings.Contains(html, baseURL) {
		t.Errorf("email is missing the base URL %q", baseURL)
	}
	if !strings.Contains(html, "MOOGO_BASE_URL") || !strings.Contains(html, "MOOGO_SQL_KEY") {
		t.Errorf("email does not name the MOOGO_BASE_URL / MOOGO_SQL_KEY variables")
	}
	if !strings.Contains(html, apiBase+"/bucket") {
		t.Errorf("email is missing the bucket endpoint %q", apiBase+"/bucket")
	}
	if strings.Contains(html, apiBase+"/db") {
		t.Errorf("email names %q, but there is no /db route under /p/{id}", apiBase+"/db")
	}
	if strings.Contains(html, "requires secret key") {
		t.Errorf("email says the bucket takes the project secret key; it takes a storage credential")
	}
}
