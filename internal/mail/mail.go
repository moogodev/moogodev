// Package mail sends transactional email through Resend.
//
// It is deliberately narrow: the service sends two kinds of outbound mail today
// (address confirmation and password reset), and both go out through one request
// path so they cannot drift apart on headers, error handling, or logging. When
// no API key is configured the sender writes the message to the log instead of
// calling Resend, so local development works without an account and the links
// are still visible.
package mail

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/moogo/moogo/pkg/logger"
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
}

// New creates a Sender. An empty apiKey switches it to log-only mode.
func New(apiKey, from, publicURL string, log *logger.Logger) *Sender {
	return &Sender{
		apiKey:     apiKey,
		from:       from,
		publicURL:  publicURL,
		log:        log,
		httpClient: &http.Client{Timeout: 15 * time.Second},
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

	return sender.send(ctx, to, "Reset your Moogo password",
		passwordResetHTML(link), token)
}

// SendEmailVerification emails the confirmation link for a new account.
//
// A registration cannot sign in until this link is followed, so a failure here
// is reported to the caller rather than swallowed: the account exists but is
// unusable, and the person needs to be told to ask for another link.
func (sender *Sender) SendEmailVerification(ctx context.Context, to, token string) error {
	link := sender.publicURL + "/verify-email?token=" + token

	return sender.send(ctx, to, "Confirm your Moogo email address",
		verificationHTML(link), token)
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
		sender.log.Info("mail: resend not configured, logging instead of sending", logger.Fields{
			"to":      to,
			"subject": subject,
			"link":    linkFromHTML(html),
		})
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
// Only used on the log-only path, where printing the link is the entire point:
// without a Resend account the link is the only way a developer can complete
// the flow locally.
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
func passwordResetHTML(link string) string {
	return messageShell(
		"Reset your Moogo password",
		"We received a request to reset the password for your account. "+
			"Use the button below to choose a new one. If you did not ask for this, "+
			"you can safely ignore this email.",
		"Reset password",
		link,
	)
}

// verificationHTML renders the address-confirmation email.
//
// The wording leads with what is blocked rather than with what to do, because a
// new registrant cannot sign in yet and the most likely reason they are reading
// this is that they tried to and could not.
func verificationHTML(link string) string {
	return messageShell(
		"Confirm your Moogo email address",
		"Your Moogo account is created. Confirm this address to finish setting "+
			"it up &mdash; until you do, you will not be able to sign in. If you did "+
			"not create this account, you can safely ignore this email.",
		"Confirm my email",
		link,
	)
}

// messageShell is the shared wrapper for both transactional emails.
//
// It is inline-styled because most mail clients strip <style> blocks and
// external stylesheets, and the colours are hardcoded because a mail client
// cannot read the site's design tokens.
func messageShell(title, intro, buttonText, link string) string {
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
                <img src="https://raw.githubusercontent.com/moogodev/moogo-img/refs/heads/main/1.png" alt="Moogo" width="120" style="display:block;" />
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
