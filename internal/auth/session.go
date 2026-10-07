package auth

import (
	"context"
	"errors"
	"net/http"
	"time"

	"github.com/google/uuid"

	"github.com/moogo/moogo/pkg/session"
)

// ContextKey is the type for values this package stores in a request context.
type ContextKey string

// Context keys for the authenticated principals.
const (
	// ContextKeyUserID holds the signed-in user's UUID.
	ContextKeyUserID ContextKey = "moogo.user_id"
	// ContextKeyProjectID holds the project UUID a data plane request targets.
	ContextKeyProjectID ContextKey = "moogo.project_id"
	// ContextKeyClaims holds the full session claims.
	ContextKeyClaims ContextKey = "moogo.claims"
	// ContextKeyObjectKey holds the bucket object key a route matched, taken
	// from the wildcard segment.
	//
	// The handler reads the key from here rather than stripping a literal
	// prefix off the URL, so the same handler serves any mount point: the
	// public /bucket/{id}/... and the dashboard /api/projects/{id}/bucket/...
	ContextKeyObjectKey ContextKey = "moogo.object_key"
	// ContextKeyCredentialID holds a storage credential's UUID.
	ContextKeyCredentialID ContextKey = "moogo.credential_id"
)

// SessionManager issues and reads session cookies.
type SessionManager struct {
	signer *session.Signer
	// secure sets the Secure cookie flag. It follows the environment: a cookie
	// without Secure leaks over plain HTTP, so it must be on in production.
	secure bool
	// cookieDomain, when set, scopes the cookie to a domain instead of a
	// single host, so a deployment split across subdomains shares one session.
	// Empty keeps the default host-only cookie.
	cookieDomain string
	ttl          time.Duration
}

// NewSessionManager creates a SessionManager.
func NewSessionManager(signer *session.Signer, secure bool) *SessionManager {
	return &SessionManager{
		signer: signer,
		secure: secure,
		ttl:    signer.TTL(),
	}
}

// SetCookieDomain sets the domain the session cookie is scoped to, for
// example ".moogo.dev". Empty keeps the cookie host-only, which is what a
// single-host deployment wants. Call it before any cookie is written.
func (manager *SessionManager) SetCookieDomain(domain string) {
	manager.cookieDomain = domain
}

// Issue creates a session token for a user.
func (manager *SessionManager) Issue(userID uuid.UUID, email string) (string, error) {
	return manager.signer.Issue(userID.String(), email, time.Now())
}

// Verify checks a session token.
func (manager *SessionManager) Verify(token string) (*session.Claims, error) {
	return manager.signer.Verify(token, time.Now())
}

// SetCookie writes the session cookie.
//
// When a cookie domain is configured, the host-only variant is expired in the
// same response first: the browser keeps the two apart by domain, so a
// leftover host-only cookie from before the domain was set would otherwise
// sit next to the new one and be preferred on the host that issued it.
func (manager *SessionManager) SetCookie(w http.ResponseWriter, token string) {
	if manager.cookieDomain != "" {
		manager.writeCookie(w, "", "", -1)
	}
	manager.writeCookie(w, manager.cookieDomain, token, int(manager.ttl.Seconds()))
}

// ClearCookie expires the session cookie.
//
// The attributes must match those used when setting it, or the browser keeps
// the original cookie and the user stays signed in. With a cookie domain
// configured, both the domain and the host-only variant are expired, since
// either may be the one actually stored.
func (manager *SessionManager) ClearCookie(w http.ResponseWriter) {
	manager.writeCookie(w, manager.cookieDomain, "", -1)
	if manager.cookieDomain != "" {
		manager.writeCookie(w, "", "", -1)
	}
}

// writeCookie writes one variant of the session cookie. An empty domain
// produces the host-only form, because http.SetCookie omits the attribute
// entirely then.
func (manager *SessionManager) writeCookie(w http.ResponseWriter, domain, value string, maxAge int) {
	http.SetCookie(w, &http.Cookie{
		Name:     SessionCookieName,
		Value:    value,
		Path:     "/",
		MaxAge:   maxAge,
		HttpOnly: true,
		Secure:   manager.secure,
		SameSite: http.SameSiteLaxMode,
		Domain:   domain,
	})
}

// ErrSessionMissing means no session cookie was present on the request.
//
// It is separate from a verification failure so a handler can distinguish a
// first-time visitor from a tampered or expired cookie.
var ErrSessionMissing = errors.New("no session cookie")

// ClaimsFromRequest reads and verifies the session cookie on a request.
//
// It returns an error when the cookie is absent or invalid, which lets a
// handler tell "not signed in" apart from "signed in as somebody" without
// duplicating the cookie lookup.
func (manager *SessionManager) ClaimsFromRequest(r *http.Request) (*session.Claims, error) {
	cookie, err := r.Cookie(SessionCookieName)
	if err != nil {
		return nil, ErrSessionMissing
	}
	return manager.Verify(cookie.Value)
}

// UserIDFromContext returns the authenticated user's ID.
func UserIDFromContext(ctx context.Context) (uuid.UUID, bool) {
	raw, found := ctx.Value(ContextKeyUserID).(string)
	if !found || raw == "" {
		return uuid.Nil, false
	}
	parsed, err := uuid.Parse(raw)
	if err != nil {
		return uuid.Nil, false
	}
	return parsed, true
}

// ProjectIDFromContext returns the project a data plane request targets.
func ProjectIDFromContext(ctx context.Context) (uuid.UUID, bool) {
	raw, found := ctx.Value(ContextKeyProjectID).(string)
	if !found || raw == "" {
		return uuid.Nil, false
	}
	parsed, err := uuid.Parse(raw)
	if err != nil {
		return uuid.Nil, false
	}
	return parsed, true
}

// ObjectKeyFromContext returns the bucket object key the route matched.
//
// It is absent for the listing route, which addresses the whole bucket rather
// than one object.
func ObjectKeyFromContext(ctx context.Context) (string, bool) {
	raw, found := ctx.Value(ContextKeyObjectKey).(string)
	if !found || raw == "" {
		return "", false
	}
	return raw, true
}

// CredentialIDFromContext returns the storage credential a route targets.
func CredentialIDFromContext(ctx context.Context) (uuid.UUID, bool) {
	raw, found := ctx.Value(ContextKeyCredentialID).(string)
	if !found || raw == "" {
		return uuid.Nil, false
	}
	parsed, err := uuid.Parse(raw)
	if err != nil {
		return uuid.Nil, false
	}
	return parsed, true
}

// RequireSession rejects requests without a valid session and stores the user
// ID in the context.
//
// Used on the control plane, where the caller is a signed-in person.
func RequireSession(sessions *SessionManager) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			cookie, err := r.Cookie(SessionCookieName)
			if err != nil {
				writeUnauthorized(w)
				return
			}

			claims, err := sessions.Verify(cookie.Value)
			if err != nil {
				writeUnauthorized(w)
				return
			}

			userID, err := uuid.Parse(claims.UserID)
			if err != nil {
				writeUnauthorized(w)
				return
			}

			ctx := context.WithValue(r.Context(), ContextKeyUserID, userID.String())
			ctx = context.WithValue(ctx, ContextKeyClaims, claims)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// writeUnauthorized returns a 401 with a JSON body.
//
// The message is intentionally generic: telling a caller whether a token was
// absent, expired, or forged would help someone probing the difference.
func writeUnauthorized(w http.ResponseWriter) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusUnauthorized)
	_, _ = w.Write([]byte(`{"error":{"code":"unauthorized","message":"authentication required"}}`))
}
