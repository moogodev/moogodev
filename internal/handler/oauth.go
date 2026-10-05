package handler

import (
	"net/http"
	"net/url"

	"github.com/google/uuid"

	"github.com/moogo/moogo/internal/auth"
	"github.com/moogo/moogo/internal/config"
	"github.com/moogo/moogo/pkg/httpx"
	"github.com/moogo/moogo/pkg/logger"
)

// OAuth serves the sign-in endpoints.
type OAuth struct {
	google   *auth.Manager
	sessions *auth.SessionManager
	store    Store
	cfg      config.Config
	log      *logger.Logger
}

// NewOAuth creates an OAuth handler.
func NewOAuth(
	google *auth.Manager,
	sessions *auth.SessionManager,
	store Store,
	cfg config.Config,
	log *logger.Logger,
) *OAuth {
	return &OAuth{google: google, sessions: sessions, store: store, cfg: cfg, log: log}
}

// GoogleRedirect handles GET /auth/google.
//
// It answers with a redirect to Google rather than a JSON body, because the
// flow is entered from a browser address bar, not from JavaScript.
func (handler *OAuth) GoogleRedirect(w http.ResponseWriter, r *http.Request) {
	// If OAuth is not configured, redirect to the setup page.
	if handler.cfg.GoogleClientID == "" || handler.cfg.GoogleClientSecret == "" {
		http.Redirect(w, r, handler.cfg.PublicURL+"/auth/setup", http.StatusFound)
		return
	}

	// next is where the user lands after signing in. It is sanitized inside
	// AuthCodeURL, so an absolute URL here cannot be used as an open redirect.
	redirectTo := handler.cfg.PublicURL + r.URL.Query().Get("next")

	http.Redirect(w, r, handler.google.AuthCodeURL(w, r, redirectTo), http.StatusFound)
}

// GoogleCallback handles GET /auth/google/callback.
//
// On success the user is redirected to the dashboard with a session cookie set.
// On failure the redirect goes to the login page with a reason code rather than
// showing an error page, since the user arrived here from Google and has no
// context on this service.
func (handler *OAuth) GoogleCallback(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query()

	// Google reports a user-declined consent screen the same way as any other
	// error, with no code. Without this branch the handler would try to
	// exchange an empty authorization code.
	if providerError := query.Get("error"); providerError != "" {
		handler.log.Info("oauth denied by provider", logger.Fields{"error": providerError})
		handler.redirectWithFailure(w, r, "denied")
		return
	}

	code := query.Get("code")
	state := query.Get("state")
	if code == "" || state == "" {
		handler.redirectWithFailure(w, r, "invalid_request")
		return
	}

	identity, err := handler.google.CompleteCallback(r.Context(), code, state)
	if err != nil {
		handler.log.Warn("oauth callback failed", logger.Fields{
			"error": err.Error(),
			"path":  r.URL.Path,
		})
		handler.redirectWithFailure(w, r, "failed")
		return
	}

	user, err := handler.store.UpsertUserByEmail(
		r.Context(),
		identity.Email,
		identity.Name,
		identity.AvatarURL,
		handler.cfg.DefaultMaxProjects,
		handler.cfg.DefaultMaxDBBytes,
		handler.cfg.DefaultMaxStorageBytes,
	)
	if err != nil {
		handler.log.Error("upsert user", logger.Fields{
			"error": err.Error(),
			"email": identity.Email,
		})
		handler.redirectWithFailure(w, r, "failed")
		return
	}

	token, err := handler.sessions.Issue(user.ID, user.Email)
	if err != nil {
		handler.log.Error("issue session", logger.Fields{"error": err.Error()})
		handler.redirectWithFailure(w, r, "failed")
		return
	}

	handler.sessions.SetCookie(w, token)

	http.Redirect(w, r, handler.cfg.PublicURL+"/app", http.StatusFound)
}

// Logout handles POST /auth/logout.
//
// POST rather than GET: a GET logout can be triggered by any image tag on any
// page, which lets a third-party site sign the user out.
func (handler *OAuth) Logout(w http.ResponseWriter, r *http.Request) {
	handler.sessions.ClearCookie(w)
	httpx.NoContent(w)
}

// SessionInfo reports the current session, used by the dashboard on load.
type SessionInfo struct {
	Authenticated bool       `json:"authenticated"`
	UserID        *uuid.UUID `json:"user_id,omitempty"`
	Email         string     `json:"email,omitempty"`
	OAuthConfigured bool    `json:"oauth_configured"`
}

// SetupConfig reports whether Google OAuth is configured.
type SetupConfig struct {
	Configured bool `json:"configured"`
}

// Setup handles GET /auth/setup.
//
// Returns the current OAuth configuration status. The frontend uses this to
// decide whether to show the setup page or redirect to Google sign-in.
func (handler *OAuth) Setup(w http.ResponseWriter, r *http.Request) {
	configured := handler.cfg.GoogleClientID != "" && handler.cfg.GoogleClientSecret != ""
	httpx.WriteJSON(w, http.StatusOK, SetupConfig{Configured: configured})
}

// Session handles GET /auth/session.
//
// It answers 200 with authenticated false instead of 401 when nobody is
// signed in: that is the normal state for a visitor, and a dashboard that has
// to catch a 401 on every page load ends up with noisy error reporting.
//
// This route is public, so it verifies the session cookie itself rather than
// reading the user id from the request context — that context is only
// populated by the RequireSession middleware, which this route does not use.
func (handler *OAuth) Session(w http.ResponseWriter, r *http.Request) {
	authenticated := false
	var userID *uuid.UUID
	email := ""

	if claims, err := handler.sessions.ClaimsFromRequest(r); err == nil {
		authenticated = true
		email = claims.Email
		if parsed, err := uuid.Parse(claims.UserID); err == nil {
			userID = &parsed
		}
	}

	httpx.WriteJSON(w, http.StatusOK, SessionInfo{
		Authenticated:   authenticated,
		UserID:          userID,
		Email:           email,
		OAuthConfigured: handler.cfg.GoogleClientID != "" && handler.cfg.GoogleClientSecret != "",
	})
}

// redirectWithFailure sends the browser back to the login page with a reason.
func (handler *OAuth) redirectWithFailure(w http.ResponseWriter, r *http.Request, reason string) {
	http.Redirect(w, r, handler.cfg.PublicURL+"/login?error="+url.QueryEscape(reason), http.StatusFound)
}
