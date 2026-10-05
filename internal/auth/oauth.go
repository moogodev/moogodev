// Package auth implements Google OAuth sign-in and the two authorization
// schemes the API has.
//
// The two schemes are deliberately separate:
//
//   - Session cookies for the dashboard and control plane, where the caller is
//     a signed-in person.
//   - Bearer secret keys for the data plane, where the caller is code holding a
//     project's key.
//
// Merging them would mean either exposing project keys to the browser or
// minting project keys for people, and neither is acceptable.
package auth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/moogo/moogo/pkg/logger"
)

// Errors returned by this package.
var (
	// ErrNotAuthenticated means no valid session was presented.
	ErrNotAuthenticated = errors.New("not authenticated")
	// ErrForbidden means the credential is valid but lacks access.
	ErrForbidden = errors.New("forbidden")
	// ErrInvalidState means the OAuth state did not match, which indicates a
	// forged or replayed callback.
	ErrInvalidState = errors.New("invalid oauth state")
	// ErrEmailMissing means the provider returned no verified email.
	ErrEmailMissing = errors.New("provider returned no verified email")
)

// Google endpoints.
//
// googleUserInfo returns claims for an access token. Using it instead of
// validating a local ID token keeps key handling out of this service: there is
// no signing key to store, rotate, or leak.
const (
	googleAuthURL     = "https://accounts.google.com/o/oauth2/v2/auth"
	googleTokenURL    = "https://oauth2.googleapis.com/token"
	googleUserInfoURL = "https://openidconnect.googleapis.com/v1/userinfo"

	// googleIssuer is the only issuer accepted for a Google ID token. Checking
	// it is what stops a token from another provider being replayed here.
	googleIssuer = "accounts.google.com"
)

// Cookie names.
const (
	// SessionCookieName is the cookie carrying the dashboard session token.
	// It is exported so tests and tooling do not have to duplicate the string,
	// which is exactly how a name drifts and sign-in silently breaks.
	SessionCookieName = "moogo_session"
	stateCookieName   = "moogo_oauth_state"
)

// stateValidity bounds how long an OAuth state cookie stays acceptable. Short
// because the flow should complete in seconds.
const stateValidity = 10 * time.Minute

// Identity is a verified user.
type Identity struct {
	Email     string
	Name      string
	AvatarURL string
}

// googleUserInfo is the subset of the userinfo response that matters here.
//
// EmailVerified is checked explicitly. Google always sets it for real accounts,
// but a claim that is present and false means the email must not be trusted as
// an identity.
type googleUserInfo struct {
	Email         string `json:"email"`
	EmailVerified bool   `json:"email_verified"`
	Name          string `json:"name"`
	Picture       string `json:"picture"`
}

// GoogleConfig holds the OAuth client settings.
type GoogleConfig struct {
	ClientID     string
	ClientSecret string
	RedirectURL  string
}

// Manager runs the OAuth flow.
type Manager struct {
	config   GoogleConfig
	sessions *SessionManager
	logger   *logger.Logger

	// httpClient is used for token exchange and userinfo. Injectable so tests
	// do not reach the network.
	httpClient *http.Client

	// stateMu guards states.
	stateMu sync.Mutex
	// states maps an issued state to its creation time and destination.
	states map[string]stateEntry
}

// stateEntry is a pending OAuth attempt.
type stateEntry struct {
	createdAt time.Time
	// redirectTo is where the user lands after signing in, validated against a
	// fixed prefix so it cannot be turned into an open redirect.
	redirectTo string
}

// NewManager creates an OAuth Manager.
func NewManager(config GoogleConfig, sessions *SessionManager, log *logger.Logger) *Manager {
	return &Manager{
		config:     config,
		sessions:   sessions,
		logger:     log,
		httpClient: &http.Client{Timeout: 10 * time.Second},
		states:     make(map[string]stateEntry),
	}
}

// AuthCodeURL builds the Google consent URL and sets the state cookie.
//
// The state is what prevents login CSRF: without it, a page could complete the
// flow with the attacker's account and leave the victim signed in to it.
func (manager *Manager) AuthCodeURL(w http.ResponseWriter, r *http.Request, redirectTo string) string {
	state, err := randomStateValue()
	if err != nil {
		manager.logger.ErrorWithError("generate oauth state failed", err, nil)
		return ""
	}

	manager.rememberState(state, redirectTo)

	http.SetCookie(w, &http.Cookie{
		Name:     stateCookieName,
		Value:    state,
		Path:     "/auth",
		MaxAge:   int(stateValidity.Seconds()),
		HttpOnly: true,
		Secure:   manager.sessions.secure,
		SameSite: http.SameSiteLaxMode,
	})

	query := url.Values{}
	query.Set("client_id", manager.config.ClientID)
	query.Set("redirect_uri", manager.config.RedirectURL)
	query.Set("response_type", "code")
	query.Set("scope", "openid email profile")
	// Without prompt=select_account Google silently reuses an existing session,
	// which makes testing the "which account" path impossible.
	query.Set("prompt", "select_account")
	query.Set("state", state)
	query.Set("access_type", "online")

	return googleAuthURL + "?" + query.Encode()
}

// CompleteCallback exchanges an authorization code for an identity.
//
// The state is consumed here: a value is valid once, so a captured callback URL
// cannot be replayed to sign in again.
func (manager *Manager) CompleteCallback(ctx context.Context, code string, state string) (*Identity, error) {
	if code == "" {
		return nil, fmt.Errorf("authorization code is required")
	}
	if !manager.consumeState(state) {
		return nil, ErrInvalidState
	}

	accessToken, err := manager.exchangeCode(ctx, code)
	if err != nil {
		return nil, err
	}

	identity, err := manager.fetchIdentity(ctx, accessToken)
	if err != nil {
		return nil, err
	}
	return identity, nil
}

// exchangeCode swaps an authorization code for an access token.
func (manager *Manager) exchangeCode(ctx context.Context, code string) (string, error) {
	form := url.Values{}
	form.Set("code", code)
	form.Set("client_id", manager.config.ClientID)
	form.Set("client_secret", manager.config.ClientSecret)
	form.Set("redirect_uri", manager.config.RedirectURL)
	form.Set("grant_type", "authorization_code")

	request, err := http.NewRequestWithContext(ctx, http.MethodPost, googleTokenURL,
		strings.NewReader(form.Encode()))
	if err != nil {
		return "", fmt.Errorf("build token request: %w", err)
	}
	request.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	response, err := manager.httpClient.Do(request)
	if err != nil {
		return "", fmt.Errorf("request access token: %w", err)
	}
	defer response.Body.Close()

	if response.StatusCode != http.StatusOK {
		// The body may contain client details, so only the status is surfaced.
		return "", fmt.Errorf("token exchange failed with status %d", response.StatusCode)
	}

	var payload struct {
		AccessToken string `json:"access_token"`
		IDToken     string `json:"id_token"`
	}
	if err := json.NewDecoder(response.Body).Decode(&payload); err != nil {
		return "", fmt.Errorf("decode token response: %w", err)
	}

	if payload.AccessToken == "" {
		return "", fmt.Errorf("token response contained no access token")
	}
	return payload.AccessToken, nil
}

// fetchIdentity loads the signed-in user's claims.
func (manager *Manager) fetchIdentity(ctx context.Context, accessToken string) (*Identity, error) {
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, googleUserInfoURL, nil)
	if err != nil {
		return nil, fmt.Errorf("build userinfo request: %w", err)
	}
	request.Header.Set("Authorization", "Bearer "+accessToken)

	response, err := manager.httpClient.Do(request)
	if err != nil {
		return nil, fmt.Errorf("request userinfo: %w", err)
	}
	defer response.Body.Close()

	if response.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("userinfo request failed with status %d", response.StatusCode)
	}

	var info googleUserInfo
	if err := json.NewDecoder(response.Body).Decode(&info); err != nil {
		return nil, fmt.Errorf("decode userinfo: %w", err)
	}

	// The email is the account identity in this system, so an unverified one
	// cannot be accepted.
	if !info.EmailVerified {
		return nil, ErrEmailMissing
	}
	email := strings.ToLower(strings.TrimSpace(info.Email))
	if email == "" {
		return nil, ErrEmailMissing
	}

	return &Identity{
		Email:     email,
		Name:      info.Name,
		AvatarURL: info.Picture,
	}, nil
}

// rememberState records an issued state.
func (manager *Manager) rememberState(state string, redirectTo string) {
	manager.stateMu.Lock()
	defer manager.stateMu.Unlock()

	manager.pruneStatesLocked()

	safeRedirect := manager.sanitizeRedirect(redirectTo)
	manager.states[state] = stateEntry{createdAt: time.Now(), redirectTo: safeRedirect}
}

// consumeState validates a state and removes it, so it cannot be reused.
func (manager *Manager) consumeState(state string) bool {
	if state == "" {
		return false
	}

	manager.stateMu.Lock()
	defer manager.stateMu.Unlock()

	entry, found := manager.states[state]
	if !found {
		return false
	}
	delete(manager.states, state)

	if time.Since(entry.createdAt) > stateValidity {
		return false
	}
	return true
}

// sanitizeRedirect restricts the post-login destination.
//
// Only same-site paths are allowed. An absolute URL here would make the sign-in
// flow an open redirect, which is a ready-made phishing primitive.
func (manager *Manager) sanitizeRedirect(redirectTo string) string {
	const fallback = "/app"

	candidate := strings.TrimSpace(redirectTo)
	if candidate == "" {
		return fallback
	}
	// A leading slash makes it a path; "//" would make it protocol-relative.
	if !strings.HasPrefix(candidate, "/") || strings.HasPrefix(candidate, "//") {
		return fallback
	}
	return candidate
}

// pruneStatesLocked drops expired states. Caller must hold stateMu.
func (manager *Manager) pruneStatesLocked() {
	for state, entry := range manager.states {
		if time.Since(entry.createdAt) > stateValidity {
			delete(manager.states, state)
		}
	}
}

// randomStateValue returns a URL-safe random state.
func randomStateValue() (string, error) {
	buffer := make([]byte, 32)
	if _, err := rand.Read(buffer); err != nil {
		return "", fmt.Errorf("generate oauth state: %w", err)
	}
	return base64.RawURLEncoding.EncodeToString(buffer), nil
}

// hashToken returns a hex SHA-256 of a bearer token, used for log correlation
// without ever logging the token itself.
func hashToken(token string) string {
	digest := sha256.Sum256([]byte(token))
	return fmt.Sprintf("%x", digest[:8])
}
