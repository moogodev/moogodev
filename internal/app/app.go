// Package app wires the service together.
//
// Wiring lives here rather than in main so it can be built and inspected in a
// test: main should read configuration, hand over, and wait for a signal.
package app

import (
	"context"
	"fmt"
	"io/fs"
	"net/http"
	"strings"
	"time"

	"github.com/moogodev/moogodev/internal/auth"
	"github.com/moogodev/moogodev/internal/config"
	"github.com/moogodev/moogodev/internal/dbcontrol"
	"github.com/moogodev/moogodev/internal/dbplane"
	"github.com/moogodev/moogodev/internal/handler"
	"github.com/moogodev/moogodev/internal/mail"
	"github.com/moogodev/moogodev/internal/metrics"
	"github.com/moogodev/moogodev/internal/router"
	"github.com/moogodev/moogodev/pkg/logger"
	"github.com/moogodev/moogodev/pkg/session"
)

// App holds the constructed service.
type App struct {
	Server    *http.Server
	Store     *dbcontrol.Store
	Databases *dbplane.Manager
	// Scheduler runs the periodic maintenance. Started by main, stopped through
	// the context that main owns.
	Scheduler *Scheduler
	Log       *logger.Logger
}

// The concrete store must satisfy the handler interfaces. Without this check
// the mismatch would only surface as a wiring error at Build time, where the
// cause is far from the interface that changed.
var _ handler.Store = (*dbcontrol.Store)(nil)

// Options are the inputs to Build.
type Options struct {
	Config config.Config
	Log    *logger.Logger
	// Frontend holds the built single-page app, the whole dist tree. It may be
	// nil, in which case the router answers 503 for pages and serves no static
	// files instead of failing to start.
	Frontend fs.FS
}

// Build constructs every component and returns the ready service.
//
// The order matters: the control plane migrates on open, so the data plane and
// the router can both assume the schema exists.
func Build(ctx context.Context, options Options) (*App, error) {
	cfg := options.Config

	store, err := dbcontrol.New(ctx, cfg, options.Log)
	if err != nil {
		return nil, fmt.Errorf("control plane: %w", err)
	}

	databases, err := dbplane.NewManager(cfg.DataDir, cfg.MaxDBBytes, cfg.QueryTimeout, cfg.MaxCachedProjects, options.Log)
	if err != nil {
		store.Close()
		return nil, fmt.Errorf("data plane: %w", err)
	}

	signer, err := session.NewSigner(cfg.SessionSecret, cfg.SessionTTL)
	if err != nil {
		databases.Close()
		store.Close()
		return nil, fmt.Errorf("session signer: %w", err)
	}

	sessions := auth.NewSessionManager(signer, cfg.CookieSecure)
	sessions.SetCookieDomain(cfg.CookieDomain)

	google := auth.NewManager(auth.GoogleConfig{
		ClientID:     cfg.GoogleClientID,
		ClientSecret: cfg.GoogleClientSecret,
		RedirectURL:  cfg.PublicURL + "/auth/google/callback",
	}, sessions, options.Log)

	controlHandler := handler.NewControlPlane(store, databases, cfg, options.Log)
	dataHandler := handler.NewDataPlane(databases, options.Log)
	oauthHandler := handler.NewOAuth(google, sessions, store, cfg, options.Log)
	bucketHandler := handler.NewBucketPlane(store, databases, cfg.MaxStorageBytes, cfg.PublicURL, options.Log)
	docsHandler := handler.NewDocsHandler(handler.GetDocsFS(), options.Log)
	updatesHandler := handler.NewUpdatesHandler(cfg.NewsURL, options.Log)

	mailer := mail.New(cfg.ResendAPIKey, cfg.MailFrom, cfg.PublicURL, options.Log)
	credentialsHandler := handler.NewCredentials(store, sessions, mailer, cfg, options.Log)

	var staticFS http.FileSystem
	if options.Frontend != nil {
		staticFS = http.FS(options.Frontend)
	}

	trustedProxies := splitList(cfg.TrustedProxies)

	built := router.New(router.Deps{
		Health:         handler.NewHealth(store, healthCheckTimeout, options.Log),
		OAuth:          oauthHandler,
		Credentials:    credentialsHandler,
		Control:        controlHandler,
		Data:           dataHandler,
		Bucket:         bucketHandler,
		Docs:           docsHandler,
		Updates:        updatesHandler,
		Sessions:       sessions,
		ProjectKeys:    store,
		Projects:       store,
		StorageKeys:    store,
		Log:            options.Log,
		StaticFS:       staticFS,
		IndexFS:        options.Frontend,
		TrustedProxies: trustedProxies,
		MaxBodyBytes:   cfg.MaxBodyBytes,
		MaxObjectBytes: cfg.MaxObjectBytes,
		RequestTimeout: cfg.QueryTimeout + requestGrace,
		// The counters themselves are process-wide; these providers are the
		// two values read fresh at scrape time. Both come from objects that
		// outlive the handler, so there is no lifetime to coordinate.
		Metrics: metrics.Handler(metrics.Providers{
			OpenConnections: databases.OpenConnections,
			ProjectCount:    store.ProjectCount,
		}),
	})

	reconciler := NewReconciler(store, databases, options.Log)

	return &App{
		Server: &http.Server{
			Addr:    cfg.Addr,
			Handler: built,
			// ReadHeaderTimeout is set but ReadTimeout is not: a query response
			// can legitimately take as long as the statement timeout plus
			// encoding, and a write timeout shorter than that would cut off
			// successful results.
			ReadHeaderTimeout: cfg.ReadTimeout,
			IdleTimeout:       cfg.IdleTimeout,
			// Go's default header cap is 1 MB, which is far more than the
			// cookies and tokens here ever need. A smaller ceiling turns a
			// header flood into a fast 431 instead of buffered memory.
			MaxHeaderBytes: 64 << 10,
			ErrorLog:       options.Log.Standard(),
		},
		Store:     store,
		Databases: databases,
		Scheduler: NewScheduler(store, reconciler, options.Log, activityRetention(cfg)),
		Log:       options.Log,
	}, nil
}

// activityRetention converts the configured day count into a duration.
func activityRetention(cfg config.Config) time.Duration {
	if cfg.ActivityLogRetentionDays <= 0 {
		return 7 * 24 * time.Hour
	}
	return time.Duration(cfg.ActivityLogRetentionDays) * 24 * time.Hour
}

// healthCheckTimeout bounds the readiness probe's database check.
const healthCheckTimeout = 2 * time.Second

// requestGrace is added to the statement timeout for the HTTP timeout, so the
// database layer gets to return its own error first. Without it the outer
// timeout would fire and the client would see a generic timeout instead of the
// statement that was too slow.
const requestGrace = 5 * time.Second

// Close releases resources in reverse construction order.
func (app *App) Close() {
	if app.Databases != nil {
		_ = app.Databases.Close()
	}
	if app.Store != nil {
		app.Store.Close()
	}
}

// splitList splits a comma-separated configuration value and drops blanks.
func splitList(raw string) []string {
	var values []string
	for _, part := range strings.Split(raw, ",") {
		if trimmed := strings.TrimSpace(part); trimmed != "" {
			values = append(values, trimmed)
		}
	}
	return values
}
