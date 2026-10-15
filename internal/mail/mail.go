// Package mail sends transactional email through Resend.
//
// It is deliberately narrow: the service sends two kinds of outbound mail today
// (address confirmation and password reset), and both go out through one request
// path so they cannot drift apart on headers, error handling, or logging. When
// no API key is configured the sender writes the message to the log instead of
// calling Resend, so local development works without an account and the links
// are still visible -- except in production, where the link is redacted so a
// live token never lands in a log file.
package mail

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/moogodev/moogodev/pkg/logger"
)

// resendAPI is the Resend email endpoint.
const resendAPI = "https://api.resend.com/emails"

// Sender sends outbound mail.
type Sender struct {
	apiKey     string
	from       string
	publicURL  string
	log        *logger.Logger
	httpClient *http.Client
	production bool
}

// New creates a Sender. An empty apiKey switches it to log-only mode.
//
// production only changes what the log-only mode writes: see send.
func New(apiKey, from, publicURL string, log *logger.Logger, production bool) *Sender {
	return &Sender{
		apiKey:     apiKey,
		from:       from,
		publicURL:  publicURL,
		log:        log,
		httpClient: &http.Client{Timeout: 15 * time.Second},
		production: production,
	}
}

// Enabled reports whether real delivery is configured.
func (sender *Sender) Enabled() bool {
	return sender.apiKey != ""
}

// resendRequest is the subset of the Resend create-email payload used here.
type resendRequest struct {
	From    string   `json:"from"`
	To      []string `json:"to"`
	Subject string   `json:"subject"`
	HTML    string   `json:"html"`
}

// resendError is the shape of a non-2xx Resend response.
type resendError struct {
	Message string `json:"message"`
	Name    string `json:"name"`
}

// SendPasswordReset emails a password-reset link to the given address.
//
// The token is embedded in the link and is never logged in full: only a short
// prefix is recorded, which is enough to correlate a delivery with a request
// without leaving a working reset link in the logs.
func (sender *Sender) SendPasswordReset(ctx context.Context, to, token string) error {
	link := sender.publicURL + "/reset-password?token=" + token
	logoURL := sender.publicURL + "/static/img/logo-light.png"

	return sender.send(ctx, to, "Reset your Moogo password",
		passwordResetHTML(link, logoURL), token)
}

// SendEmailVerification emails the confirmation link for a new account.
//
// A registration cannot sign in until this link is followed, so a failure here
// is reported to the caller rather than swallowed: the account exists but is
// unusable, and the person needs to be told to ask for another link.
func (sender *Sender) SendEmailVerification(ctx context.Context, to, token string) error {
	link := sender.publicURL + "/verify-email?token=" + token
	logoURL := sender.publicURL + "/static/img/logo-light.png"

	return sender.send(ctx, to, "Confirm your Moogo email address",
		verificationHTML(link, logoURL), token)
}

// SendProjectCreated emails the project details to the owner upon creation.
//
// This includes the project credentials (shown only once), bucket information,
// and a welcome message. The email is best-effort: a failure is logged but
// does not fail the project creation request.
func (sender *Sender) SendProjectCreated(
	ctx context.Context,
	to string,
	projectName string,
	projectID string,
	secretKey string,
	apiURL string,
) error {
	link := apiURL + "/p/" + projectID
	logoURL := sender.publicURL + "/static/img/logo-light.png"
	return sender.send(ctx, to, "Your Moogo project is ready",
		projectCreatedHTML(projectName, projectID, secretKey, link, logoURL), projectID)
}

// SendManualBackupCreated emails a notification when a manual backup completes.
//
// Includes the backup size, timestamp, and a download link. Best-effort: a
// failure is logged but does not fail the backup request.
func (sender *Sender) SendManualBackupCreated(
	ctx context.Context,
	to string,
	projectName string,
	backupSizeBytes int64,
	backupTime time.Time,
	downloadLink string,
) error {
	subject := "Manual backup completed for " + projectName
	logoURL := sender.publicURL + "/static/img/logo-light.png"
	return sender.send(ctx, to, subject,
		manualBackupHTML(projectName, backupSizeBytes, backupTime, downloadLink, logoURL),
		backupTime.Format(time.RFC3339))
}

// send is the single Resend request path.
//
// Both message kinds go through it so the headers, the error mapping, and the
// log shape cannot differ between them. subject and kind are kept as separate
// fields purely so the log line says which message it was: the subject is the
// only stable label, and a log that only recorded "mail sent" would be useless
// when working out whether an account is waiting on a confirmation or a reset.
func (sender *Sender) send(
	ctx context.Context,
	to string,
	subject string,
	html string,
	token string,
) error {
	if sender.apiKey == "" {
		fields := logger.Fields{
			"to":      to,
			"subject": subject,
		}
		if sender.production {
			// Production reaches this line when Google sign-in is configured
			// and Resend is not, and forgot-password/resend-verification do
			// not gate on Enabled(). The link carries a live token, so it is
			// redacted: only the same short prefix the sent path records is
			// kept, which correlates the line with a request without leaving
			// a working credential in the log file.
			fields["link"] = "[redacted]"
			fields["token"] = tokenPrefix(token)
		} else {
			// Development depends on the link being visible: there is no
			// Resend account, and the URL is the only way to complete the
			// flow locally.
			fields["link"] = linkFromHTML(html)
		}
		sender.log.Info("mail: resend not configured, logging instead of sending", fields)
		return nil
	}

	body, err := json.Marshal(resendRequest{
		From:    sender.from,
		To:      []string{to},
		Subject: subject,
		HTML:    html,
	})
	if err != nil {
		return fmt.Errorf("encode mail: %w", err)
	}

	request, err := http.NewRequestWithContext(ctx, http.MethodPost, resendAPI, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("build mail request: %w", err)
	}
	request.Header.Set("Authorization", "Bearer "+sender.apiKey)
	request.Header.Set("Content-Type", "application/json")

	response, err := sender.httpClient.Do(request)
	if err != nil {
		return fmt.Errorf("send mail: %w", err)
	}
	defer response.Body.Close()

	if response.StatusCode < 200 || response.StatusCode >= 300 {
		var detail resendError
		_ = json.NewDecoder(response.Body).Decode(&detail)
		message := detail.Message
		if message == "" {
			message = response.Status
		}
		// Resend's own reason is logged in full because it is the only thing
		// that distinguishes a bad sender domain from a suppressed recipient,
		// and both present to the user as a generic failure.
		sender.log.Warn("mail: resend rejected the message", logger.Fields{
			"status":  response.StatusCode,
			"to":      to,
			"subject": subject,
			"reason":  message,
		})
		return fmt.Errorf("resend returned status %d", response.StatusCode)
	}

	sender.log.Info("mail: sent", logger.Fields{
		"to":      to,
		"subject": subject,
		"token":   tokenPrefix(token),
		"status":  response.StatusCode,
	})
	return nil
}

// linkFromHTML pulls the href back out of a rendered message.
//
// Only used on the development branch of the log-only path, where printing the
// link is the entire point: without a Resend account the link is the only way a
// developer can complete the flow locally. Production takes the redacted branch
// and never calls this.
func linkFromHTML(html string) string {
	const open = `href="`
	start := indexOf(html, open)
	if start < 0 {
		return ""
	}
	rest := html[start+len(open):]
	end := indexOf(rest, `"`)
	if end < 0 {
		return ""
	}
	return rest[:end]
}

// indexOf is strings.Index, kept local so the package's imports stay limited to
// what the HTTP path needs.
func indexOf(haystack, needle string) int {
	for index := 0; index+len(needle) <= len(haystack); index++ {
		if haystack[index:index+len(needle)] == needle {
			return index
		}
	}
	return -1
}

// tokenPrefix returns enough of a token to correlate logs without exposing a
// working reset link.
func tokenPrefix(token string) string {
	if len(token) <= 8 {
		return token
	}
	return token[:8]
}

// passwordResetHTML renders the reset email.
func passwordResetHTML(link, logoURL string) string {
	return messageShell(
		"Reset your Moogo password",
		"We received a request to reset the password for your account. "+
			"Use the button below to choose a new one. If you did not ask for this, "+
			"you can safely ignore this email.",
		"Reset password",
		link,
		logoURL,
	)
}

// verificationHTML renders the address-confirmation email.
//
// The wording leads with what is blocked rather than with what to do, because a
// new registrant cannot sign in yet and the most likely reason they are reading
// this is that they tried to and could not.
func verificationHTML(link, logoURL string) string {
	return messageShell(
		"Confirm your Moogo email address",
		"Your Moogo account is created. Confirm this address to finish setting "+
			"it up &mdash; until you do, you will not be able to sign in. If you did "+
			"not create this account, you can safely ignore this email.",
		"Confirm my email",
		link,
		logoURL,
	)
}

// messageShell is the shared wrapper for both transactional emails.
//
// It is inline-styled because most mail clients strip <style> blocks and
// external stylesheets, and the colours are hardcoded because a mail client
// cannot read the site's design tokens.
func messageShell(title, intro, buttonText, link, logoURL string) string {
	return `<!doctype html>
<html>
  <body style="margin:0;background:#f5f7fa;color:#111827;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
                 style="max-width:520px;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;padding:40px 32px;">
            <tr>
              <td align="center" style="padding-bottom:24px;border-bottom:1px solid #e5e7eb;">
                <img src="`+logoURL+`"
                     alt="Moogo"
                     width="120"
                     style="display:block;border:0;outline:none;text-decoration:none;">
              </td>
            </tr>
            <tr>
              <td style="padding-top:24px;">
                <p style="margin:0 0 16px;font-size:22px;font-weight:600;color:#111827;">` + title + `</p>
                <p style="margin:0 0 24px;color:#6b7280;line-height:1.6;">
                  ` + intro + `
                </p>
                <p style="margin:0 0 8px;">
                  <a href="` + link + `"
                     style="display:inline-block;background:#15803d;color:#ffffff;font-weight:600;
                            text-decoration:none;padding:14px 24px;border-radius:8px;">
                    ` + buttonText + `
                  </a>
                </p>
                <p style="margin:24px 0 0;color:#6b7280;font-size:13px;line-height:1.6;">
                  Or paste this link into your browser:<br/>
                  <a href="` + link + `" style="color:#15803d;word-break:break-all;">` + link + `</a>
                </p>
                <p style="margin:24px 0 0;color:#6b7280;font-size:13px;line-height:1.6;">
                  This link expires soon and can only be used once.
                </p>
                <hr style="margin:32px 0 16px;border:none;border-top:1px solid #e5e7eb;" />
                <p style="margin:0;color:#9ca3af;font-size:12px;line-height:1.5;">
                  &copy; Moogo &mdash; SQLite over HTTP for serverless apps.<br/>
                  If you did not request this, you can safely ignore this email.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

// projectCreatedHTML renders the project creation email with credentials and details.
func projectCreatedHTML(projectName, projectID, secretKey, projectLink, logoURL string) string {
	return `<!doctype html>
<html>
  <body style="margin:0;background:#f5f7fa;color:#111827;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
                 style="max-width:520px;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;padding:40px 32px;">
            <tr>
              <td align="center" style="padding-bottom:24px;border-bottom:1px solid #e5e7eb;">
                <img src="`+logoURL+`"
                     alt="Moogo"
                     width="120"
                     style="display:block;border:0;outline:none;text-decoration:none;">
              </td>
            </tr>
            <tr>
              <td style="padding-top:24px;">
                <p style="margin:0 0 16px;font-size:22px;font-weight:600;color:#111827;">Your Moogo project is ready</p>
                <p style="margin:0 0 24px;color:#6b7280;line-height:1.6;">
                  Your project <strong>`+projectName+`</strong> has been created successfully. 
                  Below are your project credentials and connection details. 
                  <strong>Save the secret key now &mdash; it will not be shown again.</strong>
                </p>
                <p style="margin:0 0 8px;">
                  <a href="`+projectLink+`"
                     style="display:inline-block;background:#15803d;color:#ffffff;font-weight:600;
                            text-decoration:none;padding:14px 24px;border-radius:8px;">
                    Open project dashboard
                  </a>
                </p>
                <p style="margin:24px 0 0;color:#6b7280;font-size:13px;line-height:1.6;">
                  Or paste this link into your browser:<br/>
                  <a href="`+projectLink+`" style="color:#15803d;word-break:break-all;">`+projectLink+`</a>
                </p>
                <hr style="margin:32px 0 16px;border:none;border-top:1px solid #e5e7eb;" />
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;color:#374151;">
                  <tr>
                    <td style="padding:8px 0;font-weight:600;color:#111827;width:30%;">Project ID</td>
                    <td style="padding:8px 0;font-family:monospace;background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:8px 12px;">`+projectID+`</td>
                  </tr>
                  <tr>
                    <td style="padding:8px 0;font-weight:600;color:#111827;">Secret Key</td>
                    <td style="padding:8px 0;font-family:monospace;background:#fef3c7;border:1px solid #fcd34d;border-radius:6px;padding:8px 12px;color:#92400e;"><strong>`+secretKey+`</strong></td>
                  </tr>
                  <tr>
                    <td style="padding:8px 0;font-weight:600;color:#111827;">Project Name</td>
                    <td style="padding:8px 0;">`+projectName+`</td>
                  </tr>
                  <tr>
                    <td style="padding:8px 0;font-weight:600;color:#111827;">API Endpoint</td>
                    <td style="padding:8px 0;font-family:monospace;background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:8px 12px;">`+projectLink+`/db</td>
                  </tr>
                  <tr>
                    <td style="padding:8px 0;font-weight:600;color:#111827;">Bucket Storage</td>
                    <td style="padding:8px 0;">Available at <code>`+projectLink+`/bucket</code> (requires secret key)</td>
                  </tr>
                </table>
                <p style="margin:24px 0 0;color:#6b7280;font-size:13px;line-height:1.6;">
                  <strong>Important:</strong> The secret key above is shown only once. Store it securely &mdash; it provides full access to your project's database and bucket storage. If lost, you can rotate it from the dashboard, but the old key will be invalidated immediately.
                </p>
                <hr style="margin:32px 0 16px;border:none;border-top:1px solid #e5e7eb;" />
                <p style="margin:0;color:#9ca3af;font-size:12px;line-height:1.5;">
                  &copy; Moogo &mdash; SQLite over HTTP for serverless apps.<br/>
                  If you did not request this, you can safely ignore this email.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

// manualBackupHTML renders the manual backup completion email.
func manualBackupHTML(projectName string, backupSizeBytes int64, backupTime time.Time, downloadLink, logoURL string) string {
	sizeStr := formatBytes(backupSizeBytes)
	timeStr := backupTime.Format("2006-01-02 15:04:05 UTC")
	return `<!doctype html>
<html>
  <body style="margin:0;background:#f5f7fa;color:#111827;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
                 style="max-width:520px;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;padding:40px 32px;">
            <tr>
              <td align="center" style="padding-bottom:24px;border-bottom:1px solid #e5e7eb;">
                <img src="`+logoURL+`"
                     alt="Moogo"
                     width="120"
                     style="display:block;border:0;outline:none;text-decoration:none;">
              </td>
            </tr>
            <tr>
              <td style="padding-top:24px;">
                <p style="margin:0 0 16px;font-size:22px;font-weight:600;color:#111827;">Manual backup completed for `+projectName+`</p>
                <p style="margin:0 0 24px;color:#6b7280;line-height:1.6;">
                  A manual backup of <strong>`+projectName+`</strong> has been created and stored off-site.
                </p>
                <p style="margin:0 0 8px;">
                  <a href="`+downloadLink+`"
                     style="display:inline-block;background:#15803d;color:#ffffff;font-weight:600;
                            text-decoration:none;padding:14px 24px;border-radius:8px;">
                    Download backup
                  </a>
                </p>
                <p style="margin:24px 0 0;color:#6b7280;font-size:13px;line-height:1.6;">
                  Or paste this link into your browser:<br/>
                  <a href="`+downloadLink+`" style="color:#15803d;word-break:break-all;">`+downloadLink+`</a>
                </p>
                <hr style="margin:32px 0 16px;border:none;border-top:1px solid #e5e7eb;" />
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;color:#374151;">
                  <tr>
                    <td style="padding:8px 0;font-weight:600;color:#111827;width:30%;">Project</td>
                    <td style="padding:8px 0;">`+projectName+`</td>
                  </tr>
                  <tr>
                    <td style="padding:8px 0;font-weight:600;color:#111827;">Backup Size</td>
                    <td style="padding:8px 0;">`+sizeStr+`</td>
                  </tr>
                  <tr>
                    <td style="padding:8px 0;font-weight:600;color:#111827;">Completed At</td>
                    <td style="padding:8px 0;">`+timeStr+`</td>
                  </tr>
                  <tr>
                    <td style="padding:8px 0;font-weight:600;color:#111827;">Type</td>
                    <td style="padding:8px 0;">Manual (on-demand)</td>
                  </tr>
                </table>
                <p style="margin:24px 0 0;color:#6b7280;font-size:13px;line-height:1.6;">
                  This backup is stored in your configured off-site storage (R2/S3-compatible). 
                  The download link above is valid for 24 hours. After that, you can download the backup 
                  from the project dashboard at any time.
                </p>
                <hr style="margin:32px 0 16px;border:none;border-top:1px solid #e5e7eb;" />
                <p style="margin:0;color:#9ca3af;font-size:12px;line-height:1.5;">
                  &copy; Moogo &mdash; SQLite over HTTP for serverless apps.<br/>
                  If you did not request this, you can safely ignore this email.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

// formatBytes formats bytes as a human-readable string.
func formatBytes(bytes int64) string {
	const unit = 1024
	if bytes < unit {
		return fmt.Sprintf("%d B", bytes)
	}
	div, exp := int64(unit), 0
	for n := bytes / unit; n >= unit; n /= unit {
		div *= unit
		exp++
	}
	return fmt.Sprintf("%.1f %ciB", float64(bytes)/float64(div), "KMGTPE"[exp])
}
