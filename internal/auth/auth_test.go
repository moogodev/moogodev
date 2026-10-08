package auth

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/moogodev/moogodev/internal/dbcontrol"
	"github.com/moogodev/moogodev/pkg/bucketkey"
	"github.com/moogodev/moogodev/pkg/logger"
	"github.com/moogodev/moogodev/pkg/secretkey"
	"github.com/moogodev/moogodev/pkg/session"
)

// fakeResolver is a ProjectResolver backed by a map.
type fakeResolver struct {
	projects map[uuid.UUID]*dbcontrol.Project
}

func (resolver *fakeResolver) ProjectByID(_ context.Context, projectID uuid.UUID) (*dbcontrol.Project, error) {
	project, found := resolver.projects[projectID]
	if !found {
		return nil, dbcontrol.ErrNotFound
	}
	return project, nil
}

// Storage credential fixtures for the storage auth path.
const (
	testAccessKeyID   = "moogo_ak_testAccessKeyId00"
	testStorageSecret = "moogo_sk_testSecretKeyValue00"
)

// fakeStorageResolver answers both storage credential lookups and project
// lookups, so the lifecycle checks inside the middleware are exercised.
type fakeStorageResolver struct {
	credential *dbcontrol.StorageCredential
	projects   map[uuid.UUID]*dbcontrol.Project
}

func (resolver *fakeStorageResolver) StorageCredentialByAccessKeyID(
	_ context.Context, accessKeyID string,
) (*dbcontrol.StorageCredential, error) {
	if resolver.credential == nil || resolver.credential.AccessKeyID != accessKeyID {
		return nil, dbcontrol.ErrNotFound
	}
	return resolver.credential, nil
}

func (resolver *fakeStorageResolver) ProjectByID(
	_ context.Context, projectID uuid.UUID,
) (*dbcontrol.Project, error) {
	project, found := resolver.projects[projectID]
	if !found {
		return nil, dbcontrol.ErrNotFound
	}
	return project, nil
}

// readyProject creates a project with a known secret key.
func readyProject(t *testing.T) (*dbcontrol.Project, string) {
	t.Helper()

	key, err := secretkey.Generate()
	if err != nil {
		t.Fatalf("generate secret key: %v", err)
	}
	return &dbcontrol.Project{
		ID:              uuid.New(),
		Status:          dbcontrol.ProjectReady,
		SecretKeyHash:   key.Hash,
		SecretKeyPrefix: key.Prefix,
	}, key.Plaintext
}

// requestWithProjectID builds a request whose context carries a project ID,
// which is what the router would do.
func requestWithProjectID(projectID uuid.UUID) *http.Request {
	request := httptest.NewRequest(http.MethodPost, "/db/"+projectID.String()+"/query", nil)
	ctx := context.WithValue(request.Context(), ContextKeyProjectID, projectID.String())
	return request.WithContext(ctx)
}

func TestRequireProjectKeyAcceptsValidKey(t *testing.T) {
	project, plaintext := readyProject(t)
	resolver := &fakeResolver{projects: map[uuid.UUID]*dbcontrol.Project{project.ID: project}}

	handler := RequireProjectKey(resolver)(http.HandlerFunc(
		func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
		}))

	request := requestWithProjectID(project.ID)
	request.Header.Set("Authorization", "Bearer "+plaintext)

	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", recorder.Code)
	}
}

func TestRequireProjectKeyRejectsWrongKey(t *testing.T) {
	project, _ := readyProject(t)
	resolver := &fakeResolver{projects: map[uuid.UUID]*dbcontrol.Project{project.ID: project}}

	handler := RequireProjectKey(resolver)(http.HandlerFunc(
		func(w http.ResponseWriter, r *http.Request) {
			t.Error("handler should not be reached")
		}))

	request := requestWithProjectID(project.ID)
	request.Header.Set("Authorization", "Bearer moogo_wrong_key_wrong_key_wrong_key")

	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", recorder.Code)
	}
}

func TestRequireProjectKeyRejectsUnknownProject(t *testing.T) {
	project, plaintext := readyProject(t)
	resolver := &fakeResolver{projects: map[uuid.UUID]*dbcontrol.Project{project.ID: project}}

	handler := RequireProjectKey(resolver)(http.HandlerFunc(
		func(w http.ResponseWriter, r *http.Request) {
			t.Error("handler should not be reached")
		}))

	// A key that is valid for one project must not authorize a different
	// project ID, even when that ID does not exist.
	request := requestWithProjectID(uuid.New())
	request.Header.Set("Authorization", "Bearer "+plaintext)

	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", recorder.Code)
	}
}

func TestRequireProjectKeyRejectsMissingHeader(t *testing.T) {
	project, _ := readyProject(t)
	resolver := &fakeResolver{projects: map[uuid.UUID]*dbcontrol.Project{project.ID: project}}

	handler := RequireProjectKey(resolver)(http.HandlerFunc(
		func(w http.ResponseWriter, r *http.Request) {
			t.Error("handler should not be reached")
		}))

	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, requestWithProjectID(project.ID))

	if recorder.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", recorder.Code)
	}
}

func TestRequireProjectKeyRejectsNonBearerScheme(t *testing.T) {
	project, plaintext := readyProject(t)
	resolver := &fakeResolver{projects: map[uuid.UUID]*dbcontrol.Project{project.ID: project}}

	handler := RequireProjectKey(resolver)(http.HandlerFunc(
		func(w http.ResponseWriter, r *http.Request) {
			t.Error("handler should not be reached")
		}))

	// HTTP scheme names are case-insensitive per RFC 7235, so mixed case must
	// still work. Anything other than Bearer must fail.
	testCases := []struct {
		name         string
		header       string
		wantAccepted bool
	}{
		{"basic scheme", "Basic " + plaintext, false},
		{"no scheme", plaintext, false},
		{"empty bearer", "Bearer ", false},
		{"mixed case bearer", "bEaReR " + plaintext, true},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			// Each case gets a fresh handler so reaching the inner function is
			// only a failure for the cases that must reject.
			reached := false
			inner := RequireProjectKey(resolver)(http.HandlerFunc(
				func(w http.ResponseWriter, r *http.Request) {
					reached = true
					w.WriteHeader(http.StatusOK)
				}))

			request := requestWithProjectID(project.ID)
			request.Header.Set("Authorization", testCase.header)

			recorder := httptest.NewRecorder()
			inner.ServeHTTP(recorder, request)

			if testCase.wantAccepted {
				if !reached {
					t.Errorf("header %q should authenticate, got %d", testCase.header, recorder.Code)
				}
				return
			}
			if reached {
				t.Errorf("header %q should not authenticate", testCase.header)
			}
		})
	}
	_ = handler
}

func TestRequireProjectKeyRejectsPausedProject(t *testing.T) {
	project, plaintext := readyProject(t)
	project.Status = dbcontrol.ProjectPaused

	resolver := &fakeResolver{projects: map[uuid.UUID]*dbcontrol.Project{project.ID: project}}
	handler := RequireProjectKey(resolver)(http.HandlerFunc(
		func(w http.ResponseWriter, r *http.Request) {
			t.Error("handler should not be reached")
		}))

	request := requestWithProjectID(project.ID)
	request.Header.Set("Authorization", "Bearer "+plaintext)

	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusForbidden {
		t.Errorf("expected 403, got %d", recorder.Code)
	}
	body := recorder.Body.String()
	if !strings.Contains(body, "project_paused") {
		t.Errorf("expected project_paused in body, got %q", body)
	}
}

func TestRequireProjectKeyRejectsPendingProject(t *testing.T) {
	project, plaintext := readyProject(t)
	// A project stuck in pending has a valid key but no usable database yet.
	project.Status = dbcontrol.ProjectPending

	resolver := &fakeResolver{projects: map[uuid.UUID]*dbcontrol.Project{project.ID: project}}
	handler := RequireProjectKey(resolver)(http.HandlerFunc(
		func(w http.ResponseWriter, r *http.Request) {
			t.Error("handler should not be reached")
		}))

	request := requestWithProjectID(project.ID)
	request.Header.Set("Authorization", "Bearer "+plaintext)

	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusForbidden {
		t.Errorf("expected 403, got %d", recorder.Code)
	}
}

func TestRequireProjectKeyRequiresProjectIDInContext(t *testing.T) {
	project, plaintext := readyProject(t)
	resolver := &fakeResolver{projects: map[uuid.UUID]*dbcontrol.Project{project.ID: project}}

	handler := RequireProjectKey(resolver)(http.HandlerFunc(
		func(w http.ResponseWriter, r *http.Request) {
			t.Error("handler should not be reached")
		}))

	// No project ID in the context: the route was mounted without the router's
	// UUID validation step.
	request := httptest.NewRequest(http.MethodPost, "/db/anything/query", nil)
	request.Header.Set("Authorization", "Bearer "+plaintext)

	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", recorder.Code)
	}
}

func TestRequireStorageCredentialRefusesPausedProject(t *testing.T) {
	project, _ := readyProject(t)
	project.Status = dbcontrol.ProjectPaused

	credential := &dbcontrol.StorageCredential{
		ID:            uuid.New(),
		ProjectID:     project.ID,
		AccessKeyID:   testAccessKeyID,
		SecretKeyHash: bucketkey.Hash(testStorageSecret),
	}

	resolver := &fakeStorageResolver{
		credential: credential,
		projects:   map[uuid.UUID]*dbcontrol.Project{project.ID: project},
	}

	handler := RequireStorageCredential(resolver, resolver)(http.HandlerFunc(
		func(w http.ResponseWriter, r *http.Request) {
			t.Error("handler should not be reached")
		}))

	request := requestWithProjectID(project.ID)
	request.Header.Set(StorageAccessKeyHeader, testAccessKeyID)
	request.Header.Set("Authorization", "Bearer "+testStorageSecret)

	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, request)

	// Pausing has to stop storage as well as SQL. Without this check a paused
	// project refused queries while continuing to accept uploads, so the owner
	// would believe everything had stopped while files kept changing.
	if recorder.Code != http.StatusForbidden {
		t.Errorf("expected 403, got %d", recorder.Code)
	}
}

func TestRequireStorageCredentialRefusesUnreadyProject(t *testing.T) {
	project, _ := readyProject(t)
	project.Status = dbcontrol.ProjectPending

	credential := &dbcontrol.StorageCredential{
		ID:            uuid.New(),
		ProjectID:     project.ID,
		AccessKeyID:   testAccessKeyID,
		SecretKeyHash: bucketkey.Hash(testStorageSecret),
	}
	resolver := &fakeStorageResolver{
		credential: credential,
		projects:   map[uuid.UUID]*dbcontrol.Project{project.ID: project},
	}

	handler := RequireStorageCredential(resolver, resolver)(http.HandlerFunc(
		func(w http.ResponseWriter, r *http.Request) {
			t.Error("handler should not be reached")
		}))

	request := requestWithProjectID(project.ID)
	request.Header.Set(StorageAccessKeyHeader, testAccessKeyID)
	request.Header.Set("Authorization", "Bearer "+testStorageSecret)

	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusForbidden {
		t.Errorf("expected 403, got %d", recorder.Code)
	}
}

func TestRequireSessionAcceptsValidCookie(t *testing.T) {
	signer, err := session.NewSigner("a-test-secret-that-is-definitely-long-enough", time.Hour)
	if err != nil {
		t.Fatalf("create signer: %v", err)
	}
	sessions := NewSessionManager(signer, false)

	userID := uuid.New()
	token, err := sessions.Issue(userID, "ketut@example.com")
	if err != nil {
		t.Fatalf("issue: %v", err)
	}

	handler := RequireSession(sessions)(http.HandlerFunc(
		func(w http.ResponseWriter, r *http.Request) {
			resolved, found := UserIDFromContext(r.Context())
			if !found {
				t.Error("user id should be in the context")
			} else if resolved != userID {
				t.Errorf("expected %s, got %s", userID, resolved)
			}
			w.WriteHeader(http.StatusOK)
		}))

	request := httptest.NewRequest(http.MethodGet, "/api/projects", nil)
	request.AddCookie(&http.Cookie{Name: SessionCookieName, Value: token})

	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", recorder.Code)
	}
}

func TestRequireSessionRejectsMissingAndBadCookies(t *testing.T) {
	signer, err := session.NewSigner("a-test-secret-that-is-definitely-long-enough", time.Hour)
	if err != nil {
		t.Fatalf("create signer: %v", err)
	}
	sessions := NewSessionManager(signer, false)

	handler := RequireSession(sessions)(http.HandlerFunc(
		func(w http.ResponseWriter, r *http.Request) {
			t.Error("handler should not be reached")
		}))

	testCases := []struct {
		name  string
		token string
	}{
		{"no cookie", ""},
		{"garbage", "not-a-token"},
		{"no separator", "abcdefghijklmnop"},
		{"wrong secret signature", "eyJ1aWQiOiJ4In0.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			request := httptest.NewRequest(http.MethodGet, "/api/projects", nil)
			if testCase.token != "" {
				request.AddCookie(&http.Cookie{Name: SessionCookieName, Value: testCase.token})
			}

			recorder := httptest.NewRecorder()
			handler.ServeHTTP(recorder, request)

			if recorder.Code != http.StatusUnauthorized {
				t.Errorf("expected 401, got %d", recorder.Code)
			}
		})
	}
}

func TestSetCookieCarriesSecurityFlags(t *testing.T) {
	signer, err := session.NewSigner("a-test-secret-that-is-definitely-long-enough", time.Hour)
	if err != nil {
		t.Fatalf("create signer: %v", err)
	}
	sessions := NewSessionManager(signer, true)

	token, err := sessions.Issue(uuid.New(), "ketut@example.com")
	if err != nil {
		t.Fatalf("issue: %v", err)
	}

	recorder := httptest.NewRecorder()
	sessions.SetCookie(recorder, token)

	cookies := recorder.Result().Cookies()
	if len(cookies) != 1 {
		t.Fatalf("expected 1 cookie, got %d", len(cookies))
	}

	cookie := cookies[0]
	// HttpOnly keeps the session out of reach of XSS.
	if !cookie.HttpOnly {
		t.Error("session cookie must be HttpOnly")
	}
	// Secure keeps it off plain HTTP.
	if !cookie.Secure {
		t.Error("session cookie must be Secure in production mode")
	}
	// SameSite=Lax is what permits the OAuth redirect back from Google while
	// blocking cross-site POSTs.
	if cookie.SameSite != http.SameSiteLaxMode {
		t.Errorf("expected SameSite=Lax, got %v", cookie.SameSite)
	}
}

func TestClearCookieExpiresSession(t *testing.T) {
	signer, err := session.NewSigner("a-test-secret-that-is-definitely-long-enough", time.Hour)
	if err != nil {
		t.Fatalf("create signer: %v", err)
	}
	sessions := NewSessionManager(signer, false)

	recorder := httptest.NewRecorder()
	sessions.ClearCookie(recorder)

	cookies := recorder.Result().Cookies()
	if len(cookies) != 1 {
		t.Fatalf("expected 1 cookie, got %d", len(cookies))
	}
	// A negative MaxAge is what tells the browser to drop it.
	if cookies[0].MaxAge >= 0 {
		t.Errorf("expected a negative MaxAge, got %d", cookies[0].MaxAge)
	}
	if !cookies[0].HttpOnly {
		t.Error("cleared cookie must keep HttpOnly")
	}
}

// The default has to stay host-only: a cookie carrying a Domain attribute on a
// single-host deployment hands the session to every sibling domain, which is
// a wider blast radius than anyone asked for.
func TestSetCookieIsHostOnlyByDefault(t *testing.T) {
	signer, err := session.NewSigner("a-test-secret-that-is-definitely-long-enough", time.Hour)
	if err != nil {
		t.Fatalf("create signer: %v", err)
	}
	sessions := NewSessionManager(signer, false)

	recorder := httptest.NewRecorder()
	sessions.SetCookie(recorder, "token")

	cookies := recorder.Result().Cookies()
	if len(cookies) != 1 {
		t.Fatalf("expected 1 cookie, got %d", len(cookies))
	}
	if cookies[0].Domain != "" {
		t.Errorf("default cookie must be host-only, got Domain=%q", cookies[0].Domain)
	}
}

// With a domain configured the response both expires the host-only leftover
// and writes the domain-scoped cookie, in that order. Without the expire, a
// browser that still holds the old host-only cookie keeps sending it and the
// stale token wins the lookup on the issuing host while every other host
// appears signed out.
func TestSetCookieWithDomainRetiresHostOnlyAndScopes(t *testing.T) {
	signer, err := session.NewSigner("a-test-secret-that-is-definitely-long-enough", time.Hour)
	if err != nil {
		t.Fatalf("create signer: %v", err)
	}
	sessions := NewSessionManager(signer, true)
	sessions.SetCookieDomain(".moogo.dev")

	recorder := httptest.NewRecorder()
	sessions.SetCookie(recorder, "the-token")

	cookies := recorder.Result().Cookies()
	if len(cookies) != 2 {
		t.Fatalf("expected 2 cookies (expire host-only, then domain cookie), got %d", len(cookies))
	}

	retired := cookies[0]
	if retired.Domain != "" {
		t.Errorf("first cookie must retire the host-only variant, got Domain=%q", retired.Domain)
	}
	if retired.MaxAge >= 0 {
		t.Errorf("first cookie must expire the host-only variant, got MaxAge=%d", retired.MaxAge)
	}

	scoped := cookies[1]
	// Go strips the leading dot when writing Domain, so ".moogo.dev" and
	// "moogo.dev" are the same attribute on the wire.
	if strings.TrimPrefix(scoped.Domain, ".") != "moogo.dev" {
		t.Errorf("second cookie must be scoped to moogo.dev, got Domain=%q", scoped.Domain)
	}
	if scoped.MaxAge <= 0 {
		t.Errorf("second cookie must be live, got MaxAge=%d", scoped.MaxAge)
	}
	if scoped.Value != "the-token" {
		t.Errorf("second cookie must carry the token, got %q", scoped.Value)
	}
	if !scoped.HttpOnly || !scoped.Secure || scoped.SameSite != http.SameSiteLaxMode {
		t.Error("domain cookie must keep the security flags of the host-only one")
	}
}

// Signing out must drop both variants. Expiring only the domain cookie would
// leave a host-only one behind that the issuing host keeps sending, so the
// user appears signed in again on the very host they signed out from.
func TestClearCookieWithDomainExpiresBothVariants(t *testing.T) {
	signer, err := session.NewSigner("a-test-secret-that-is-definitely-long-enough", time.Hour)
	if err != nil {
		t.Fatalf("create signer: %v", err)
	}
	sessions := NewSessionManager(signer, false)
	sessions.SetCookieDomain(".moogo.dev")

	recorder := httptest.NewRecorder()
	sessions.ClearCookie(recorder)

	cookies := recorder.Result().Cookies()
	if len(cookies) != 2 {
		t.Fatalf("expected 2 cookies (domain + host-only), got %d", len(cookies))
	}
	for i, cookie := range cookies {
		if cookie.MaxAge >= 0 {
			t.Errorf("cookie %d must be expired, got MaxAge=%d", i, cookie.MaxAge)
		}
	}
	if got := strings.TrimPrefix(cookies[0].Domain, "."); got != "moogo.dev" {
		t.Errorf("first cleared cookie must be the domain variant, got Domain=%q", got)
	}
	if cookies[1].Domain != "" {
		t.Errorf("second cleared cookie must be the host-only variant, got Domain=%q", cookies[1].Domain)
	}
}

func TestSanitizeRedirectRejectsAbsoluteURLs(t *testing.T) {
	manager := NewManager(GoogleConfig{}, nil, nil)

	// An absolute URL here would turn sign-in into an open redirect.
	testCases := []struct {
		input string
		want  string
	}{
		{"", "/app"},
		{"/app", "/app"},
		{"/app/projects/123", "/app/projects/123"},
		{"https://evil.example.com/steal", "/app"},
		{"//evil.example.com/steal", "/app"},
		{"http:/evil", "/app"},
		{"app", "/app"},
	}

	for _, testCase := range testCases {
		if got := manager.sanitizeRedirect(testCase.input); got != testCase.want {
			t.Errorf("sanitizeRedirect(%q) = %q, want %q", testCase.input, got, testCase.want)
		}
	}
}

func TestOAuthStateIsSingleUse(t *testing.T) {
	manager := NewManager(GoogleConfig{}, nil, nil)
	manager.rememberState("state-abc", "/app")

	if !manager.consumeState("state-abc") {
		t.Fatal("the first use of a state should succeed")
	}
	// A captured callback URL must not be replayable.
	if manager.consumeState("state-abc") {
		t.Error("a state should not be usable twice")
	}
}

func TestOAuthStateRejectsUnknownAndEmpty(t *testing.T) {
	manager := NewManager(GoogleConfig{}, nil, nil)

	if manager.consumeState("never-issued") {
		t.Error("an unknown state must be rejected")
	}
	if manager.consumeState("") {
		t.Error("an empty state must be rejected")
	}
}

func TestOAuthStateExpires(t *testing.T) {
	manager := NewManager(GoogleConfig{}, nil, nil)
	manager.states["old"] = stateEntry{
		createdAt: time.Now().Add(-2 * stateValidity),
	}

	if manager.consumeState("old") {
		t.Error("a state older than the validity window must be rejected")
	}
}

// TestFetchIdentityRejectsUnverifiedEmail covers the claim check that decides
// whether a Google account can become a Moogo account.
//
// The email is the identity key in this system, so an unverified email must
// never be accepted.
func TestFetchIdentityRejectsUnverifiedEmail(t *testing.T) {
	manager := NewManager(GoogleConfig{}, nil, logger.Nop())

	responses := map[string]string{
		"/unverified": `{"email":"attacker@example.com","email_verified":false}`,
		"/missing":    `{}`,
		"/blank":      `{"email":"","email_verified":true}`,
	}

	server := newStubServer(t, responses)
	defer server.Close()

	testCases := []struct {
		name    string
		path    string
		wantErr error
	}{
		{"unverified claim", "/unverified", ErrEmailMissing},
		{"no email field", "/missing", ErrEmailMissing},
		{"blank email", "/blank", ErrEmailMissing},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			manager.httpClient = &http.Client{
				Transport: rewriteTransport{base: mustParseURL(t, server.URL), path: testCase.path},
				Timeout:   time.Second,
			}

			identity, err := manager.fetchIdentity(context.Background(), "token")
			if !errors.Is(err, testCase.wantErr) {
				t.Errorf("expected %v, got %v (identity: %+v)", testCase.wantErr, err, identity)
			}
		})
	}
}

func TestFetchIdentityAcceptsVerifiedEmail(t *testing.T) {
	manager := NewManager(GoogleConfig{}, nil, logger.Nop())

	responses := map[string]string{
		"/verified": `{"email":"Ketut@Example.COM","email_verified":true,"name":"Ketut","picture":"https://example.com/a.png"}`,
	}

	server := newStubServer(t, responses)
	defer server.Close()

	manager.httpClient = &http.Client{
		Transport: rewriteTransport{base: mustParseURL(t, server.URL), path: "/verified"},
		Timeout:   time.Second,
	}

	identity, err := manager.fetchIdentity(context.Background(), "token")
	if err != nil {
		t.Fatalf("fetch identity: %v", err)
	}
	// The email is normalized to lowercase so the same person cannot end up
	// with two accounts through differing casing.
	if identity.Email != "ketut@example.com" {
		t.Errorf("expected lowercase email, got %q", identity.Email)
	}
	if identity.Name != "Ketut" {
		t.Errorf("expected name Ketut, got %q", identity.Name)
	}
}

// newStubServer serves canned JSON bodies by path.
func newStubServer(t *testing.T, responses map[string]string) *httptest.Server {
	t.Helper()

	mux := http.NewServeMux()
	for path, body := range responses {
		mux.HandleFunc(path, func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(body))
		})
	}

	server := httptest.NewServer(mux)
	t.Cleanup(server.Close)
	return server
}

// rewriteTransport redirects every request to a stub server, so the production
// URL constants can be exercised without a network call.
type rewriteTransport struct {
	base *url.URL
	path string
}

func (transport rewriteTransport) RoundTrip(request *http.Request) (*http.Response, error) {
	rewritten := request.Clone(request.Context())
	rewritten.URL.Scheme = transport.base.Scheme
	rewritten.URL.Host = transport.base.Host
	rewritten.URL.Path = transport.path
	rewritten.Host = transport.base.Host
	return http.DefaultTransport.RoundTrip(rewritten)
}

// mustParseURL parses a URL or fails the test.
func mustParseURL(t *testing.T, raw string) *url.URL {
	t.Helper()
	parsed, err := url.Parse(raw)
	if err != nil {
		t.Fatalf("parse url %q: %v", raw, err)
	}
	return parsed
}

// TestRequireProjectKeyVerifiesTheKeyBeforeTheStateChecks: the 403s for
// "paused" and "not ready" are statements about the project, and answering
// them before the key is verified hands that information to anyone who can
// guess a project id. The key decides first; only the owner learns the state.
func TestRequireProjectKeyVerifiesTheKeyBeforeTheStateChecks(t *testing.T) {
	testCases := []struct {
		name   string
		status dbcontrol.ProjectStatus
	}{
		{"paused", dbcontrol.ProjectPaused},
		{"pending", dbcontrol.ProjectPending},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			project, _ := readyProject(t)
			project.Status = testCase.status

			resolver := &fakeResolver{projects: map[uuid.UUID]*dbcontrol.Project{project.ID: project}}
			handler := RequireProjectKey(resolver)(http.HandlerFunc(
				func(w http.ResponseWriter, r *http.Request) {
					t.Error("handler should not be reached")
				}))

			request := requestWithProjectID(project.ID)
			request.Header.Set("Authorization", "Bearer moogo_wrong_key")

			recorder := httptest.NewRecorder()
			handler.ServeHTTP(recorder, request)

			if recorder.Code != http.StatusUnauthorized {
				t.Errorf("wrong key on a %s project: got %d, want 401 -- the state must not be revealed before the key verifies",
					testCase.name, recorder.Code)
			}
		})
	}
}
