// Package mcp exposes the Moogo data plane as Model Context Protocol tools.
//
// The server is a thin HTTP proxy. It does not open SQLite or Postgres; every
// tool call becomes a request to the project's existing /query, /exec or
// /transaction endpoint, and every object tool becomes a request to the same
// project's bucket routes. That is deliberate: the data plane already enforces
// the keys, the rate limits, the sanitizer and the size caps, and a second path
// to the database or to disk would be a second set of rules to keep in step
// with the first.
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

	// TransportHTTP serves the same JSON-RPC over the MCP Streamable HTTP
	// transport, so an agent that runs elsewhere can reach this process at
	// http://<addr>/mcp.
	TransportHTTP = "http"
)

// defaultAddr is where the HTTP transport listens when MOOGO_MCP_ADDR is
// unset. Loopback on purpose: the process holds the project's secret key, so a
// default that bound every interface would hand the project to anyone who can
// reach the port.
const defaultAddr = "127.0.0.1:4618"

// Config is everything the MCP server needs to start.
//
// It is read from the environment exactly once, at startup. The secret keys in
// particular are never accepted from a tool argument and never written to a log
// or a response: a key that can be passed in is a key that will end up in a
// transcript.
type Config struct {
	// ProjectURL is the project's data-plane base, for example
	// https://api.moogo.dev/p/<project_id>. The SQL and bucket endpoints are
	// appended to it, so it carries the project id and the route layout in one
	// value.
	ProjectURL string

	// SecretKey authorises the SQL tools (the project's secret key).
	SecretKey string

	// Transport selects how the server is reached: stdio or http.
	Transport string

	// Addr is the listen address of the HTTP transport. It is empty for
	// stdio, where no socket is opened.
	Addr string

	// BucketAccessKeyID and BucketSecretKey authorise the object storage
	// tools. Storage is a separate credential on purpose, so a key scoped to
	// running SELECT cannot overwrite every file. They are either both set --
	// and then the object tools are registered -- or both empty.
	BucketAccessKeyID string
	BucketSecretKey   string
}

// StorageEnabled reports whether the bucket credential pair was supplied. The
// two are required together, so one field is enough to answer.
func (config Config) StorageEnabled() bool {
	return config.BucketAccessKeyID != "" && config.BucketSecretKey != ""
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
		ProjectURL:        strings.TrimRight(strings.TrimSpace(getenv("MOOGO_PROJECT_URL")), "/"),
		SecretKey:         strings.TrimSpace(getenv("MOOGO_SECRET_KEY")),
		Transport:         strings.TrimSpace(getenv("MOOGO_MCP_TRANSPORT")),
		Addr:              strings.TrimSpace(getenv("MOOGO_MCP_ADDR")),
		BucketAccessKeyID: strings.TrimSpace(getenv("MOOGO_STORAGE_ACCESS_KEY_ID")),
		BucketSecretKey:   strings.TrimSpace(getenv("MOOGO_STORAGE_SECRET_KEY")),
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
	switch config.Transport {
	case TransportStdio:
	case TransportHTTP:
		if config.Addr == "" {
			config.Addr = defaultAddr
		}
	default:
		problems = append(problems,
			fmt.Sprintf("MOOGO_MCP_TRANSPORT=%q is not supported; use %q or %q",
				config.Transport, TransportStdio, TransportHTTP))
	}

	// The two halves of one credential: a set access key id with no secret, or
	// the reverse, is a half-configured server. Refusing makes the mistake
	// visible at startup instead of at the first object call.
	if (config.BucketAccessKeyID == "") != (config.BucketSecretKey == "") {
		problems = append(problems,
			"MOOGO_STORAGE_ACCESS_KEY_ID and MOOGO_STORAGE_SECRET_KEY must be set together, or neither")
	}

	if len(problems) > 0 {
		return Config{}, errors.New(strings.Join(problems, "; "))
	}
	return config, nil
}
