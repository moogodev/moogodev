package config

import (
	"bytes"
	"log"
	"os"
	"regexp"
	"strings"
	"testing"
	"time"
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

// captureLog redirects the standard logger for the duration of one test, so a
// warning's presence or absence can be asserted instead of read by eye.
func captureLog(t *testing.T) *bytes.Buffer {
	t.Helper()
	var buffer bytes.Buffer
	previous := log.Writer()
	log.SetOutput(&buffer)
	t.Cleanup(func() { log.SetOutput(previous) })
	return &buffer
}

// TestKnownServerVariablesDoNotWarn pins the bug where the unknown-variable
// warning used a list that had drifted from the reader: these five are read on
// every start and were each reported as a typo.
//
// Only these keys are asserted on. A deploy gate runs the tests with the
// deployment's own environment inherited, so unrelated MOOGO_* helper values
// such as MOOGO_HEALTHCHECK_URL are legitimately unknown to the server and
// must not turn this regression test into a failure.
func TestKnownServerVariablesDoNotWarn(t *testing.T) {
	// Deployment helpers share the MOOGO_ prefix but are not server settings.
	// Setting one here makes the regression reproduce even on a clean CI box.
	t.Setenv("MOOGO_HEALTHCHECK_URL", "https://app.moogo.dev")
	logged := captureLog(t)

	known := map[string]string{
		"MOOGO_TRUSTED_PROXIES":    "127.0.0.1",
		"MOOGO_QUERY_TIMEOUT":      "15s",
		"MOOGO_SESSION_TTL":        "24h",
		"MOOGO_PASSWORD_RESET_TTL": "1h",
		"MOOGO_VERIFICATION_TTL":   "24h",
	}
	if _, err := loadWith(t, known); err != nil {
		t.Fatalf("known settings should be valid: %v", err)
	}

	for key := range known {
		warning := "unknown MOOGO_* environment variable: " + key + " "
		if strings.Contains(logged.String(), warning) {
			t.Errorf("known setting %s produced an unknown-variable warning:\n%s", key, logged.String())
		}
	}
}

// TestEveryServerEnvironmentReadIsRegistered is the structural guard: every
// reader call in this file must mark its key, so adding a setting cannot
// reintroduce the false-positive warning by forgetting a second list.
func TestEveryServerEnvironmentReadIsRegistered(t *testing.T) {
	source, err := os.ReadFile("config.go")
	if err != nil {
		t.Fatalf("read config.go: %v", err)
	}

	pattern := regexp.MustCompile(`reader\.(string|requiredString|int|int64|duration|bool)\("(MOOGO_[A-Z0-9_]+)"`)
	matches := pattern.FindAllStringSubmatch(string(source), -1)
	if len(matches) == 0 {
		t.Fatal("no reader calls found; the pattern no longer matches the code")
	}

	reader := newEnvReader()
	for _, match := range matches {
		key := match[2]
		switch match[1] {
		case "string":
			reader.string(key, "")
		case "requiredString":
			reader.requiredString(key)
		case "int":
			reader.int(key, 0)
		case "int64":
			reader.int64(key, 0)
		case "duration":
			reader.duration(key, 0)
		case "bool":
			reader.bool(key, false)
		default:
			t.Fatalf("unhandled reader method %q", match[1])
		}
	}

	for _, match := range matches {
		if !reader.known[match[2]] {
			t.Errorf("reader call for %s does not register the key", match[2])
		}
	}
}

// TestUnknownServerVariableWarns is the other side: the warning still catches a
// genuine typo rather than being silently removed to make the false positive
// go away.
func TestUnknownServerVariableWarns(t *testing.T) {
	logged := captureLog(t)

	if _, err := loadWith(t, map[string]string{
		"MOOGO_NOT_A_REAL_SETTING": "1",
	}); err != nil {
		t.Fatalf("an unknown variable should not invalidate the configuration: %v", err)
	}

	if !strings.Contains(logged.String(), "MOOGO_NOT_A_REAL_SETTING") {
		t.Errorf("unknown variable was not reported:\n%s", logged.String())
	}
}

func TestBackupsAreOffByDefault(t *testing.T) {
	cfg, err := loadWith(t, nil)
	if err != nil {
		t.Fatalf("defaults should be valid: %v", err)
	}
	if cfg.BackupEnabled {
		t.Errorf("BackupEnabled = true, want false by default")
	}
}

func TestBackupsRequireTheirStorageSettings(t *testing.T) {
	// Enabled but with nothing else set: all four required keys are missing.
	_, err := loadWith(t, map[string]string{"MOOGO_BACKUP_ENABLED": "true"})
	if err == nil {
		t.Fatal("expected a validation error when backups are enabled without storage settings")
	}
	for _, key := range []string{
		"MOOGO_BACKUP_ENDPOINT",
		"MOOGO_BACKUP_BUCKET",
		"MOOGO_BACKUP_ACCESS_KEY",
		"MOOGO_BACKUP_SECRET_KEY",
	} {
		if !strings.Contains(err.Error(), key) {
			t.Errorf("error should name %s, got %q", key, err.Error())
		}
	}
}

func TestBackupsAcceptACompleteConfiguration(t *testing.T) {
	cfg, err := loadWith(t, map[string]string{
		"MOOGO_BACKUP_ENABLED":    "true",
		"MOOGO_BACKUP_ENDPOINT":   "https://acct.r2.cloudflarestorage.com",
		"MOOGO_BACKUP_BUCKET":     "moogo-backups",
		"MOOGO_BACKUP_ACCESS_KEY": "key",
		"MOOGO_BACKUP_SECRET_KEY": "secret",
	})
	if err != nil {
		t.Fatalf("a complete backup configuration should be valid: %v", err)
	}
	if !cfg.BackupEnabled {
		t.Errorf("BackupEnabled = false, want true")
	}
	if cfg.BackupMaxAge != 24*time.Hour {
		t.Errorf("BackupMaxAge = %v, want 24h", cfg.BackupMaxAge)
	}
}

func TestBackupWindowShorterThanADayIsRejected(t *testing.T) {
	// The daily key is a UTC date, so a sub-day window could overwrite the
	// same day's copy and strand a history row.
	_, err := loadWith(t, map[string]string{
		"MOOGO_BACKUP_ENABLED":    "true",
		"MOOGO_BACKUP_ENDPOINT":   "https://acct.r2.cloudflarestorage.com",
		"MOOGO_BACKUP_BUCKET":     "moogo-backups",
		"MOOGO_BACKUP_ACCESS_KEY": "key",
		"MOOGO_BACKUP_SECRET_KEY": "secret",
		"MOOGO_BACKUP_MAX_AGE":    "6h",
	})
	if err == nil {
		t.Fatal("expected a validation error for a sub-day backup window")
	}
	if !strings.Contains(err.Error(), "MOOGO_BACKUP_MAX_AGE") {
		t.Errorf("error should name MOOGO_BACKUP_MAX_AGE, got %q", err.Error())
	}
}

func TestDefaultsPutAProjectAt256MB(t *testing.T) {
	cfg, err := loadWith(t, nil)
	if err != nil {
		t.Fatalf("defaults should be valid: %v", err)
	}

	if cfg.MaxStorageBytes != 256*1024*1024 {
		t.Errorf("MaxStorageBytes = %d, want 256 MiB", cfg.MaxStorageBytes)
	}
	if cfg.MaxObjectBytes != 256*1024*1024 {
		t.Errorf("MaxObjectBytes = %d, want 256 MiB", cfg.MaxObjectBytes)
	}
	if cfg.MaxDBBytes != 256*1024*1024 {
		t.Errorf("MaxDBBytes = %d, want 256 MiB", cfg.MaxDBBytes)
	}
	if cfg.DefaultMaxDBBytes != 256*1024*1024 {
		t.Errorf("DefaultMaxDBBytes = %d, want 256 MiB", cfg.DefaultMaxDBBytes)
	}
	if cfg.DefaultMaxStorageBytes != 256*1024*1024 {
		t.Errorf("DefaultMaxStorageBytes = %d, want 256 MiB", cfg.DefaultMaxStorageBytes)
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

// TestCDNURLDefaultsToTheBaseURL pins the single-host case: a deployment with
// no CDN host hands public objects out on the data plane, so a public_url is
// never empty and never points at nothing.
func TestCDNURLDefaultsToTheBaseURL(t *testing.T) {
	cfg, err := loadWith(t, nil)
	if err != nil {
		t.Fatalf("defaults should be valid: %v", err)
	}

	if cfg.CDNURL != cfg.BaseURL {
		t.Errorf("CDNURL = %q, want the Base URL %q when no CDN host is set", cfg.CDNURL, cfg.BaseURL)
	}
}

// TestCDNURLIsReadAndTrimmed checks the split-host case: the CDN origin is
// taken from the environment, has no trailing slash, and does not drag the API
// origin with it.
func TestCDNURLIsReadAndTrimmed(t *testing.T) {
	cfg, err := loadWith(t, map[string]string{
		"MOOGO_CDN_URL": "https://cdn.moogo.dev/",
	})
	if err != nil {
		t.Fatalf("load: %v", err)
	}

	if cfg.CDNURL != "https://cdn.moogo.dev" {
		t.Errorf("CDNURL = %q, want the trailing slash trimmed", cfg.CDNURL)
	}
	if cfg.BaseURL == cfg.CDNURL {
		t.Errorf("BaseURL should stay the data-plane origin, got %q", cfg.BaseURL)
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
	// per project while uploads fail at 256 MB for reasons the config does not
	// mention. Failing to start says what is wrong.
	_, err := loadWith(t, map[string]string{
		"MOOGO_MAX_STORAGE_BYTES":         "1073741824",
		"MOOGO_DEFAULT_MAX_STORAGE_BYTES": "1073741824",
		"MOOGO_MAX_OBJECT_BYTES":          "1073741824",
	})
	if err == nil {
		t.Fatal("a 1 GB quota should be rejected, the ceiling is 256 MB")
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
		"MOOGO_BASE_URL":       "https://api.example.com",
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
		"MOOGO_BASE_URL":       "https://api.example.com",
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
		"MOOGO_BASE_URL":      "https://api.example.com",
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
		"MOOGO_BASE_URL":         "https://api.example.com",
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

// MOOGO_ENV is the switch the production rules hang on, so a value the code
// does not branch on must not be accepted as if it meant something. The cost
// of a silent typo here would be a deployment running with development rules:
// an insecure cookie, a published session secret, no mail provider.
func TestUnknownEnvironmentIsRejected(t *testing.T) {
	for _, value := range []string{"prod", "staging", "Production", "dev"} {
		t.Run(value, func(t *testing.T) {
			_, err := loadWith(t, map[string]string{"MOOGO_ENV": value})
			if err == nil {
				t.Fatalf("%q should be rejected", value)
			}
			if !strings.Contains(err.Error(), "MOOGO_ENV") {
				t.Errorf("error does not name the variable: %v", err)
			}
			if !strings.Contains(err.Error(), "production") {
				t.Errorf("error should list the accepted values: %v", err)
			}
		})
	}
}

// The three names the code branches on each start.
func TestEveryEnvironmentTheCodeBranchesOnIsAccepted(t *testing.T) {
	testCases := []struct {
		name       string
		env        string
		overrides  map[string]string
		production bool
	}{
		{"development", "development", nil, false},
		{"test", "test", nil, false},
		{"production", "production", map[string]string{
			"MOOGO_BASE_URL":       "https://api.example.com",
			"MOOGO_COOKIE_SECURE":  "true",
			"MOOGO_SESSION_SECRET": strings.Repeat("x", 45),
			"RESEND_API_KEY":       "re_test",
		}, true},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			overrides := map[string]string{"MOOGO_ENV": testCase.env}
			for key, value := range testCase.overrides {
				overrides[key] = value
			}
			cfg, err := loadWith(t, overrides)
			if err != nil {
				t.Fatalf("%s should be accepted: %v", testCase.env, err)
			}
			if cfg.IsProduction() != testCase.production {
				t.Errorf("IsProduction() = %v, want %v", cfg.IsProduction(), testCase.production)
			}
		})
	}
}
