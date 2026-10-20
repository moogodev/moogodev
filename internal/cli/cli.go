// Package cli implements moogo, the official command line client.
//
// Every subcommand is an ordinary HTTP request to the project's existing
// data-plane routes, carrying the same credentials a curl call would. The CLI
// opens no database connection and reads no file on the server: it goes through
// the same API, the same sanitizer and the same limits as every other client,
// which is what an API without a driver buys. There is nothing here that the
// API does not already offer, so a command that works in a terminal works the
// same way from a script, an agent, or someone else's language of choice.
package cli

import (
	"context"
	"errors"
	"fmt"
	"io"
)

// Exit codes.
//
// They are distinct because scripts branch on them: 2 means the invocation
// itself was wrong -- an unknown command, a missing flag, a value the API never
// issued -- and 1 means the command was understood and something failed while
// doing it.
const (
	// ExitOK is a command that did its work.
	ExitOK = 0
	// ExitFailure is a command that failed at the API or the filesystem.
	ExitFailure = 1
	// ExitUsage is a command line that could not be run as written.
	ExitUsage = 2
)

// Streams are the three files a command reads from and writes to.
//
// A struct rather than a direct dependency on the os package so a test can run
// a command against buffers and assert on what a person would have seen.
type Streams struct {
	In  io.Reader
	Out io.Writer
	Err io.Writer
}

// commandError marks a failure the caller caused rather than the server:
// an unparsable flag, a missing environment variable, an argument count that
// matches no command. It is the difference between exit code 2 and 1.
type commandError struct {
	error
}

// Run executes one invocation and returns the process exit code.
func Run(ctx context.Context, args []string, streams Streams) int {
	if len(args) == 0 {
		usage(streams.Err)
		return ExitUsage
	}

	switch command := args[0]; command {
	case "help", "-h", "--help":
		usage(streams.Out)
		return ExitOK
	case "version", "--version":
		fmt.Fprintln(streams.Out, buildVersion())
		return ExitOK
	case "db":
		return runDB(ctx, streams, args[1:])
	case "bucket":
		return runBucket(ctx, streams, args[1:])
	default:
		fmt.Fprintf(streams.Err, "moogo: unknown command %q\n\n", command)
		usage(streams.Err)
		return ExitUsage
	}
}

// fail reports err the way the whole CLI reports errors, and returns the exit
// code its kind deserves.
func fail(streams Streams, err error) int {
	if err == nil {
		return ExitOK
	}

	exitCode := ExitFailure
	var typed *commandError
	if errors.As(err, &typed) {
		exitCode = ExitUsage
		err = typed.error
	}

	fmt.Fprintf(streams.Err, "moogo: %v\n", err)
	return exitCode
}

// usage is the whole surface of the tool on one screen.
func usage(writer io.Writer) {
	fmt.Fprint(writer, `moogo — the command line client for the Moogo API

Usage:
  moogo db push <file>        apply a SQL file to the project's database
  moogo db seed [file]        apply a seed file once (default seed.sql)
  moogo db reset --yes        drop every table and view in the project
  moogo db vacuum             reclaim free space after deleting rows
  moogo bucket ls [prefix]    list the objects in a bucket
  moogo bucket rm <key...>    delete objects, or with --prefix a whole folder
  moogo version               print the client version
  moogo help                  print this help

Configuration, by environment or flag. The flag wins.
  MOOGO_PROJECT_URL            the project URL from the dashboard:
                               https://api.moogo.dev/p/<project-id>   --url
  MOOGO_SECRET_KEY             the project key, for db commands        --key
  MOOGO_BUCKET_ACCESS_KEY_ID   a storage credential, for bucket commands
  MOOGO_BUCKET_SECRET_KEY      its secret                       --storage-key

Flags:
  --force           db seed: run even when this exact file is recorded
  --yes             db reset: confirm a destructive command
  --bucket <name>   which bucket (default: the default bucket)
  --prefix          bucket rm: treat each key as the start of a folder
  --limit <n>       bucket ls: show at most this many objects
  --cursor <token>  bucket ls: continue where a listing stopped
  --json            bucket ls: print the API response instead of a table

Every command is an ordinary HTTP request against your project's API — the
same one you would send with curl. Full reference: /docs/cli
`)
}
