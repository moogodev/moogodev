// Command mcp is the Moogo Model Context Protocol server: the data plane's SQL
// and object storage, as tools an agent can call.
//
// It is a separate binary from cmd/api on purpose. The API is the public
// surface, served to applications; this process is served to a developer's
// agent instead -- it speaks MCP over stdio by default, or over the Streamable
// HTTP transport when MOOGO_MCP_TRANSPORT=http. Keeping them apart means a
// change here cannot widen the API's surface.
//
// The server opens no database and no object directory. Every tool call is an
// HTTP request to the project's own data plane, so that plane's key checks,
// rate limits, statement sanitizer and size caps all still apply, and there is
// no second path to the data to keep in step with the first.
package main

import (
	"context"
	"fmt"
	"os"
	"os/signal"
	"syscall"
	"time"

	mcpserver "github.com/mark3labs/mcp-go/server"

	"github.com/moogodev/moogodev/internal/mcp"
)

// serverName and endpoint path are what an MCP client is told to reach in HTTP
// mode. The path matches the MCP convention.
const endpointPath = "/mcp"

func main() {
	if err := run(); err != nil {
		// stderr, never stdout: in stdio mode stdout is the JSON-RPC stream,
		// and one stray line there desynchronises the client. Diagnostics and
		// the startup error both belong on the other stream.
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

	// The object tools are registered only when both halves of the storage
	// credential are present. Leaving them out is a configuration choice, not
	// an error: an agent that only needs SQL keeps the smaller surface.
	var storage *mcp.StorageClient
	if config.StorageEnabled() {
		storage = mcp.NewStorageClient(
			config.ProjectURL, config.BucketAccessKeyID, config.BucketSecretKey, nil,
		)
	}

	instance := mcp.NewServer(client, storage)

	switch config.Transport {
	case mcp.TransportStdio:
		return mcpserver.ServeStdio(instance)
	case mcp.TransportHTTP:
		return serveHTTP(instance, config.Addr)
	default:
		// ParseEnv refuses anything else before this point.
		return fmt.Errorf("unknown transport %q", config.Transport)
	}
}

// serveHTTP runs the Streamable HTTP transport until a signal stops it.
//
// Start blocks, so it runs in a goroutine while the main one waits on either
// the server's own failure or a stop signal; a signal then gets the sessions
// closed and the listener drained instead of a connection cut mid-response.
func serveHTTP(instance *mcpserver.MCPServer, addr string) error {
	httpServer := mcpserver.NewStreamableHTTPServer(
		instance,
		mcpserver.WithEndpointPath(endpointPath),
	)

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	fmt.Fprintf(os.Stderr, "moogo-mcp: listening on http://%s%s\n", addr, endpointPath)

	failures := make(chan error, 1)
	go func() { failures <- httpServer.Start(addr) }()

	select {
	case err := <-failures:
		return err
	case <-ctx.Done():
		shutdown, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		return httpServer.Shutdown(shutdown)
	}
}
