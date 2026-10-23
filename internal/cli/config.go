package cli

import (
	"fmt"
	"os"
	"strings"
)

// Environment variables. The names are the ones the dashboard shows when a
// project is created and the ones the MCP server reads, so one set of exports
// works for curl, for an agent and for this tool.
//
// The origin and the project id are separate, exactly as the SDK reads them: a
// client appends the project's own routes rather than holding a URL with the
// route layout baked in.
const (
	// EnvBaseURL is the data-plane origin, without a path:
	// https://api.moogo.dev. The project's routes are built from it and
	// EnvProjectID.
	EnvBaseURL = "MOOGO_BASE_URL"
	// EnvProjectID is the project's UUID.
	EnvProjectID = "MOOGO_PROJECT_ID"
	// EnvSQLKey is the project key, which authorises SQL.
	EnvSQLKey = "MOOGO_SQL_KEY"
	// EnvBucketAccessKeyID is a storage credential's access key id, which
	// authorises object storage.
	EnvBucketAccessKeyID = "MOOGO_STORAGE_ACCESS_KEY_ID"
	// EnvBucketSecretKey is that credential's secret.
	EnvBucketSecretKey = "MOOGO_STORAGE_SECRET_KEY"
)

// Config is who a command talks to the API as.
//
// It holds the project URL rather than a host and a project id because every
// endpoint in this API is a path under that URL; taking it apart would only be
// an opportunity to disagree with the value the dashboard printed.
type Config struct {
	// ProjectURL is the project's data-plane base without a trailing slash,
	// project id included: https://api.moogo.dev/p/<project-id>. SQL lives at
	// its routes, object storage at its /bucket.
	ProjectURL string
	// ProjectID is the last path segment of ProjectURL, used in messages.
	ProjectID string

	// SecretKey authorises SQL and the object plane's project-key routes.
	SecretKey string
	// BucketAccessKeyID and BucketSecretKey are the storage credential, which
	// object storage requires. The project key is deliberately not accepted
	// there: a key scoped to running SELECT should not be able to overwrite
	// every file a project has stored.
	BucketAccessKeyID string
	BucketSecretKey   string
}

// resolve reads the configuration from flags over environment.
//
// Only the base URL and project id are required here, because every command
// needs them; the credentials are checked by the command that needs them, so
// `moogo db push` does not ask for a storage credential it will never send.
func resolve(flags *flagSet) (Config, error) {
	base := strings.TrimRight(strings.TrimSpace(first(flags.value("base-url"), os.Getenv(EnvBaseURL))), "/")
	projectID := strings.TrimSpace(first(flags.value("project-id"), os.Getenv(EnvProjectID)))
	if base == "" || projectID == "" {
		return Config{}, &commandError{fmt.Errorf(
			"%s and %s are not set; they are the API origin and the project id from the dashboard, like https://api.moogo.dev and 8f3c1a20-...",
			EnvBaseURL, EnvProjectID)}
	}

	projectURL, err := buildProjectURL(base, projectID)
	if err != nil {
		return Config{}, &commandError{err}
	}

	return Config{
		ProjectURL:        projectURL,
		ProjectID:         projectID,
		SecretKey:         first(flags.value("key"), os.Getenv(EnvSQLKey)),
		BucketAccessKeyID: first(flags.value("storage-key-id"), os.Getenv(EnvBucketAccessKeyID)),
		BucketSecretKey:   first(flags.value("storage-key"), os.Getenv(EnvBucketSecretKey)),
	}, nil
}

// buildProjectURL validates the origin and the project id and joins them into
// the base every command appends to.
//
// The shape is fixed by the API: the data plane is mounted at /p/{project_id},
// so the origin must carry no path and the id must be a single segment. A value
// that does not fit is refused rather than guessed at, because guessing produces
// a base that silently answers for whatever else is mounted there.
func buildProjectURL(base, projectID string) (string, error) {
	if !strings.HasPrefix(base, "http://") && !strings.HasPrefix(base, "https://") {
		return "", fmt.Errorf(
			"%s must be an http or https origin, without a path (got %q)", EnvBaseURL, base)
	}
	if projectID == "" {
		return "", fmt.Errorf("%s must not be empty", EnvProjectID)
	}
	if strings.ContainsAny(projectID, "/?# ") {
		return "", fmt.Errorf(
			"%s must be a single path segment (got %q)", EnvProjectID, projectID)
	}
	return base + "/p/" + projectID, nil
}

// sqlEndpoint is one of the data-plane routes that run SQL.
func (config Config) sqlEndpoint(path string) string {
	return config.ProjectURL + path
}

// bucketEndpoint is the object plane, which lives under the same project URL
// and is addressed by key rather than by id.
func (config Config) bucketEndpoint(path string) string {
	return config.ProjectURL + "/bucket" + path
}

// requireSecret checks the credential SQL needs.
func (config Config) requireSecret() error {
	if config.SecretKey == "" {
		return &commandError{fmt.Errorf(
			"%s is not set; it is the SQL key shown once when the project was created",
			EnvSQLKey)}
	}
	return nil
}

// requireStorage checks the credential object storage needs.
//
// The message names where to make one, because the failure is otherwise a dead
// end: the project key is right there in the environment and the API will not
// take it on these routes.
func (config Config) requireStorage() error {
	if config.BucketAccessKeyID == "" || config.BucketSecretKey == "" {
		return &commandError{fmt.Errorf(
			"bucket commands need a storage credential\n"+
				"  set %s and %s (--storage-key-id and --storage-key)\n"+
				"  make one under Buckets → Access keys in the dashboard",
			EnvBucketAccessKeyID, EnvBucketSecretKey)}
	}
	return nil
}
