// Package news is the What's-new service behind news.moogo.dev.
//
// It is deliberately its own service: its own binary, its own SQLite file, its
// own session secret and its own single admin account. Nothing here reads the
// control plane's tables, and the control plane never reads this one — a
// compromise on either side does not travel to the other.
package news

import (
	"fmt"
	"os"
	"strings"
)

// Config is everything the news service reads from the environment.
type Config struct {
	// Environment selects log formatting, NEWS_ENV: "production" (JSON) or
	// "development". Defaults to production because the service ships as a
	// systemd unit whose logs go to journald.
	Environment string
	// ListenAddr is the address the HTTP server binds, NEWS_ADDR.
	ListenAddr string
	// DBPath is the SQLite file, NEWS_DB. It is this service's only storage.
	DBPath string
	// SessionSecret signs the admin session cookie. Minimum 32 characters,
	// enforced by pkg/session as well; checked here so the error names the
	// variable instead of the library.
	SessionSecret string
	// AdminEmail and AdminPasswordHash are the single admin account. There is
	// no sign-up and no password reset: rotation is replacing the hash in the
	// environment.
	AdminEmail        string
	AdminPasswordHash string
	// CookieSecure sets the Secure flag. It follows the environment: behind
	// TLS it must be on, and plain-HTTP local development turns it off.
	CookieSecure bool
	// TrustedProxies lists the addresses X-Forwarded-For may be believed
	// from, so login rate limiting sees the real client instead of the proxy.
	TrustedProxies []string
}

// FromEnv reads and validates the configuration.
func FromEnv() (Config, error) {
	cfg := Config{
		Environment:       envOr("NEWS_ENV", "production"),
		ListenAddr:        envOr("NEWS_ADDR", ":8081"),
		DBPath:            envOr("NEWS_DB", "news.db"),
		SessionSecret:     strings.TrimSpace(os.Getenv("NEWS_SESSION_SECRET")),
		AdminEmail:        strings.TrimSpace(os.Getenv("NEWS_ADMIN_EMAIL")),
		AdminPasswordHash: strings.TrimSpace(os.Getenv("NEWS_ADMIN_PASSWORD_HASH")),
		CookieSecure:      os.Getenv("NEWS_COOKIE_SECURE") != "false",
		TrustedProxies:    splitCSV(os.Getenv("NEWS_TRUSTED_PROXIES")),
	}
	if len(cfg.TrustedProxies) == 0 {
		cfg.TrustedProxies = []string{"127.0.0.1"}
	}

	var problems []string
	if len(cfg.SessionSecret) < 32 {
		problems = append(problems, "NEWS_SESSION_SECRET must be at least 32 characters")
	}
	if cfg.AdminEmail == "" || !strings.Contains(cfg.AdminEmail, "@") {
		problems = append(problems, "NEWS_ADMIN_EMAIL must be an email address")
	}
	if !strings.HasPrefix(cfg.AdminPasswordHash, "$2") {
		problems = append(problems, "NEWS_ADMIN_PASSWORD_HASH must be a bcrypt hash (generate one with: news -hash-password)")
	}
	if len(problems) > 0 {
		return Config{}, fmt.Errorf("news: %s", strings.Join(problems, "; "))
	}
	return cfg, nil
}

func envOr(key, fallback string) string {
	if value := strings.TrimSpace(os.Getenv(key)); value != "" {
		return value
	}
	return fallback
}

func splitCSV(raw string) []string {
	var out []string
	for _, part := range strings.Split(raw, ",") {
		if part = strings.TrimSpace(part); part != "" {
			out = append(out, part)
		}
	}
	return out
}
