// Command api is the Moogo HTTP service.
//
// It reads configuration, builds the service, serves until a signal arrives,
// then shuts down gracefully so in-flight requests finish and open SQLite
// connections are closed cleanly.
package main

import (
	"context"
	"errors"
	"fmt"
	"io/fs"
	"net/http"
	"os"
	"os/signal"
	"slices"
	"syscall"
	"time"

	"github.com/moogo/moogo/internal/app"
	"github.com/moogo/moogo/internal/config"
	"github.com/moogo/moogo/pkg/logger"
	"github.com/moogo/moogo/web"
)

// shutdownGrace is how long in-flight requests get to finish after a signal.
//
// It must exceed the statement timeout, otherwise a running query would be cut
// off by shutdown instead of being allowed to finish or report its own error.
const shutdownGrace = 30 * time.Second

// checkConfigFlag validates the configuration and exits without opening a
// database or listening on a port.
const checkConfigFlag = "--check-config"

func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, "moogo:", err)
		os.Exit(1)
	}
}

func run() error {
	cfg, err := config.Load()
	if err != nil {
		return err
	}

	// --check-config validates the environment and exits before anything is
	// opened. A deployment script wants exactly this: a mistyped
	// MOOGO_SESSION_SECRET should be reported before the service is enabled,
	// not five seconds after it starts restarting in a loop.
	if slices.Contains(os.Args[1:], checkConfigFlag) {
		fmt.Println("configuration is valid")
		fmt.Printf("  environment:   %s\n", cfg.Environment)
		fmt.Printf("  addr:          %s\n", cfg.Addr)
		fmt.Printf("  public url:    %s\n", cfg.PublicURL)
		fmt.Printf("  data dir:      %s\n", cfg.DataDir)
		fmt.Printf("  cookie secure: %v\n", cfg.CookieSecure)
		fmt.Printf("  mail provider: %v\n", cfg.ResendAPIKey != "")
		fmt.Printf("  google signin: %v\n", cfg.GoogleClientID != "")
		return nil
	}

	log := logger.New(cfg.Environment)
	log.Info("starting moogo", logger.Fields{
		"environment": cfg.Environment,
		"addr":        cfg.Addr,
		"public_url":  cfg.PublicURL,
	})

	// Signal handling is registered before anything slow happens, so a Ctrl-C
	// during startup is not lost.
	signalCtx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	buildCtx, cancelBuild := context.WithTimeout(signalCtx, 60*time.Second)
	defer cancelBuild()

	built, err := app.Build(buildCtx, app.Options{
		Config:   cfg,
		Log:      log,
		Frontend: frontend(),
	})
	if err != nil {
		return err
	}
	defer built.Close()

	// The scheduler shares the signal context, so a shutdown stops the periodic
	// jobs at the same time it stops accepting requests.
	go built.Scheduler.Run(signalCtx)

	serveErr := make(chan error, 1)
	go func() {
		log.Info("http listening", logger.Fields{"addr": cfg.Addr})

		if err := built.Server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			serveErr <- fmt.Errorf("serve: %w", err)
			return
		}
		serveErr <- nil
	}()

	select {
	case err := <-serveErr:
		return err

	case <-signalCtx.Done():
		stop()
		log.Info("shutdown requested", nil)
	}

	shutdownCtx, cancelShutdown := context.WithTimeout(context.Background(), shutdownGrace)
	defer cancelShutdown()

	if err := built.Server.Shutdown(shutdownCtx); err != nil {
		// Close is still deferred, so connections are released even when the
		// graceful path times out.
		return fmt.Errorf("shutdown: %w", err)
	}

	if err := <-serveErr; err != nil {
		return err
	}

	log.Info("stopped cleanly", nil)
	return nil
}

// frontend returns the built single-page app, or nil when it is not present.
//
// A missing build is not fatal: the API is the part that has to work, and the
// router answers 503 for pages in that case.
func frontend() fs.FS {
	dist, err := web.Dist()
	if err != nil {
		return nil
	}
	return dist
}
