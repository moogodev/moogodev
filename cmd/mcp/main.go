// Command mcp serves the Moogo data plane to a Model Context Protocol client
// over stdio.
//
// It is a separate binary from cmd/api on purpose. The API is the public,
// internet-facing surface with a strict handler set; this process runs on a
// developer's machine and is reached only by the agent that launched it.
// Keeping them apart means a change here cannot widen the API's surface.
//
// The server does not open a database. Every call is an HTTP request to the
// project's data plane, so it inherits that surface's key check, rate limit,
// sanitizer and size caps with no second path to SQLite or Postgres.
package main

import (
	"fmt"
	"os"

	mcpserver "github.com/mark3labs/mcp-go/server"

	"github.com/moogodev/moogodev/internal/mcp"
)

func main() {
	if err := run(); err != nil {
		// stderr, never stdout: stdout is the JSON-RPC stream, and one stray
		// line there desynchronises the client. Diagnostics and the startup
		// error both belong on the other stream.
		fmt.Fprintln(os.Stderr, "moogo-mcp:", err)
		os.Exit(1)
	}
}

func run() error {
	config, err := mcp.ParseEnv(os.Getenv)
	if err != nil {
		return err
	}

	client := mcp.NewClient(config.ProjectURL, config.SecretKey, nil)
	return mcpserver.ServeStdio(mcp.NewServer(client))
}
