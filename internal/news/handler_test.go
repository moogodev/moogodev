package news

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"io/fs"
	"net/http"
	"net/http/cookiejar"
	"net/http/httptest"
	"net/url"
	"strconv"
	"strings"
	"testing"
	"testing/fstest"

	"golang.org/x/crypto/bcrypt"
)

const (
	testEmail    = "admin@example.com"
	testPassword = "correct horse battery"
)

func testConfig(t *testing.T) Config {
	t.Helper()
	hash, err := bcrypt.GenerateFromPassword([]byte(testPassword), bcrypt.MinCost)
	if err != nil {
		t.Fatalf("hash password: %v", err)
	}
	return Config{
		Environment:       "development",
		SessionSecret:     "test-session-secret-0123456789-abcdef",
		AdminEmail:        testEmail,
		AdminPasswordHash: string(hash),
		CookieSecure:      false,
		TrustedProxies:    []string{"127.0.0.1"},
	}
}

// newTestServer starts the real handler (API + static) on a fresh, seeded
// database. static may be nil to exercise the "frontend not built" path.
func newTestServer(t *testing.T, static fs.FS) *httptest.Server {
	t.Helper()
	store := newTestStore(t)
	if _, err := store.SeedIfEmpty(context.Background()); err != nil {
		t.Fatalf("seed: %v", err)
	}
	server := httptest.NewServer(NewServer(testConfig(t), store, static))
	t.Cleanup(func() {
		server.Close()
		_ = store.Close()
	})
	return server
}

// jarClient is a browser-shaped client: it keeps the session cookie between
// requests, which is exactly what the auth flow under test relies on.
func jarClient(t *testing.T) *http.Client {
	t.Helper()
	jar, err := cookiejar.New(nil)
	if err != nil {
		t.Fatalf("cookie jar: %v", err)
	}
	return &http.Client{Jar: jar}
}

// call performs one request and returns the response plus the decoded JSON
// envelope, if any (204s and non-JSON bodies decode to nil).
func call(t *testing.T, client *http.Client, method, url string, payload any) (*http.Response, map[string]any) {
	t.Helper()
	var body io.Reader
	if payload != nil {
		raw, err := json.Marshal(payload)
		if err != nil {
			t.Fatalf("marshal %s %s: %v", method, url, err)
		}
		body = bytes.NewReader(raw)
	}
	req, err := http.NewRequest(method, url, body)
	if err != nil {
		t.Fatalf("request: %v", err)
	}
	if payload != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	res, err := client.Do(req)
	if err != nil {
		t.Fatalf("%s %s: %v", method, url, err)
	}
	defer res.Body.Close()
	raw, err := io.ReadAll(res.Body)
	if err != nil {
		t.Fatalf("read body: %v", err)
	}
	var decoded map[string]any
	if len(raw) > 0 {
		_ = json.Unmarshal(raw, &decoded)
	}
	return res, decoded
}

func login(t *testing.T, client *http.Client, baseURL, password string) *http.Response {
	t.Helper()
	res, _ := call(t, client, http.MethodPost, baseURL+"/api/login", map[string]string{
		"email":    testEmail,
		"password": password,
	})
	return res
}

func TestHealthzAndSecurityHeaders(t *testing.T) {
	server := newTestServer(t, nil)
	res, body := call(t, server.Client(), http.MethodGet, server.URL+"/healthz", nil)
	if res.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want 200", res.StatusCode)
	}
	if body["status"] != "ok" {
		t.Errorf("body = %v, want status ok", body)
	}
	for header, want := range map[string]string{
		"Content-Security-Policy": "default-src 'self'",
		"X-Content-Type-Options":  "nosniff",
		"X-Frame-Options":         "DENY",
	} {
		if got := res.Header.Get(header); !strings.Contains(got, want) {
			t.Errorf("%s = %q, want it to contain %q", header, got, want)
		}
	}
}

func TestPublicPosts(t *testing.T) {
	server := newTestServer(t, nil)
	res, body := call(t, server.Client(), http.MethodGet, server.URL+"/api/posts", nil)
	if res.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want 200", res.StatusCode)
	}
	posts, ok := body["posts"].([]any)
	if !ok || len(posts) != 3 {
		t.Fatalf("got %d seeded posts, want 3 (body: %v)", len(posts), body)
	}
	newest := posts[0].(map[string]any)
	if newest["slug"] != "spreadsheet-table-editor" {
		t.Errorf("newest slug = %v, want spreadsheet-table-editor", newest["slug"])
	}
}

func TestSameOrigin(t *testing.T) {
	server := newTestServer(t, nil)
	client := jarClient(t)
	if res := login(t, client, server.URL, testPassword); res.StatusCode != http.StatusOK {
		t.Fatalf("login = %d, want 200", res.StatusCode)
	}

	// A write that names another host in Origin is refused before it reaches
	// the handler — this is what a CSRF attempt looks like on arrival.
	req, err := http.NewRequest(http.MethodPost, server.URL+"/api/admin/posts", strings.NewReader(
		`{"slug":"forged","title":"Forged","body":"","published":false}`))
	if err != nil {
		t.Fatalf("request: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Origin", "https://evil.example")
	for _, cookie := range client.Jar.Cookies(mustURL(t, server.URL)) {
		req.AddCookie(cookie)
	}
	res, err := client.Do(req)
	if err != nil {
		t.Fatalf("forged post: %v", err)
	}
	res.Body.Close()
	if res.StatusCode != http.StatusForbidden {
		t.Errorf("cross-origin write = %d, want 403", res.StatusCode)
	}

	// The same write with this server's own Origin succeeds: the guard
	// discriminates on the host, not on the presence of the header.
	req2, err := http.NewRequest(http.MethodPost, server.URL+"/api/admin/posts", strings.NewReader(
		`{"slug":"own-origin","title":"Fine","body":"","published":false}`))
	if err != nil {
		t.Fatalf("request: %v", err)
	}
	req2.Header.Set("Content-Type", "application/json")
	req2.Header.Set("Origin", server.URL)
	for _, cookie := range client.Jar.Cookies(mustURL(t, server.URL)) {
		req2.AddCookie(cookie)
	}
	res2, err := client.Do(req2)
	if err != nil {
		t.Fatalf("own-origin post: %v", err)
	}
	res2.Body.Close()
	if res2.StatusCode != http.StatusCreated {
		t.Errorf("same-origin write = %d, want 201", res2.StatusCode)
	}

	// Login is a write too: a cross-site form of any kind must not be able
	// to drive it, even before a session exists.
	req3, err := http.NewRequest(http.MethodPost, server.URL+"/api/login", strings.NewReader(
		`{"email":"`+testEmail+`","password":"`+testPassword+`"}`))
	if err != nil {
		t.Fatalf("request: %v", err)
	}
	req3.Header.Set("Content-Type", "application/json")
	req3.Header.Set("Origin", "https://evil.example")
	res3, err := server.Client().Do(req3)
	if err != nil {
		t.Fatalf("forged login: %v", err)
	}
	res3.Body.Close()
	if res3.StatusCode != http.StatusForbidden {
		t.Errorf("cross-origin login = %d, want 403", res3.StatusCode)
	}

	// Reads are not guarded: a cross-origin GET needs no CORS answer to be
	// blocked from reading the response, and the public changelog is public.
	req4, err := http.NewRequest(http.MethodGet, server.URL+"/api/posts", nil)
	if err != nil {
		t.Fatalf("request: %v", err)
	}
	req4.Header.Set("Origin", "https://evil.example")
	res4, err := server.Client().Do(req4)
	if err != nil {
		t.Fatalf("cross-origin read: %v", err)
	}
	res4.Body.Close()
	if res4.StatusCode != http.StatusOK {
		t.Errorf("cross-origin read = %d, want 200 (the data is public)", res4.StatusCode)
	}

	// No CORS preflight answer either: OPTIONS is a method error, which is
	// what makes a cross-origin fetch with Content-Type application/json
	// fail in the browser before the request is ever sent.
	res5, _ := call(t, server.Client(), http.MethodOptions, server.URL+"/api/posts", nil)
	if res5.StatusCode != http.StatusMethodNotAllowed {
		t.Errorf("OPTIONS = %d, want 405 (no preflight support)", res5.StatusCode)
	}
}

// mustURL parses server.URL once for cookie-jar lookups.
func mustURL(t *testing.T, raw string) *url.URL {
	t.Helper()
	parsed, err := url.Parse(raw)
	if err != nil {
		t.Fatalf("parse %q: %v", raw, err)
	}
	return parsed
}

func TestGetPostBySlug(t *testing.T) {
	server := newTestServer(t, nil)

	// A published slug answers with the full post.
	res, body := call(t, server.Client(), http.MethodGet, server.URL+"/api/posts/spreadsheet-table-editor", nil)
	if res.StatusCode != http.StatusOK {
		t.Fatalf("published slug = %d, want 200", res.StatusCode)
	}
	post, _ := body["post"].(map[string]any)
	if post["slug"] != "spreadsheet-table-editor" || post["title"] == "" {
		t.Errorf("post = %v, want the spreadsheet entry", post)
	}

	// Unknown slug is a plain 404.
	res, body = call(t, server.Client(), http.MethodGet, server.URL+"/api/posts/no-such-post", nil)
	if res.StatusCode != http.StatusNotFound || errorOf(body) != "not_found" {
		t.Errorf("unknown slug = %d %q, want 404 not_found", res.StatusCode, errorOf(body))
	}

	// A slug that is not slug-shaped is a client error, not a lookup miss.
	res, body = call(t, server.Client(), http.MethodGet, server.URL+"/api/posts/Not%20ASlug", nil)
	if res.StatusCode != http.StatusBadRequest || errorOf(body) != "invalid_input" {
		t.Errorf("malformed slug = %d %q, want 400 invalid_input", res.StatusCode, errorOf(body))
	}

	// A draft is invisible on the public read path: create one through the
	// admin API, then confirm the public endpoint denies it exists.
	client := jarClient(t)
	if res := login(t, client, server.URL, testPassword); res.StatusCode != http.StatusOK {
		t.Fatalf("login = %d, want 200", res.StatusCode)
	}
	res, _ = call(t, client, http.MethodPost, server.URL+"/api/admin/posts", map[string]any{
		"slug": "hidden-draft", "title": "Hidden", "body": "WIP", "published": false,
	})
	if res.StatusCode != http.StatusCreated {
		t.Fatalf("create draft = %d, want 201", res.StatusCode)
	}
	res, body = call(t, server.Client(), http.MethodGet, server.URL+"/api/posts/hidden-draft", nil)
	if res.StatusCode != http.StatusNotFound || errorOf(body) != "not_found" {
		t.Errorf("draft slug = %d %q, want 404 not_found", res.StatusCode, errorOf(body))
	}
}

func TestLoginFlow(t *testing.T) {
	server := newTestServer(t, nil)
	client := jarClient(t)

	// Wrong password and wrong email answer the same error.
	for _, tc := range []struct{ name, email, password string }{
		{"wrong password", testEmail, "nope"},
		{"wrong email", "not-the-admin@example.com", testPassword},
	} {
		res, body := call(t, client, http.MethodPost, server.URL+"/api/login", map[string]string{
			"email": tc.email, "password": tc.password,
		})
		if res.StatusCode != http.StatusUnauthorized {
			t.Errorf("%s: status = %d, want 401", tc.name, res.StatusCode)
		}
		if errorOf(body) != "invalid_credentials" {
			t.Errorf("%s: error = %q, want invalid_credentials", tc.name, errorOf(body))
		}
	}

	// Signed out: /me and the admin API both refuse.
	res, _ := call(t, client, http.MethodGet, server.URL+"/api/me", nil)
	if res.StatusCode != http.StatusUnauthorized {
		t.Errorf("/api/me signed out = %d, want 401", res.StatusCode)
	}
	res, _ = call(t, client, http.MethodGet, server.URL+"/api/admin/posts", nil)
	if res.StatusCode != http.StatusUnauthorized {
		t.Errorf("admin without session = %d, want 401", res.StatusCode)
	}

	// Correct credentials start a session: host-only, HttpOnly, SameSite.
	res = login(t, client, server.URL, testPassword)
	if res.StatusCode != http.StatusOK {
		t.Fatalf("login status = %d, want 200", res.StatusCode)
	}
	var cookie *http.Cookie
	for _, c := range res.Cookies() {
		if c.Name == SessionCookieName {
			cookie = c
		}
	}
	if cookie == nil {
		t.Fatalf("no %s cookie on login", SessionCookieName)
	}
	if !cookie.HttpOnly || cookie.Path != "/" || cookie.SameSite != http.SameSiteLaxMode || cookie.Domain != "" {
		t.Errorf("cookie attributes wrong: %+v", cookie)
	}

	res, body := call(t, client, http.MethodGet, server.URL+"/api/me", nil)
	if res.StatusCode != http.StatusOK || body["email"] != testEmail {
		t.Errorf("/api/me = %d %v, want 200 with the admin email", res.StatusCode, body)
	}

	// Sign out clears the cookie for real.
	res, _ = call(t, client, http.MethodPost, server.URL+"/api/logout", nil)
	if res.StatusCode != http.StatusNoContent {
		t.Errorf("logout = %d, want 204", res.StatusCode)
	}
	res, _ = call(t, client, http.MethodGet, server.URL+"/api/me", nil)
	if res.StatusCode != http.StatusUnauthorized {
		t.Errorf("/api/me after logout = %d, want 401", res.StatusCode)
	}
}

func TestLoginRateLimit(t *testing.T) {
	server := newTestServer(t, nil)
	client := server.Client()

	for attempt := 1; attempt <= 11; attempt++ {
		res, _ := call(t, client, http.MethodPost, server.URL+"/api/login", map[string]string{
			"email": testEmail, "password": "guess",
		})
		switch {
		case attempt < 11 && res.StatusCode != http.StatusUnauthorized:
			t.Errorf("attempt %d: status = %d, want 401", attempt, res.StatusCode)
		case attempt == 11:
			if res.StatusCode != http.StatusTooManyRequests {
				t.Errorf("attempt %d: status = %d, want 429", attempt, res.StatusCode)
			}
			if res.Header.Get("Retry-After") == "" {
				t.Error("429 without Retry-After")
			}
		}
	}
}

func TestAdminCRUD(t *testing.T) {
	server := newTestServer(t, nil)
	client := jarClient(t)
	if res := login(t, client, server.URL, testPassword); res.StatusCode != http.StatusOK {
		t.Fatalf("login = %d, want 200", res.StatusCode)
	}

	// Invalid slugs are rejected before they reach the database — including
	// one shaped as a SQL injection attempt, which the pattern refuses on
	// characters rather than on intent.
	for _, slug := range []string{
		"Bad Slug", "-leading", "double--dash", strings.Repeat("a", 81),
		"'; DROP TABLE posts; --", "x' OR '1'='1",
	} {
		res, body := call(t, client, http.MethodPost, server.URL+"/api/admin/posts", map[string]any{
			"slug": slug, "title": "T", "body": "", "published": false,
		})
		if res.StatusCode != http.StatusBadRequest || errorOf(body) != "invalid_input" {
			t.Errorf("slug %q: status %d error %q, want 400 invalid_input", slug, res.StatusCode, errorOf(body))
		}
	}

	// Create → draft is invisible to the public list.
	res, body := call(t, client, http.MethodPost, server.URL+"/api/admin/posts", map[string]any{
		"slug": "draft-post", "title": "Draft post", "body": "Not ready.", "published": false,
	})
	if res.StatusCode != http.StatusCreated {
		t.Fatalf("create = %d, want 201 (body %v)", res.StatusCode, body)
	}
	post := body["post"].(map[string]any)
	id := int64(post["id"].(float64))

	_, public := call(t, server.Client(), http.MethodGet, server.URL+"/api/posts", nil)
	if len(public["posts"].([]any)) != 3 {
		t.Errorf("public list = %v, want the 3 seeds only", public["posts"])
	}
	_, all := call(t, client, http.MethodGet, server.URL+"/api/admin/posts", nil)
	if len(all["posts"].([]any)) != 4 {
		t.Errorf("admin list = %d posts, want 4", len(all["posts"].([]any)))
	}

	// Duplicate slug conflicts.
	res, body = call(t, client, http.MethodPost, server.URL+"/api/admin/posts", map[string]any{
		"slug": "draft-post", "title": "Collision", "body": "", "published": false,
	})
	if res.StatusCode != http.StatusConflict || errorOf(body) != "slug_taken" {
		t.Errorf("duplicate slug: %d %q, want 409 slug_taken", res.StatusCode, errorOf(body))
	}

	// Update publishes it; it then shows up publicly.
	res, body = call(t, client, http.MethodPut, server.URL+"/api/admin/posts/"+itoa(id), map[string]any{
		"slug": "draft-post", "title": "Now live", "body": "Ready.", "published": true,
	})
	if res.StatusCode != http.StatusOK {
		t.Fatalf("update = %d, want 200 (body %v)", res.StatusCode, body)
	}
	if got := body["post"].(map[string]any); got["title"] != "Now live" || got["published"] != true {
		t.Errorf("updated post = %v", got)
	}
	_, public = call(t, server.Client(), http.MethodGet, server.URL+"/api/posts", nil)
	if len(public["posts"].([]any)) != 4 {
		t.Errorf("public list after publish = %d posts, want 4", len(public["posts"].([]any)))
	}

	// Delete is permanent: a second delete finds nothing.
	res, _ = call(t, client, http.MethodDelete, server.URL+"/api/admin/posts/"+itoa(id), nil)
	if res.StatusCode != http.StatusNoContent {
		t.Errorf("delete = %d, want 204", res.StatusCode)
	}
	res, body = call(t, client, http.MethodDelete, server.URL+"/api/admin/posts/"+itoa(id), nil)
	if res.StatusCode != http.StatusNotFound || errorOf(body) != "not_found" {
		t.Errorf("second delete = %d %q, want 404 not_found", res.StatusCode, errorOf(body))
	}

	// A non-numeric id is a client error, not a server one.
	res, body = call(t, client, http.MethodDelete, server.URL+"/api/admin/posts/abc", nil)
	if res.StatusCode != http.StatusBadRequest || errorOf(body) != "invalid_input" {
		t.Errorf("id abc = %d %q, want 400 invalid_input", res.StatusCode, errorOf(body))
	}
}

func TestStaticFrontend(t *testing.T) {
	static := fstest.MapFS{
		"index.html":    &fstest.MapFile{Data: []byte("<html>changelog</html>")},
		"assets/app.js": &fstest.MapFile{Data: []byte("console.log(1)")},
	}
	server := newTestServer(t, static)
	client := server.Client()

	// The root serves the entry file.
	res, raw := getText(t, client, server.URL+"/")
	if res.StatusCode != http.StatusOK || !strings.Contains(raw, "changelog") {
		t.Errorf("/ = %d %q, want the index page", res.StatusCode, raw)
	}

	// A hashed asset is served verbatim.
	res, raw = getText(t, client, server.URL+"/assets/app.js")
	if res.StatusCode != http.StatusOK || !strings.Contains(raw, "console.log") {
		t.Errorf("/assets/app.js = %d %q, want the asset", res.StatusCode, raw)
	}

	// A client-side route falls back to index.html instead of 404ing.
	res, raw = getText(t, client, server.URL+"/editor")
	if res.StatusCode != http.StatusOK || !strings.Contains(raw, "changelog") {
		t.Errorf("/editor = %d %q, want the index fallback", res.StatusCode, raw)
	}

	// Non-GET to an unknown path is a method error, not a page.
	res, _ = call(t, client, http.MethodPost, server.URL+"/", nil)
	if res.StatusCode != http.StatusMethodNotAllowed {
		t.Errorf("POST / = %d, want 405", res.StatusCode)
	}
}

// getText is a GET that keeps the body as text, for responses that are HTML
// rather than the JSON envelope the other helpers decode.
func getText(t *testing.T, client *http.Client, url string) (*http.Response, string) {
	t.Helper()
	res, err := client.Get(url)
	if err != nil {
		t.Fatalf("GET %s: %v", url, err)
	}
	defer res.Body.Close()
	raw, err := io.ReadAll(res.Body)
	if err != nil {
		t.Fatalf("read %s: %v", url, err)
	}
	return res, string(raw)
}

func TestStaticNotBuilt(t *testing.T) {
	server := newTestServer(t, nil)
	res, body := call(t, server.Client(), http.MethodGet, server.URL+"/editor", nil)
	if res.StatusCode != http.StatusNotFound || errorOf(body) != "not_found" {
		t.Errorf("GET /editor without a build = %d %v, want 404 not_found", res.StatusCode, body)
	}
}

func errorOf(body map[string]any) string {
	if body == nil {
		return ""
	}
	if envelope, ok := body["error"].(map[string]any); ok {
		if code, ok := envelope["code"].(string); ok {
			return code
		}
	}
	return ""
}

func itoa(value int64) string {
	return strconv.FormatInt(value, 10)
}

// The login form posts credentials, so the policy that allows the form to go
// anywhere would be the policy that leaks them. And HSTS has to fire in
// production, where the process only ever sees cleartext and the proxy's
// X-Forwarded-Proto is the only evidence that TLS happened.
func TestSecurityHeadersLockDownFormsAndForwardedHTTPS(t *testing.T) {
	server := newTestServer(t, nil)

	res, _ := call(t, server.Client(), http.MethodGet, server.URL+"/healthz", nil)
	if got := res.Header.Get("Content-Security-Policy"); !strings.Contains(got, "form-action 'self'") {
		t.Errorf("CSP = %q, want form-action 'self'", got)
	}
	// Plain HTTP with no forwarded scheme: HSTS would pin a browser to the
	// origin for a year, so it must be absent.
	if got := res.Header.Get("Strict-Transport-Security"); got != "" {
		t.Errorf("HSTS on plain HTTP = %q, want empty", got)
	}

	request, err := http.NewRequest(http.MethodGet, server.URL+"/healthz", nil)
	if err != nil {
		t.Fatalf("new request: %v", err)
	}
	request.Header.Set("X-Forwarded-Proto", "https")
	forwarded, err := server.Client().Do(request)
	if err != nil {
		t.Fatalf("forwarded request: %v", err)
	}
	defer forwarded.Body.Close()
	if got := forwarded.Header.Get("Strict-Transport-Security"); got == "" {
		t.Error("expected HSTS when the proxy reports https")
	}
}

// A shell without a cache policy outlives the assets it names: ServeFileFS
// sends Last-Modified, so the browser may reuse an index.html that points at
// a hashed bundle a redeploy has already rotated.
func TestStaticCachePolicyFollowsTheFileName(t *testing.T) {
	static := fstest.MapFS{
		"index.html":           {Data: []byte("<!doctype html>")},
		"assets/app-abc123.js": {Data: []byte("js")},
		"favicon.svg":          {Data: []byte("<svg/>")},
	}
	server := newTestServer(t, static)

	testCases := []struct {
		path string
		want string
	}{
		{"/", "no-cache"},
		{"/assets/app-abc123.js", "immutable"},
		{"/favicon.svg", "max-age=3600"},
		// A client-side route falls back to index.html and must carry the
		// same policy as the shell it is.
		{"/editor", "no-cache"},
	}
	for _, testCase := range testCases {
		res, _ := call(t, server.Client(), http.MethodGet, server.URL+testCase.path, nil)
		got := res.Header.Get("Cache-Control")
		if !strings.Contains(got, testCase.want) {
			t.Errorf("GET %s: Cache-Control = %q, want it to contain %q",
				testCase.path, got, testCase.want)
		}
	}
}
