package cli

import (
	"fmt"
	"os"
	"strings"
)

// runConfig prints the configuration the CLI would use and flags anything that
// looks like a mistake: a missing variable, a value the API would reject, a
// deprecated name, or an unknown MOOGO_* variable that is probably a typo.
//
// It reads the environment only; it makes no request, so an operator can run it
// before touching a service or a deployment.
func runConfig(streams Streams, args []string) int {
	if len(args) > 0 && (args[0] == "-h" || args[0] == "--help") {
		fmt.Fprint(streams.Out, `Usage: moogo config

Show the effective CLI configuration from the environment, with warnings.

Checks:
  - required variables (MOOGO_BASE_URL, MOOGO_PROJECT_ID)
  - credential presence per command type
  - value shape (origin without a path, single-segment project id)
  - deprecated names and unknown MOOGO_* variables

Exits 0 when everything checks out and 2 when there is something to fix.
`)
		return ExitOK
	}

	fmt.Fprintln(streams.Out, "Moogo CLI configuration")
	fmt.Fprintln(streams.Out)

	base := strings.TrimRight(strings.TrimSpace(os.Getenv(EnvBaseURL)), "/")
	projectID := strings.TrimSpace(os.Getenv(EnvProjectID))
	sqlKey := strings.TrimSpace(os.Getenv(EnvSQLKey))
	bucketID := strings.TrimSpace(os.Getenv(EnvBucketAccessKeyID))
	bucketKey := strings.TrimSpace(os.Getenv(EnvBucketSecretKey))

	fmt.Fprintf(streams.Out, "%s: %s\n", EnvBaseURL, maskOrEmpty(base))
	fmt.Fprintf(streams.Out, "%s: %s\n", EnvProjectID, maskOrEmpty(projectID))
	fmt.Fprintf(streams.Out, "%s: %s\n", EnvSQLKey, maskOrEmpty(sqlKey))
	fmt.Fprintf(streams.Out, "%s: %s\n", EnvBucketAccessKeyID, maskOrEmpty(bucketID))
	fmt.Fprintf(streams.Out, "%s: %s\n", EnvBucketSecretKey, maskOrEmpty(bucketKey))
	fmt.Fprintln(streams.Out)

	var warnings []string

	if base == "" {
		warnings = append(warnings, fmt.Sprintf("%s not set (required for all commands)", EnvBaseURL))
	}
	if projectID == "" {
		warnings = append(warnings, fmt.Sprintf("%s not set (required for all commands)", EnvProjectID))
	}
	switch {
	case base != "" && projectID != "":
		if projectURL, err := buildProjectURL(base, projectID); err != nil {
			warnings = append(warnings, err.Error())
		} else {
			fmt.Fprintf(streams.Out, "✓ Project URL: %s\n", projectURL)
		}
	}

	if sqlKey != "" {
		fmt.Fprintf(streams.Out, "✓ %s set (for db commands)\n", EnvSQLKey)
	} else {
		warnings = append(warnings, fmt.Sprintf("%s not set (required for db push/seed/reset/vacuum)", EnvSQLKey))
	}

	switch {
	case bucketID != "" && bucketKey != "":
		fmt.Fprintf(streams.Out, "✓ %s + %s set (for bucket commands)\n", EnvBucketAccessKeyID, EnvBucketSecretKey)
	case bucketID != "" || bucketKey != "":
		warnings = append(warnings, fmt.Sprintf(
			"%s and %s must be set together for bucket commands", EnvBucketAccessKeyID, EnvBucketSecretKey))
	default:
		warnings = append(warnings, "Storage credentials not set (required for bucket ls/rm)")
	}

	// Names that used to work and no longer do. A deployment that still sets
	// one is silently misconfigured, so it is called out by name.
	deprecated := map[string]string{
		"MOOGO_PROJECT_URL":          "rename it to " + EnvBaseURL + " (origin only) + " + EnvProjectID,
		"MOOGO_SECRET_KEY":           "rename it to " + EnvSQLKey,
		"MOOGO_API_URL":              "rename it to " + EnvBaseURL,
		"MOOGO_PROJECT_KEY":          "rename it to " + EnvSQLKey,
		"MOOGO_BUCKET_ACCESS_KEY_ID": "rename it to " + EnvBucketAccessKeyID,
		"MOOGO_BUCKET_SECRET_KEY":    "rename it to " + EnvBucketSecretKey,
		"MOOGO_BUCKET_ENDPOINT":      "rename it to " + EnvBaseURL + " + " + EnvProjectID,
	}
	for name, advice := range deprecated {
		if os.Getenv(name) != "" {
			warnings = append(warnings, fmt.Sprintf("%s is deprecated; %s", name, advice))
		}
	}

	for _, entry := range os.Environ() {
		key, _, found := strings.Cut(entry, "=")
		if !found || !strings.HasPrefix(key, "MOOGO_") {
			continue
		}
		if _, isDeprecated := deprecated[key]; isDeprecated {
			continue
		}
		switch key {
		case EnvBaseURL, EnvProjectID, EnvSQLKey, EnvBucketAccessKeyID, EnvBucketSecretKey,
			"MOOGO_PUBLIC_URL", "MOOGO_CDN_URL":
		default:
			warnings = append(warnings, fmt.Sprintf("unknown environment variable %s (check for typos)", key))
		}
	}

	fmt.Fprintln(streams.Out)
	if len(warnings) == 0 {
		fmt.Fprintln(streams.Out, "✓ All checks passed")
		return ExitOK
	}

	fmt.Fprintf(streams.Out, "Warnings (%d):\n", len(warnings))
	for _, warning := range warnings {
		fmt.Fprintf(streams.Out, "  ⚠ %s\n", warning)
	}
	fmt.Fprintln(streams.Out)
	fmt.Fprintln(streams.Out,
		"Tip: set the variables above, or pass flags (--base-url, --project-id, --key, --storage-key-id, --storage-key)")
	return ExitUsage
}

func maskOrEmpty(s string) string {
	if s == "" {
		return "(not set)"
	}
	if len(s) <= 8 {
		return "***"
	}
	return s[:4] + "..." + s[len(s)-4:]
}
