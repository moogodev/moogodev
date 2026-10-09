package news

import (
	"errors"
	"net/http"
	"time"

	"github.com/google/uuid"

	"github.com/moogodev/moogodev/pkg/session"
)

// SessionCookieName is this service's own cookie. It shares neither the name
// scope nor the secret of the dashboard's cookie: the hosts differ, so even a
// name collision would be two independent cookies, but a distinct name keeps
// the two systems from ever being confused in a browser's cookie jar.
const SessionCookieName = "news_session"

// sessionTTL is how long an editor session lives. Long enough to write
// without interruption, short enough that a forgotten tab expires.
const sessionTTL = 12 * time.Hour

// adminUserID identifies the single admin in session claims. Deterministic,
// because there is exactly one admin and nothing else is ever issued.
var adminUserID = uuid.NewSHA1(uuid.NameSpaceURL, []byte("https://moogo.dev/news/admin"))

// Sessions issues and verifies the admin session cookie, on top of the same
// signed-token primitives the main application uses. The token is stateless:
// there is no session table to expire, and rotating NEWS_SESSION_SECRET
// invalidates every session at once.
type Sessions struct {
	signer *session.Signer
	secure bool
}

// NewSessions creates the session manager.
func NewSessions(secret string, secure bool) (*Sessions, error) {
	signer, err := session.NewSigner(secret, sessionTTL)
	if err != nil {
		return nil, err
	}
	return &Sessions{signer: signer, secure: secure}, nil
}

// Issue signs a session for the admin and writes the cookie.
func (sessions *Sessions) Issue(w http.ResponseWriter, email string) error {
	token, err := sessions.signer.Issue(adminUserID.String(), email, 0, time.Now())
	if err != nil {
		return err
	}
	sessions.writeCookie(w, token, int(sessionTTL.Seconds()))
	return nil
}

// Clear expires the cookie on sign-out. The attributes have to match the ones
// used when setting it, or the browser keeps the original.
func (sessions *Sessions) Clear(w http.ResponseWriter) {
	sessions.writeCookie(w, "", -1)
}

// Claims reads and verifies the session cookie on a request.
func (sessions *Sessions) Claims(r *http.Request) (*session.Claims, error) {
	cookie, err := r.Cookie(SessionCookieName)
	if err != nil {
		return nil, ErrNoSession
	}
	return sessions.signer.Verify(cookie.Value, time.Now())
}

// writeCookie writes a host-only cookie: no Domain attribute, so the browser
// scopes it to news.moogo.dev and the dashboard host can never see it.
func (sessions *Sessions) writeCookie(w http.ResponseWriter, value string, maxAge int) {
	http.SetCookie(w, &http.Cookie{
		Name:     SessionCookieName,
		Value:    value,
		Path:     "/",
		MaxAge:   maxAge,
		HttpOnly: true,
		Secure:   sessions.secure,
		SameSite: http.SameSiteLaxMode,
	})
}

// ErrNoSession means no session cookie was present on the request, separate
// from a verification failure so a handler can tell "signed out" from
// "tampered or expired" without duplicating the cookie lookup.
var ErrNoSession = errors.New("news: no session cookie")
