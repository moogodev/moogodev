// Package mcp exposes the Moogo data plane as Model Context Protocol tools.
//
// The server is a thin HTTP proxy. It does not open SQLite or Postgres; every
// tool call becomes a request to the project's existing /query, /exec or
// /transaction endpoint. That is deliberate: the data plane already enforces
// the key, the rate limit, the sanitizer and the size caps, and a second path
// to the database would be a second set of rules to keep in step with the
// first.
package mcp

import (
	"errors"
	"fmt"
	"strings"
)

// Transport names accepted in MOOGO_MCP_TRANSPORT.
const (
	// TransportStdio is the local transport every desktop agent speaks: the
	// server reads JSON-RPC from stdin and writes it to stdout.
	TransportStdio = "stdio"
)

// Config is everything the MCP server needs to start.
//
// It is read from the environment exactly once, at startup. The secret key in
// particular is never accepted from a tool argument and never written to a log
// or a response: a key that can be passed in is a key that will end up in a
// transcript.
type Config struct {
	// ProjectURL is the project's data-plane base, for example
	// https://api.moogo.dev/p/<project_id>. The SQL endpoints are appended to
	// it, so it carries the project id and the route layout in one value.
	ProjectURL string

	// SecretKey authorises the SQL tools (the project's secret key).
	SecretKey string

	// Transport selects how the server is reached. Only stdio is implemented;
	// the remote HTTP transport and the storage credentials that go with the
	// bucket tools are reserved for a later phase.
	Transport string
}

// ParseEnv reads the configuration from the environment.
//
// It takes the lookup function rather than calling os.Getenv directly so the
// rules can be tested without touching the process environment.
//
// A missing value is a startup error, not a tool failure: a client that is
// configured wrong should be told before the agent has made its first call,
// not after it has reported a puzzling authentication error mid-task.
func ParseEnv(getenv func(string) string) (Config, error) {
	config := Config{
		ProjectURL: strings.TrimRight(strings.TrimSpace(getenv("MOOGO_PROJECT_URL")), "/"),
		SecretKey:  strings.TrimSpace(getenv("MOOGO_SECRET_KEY")),
		Transport:  strings.TrimSpace(getenv("MOOGO_MCP_TRANSPORT")),
	}

	var problems []string
	if config.ProjectURL == "" {
		problems = append(problems, "MOOGO_PROJECT_URL is required")
	}
	if config.SecretKey == "" {
		problems = append(problems, "MOOGO_SECRET_KEY is required")
	}

	if config.Transport == "" {
		config.Transport = TransportStdio
	}
	if config.Transport != TransportStdio {
		problems = append(problems,
			fmt.Sprintf("MOOGO_MCP_TRANSPORT=%q is not supported yet; use %q", config.Transport, TransportStdio))
	}

	if len(problems) > 0 {
		return Config{}, errors.New(strings.Join(problems, "; "))
	}
	return config, nil
}
