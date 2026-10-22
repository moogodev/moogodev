package cli

import (
	"fmt"
	"os"
	"strings"
)

// Environment variables. The names are the ones the dashboard shows when a
// project is created and the ones the MCP server already reads, so one set of
// exports works for curl, for an agent and for this tool.
const (
	// EnvProjectURL is the project's data-plane URL, including the project id:
	// https://api.moogo.dev/p/<project-id>.
	EnvProjectURL = "MOOGO_PROJECT_URL"
	// EnvSecretKey is the project key, which authorises SQL.
	EnvSecretKey = "MOOGO_SECRET_KEY"
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
// Only the project URL is required here, because every command needs it; the
// credentials are checked by the command that needs them, so `moogo db push`
// does not ask for a storage credential it will never send.
func resolve(flags *flagSet) (Config, error) {
	raw := first(flags.value("url"), os.Getenv(EnvProjectURL))
	if raw == "" {
		return Config{}, &commandError{fmt.Errorf(
			"%s is not set; it is the project URL from the dashboard, like https://api.moogo.dev/p/<project-id>",
			EnvProjectURL)}
	}

	base, projectID, err := splitProjectURL(raw)
	if err != nil {
		return Config{}, &commandError{err}
	}

	return Config{
		ProjectURL:        base,
		ProjectID:         projectID,
		SecretKey:         first(flags.value("key"), os.Getenv(EnvSecretKey)),
		BucketAccessKeyID: first(flags.value("storage-key-id"), os.Getenv(EnvBucketAccessKeyID)),
		BucketSecretKey:   first(flags.value("storage-key"), os.Getenv(EnvBucketSecretKey)),
	}, nil
}

// splitProjectURL validates the shape of a project URL and reads the project
// id out of it.
//
// The shape is fixed by the API: the data plane is mounted at /p/{project_id},
// and every endpoint in this tool is a path under that URL. A URL that does not
// carry the segment is refused rather than guessed at, because guessing
// produces a base that silently answers for whatever else is mounted there.
func splitProjectURL(raw string) (projectURL, projectID string, err error) {
	trimmed := strings.TrimRight(strings.TrimSpace(raw), "/")

	if !strings.HasPrefix(trimmed, "http://") && !strings.HasPrefix(trimmed, "https://") {
		return "", "", fmt.Errorf(
			"%s must be an http or https URL (got %q)", EnvProjectURL, raw)
	}

	marker := "/p/"
	index := strings.LastIndex(trimmed, marker)
	if index < 0 {
		return "", "", fmt.Errorf(
			"%s must be the project URL, which ends in /p/<project-id> (got %q)",
			EnvProjectURL, raw)
	}

	projectID = trimmed[index+len(marker):]
	if projectID == "" || strings.ContainsAny(projectID, "/?#") {
		return "", "", fmt.Errorf(
			"%s has nothing usable after /p/ (got %q)", EnvProjectURL, raw)
	}

	return trimmed, projectID, nil
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
			"%s is not set; it is the project key shown once when the project was created",
			EnvSecretKey)}
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
