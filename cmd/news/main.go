// Command news serves the What's-new site: the public changelog API, the
// single-admin editor API, and the embedded frontend.
//
// It is a separate binary from cmd/api on purpose — its own port, its own
// SQLite file, its own session secret. See internal/news for the reasoning.
package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"io/fs"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"golang.org/x/crypto/bcrypt"

	"github.com/moogodev/moogodev/internal/news"
	newsweb "github.com/moogodev/moogodev/news"
	"github.com/moogodev/moogodev/pkg/logger"
)

func main() {
	hashPassword := flag.String("hash-password", "", "print a bcrypt hash for the given password and exit")
	flag.Parse()

	if *hashPassword != "" {
		hash, err := bcrypt.GenerateFromPassword([]byte(*hashPassword), bcrypt.DefaultCost)
		if err != nil {
			fatal(err)
		}
		fmt.Println(string(hash))
		return
	}

	cfg, err := news.FromEnv()
	if err != nil {
		fatal(err)
	}
	log := logger.New(cfg.Environment)

	store, err := news.OpenStore(cfg.DBPath)
	if err != nil {
		fatal(err)
	}
	defer func() {
		if err := store.Close(); err != nil {
			log.Error("close database", logger.Fields{"error": err.Error()})
		}
	}()

	seeded, err := store.SeedIfEmpty(context.Background())
	if err != nil {
		fatal(err)
	}
	if seeded {
		log.Info("seeded initial posts", nil)
	}

	// A checkout that never ran `npm run build` in news/ starts anyway: the
	// API is still usable, and the pages answer with a clear 404 instead of
	// the process refusing to boot.
	var static fs.FS
	if static, err = newsweb.Dist(); err != nil {
		log.Warn("frontend not built, pages will 404", logger.Fields{"error": err.Error()})
		static = nil
	}

	server := &http.Server{
		Addr:              cfg.ListenAddr,
		Handler:           news.NewServer(cfg, store, static),
		ReadHeaderTimeout: 10 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	errCh := make(chan error, 1)
	go func() {
		log.Info("news listening", logger.Fields{"addr": cfg.ListenAddr})
		errCh <- server.ListenAndServe()
	}()

	select {
	case err := <-errCh:
		if !errors.Is(err, http.ErrServerClosed) {
			fatal(err)
		}
	case <-ctx.Done():
		log.Info("shutdown requested", nil)
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()
		if err := server.Shutdown(shutdownCtx); err != nil {
			fatal(err)
		}
		log.Info("stopped cleanly", nil)
	}
}

func fatal(err error) {
	fmt.Fprintln(os.Stderr, "news:", err)
	os.Exit(1)
}
