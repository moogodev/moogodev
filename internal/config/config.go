// Package config loads runtime configuration from environment variables.
//
// Every value has a safe default for local development, except the ones that
// touch security: those have no default and must be set explicitly, so a
// misconfigured deployment fails at startup rather than running insecure.
package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"
)

// Config is the validated application configuration.
type Config struct {
	// HTTP server.
	Addr string
	// PublicURL is the origin the browser dashboard is served from, and so the
	// origin the OAuth redirect URI is built from.
	PublicURL string
	// APIURL is the origin a client application is told to talk to: the base of
	// MOOGO_PROJECT_URL and MOOGO_BUCKET_ENDPOINT.
	//
	// It exists because a split deployment puts the dashboard and the data
	// plane on different hostnames, and the value has to be assembled from
	// configuration rather than from the request the credential was issued on —
	// that request arrived at the dashboard, and behind a proxy it arrived over
	// plain HTTP. Defaults to PublicURL, which is what a single-host
	// deployment wants.
	APIURL      string
	ReadTimeout time.Duration
	IdleTimeout time.Duration
	// ShutdownTimeout bounds graceful shutdown after a signal. It must
	// exceed the statement timeout, otherwise a running query would be cut
	// off by shutdown instead of being allowed to finish or report its own
	// error.
	ShutdownTimeout time.Duration

	// Control plane (Postgres).
	DatabaseURL      string
	DBMaxConns       int32
	DBMinConns       int32
	DBConnectTimeout time.Duration

	// Data plane (per-project SQLite files).
	DataDir         string
	MaxDBBytes      int64
	MaxStorageBytes int64
	QueryTimeout    time.Duration
	MaxBodyBytes    int64
	// MaxCachedProjects bounds how many project database handles stay open
	// at once. Past it the least recently used idle handle is closed; the
	// next request for that project reopens it. Without a bound, a
	// deployment that has seen many projects would hold a connection pool
	// for every one of them for the life of the process.
	MaxCachedProjects int

	// MaxObjectBytes caps a single object upload.
	//
	// It is separate from MaxBodyBytes because the two guard different things.
	// MaxBodyBytes bounds a JSON request -- a statement, a settings body -- where
	// anything past a megabyte is a mistake. An upload is a file, so the same
	// limit would cap a project that has 256 MB of storage at 1 MB per upload,
	// and the bucket would then be a quota nobody can ever fill.
	MaxObjectBytes int64

	// Authentication.
	GoogleClientID     string
	GoogleClientSecret string
	SessionSecret      string
	SessionTTL         time.Duration
	CookieSecure       bool
	// CookieDomain scopes the session cookie to a domain instead of a single
	// host, so the landing page on the apex and the dashboard on a subdomain
	// share one session. Empty keeps the cookie host-only. A split deployment
	// sets it to the registrable domain, for example ".moogo.dev".
	CookieDomain string

	// Password reset. TTL bounds how long a reset link stays valid; the token
	// itself is single-use regardless of this window.
	PasswordResetTTL time.Duration

	// Email verification TTL. Separate from PasswordResetTTL because the two
	// are used in different places: a confirmation link is read immediately
	// after registering, while a reset link sits in an inbox for days. Sharing
	// one value would mean either an expired confirmation or a reset link that
	// stays live for far too long.
	VerificationTTL time.Duration

	// Transactional email (Resend). When ResendAPIKey is empty, emails are
	// written to the log instead of sent, which keeps local development usable
	// without a Resend account.
	ResendAPIKey string
	MailFrom     string

	// Quotas. These are the defaults applied to newly created users; the
	// authoritative value lives in the users table so billing can override it.
	DefaultMaxProjects       int
	DefaultMaxDBBytes        int64
	DefaultMaxStorageBytes   int64
	ActivityLogRetentionDays int

	// TrustedProxies lists the addresses allowed to set X-Forwarded-For. Empty
	// means the header is ignored, so a client cannot spoof its own IP for rate
	// limiting and audit logging.
	TrustedProxies string

	// Environment name, used to pick log level and relax local-only rules.
	Environment string
}

// envReader reads typed values from the environment and accumulates every
// problem it finds, so a single run reports all bad values instead of only
// the first.
type envReader struct {
	problems []string
}

func (reader *envReader) string(key, fallback string) string {
	if value := strings.TrimSpace(os.Getenv(key)); value != "" {
		return value
	}
	return fallback
}

func (reader *envReader) requiredString(key string) string {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		reader.problems = append(reader.problems, key+" is required")
	}
	return value
}

func (reader *envReader) int(key string, fallback int) int {
	raw := strings.TrimSpace(os.Getenv(key))
	if raw == "" {
		return fallback
	}
	parsed, err := strconv.Atoi(raw)
	if err != nil {
		reader.problems = append(reader.problems, fmt.Sprintf("%s must be an integer, got %q", key, raw))
		return fallback
	}
	return parsed
}

func (reader *envReader) int64(key string, fallback int64) int64 {
	raw := strings.TrimSpace(os.Getenv(key))
	if raw == "" {
		return fallback
	}
	parsed, err := strconv.ParseInt(raw, 10, 64)
	if err != nil {
		reader.problems = append(reader.problems, fmt.Sprintf("%s must be an integer, got %q", key, raw))
		return fallback
	}
	return parsed
}

func (reader *envReader) duration(key string, fallback time.Duration) time.Duration {
	raw := strings.TrimSpace(os.Getenv(key))
	if raw == "" {
		return fallback
	}
	parsed, err := time.ParseDuration(raw)
	if err != nil {
		reader.problems = append(reader.problems, fmt.Sprintf("%s must be a duration such as 30s, got %q", key, raw))
		return fallback
	}
	return parsed
}

func (reader *envReader) bool(key string, fallback bool) bool {
	raw := strings.TrimSpace(os.Getenv(key))
	if raw == "" {
		return fallback
	}
	parsed, err := strconv.ParseBool(raw)
	if err != nil {
		reader.problems = append(reader.problems, fmt.Sprintf("%s must be a boolean, got %q", key, raw))
		return fallback
	}
	return parsed
}

// Load reads configuration from the environment and returns an error listing
// every invalid or missing required value.
//
// Before anything else it loads a .env file from the working directory, if one
// exists, so a local developer can keep secrets out of the shell. Real
// environment variables always win: a value already set in the process is
// never overwritten by the file.
func Load() (Config, error) {
	loadDotenv(".env")

	reader := &envReader{}

	cfg := Config{
		Addr:            reader.string("MOOGO_ADDR", ":8080"),
		PublicURL:       strings.TrimRight(reader.string("MOOGO_PUBLIC_URL", "http://localhost:8080"), "/"),
		APIURL:          strings.TrimRight(reader.string("MOOGO_API_URL", ""), "/"),
		ReadTimeout:     reader.duration("MOOGO_READ_TIMEOUT", 15*time.Second),
		IdleTimeout:     reader.duration("MOOGO_IDLE_TIMEOUT", 120*time.Second),
		ShutdownTimeout: reader.duration("MOOGO_SHUTDOWN_TIMEOUT", 30*time.Second),

		DatabaseURL:      reader.requiredString("MOOGO_DATABASE_URL"),
		DBMaxConns:       int32(reader.int("MOOGO_DB_MAX_CONNS", 32)),
		DBMinConns:       int32(reader.int("MOOGO_DB_MIN_CONNS", 2)),
		DBConnectTimeout: reader.duration("MOOGO_DB_CONNECT_TIMEOUT", 10*time.Second),

		DataDir:           reader.string("MOOGO_DATA_DIR", "/data"),
		MaxDBBytes:        reader.int64("MOOGO_MAX_DB_BYTES", 100*1024*1024),
		MaxStorageBytes:   reader.int64("MOOGO_MAX_STORAGE_BYTES", 256*1024*1024),
		QueryTimeout:      reader.duration("MOOGO_QUERY_TIMEOUT", 15*time.Second),
		MaxBodyBytes:      reader.int64("MOOGO_MAX_BODY_BYTES", 1*1024*1024),
		MaxObjectBytes:    reader.int64("MOOGO_MAX_OBJECT_BYTES", StorageCeilingBytes),
		MaxCachedProjects: reader.int("MOOGO_MAX_CACHED_PROJECTS", 512),

		GoogleClientID:     reader.string("MOOGO_GOOGLE_CLIENT_ID", ""),
		GoogleClientSecret: reader.string("MOOGO_GOOGLE_CLIENT_SECRET", ""),
		SessionSecret:      reader.requiredString("MOOGO_SESSION_SECRET"),
		SessionTTL:         reader.duration("MOOGO_SESSION_TTL", 7*24*time.Hour),
		CookieSecure:       reader.bool("MOOGO_COOKIE_SECURE", true),
		CookieDomain:       reader.string("MOOGO_COOKIE_DOMAIN", ""),

		PasswordResetTTL: reader.duration("MOOGO_PASSWORD_RESET_TTL", time.Hour),
		VerificationTTL:  reader.duration("MOOGO_VERIFICATION_TTL", 24*time.Hour),

		ResendAPIKey: reader.string("RESEND_API_KEY", ""),
		// The default is Resend's shared onboarding domain, which needs no domain
		// verification. It can only deliver to the address tied to the Resend
		// account, so it is for development; set MOOGO_MAIL_FROM to a verified
		// domain before production.
		MailFrom: reader.string("MOOGO_MAIL_FROM", "Moogo <onboarding@resend.dev>"),

		// Two projects per account, for now.
		//
		// The number is written out here and on the landing page rather than
		// fetched, because a limit a visitor cannot see reads as a bug when they
		// hit it: the create button simply stops working.
		DefaultMaxProjects:       reader.int("MOOGO_DEFAULT_MAX_PROJECTS", 2),
		DefaultMaxDBBytes:        reader.int64("MOOGO_DEFAULT_MAX_DB_BYTES", 100*1024*1024),
		DefaultMaxStorageBytes:   reader.int64("MOOGO_DEFAULT_MAX_STORAGE_BYTES", StorageCeilingBytes),
		ActivityLogRetentionDays: reader.int("MOOGO_ACTIVITY_LOG_RETENTION_DAYS", 7),

		TrustedProxies: reader.string("MOOGO_TRUSTED_PROXIES", ""),
		Environment:    reader.string("MOOGO_ENV", "development"),
	}

	if len(reader.problems) > 0 {
		return Config{}, reader.err()
	}
	// The data plane only has a hostname of its own when a deployment splits it
	// off from the dashboard; otherwise the two are the same host.
	if cfg.APIURL == "" {
		cfg.APIURL = cfg.PublicURL
	}
	if err := cfg.validate(); err != nil {
		return Config{}, err
	}
	return cfg, nil
}

func (reader *envReader) err() error {
	return fmt.Errorf("invalid configuration:\n  - %s", strings.Join(reader.problems, "\n  - "))
}

// IsProduction reports whether the process is running with production
// settings applied.
func (cfg Config) IsProduction() bool {
	return cfg.Environment == "production"
}

func (cfg Config) validate() error {
	var problems []string

	// A cookie domain reaches the browser verbatim, and the browser silently
	// drops a cookie whose Domain attribute it rejects — which would look like
	// sessions randomly not working on a split deployment rather than like a
	// configuration mistake. Reject the shapes that get rejected.
	if cfg.CookieDomain != "" {
		switch {
		case strings.ContainsAny(cfg.CookieDomain, ":/ "):
			problems = append(problems, "MOOGO_COOKIE_DOMAIN must be a bare domain like .moogo.dev, without scheme, port, or path")
		case strings.Trim(cfg.CookieDomain, ".") == "":
			problems = append(problems, "MOOGO_COOKIE_DOMAIN must name a domain, not just dots")
		case !strings.HasPrefix(cfg.CookieDomain, "."):
			problems = append(problems, "MOOGO_COOKIE_DOMAIN must start with a dot, for example .moogo.dev")
		}
	}

	if cfg.DBMaxConns < 1 {
		problems = append(problems, "MOOGO_DB_MAX_CONNS must be at least 1")
	}
	if cfg.MaxCachedProjects < 1 {
		problems = append(problems, "MOOGO_MAX_CACHED_PROJECTS must be at least 1")
	}
	if cfg.DBMinConns < 0 || cfg.DBMinConns > cfg.DBMaxConns {
		problems = append(problems, "MOOGO_DB_MIN_CONNS must be between 0 and MOOGO_DB_MAX_CONNS")
	}
	if cfg.QueryTimeout <= 0 {
		problems = append(problems, "MOOGO_QUERY_TIMEOUT must be greater than zero")
	}
	if cfg.MaxDBBytes < minimumBytes {
		problems = append(problems, "MOOGO_MAX_DB_BYTES must be at least 1 MB")
	}
	if cfg.MaxStorageBytes < minimumBytes {
		problems = append(problems, "MOOGO_MAX_STORAGE_BYTES must be at least 1 MB")
	}
	if cfg.MaxBodyBytes < minimumBodyBytes {
		problems = append(problems, "MOOGO_MAX_BODY_BYTES must be at least 1 KB")
	}

	// The 256 MB ceiling is a product decision, not a tuning knob: it is what a
	// project is promised, and it is what the UI and the pricing page say. A
	// larger value is rejected rather than quietly clamped, because a
	// configuration that appears to work and does not is the one nobody can
	// debug from the outside.
	if cfg.MaxStorageBytes > StorageCeilingBytes {
		problems = append(problems, fmt.Sprintf(
			"MOOGO_MAX_STORAGE_BYTES is %d, which is above the %d per-project ceiling",
			cfg.MaxStorageBytes, StorageCeilingBytes))
	}
	if cfg.DefaultMaxStorageBytes > StorageCeilingBytes {
		problems = append(problems, fmt.Sprintf(
			"MOOGO_DEFAULT_MAX_STORAGE_BYTES is %d, which is above the %d per-project ceiling",
			cfg.DefaultMaxStorageBytes, StorageCeilingBytes))
	}
	if cfg.MaxObjectBytes < minimumBytes {
		problems = append(problems, "MOOGO_MAX_OBJECT_BYTES must be at least 1 MB")
	}
	if cfg.MaxObjectBytes > StorageCeilingBytes {
		problems = append(problems, fmt.Sprintf(
			"MOOGO_MAX_OBJECT_BYTES is %d, which is above the %d per-project ceiling",
			cfg.MaxObjectBytes, StorageCeilingBytes))
	}
	if cfg.DefaultMaxProjects < 1 {
		problems = append(problems, "MOOGO_DEFAULT_MAX_PROJECTS must be at least 1")
	}
	if len(cfg.SessionSecret) < minimumSessionSecretLength {
		problems = append(problems, fmt.Sprintf(
			"MOOGO_SESSION_SECRET must be at least %d characters", minimumSessionSecretLength))
	}
	if !strings.HasPrefix(cfg.DatabaseURL, "postgres://") &&
		!strings.HasPrefix(cfg.DatabaseURL, "postgresql://") {
		problems = append(problems, "MOOGO_DATABASE_URL must start with postgres:// or postgresql://")
	}

	// In production a session cookie without the Secure flag leaks over plain
	// HTTP, so it is rejected outright instead of warned about.
	if cfg.IsProduction() && !cfg.CookieSecure {
		problems = append(problems, "MOOGO_COOKIE_SECURE must be true in production")
	}

	// dev.sh ships a working session secret so a laptop can start without
	// setup. Length validation does not help here: that value is longer than
	// the minimum, and it is published in the repository, so anyone can read it
	// and sign their own session cookies. In production that is the same as no
	// authentication at all, so the known value is refused outright.
	if cfg.IsProduction() && isKnownSessionSecret(cfg.SessionSecret) {
		problems = append(problems, "MOOGO_SESSION_SECRET is the published development default; "+
			"generate a real one with `openssl rand -base64 32`")
	}

	// Registration is always mounted, so a deployment with no way to deliver a
	// confirmation email creates accounts that can never be opened: the account
	// is written with email_verified_at NULL, and Login refuses NULL with
	// email_not_verified. Nothing arrives to unblock it, and the retry answers
	// "check your email" for an address that was never written to.
	//
	// Google sign-in is an accepted substitute: UpsertUserByEmail sets
	// email_verified_at and keeps it on conflict, so somebody who registered by
	// password can still open the account through Google. Either path is
	// enough; neither is a deploy that cannot sign a single user in.
	if cfg.IsProduction() && cfg.ResendAPIKey == "" && cfg.GoogleClientID == "" {
		problems = append(problems, "no sign-in path: set RESEND_API_KEY for email confirmation, "+
			"or MOOGO_GOOGLE_CLIENT_ID for Google sign-in, otherwise registration creates "+
			"accounts that can never be verified")
	}

	if len(problems) > 0 {
		return fmt.Errorf("invalid configuration:\n  - %s", strings.Join(problems, "\n  - "))
	}
	return nil
}

// loadDotenv reads a .env file and sets any variables it defines that are not
// already present in the process environment.
//
// It is deliberately small and dependency-free: parse KEY=VALUE lines, ignore
// blanks and comments, strip surrounding quotes. It never errors on a missing
// file — a deployment that sets everything through the real environment simply
// has no .env, and that is a valid configuration.
func loadDotenv(path string) {
	contents, err := os.ReadFile(path)
	if err != nil {
		return
	}

	for _, rawLine := range strings.Split(string(contents), "\n") {
		line := strings.TrimSpace(rawLine)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}

		// "export KEY=VALUE" is a common shell convention; drop the export.
		line = strings.TrimPrefix(line, "export ")

		key, value, found := strings.Cut(line, "=")
		if !found {
			continue
		}
		key = strings.TrimSpace(key)
		if key == "" {
			continue
		}
		value = strings.TrimSpace(value)
		value = stripQuotes(value)

		// A value already in the environment is authoritative.
		if _, alreadySet := os.LookupEnv(key); alreadySet {
			continue
		}
		_ = os.Setenv(key, value)
	}
}

// stripQuotes removes one pair of matching surrounding quotes from a value.
func stripQuotes(value string) string {
	if len(value) >= 2 {
		if (value[0] == '"' && value[len(value)-1] == '"') ||
			(value[0] == '\'' && value[len(value)-1] == '\'') {
			return value[1 : len(value)-1]
		}
	}
	return value
}

// Floor values. Anything below these is a configuration mistake rather than a
// supported setting.
const (
	minimumBytes               = 1024 * 1024
	minimumBodyBytes           = 1024
	minimumSessionSecretLength = 32
)

// knownSessionSecrets are the session secrets that appear in the repository,
// in dev.sh and in .env.example.
//
// They are listed rather than pattern-matched on words like "change" so that
// editing the development script cannot quietly remove the guard and leave
// production running on a value the repository publishes.
var knownSessionSecrets = []string{
	"local-dev-session-secret-change-me-0123456789",
	"change-me-to-a-long-random-string",
}

// isKnownSessionSecret reports whether a session secret is one of the published
// development values.
func isKnownSessionSecret(secret string) bool {
	for _, known := range knownSessionSecrets {
		if secret == known {
			return true
		}
	}
	return false
}

// StorageCeilingBytes is the most one project can hold.
//
// It is a constant rather than only a default because the number appears in the
// dashboard, in the prompt handed to a coding assistant and in the answer to
// "why did my upload fail", and each of those has to be the same number. Making
// it configurable in one direction only would reintroduce exactly the drift this
// prevents.
const StorageCeilingBytes int64 = 256 * 1024 * 1024
