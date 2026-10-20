// Command moogo is the official command line client for the Moogo API.
//
// It is a client, not a connection. Every subcommand is an ordinary HTTP
// request to the project's existing data-plane routes, carrying the project's
// credentials the same way curl would: there is no driver here, no direct path
// to the files behind an API, and no second set of rules for the dashboard and
// the API to keep in step with. What a command can do is what the API can do.
package main

import (
	"context"
	"os"
	"os/signal"
	"syscall"

	"github.com/moogodev/moogodev/internal/cli"
)

func main() {
	// Ctrl-C cancels the context, so a request in flight is abandoned rather
	// than waited out, and the terminal returns.
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	code := cli.Run(ctx, os.Args[1:], cli.Streams{
		In:  os.Stdin,
		Out: os.Stdout,
		Err: os.Stderr,
	})

	stop()
	os.Exit(code)
}
