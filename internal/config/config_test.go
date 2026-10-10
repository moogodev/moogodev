package config

import (
	"strings"
	"testing"
)

// loadWith builds a configuration from environment overrides, on top of the
// values every deployment needs to get past validation.
func loadWith(t *testing.T, overrides map[string]string) (Config, error) {
	t.Helper()

	base := map[string]string{
		"MOOGO_DATABASE_URL":   "postgres://localhost/moogo",
		"MOOGO_SESSION_SECRET": strings.Repeat("k", 40),
	}
	for key, value := range overrides {
		base[key] = value
	}
	for key, value := range base {
		t.Setenv(key, value)
	}

	return Load()
}

func TestDefaultsPutAProjectAt256MB(t *testing.T) {
	cfg, err := loadWith(t, nil)
	if err != nil {
		t.Fatalf("defaults should be valid: %v", err)
	}

	if cfg.MaxStorageBytes != 250*1024*1024 {
		t.Errorf("MaxStorageBytes = %d, want 250 MiB", cfg.MaxStorageBytes)
	}
	if cfg.MaxObjectBytes != 250*1024*1024 {
		t.Errorf("MaxObjectBytes = %d, want 250 MiB", cfg.MaxObjectBytes)
	}
}

// TestDefaultAddrBindsLoopback pins MG-04: without an explicit MOOGO_ADDR
// the API listens on every interface, which turns a deployment that forgot
// the variable into one serving its admin routes to the network. Loopback
// is the safe default; a host that means to expose the port says so.
func TestDefaultAddrBindsLoopback(t *testing.T) {
	cfg, err := loadWith(t, nil)
	if err != nil {
		t.Fatalf("defaults should be valid: %v", err)
	}

	if cfg.Addr != "127.0.0.1:8080" {
		t.Errorf("Addr = %q, want the loopback default 127.0.0.1:8080", cfg.Addr)
	}
}

func TestObjectCapIsSeparateFromTheJSONBodyCap(t *testing.T) {
	cfg, err := loadWith(t, nil)
	if err != nil {
		t.Fatalf("load: %v", err)
	}

	// The JSON cap stays small: a statement or a settings body past a megabyte
	// is a mistake. The object cap has to be the whole quota, or the largest
	// file a project can hold is a fraction of what it is promised.
	if cfg.MaxBodyBytes >= cfg.MaxObjectBytes {
		t.Errorf("MaxBodyBytes = %d and MaxObjectBytes = %d; a JSON cap at or above "+
			"the object cap means the object cap is never the binding one",
			cfg.MaxBodyBytes, cfg.MaxObjectBytes)
	}
}

func TestAQuotaAboveTheCeilingIsRejected(t *testing.T) {
	// Silently clamping would leave an operator believing they provisioned 1 GB
	// per project while uploads fail at 250 MB for reasons the config does not
	// mention. Failing to start says what is wrong.
	_, err := loadWith(t, map[string]string{
		"MOOGO_MAX_STORAGE_BYTES":         "1073741824",
		"MOOGO_DEFAULT_MAX_STORAGE_BYTES": "1073741824",
		"MOOGO_MAX_OBJECT_BYTES":          "1073741824",
	})
	if err == nil {
		t.Fatal("a 1 GB quota should be rejected, the ceiling is 250 MB")
	}
	for _, want := range []string{
		"MOOGO_MAX_STORAGE_BYTES",
		"MOOGO_DEFAULT_MAX_STORAGE_BYTES",
		"MOOGO_MAX_OBJECT_BYTES",
	} {
		if !strings.Contains(err.Error(), want) {
			t.Errorf("error should name %s, got %v", want, err)
		}
	}
}

func TestAQuotaBelowTheCeilingIsAccepted(t *testing.T) {
	if _, err := loadWith(t, map[string]string{
		"MOOGO_MAX_STORAGE_BYTES":         "52428800",
		"MOOGO_DEFAULT_MAX_STORAGE_BYTES": "52428800",
		"MOOGO_MAX_OBJECT_BYTES":          "52428800",
	}); err != nil {
		t.Fatalf("a smaller quota is a supported setting: %v", err)
	}
}

func TestAQuotaBelowOneMegabyteIsRejected(t *testing.T) {
	// The floor exists because the accounting is per byte; a quota of 512 would
	// mean no file can ever be stored, which is a misconfiguration rather than a
	// working zero.
	_, err := loadWith(t, map[string]string{"MOOGO_MAX_STORAGE_BYTES": "512"})
	if err == nil {
		t.Fatal("a sub-megabyte quota should be rejected")
	}
}

func TestDefaultProjectLimitIsTwo(t *testing.T) {
	// The number appears on the landing page and inside the dashboard, both read
	// from here or from the user row seeded by it. A default that drifts from
	// those is a create button that stops working with no explanation.
	cfg, err := loadWith(t, nil)
	if err != nil {
		t.Fatalf("defaults should be valid: %v", err)
	}

	if cfg.DefaultMaxProjects != 2 {
		t.Errorf("DefaultMaxProjects = %d, want 2", cfg.DefaultMaxProjects)
	}
}

func TestProjectLimitStaysOverridable(t *testing.T) {
	// Lowering the free tier is a product decision made in config, not a constant
	// baked into the binary, so a deployment can move it without a rebuild.
	cfg, err := loadWith(t, map[string]string{"MOOGO_DEFAULT_MAX_PROJECTS": "1"})
	if err != nil {
		t.Fatalf("load: %v", err)
	}

	if cfg.DefaultMaxProjects != 1 {
		t.Errorf("DefaultMaxProjects = %d, want 1", cfg.DefaultMaxProjects)
	}
}

func TestAProjectLimitBelowOneIsRejected(t *testing.T) {
	_, err := loadWith(t, map[string]string{"MOOGO_DEFAULT_MAX_PROJECTS": "0"})
	if err == nil {
		t.Fatal("a zero project limit should be rejected: signup would create an account that cannot use the product")
	}
}

// The development secret is published in the repository, and it is longer than
// the minimum length, so the length check alone accepts it. In production that
// would let anyone sign their own session cookies, so it has to be refused.
func TestProductionRejectsThePublishedDevelopmentSecret(t *testing.T) {
	_, err := loadWith(t, map[string]string{
		"MOOGO_ENV":            "production",
		"MOOGO_COOKIE_SECURE":  "true",
		"MOOGO_SESSION_SECRET": "local-dev-session-secret-change-me-0123456789",
		"RESEND_API_KEY":       "re_test",
	})

	if err == nil {
		t.Fatal("the published development secret was accepted in production")
	}
	if !strings.Contains(err.Error(), "MOOGO_SESSION_SECRET is the published development default") {
		t.Errorf("error does not name the problem: %v", err)
	}
}

// Outside production the same value is fine: that is what it is for.
func TestDevelopmentAcceptsThePublishedSecret(t *testing.T) {
	cfg, err := loadWith(t, map[string]string{
		"MOOGO_ENV":            "development",
		"MOOGO_SESSION_SECRET": "local-dev-session-secret-change-me-0123456789",
	})

	if err != nil {
		t.Fatalf("local development should start with it: %v", err)
	}
	if cfg.IsProduction() {
		t.Error("environment was not development")
	}
}

// A real secret of the same length must still be accepted, so the guard is not
// just a length rule wearing a disguise.
func TestProductionAcceptsAGeneratedSecret(t *testing.T) {
	cfg, err := loadWith(t, map[string]string{
		"MOOGO_ENV":            "production",
		"MOOGO_COOKIE_SECURE":  "true",
		"MOOGO_SESSION_SECRET": strings.Repeat("x", 45),
		"RESEND_API_KEY":       "re_test",
	})

	if err != nil {
		t.Fatalf("a generated secret should be accepted: %v", err)
	}
	if cfg.IsProduction() != true {
		t.Error("environment was not production")
	}
}

// Registration is mounted unconditionally, and an account whose
// email_verified_at is NULL is refused at login with nothing to unblock it.
// A production deployment with neither a mail provider nor Google sign-in
// therefore cannot open a single account, and must not boot into it.
func TestProductionRefusesToBootWithNoSignInPath(t *testing.T) {
	_, err := loadWith(t, map[string]string{
		"MOOGO_ENV":           "production",
		"MOOGO_COOKIE_SECURE": "true",
	})

	if err == nil {
		t.Fatal("production started with no way to verify an account")
	}
	if !strings.Contains(err.Error(), "no sign-in path") {
		t.Errorf("error does not name the problem: %v", err)
	}
}

// Google sign-in is an accepted substitute: UpsertUserByEmail sets
// email_verified_at and keeps it on conflict, so somebody who registered by
// password can still open the account through Google.
func TestProductionAcceptsGoogleAsTheOnlySignInPath(t *testing.T) {
	_, err := loadWith(t, map[string]string{
		"MOOGO_ENV":              "production",
		"MOOGO_COOKIE_SECURE":    "true",
		"MOOGO_GOOGLE_CLIENT_ID": "client-id",
	})

	if err != nil {
		t.Fatalf("Google sign-in should satisfy the guard: %v", err)
	}
}

// In development none of this is fatal. A laptop with no provider is how the
// project is normally worked on.
func TestDevelopmentStartsWithNoSignInPath(t *testing.T) {
	cfg, err := loadWith(t, nil)

	if err != nil {
		t.Fatalf("development should start with nothing configured: %v", err)
	}
	if cfg.IsProduction() {
		t.Error("default environment was not development")
	}
}

// A split deployment sets the cookie domain so the apex and the dashboard
// subdomain share one session; the value is taken as given, dot included.
func TestCookieDomainIsAcceptedWithALeadingDot(t *testing.T) {
	cfg, err := loadWith(t, map[string]string{"MOOGO_COOKIE_DOMAIN": ".moogo.dev"})
	if err != nil {
		t.Fatalf("a leading-dot domain should be accepted: %v", err)
	}
	if cfg.CookieDomain != ".moogo.dev" {
		t.Errorf("CookieDomain = %q, want .moogo.dev", cfg.CookieDomain)
	}
}

// Without a leading dot the browser still accepts the attribute, but the
// spelling that is meant is unambiguous, and an operator typing moogo.dev may
// have meant a host rather than a domain. Refusing costs one edit.
func TestCookieDomainWithoutLeadingDotIsRejected(t *testing.T) {
	_, err := loadWith(t, map[string]string{"MOOGO_COOKIE_DOMAIN": "moogo.dev"})
	if err == nil {
		t.Fatal("a domain without a leading dot should be rejected")
	}
	if !strings.Contains(err.Error(), "MOOGO_COOKIE_DOMAIN must start with a dot") {
		t.Errorf("error does not name the problem: %v", err)
	}
}

// A scheme, port, or path in the value is a URL pasted where a domain
// belongs. The browser rejects such a Domain attribute silently, so the cost
// would be a session that never becomes shared — no error anywhere.
func TestCookieDomainRejectsSchemePortAndPath(t *testing.T) {
	testCases := []string{
		"https://moogo.dev",
		".moogo.dev:8443",
		".moogo.dev/",
		".moogo.dev/app",
	}
	for _, value := range testCases {
		t.Run(value, func(t *testing.T) {
			_, err := loadWith(t, map[string]string{"MOOGO_COOKIE_DOMAIN": value})
			if err == nil {
				t.Fatalf("%q should be rejected", value)
			}
			if !strings.Contains(err.Error(), "MOOGO_COOKIE_DOMAIN") {
				t.Errorf("error does not name the variable: %v", err)
			}
		})
	}
}

// Dots alone name no domain at all.
func TestCookieDomainRejectsBareDots(t *testing.T) {
	_, err := loadWith(t, map[string]string{"MOOGO_COOKIE_DOMAIN": "."})
	if err == nil {
		t.Fatal("a bare dot should be rejected")
	}
}

// Single-host deployments must not have to think about this variable.
func TestCookieDomainDefaultsToEmpty(t *testing.T) {
	cfg, err := loadWith(t, nil)
	if err != nil {
		t.Fatalf("defaults should be valid: %v", err)
	}
	if cfg.CookieDomain != "" {
		t.Errorf("CookieDomain = %q, want empty (host-only cookie)", cfg.CookieDomain)
	}
}
