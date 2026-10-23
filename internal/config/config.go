// Package config loads runtime configuration from environment variables.
//
// Every value has a safe default for local development, except the ones that
// touch security: those have no default and must be set explicitly, so a
// misconfigured deployment fails at startup rather than running insecure.
package config

import (
	"fmt"
	"log"
	"net/url"
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
	// BaseURL is the data-plane origin a client application is told to talk
	// to: the value of MOOGO_BASE_URL. It carries no path — a client appends
	// /p/{project_id} and its own routes.
	//
	// It exists because a split deployment puts the dashboard and the data
	// plane on different hostnames, and the value has to be assembled from
	// configuration rather than from the request the credential was issued on —
	// that request arrived at the dashboard, and behind a proxy it arrived over
	// plain HTTP. Defaults to PublicURL, which is what a single-host
	// deployment wants.
	BaseURL string
	// CDNURL is the origin published objects are served from, so the URL a
	// client is given for a public object points at the CDN host rather than
	// at the data plane. It is the base of an object's public_url; the
	// authenticated url keeps using BaseURL, so a private object never leaks
	// the CDN host and a public one never carries an API credential route.
	// Defaults to BaseURL, which is what a deployment with no separate CDN
	// host wants.
	CDNURL string
	// NewsURL is the What's-new service whose published posts feed the
	// dashboard's update list. The list is fetched over loopback and served
	// on this origin, so the news service needs no CORS route. The default
	// matches the shipped news unit; when news is not running the fetch
	// fails and the list is empty rather than the dashboard erroring.
	NewsURL     string
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

	// Off-site database backups.
	//
	// Backups are optional: with BackupEnabled false none of the other backup
	// values are read, so a deployment that does not want them carries no
	// object-storage credentials at all. When it is true, the endpoint and the
	// credentials must be set or startup fails, because a backup scheduler that
	// silently uploads nowhere is worse than none.
	BackupEnabled bool
	// BackupEndpoint is the S3-compatible base URL, for example
	// https://<account>.r2.cloudflarestorage.com.
	BackupEndpoint string
	// BackupRegion is the SigV4 region; object storage ignores it and R2 uses
	// "auto".
	BackupRegion string
	BackupBucket string
	// BackupAccessKey and BackupSecretKey are the storage credentials.
	BackupAccessKey string
	BackupSecretKey string
	// BackupPrefix is the key prefix every backup object shares, so backups can
	// live beside other data in one bucket without colliding.
	BackupPrefix string
	// BackupInterval is how often the scheduler looks for projects that are due.
	BackupInterval time.Duration
	// BackupMaxAge is how stale a backup may get before the project is due
	// again. The scheduler is "due"-driven rather than pinned to a clock hour:
	// a process restarted at 03:00 still backs up a project whose last
	// successful backup has aged past this window.
	BackupMaxAge time.Duration
	// BackupRetention is how long a backup is kept. The newest backup of a
	// project is always kept regardless of age.
	BackupRetention time.Duration
	// BackupBatchSize caps how many projects one pass handles, so a backlog
	// does not hold the loop for minutes.
	BackupBatchSize int
	// BackupTimeout bounds one project's snapshot-and-upload, and one
	// background restore of the same project.
	BackupTimeout time.Duration
	// BackupDownloadTTL bounds how long a backup download link from a
	// notification email stays valid. The link is single-use regardless; this
	// is only how long an unused one stays live.
	BackupDownloadTTL time.Duration

	// BackupAlertWebhook is where backup alerts are POSTed as JSON. Empty
	// disables delivery.
	BackupAlertWebhook string
	// BackupAlertAfter is how many consecutive backup failures trigger an
	// alert. Zero disables the threshold.
	BackupAlertAfter int

	// BackupVerifyInterval is how often the restore drill looks for work.
	BackupVerifyInterval time.Duration
	// BackupVerifyMaxAge is how long a passing drill verdict is trusted.
	BackupVerifyMaxAge time.Duration
	// BackupVerifyBatchSize caps how many projects one drill pass handles.
	BackupVerifyBatchSize int

	// Environment name, used to pick log level and relax local-only rules.
	Environment string
}

// envReader reads typed values from the environment and accumulates every
// problem it finds, so a single run reports all bad values instead of only
// the first.
type envReader struct {
	problems []string
	// known is every MOOGO_* name this loader actually reads, recorded by the
	// getters below. The unknown-variable warning is derived from it rather
	// than from a second hand-maintained list, so a new setting cannot be
	// added here and then be reported as a typo on every start.
	known map[string]bool
}

// newEnvReader returns a reader that already accepts the deprecated names the
// server no longer reads on every path. They stay accepted so an older
// environment file keeps starting without a warning that looks like a typo.
func newEnvReader() *envReader {
	reader := &envReader{known: make(map[string]bool, 64)}
	for key := range acceptedMoogoEnv {
		reader.known[key] = true
	}
	return reader
}

// mark records a key the loader read.
func (reader *envReader) mark(key string) {
	reader.known[key] = true
}

func (reader *envReader) string(key, fallback string) string {
	reader.mark(key)
	if value := strings.TrimSpace(os.Getenv(key)); value != "" {
		return value
	}
	return fallback
}

func (reader *envReader) requiredString(key string) string {
	reader.mark(key)
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		reader.problems = append(reader.problems, key+" is required")
	}
	return value
}

func (reader *envReader) int(key string, fallback int) int {
	reader.mark(key)
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
	reader.mark(key)
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
	reader.mark(key)
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
	reader.mark(key)
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

	reader := newEnvReader()
	// Warn once the loader knows which names it actually read. Doing this at
	// the start against a separate list is what made a valid setting look like
	// a typo whenever the two drifted.
	defer warnUnknownMoogoEnv(reader.known)

	cfg := Config{
		Addr:            reader.string("MOOGO_ADDR", "127.0.0.1:8080"),
		PublicURL:       strings.TrimRight(reader.string("MOOGO_PUBLIC_URL", "http://localhost:8080"), "/"),
		BaseURL:         strings.TrimRight(reader.string("MOOGO_BASE_URL", ""), "/"),
		CDNURL:          strings.TrimRight(reader.string("MOOGO_CDN_URL", ""), "/"),
		NewsURL:         strings.TrimRight(reader.string("MOOGO_NEWS_URL", "http://127.0.0.1:8081"), "/"),
		ReadTimeout:     reader.duration("MOOGO_READ_TIMEOUT", 15*time.Second),
		IdleTimeout:     reader.duration("MOOGO_IDLE_TIMEOUT", 120*time.Second),
		ShutdownTimeout: reader.duration("MOOGO_SHUTDOWN_TIMEOUT", 30*time.Second),

		DatabaseURL:      reader.requiredString("MOOGO_DATABASE_URL"),
		DBMaxConns:       int32(reader.int("MOOGO_DB_MAX_CONNS", 32)),
		DBMinConns:       int32(reader.int("MOOGO_DB_MIN_CONNS", 2)),
		DBConnectTimeout: reader.duration("MOOGO_DB_CONNECT_TIMEOUT", 10*time.Second),

		DataDir:           reader.string("MOOGO_DATA_DIR", "/data"),
		MaxDBBytes:        reader.int64("MOOGO_MAX_DB_BYTES", 256*1024*1024),
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
		DefaultMaxDBBytes:        reader.int64("MOOGO_DEFAULT_MAX_DB_BYTES", 256*1024*1024),
		DefaultMaxStorageBytes:   reader.int64("MOOGO_DEFAULT_MAX_STORAGE_BYTES", StorageCeilingBytes),
		ActivityLogRetentionDays: reader.int("MOOGO_ACTIVITY_LOG_RETENTION_DAYS", 7),

		TrustedProxies: reader.string("MOOGO_TRUSTED_PROXIES", ""),
		Environment:    reader.string("MOOGO_ENV", "development"),

		BackupEnabled:   reader.bool("MOOGO_BACKUP_ENABLED", false),
		BackupEndpoint:  strings.TrimRight(reader.string("MOOGO_BACKUP_ENDPOINT", ""), "/"),
		BackupRegion:    reader.string("MOOGO_BACKUP_REGION", "auto"),
		BackupBucket:    reader.string("MOOGO_BACKUP_BUCKET", ""),
		BackupAccessKey: reader.string("MOOGO_BACKUP_ACCESS_KEY", ""),
		BackupSecretKey: reader.string("MOOGO_BACKUP_SECRET_KEY", ""),
		BackupPrefix:    strings.Trim(reader.string("MOOGO_BACKUP_PREFIX", "database-backups"), "/"),
		BackupInterval:  reader.duration("MOOGO_BACKUP_INTERVAL", 15*time.Minute),
		BackupMaxAge:    reader.duration("MOOGO_BACKUP_MAX_AGE", 24*time.Hour),
		BackupRetention: reader.duration("MOOGO_BACKUP_RETENTION", 30*24*time.Hour),
		BackupBatchSize: reader.int("MOOGO_BACKUP_BATCH_SIZE", 20),
		BackupTimeout:   reader.duration("MOOGO_BACKUP_TIMEOUT", 15*time.Minute),

		// A download link from an email is single-use; one hour is enough for
		// someone to open a just-sent message without leaving a live, replayable
		// link sitting in an inbox for a day.
		BackupDownloadTTL: reader.duration("MOOGO_BACKUP_DOWNLOAD_TTL", time.Hour),

		// Alerting on a failing backup is opt-in: the metric is always exposed,
		// but a webhook only fires when an operator has set one.
		BackupAlertWebhook: reader.string("MOOGO_BACKUP_ALERT_WEBHOOK", ""),
		BackupAlertAfter:   reader.int("MOOGO_BACKUP_ALERT_AFTER", 3),

		// The restore drill proves the newest backup can be restored. It is on
		// whenever backups are; the interval is how often it looks for work and
		// the max age is how old a passing verdict may get.
		BackupVerifyInterval:  reader.duration("MOOGO_BACKUP_VERIFY_INTERVAL", time.Hour),
		BackupVerifyMaxAge:    reader.duration("MOOGO_BACKUP_VERIFY_MAX_AGE", 7*24*time.Hour),
		BackupVerifyBatchSize: reader.int("MOOGO_BACKUP_VERIFY_BATCH_SIZE", 5),
	}

	if len(reader.problems) > 0 {
		return Config{}, reader.err()
	}

	// BaseURL handling with fail-fast in production, legacy fallback with warning
	base := strings.TrimRight(reader.string("MOOGO_BASE_URL", ""), "/")
	if base == "" {
		// Legacy fallback: MOOGO_API_URL (deprecated)
		if legacy := strings.TrimRight(reader.string("MOOGO_API_URL", ""), "/"); legacy != "" {
			log.Printf("[WARN] MOOGO_API_URL is deprecated; rename it to MOOGO_BASE_URL, using %s", legacy)
			base = legacy
		}
	}

	// Fail-fast in production: BaseURL must be explicitly set
	if base == "" {
		if cfg.Environment == "production" {
			return Config{}, fmt.Errorf(
				"MOOGO_BASE_URL is required in production: it is the origin of the data plane "+
					"(e.g. https://api.example.com), not the dashboard. MOOGO_PUBLIC_URL is %q.",
				cfg.PublicURL)
		}
		// Development/test: fall back to PublicURL
		base = cfg.PublicURL
	}

	// Validate BaseURL is a proper absolute URL (scheme + host, no path)
	if err := validateAbsoluteURL(base); err != nil {
		return Config{}, fmt.Errorf("MOOGO_BASE_URL: %w", err)
	}

	cfg.BaseURL = base

	// The data plane only has a hostname of its own when a deployment splits it
	// off from the dashboard; otherwise the two are the same host.
	// Published objects are served from a CDN host when the deployment has
	// one; without it they are served from the same origin as the data plane,
	// so public_url is never empty and never points at nothing.
	if cfg.CDNURL == "" {
		cfg.CDNURL = cfg.BaseURL
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

	// The environment name is a switch, not a label. "production" is the only
	// value that turns the production rules on — secure cookies, a session
	// secret nobody could guess, a mail or sign-in provider configured — and
	// every other value runs with the development ones. A typo in MOOGO_ENV
	// would therefore not shout: it would quietly start a real deployment
	// without them. The name is checked against the values the code actually
	// branches on, so the process fails at startup instead of degrading.
	switch cfg.Environment {
	case "development", "test", "production":
	default:
		problems = append(problems, fmt.Sprintf(
			"MOOGO_ENV must be development, test, or production (got %q)", cfg.Environment))
	}

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

	if cfg.BackupEnabled {
		var missing []string
		if cfg.BackupEndpoint == "" {
			missing = append(missing, "MOOGO_BACKUP_ENDPOINT")
		}
		if cfg.BackupBucket == "" {
			missing = append(missing, "MOOGO_BACKUP_BUCKET")
		}
		if cfg.BackupAccessKey == "" {
			missing = append(missing, "MOOGO_BACKUP_ACCESS_KEY")
		}
		if cfg.BackupSecretKey == "" {
			missing = append(missing, "MOOGO_BACKUP_SECRET_KEY")
		}
		if len(missing) > 0 {
			problems = append(problems, "MOOGO_BACKUP_ENABLED is true but these are unset: "+
				strings.Join(missing, ", "))
		}
		if cfg.BackupInterval <= 0 {
			problems = append(problems, "MOOGO_BACKUP_INTERVAL must be greater than zero")
		}
		if cfg.BackupMaxAge <= 0 {
			problems = append(problems, "MOOGO_BACKUP_MAX_AGE must be greater than zero")
		}
		// Daily backups are keyed by UTC date, so a window shorter than a day
		// could back a project up twice on the same date and overwrite the
		// earlier copy, leaving a history row pointing at bytes it no longer
		// describes. Requiring a full day keeps the key unique by construction.
		if cfg.BackupMaxAge > 0 && cfg.BackupMaxAge < 24*time.Hour {
			problems = append(problems, "MOOGO_BACKUP_MAX_AGE must be at least 24h")
		}
		if cfg.BackupRetention <= 0 {
			problems = append(problems, "MOOGO_BACKUP_RETENTION must be greater than zero")
		}
		if cfg.BackupBatchSize < 1 {
			problems = append(problems, "MOOGO_BACKUP_BATCH_SIZE must be at least 1")
		}
		if cfg.BackupTimeout <= 0 {
			problems = append(problems, "MOOGO_BACKUP_TIMEOUT must be greater than zero")
		}
		if cfg.BackupDownloadTTL <= 0 {
			problems = append(problems, "MOOGO_BACKUP_DOWNLOAD_TTL must be greater than zero")
		}
		if cfg.BackupAlertAfter < 0 {
			problems = append(problems, "MOOGO_BACKUP_ALERT_AFTER must not be negative")
		}
		if cfg.BackupVerifyInterval <= 0 {
			problems = append(problems, "MOOGO_BACKUP_VERIFY_INTERVAL must be greater than zero")
		}
		if cfg.BackupVerifyMaxAge <= 0 {
			problems = append(problems, "MOOGO_BACKUP_VERIFY_MAX_AGE must be greater than zero")
		}
		if cfg.BackupVerifyBatchSize < 1 {
			problems = append(problems, "MOOGO_BACKUP_VERIFY_BATCH_SIZE must be at least 1")
		}
		if cfg.BackupAlertWebhook != "" && !strings.HasPrefix(cfg.BackupAlertWebhook, "http://") &&
			!strings.HasPrefix(cfg.BackupAlertWebhook, "https://") {
			problems = append(problems, "MOOGO_BACKUP_ALERT_WEBHOOK must be an http:// or https:// URL")
		}
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

// acceptedMoogoEnv seeds the names a deployment may keep even though the
// server does not read them through a typed getter: deprecated aliases the
// CLI still tells people to rename, and settings accepted for compatibility.
// Every name the server actually reads is added by envReader.mark, so this
// list only has to cover what the readers cannot see.
var acceptedMoogoEnv = map[string]bool{
	"MOOGO_ACTIVITY_LOG_RETENTION_DAYS": true,
	"MOOGO_ADDR":                        true,
	"MOOGO_API_URL":                     true, // deprecated, accepted
	"MOOGO_PROJECT_URL":                 true, // deprecated: rename to MOOGO_BASE_URL + MOOGO_PROJECT_ID
	"MOOGO_BACKUP_ACCESS_KEY":           true,
	"MOOGO_BACKUP_ALERT_AFTER":          true,
	"MOOGO_BACKUP_ALERT_WEBHOOK":        true,
	"MOOGO_BACKUP_BATCH_SIZE":           true,
	"MOOGO_BACKUP_BUCKET":               true,
	"MOOGO_BACKUP_DOWNLOAD_TTL":         true,
	"MOOGO_BACKUP_ENABLED":              true,
	"MOOGO_BACKUP_ENDPOINT":             true,
	"MOOGO_BACKUP_INTERVAL":             true,
	"MOOGO_BACKUP_MAX_AGE":              true,
	"MOOGO_BACKUP_PREFIX":               true,
	"MOOGO_BACKUP_REGION":               true,
	"MOOGO_BACKUP_RETENTION":            true,
	"MOOGO_BACKUP_SECRET_KEY":           true,
	"MOOGO_BACKUP_TIMEOUT":              true,
	"MOOGO_BACKUP_VERIFY_BATCH_SIZE":    true,
	"MOOGO_BACKUP_VERIFY_INTERVAL":      true,
	"MOOGO_BACKUP_VERIFY_MAX_AGE":       true,
	"MOOGO_BASE_URL":                    true,
	"MOOGO_CDN_URL":                     true,
	"MOOGO_COOKIE_DOMAIN":               true,
	"MOOGO_COOKIE_SECURE":               true,
	"MOOGO_DATA_DIR":                    true,
	"MOOGO_DATABASE_URL":                true,
	"MOOGO_DB_CONNECT_TIMEOUT":          true,
	"MOOGO_DB_MAX_CONNS":                true,
	"MOOGO_DB_MIN_CONNS":                true,
	"MOOGO_DEFAULT_MAX_DB_BYTES":        true,
	"MOOGO_DEFAULT_MAX_PROJECTS":        true,
	"MOOGO_DEFAULT_MAX_STORAGE_BYTES":   true,
	"MOOGO_ENV":                         true,
	"MOOGO_GOOGLE_CLIENT_ID":            true,
	"MOOGO_GOOGLE_CLIENT_SECRET":        true,
	"MOOGO_IDLE_TIMEOUT":                true,
	"MOOGO_MAIL_FROM":                   true,
	"MOOGO_MAX_BODY_BYTES":              true,
	"MOOGO_MAX_CACHED_PROJECTS":         true,
	"MOOGO_MAX_DB_BYTES":                true,
	"MOOGO_MAX_OBJECT_BYTES":            true,
	"MOOGO_MAX_PROJECTS":                true,
	"MOOGO_MAX_STORAGE_BYTES":           true,
	"MOOGO_NEWS_URL":                    true,
	"MOOGO_PUBLIC_URL":                  true,
	"MOOGO_READ_TIMEOUT":                true,
	"MOOGO_SHUTDOWN_TIMEOUT":            true,
	"MOOGO_SITEMAP_CACHE_TTL":           true,
	"MOOGO_SQL_READ_ONLY":               true,
	"MOOGO_SESSION_SECURE":              true,
	"MOOGO_SESSION_SECRET":              true,
	"MOOGO_SECRET_KEY":                  true, // deprecated: rename to MOOGO_SQL_KEY
}

// Floor values. Anything below these is a configuration mistake rather than a
// supported setting.
const (
	minimumBytes               = 1024 * 1024
	minimumBodyBytes           = 1024
	minimumSessionSecretLength = 32
)

func warnUnknownMoogoEnv(known map[string]bool) {
	for _, env := range os.Environ() {
		parts := strings.SplitN(env, "=", 2)
		if len(parts) != 2 {
			continue
		}
		key := parts[0]
		if strings.HasPrefix(key, "MOOGO_") && !known[key] {
			log.Printf("[WARN] unknown MOOGO_* environment variable: %s (check for typos)", key)
		}
	}
}

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

// validateAbsoluteURL checks that a string is a valid absolute URL with scheme and host,
// no path, query, or fragment.
func validateAbsoluteURL(s string) error {
	u, err := url.Parse(s)
	if err != nil {
		return fmt.Errorf("not a valid URL: %w", err)
	}
	if u.Scheme != "http" && u.Scheme != "https" {
		return fmt.Errorf("must use http:// or https:// scheme")
	}
	if u.Host == "" {
		return fmt.Errorf("missing host")
	}
	if u.Path != "" && u.Path != "/" {
		return fmt.Errorf("must not contain a path (got %q)", u.Path)
	}
	if u.RawQuery != "" {
		return fmt.Errorf("must not contain query parameters")
	}
	if u.Fragment != "" {
		return fmt.Errorf("must not contain a fragment")
	}
	return nil
}
