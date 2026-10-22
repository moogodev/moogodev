package cli

import (
	"fmt"
	"os"
	"strings"
)

func runConfig(streams Streams, args []string) int {
	if len(args) > 0 && (args[0] == "-h" || args[0] == "--help") {
		fmt.Fprint(streams.Out, `Usage: moogo config

Show effective CLI configuration from environment variables and flags, plus warnings.

Checks:
  - known env vars (warns on unknown MOOGO_* vars)
  - project URL shape
  - credential presence per command type
  - common typos
`)
		return ExitOK
	}

	fmt.Fprintln(streams.Out, "Moogo CLI configuration")
	fmt.Fprintln(streams.Out)

	projectURL := first("", os.Getenv(EnvProjectURL))
	secretKey := first("", os.Getenv(EnvSecretKey))
	bucketID := first("", os.Getenv(EnvBucketAccessKeyID))
	bucketKey := first("", os.Getenv(EnvBucketSecretKey))

	fmt.Fprintf(streams.Out, "MOOGO_PROJECT_URL:      %s\n", maskOrEmpty(projectURL))
	fmt.Fprintf(streams.Out, "MOOGO_SECRET_KEY:       %s\n", maskOrEmpty(secretKey))
	fmt.Fprintf(streams.Out, "MOOGO_STORAGE_ACCESS_KEY_ID: %s\n", maskOrEmpty(bucketID))
	fmt.Fprintf(streams.Out, "MOOGO_STORAGE_SECRET_KEY:    %s\n", maskOrEmpty(bucketKey))
	fmt.Fprintln(streams.Out)

	var warnings []string
	var okCount int

	if projectURL == "" {
		warnings = append(warnings, "MOOGO_PROJECT_URL not set (required for all commands)")
	} else {
		if base, pid, err := splitProjectURL(projectURL); err != nil {
			warnings = append(warnings, fmt.Sprintf("MOOGO_PROJECT_URL invalid: %v", err))
		} else {
			okCount++
			fmt.Fprintf(streams.Out, "✓ Project URL: %s (project %s)\n", base, pid)
		}
	}

	if secretKey != "" {
		okCount++
		fmt.Fprintln(streams.Out, "✓ MOOGO_SECRET_KEY set (for db commands)")
	} else {
		warnings = append(warnings, "MOOGO_SECRET_KEY not set (required for db push/seed/reset)")
	}

	if bucketID != "" && bucketKey != "" {
		okCount++
		fmt.Fprintln(streams.Out, "✓ MOOGO_STORAGE_ACCESS_KEY_ID + MOOGO_STORAGE_SECRET_KEY set (for bucket commands)")
	} else if bucketID != "" || bucketKey != "" {
		warnings = append(warnings, "Both MOOGO_STORAGE_ACCESS_KEY_ID and MOOGO_STORAGE_SECRET_KEY must be set for bucket commands")
	} else {
		warnings = append(warnings, "Storage credentials not set (required for bucket ls/rm)")
	}

	fmt.Fprintln(streams.Out)
	for _, k := range []string{"MOOGO_API_URL", "MOOGO_PROJECT_KEY", "MOOGO_BUCKET_ACCESS_KEY_ID", "MOOGO_BUCKET_SECRET_KEY", "MOOGO_BASE_URL"} {
		if v := os.Getenv(k); v != "" {
			warnings = append(warnings, fmt.Sprintf("%s is set but not used by CLI (CLI uses MOOGO_PROJECT_URL + MOOGO_SECRET_KEY)", k))
		}
	}

	for _, env := range os.Environ() {
		parts := strings.SplitN(env, "=", 2)
		if len(parts) != 2 {
			continue
		}
		key := parts[0]
		if strings.HasPrefix(key, "MOOGO_") {
			known := false
			switch key {
			case EnvProjectURL, EnvSecretKey, EnvBucketAccessKeyID, EnvBucketSecretKey,
				"MOOGO_API_URL", "MOOGO_PROJECT_KEY", "MOOGO_BUCKET_ACCESS_KEY_ID", "MOOGO_BUCKET_SECRET_KEY",
				"MOOGO_BASE_URL", "MOOGO_PUBLIC_URL":
				known = true
			}
			if !known {
				warnings = append(warnings, fmt.Sprintf("Unknown env var: %s (check for typos)", key))
			}
		}
	}

	if len(warnings) == 0 {
		fmt.Fprintln(streams.Out, "✓ All checks passed")
		return ExitOK
	}

	fmt.Fprintf(streams.Out, "Warnings (%d):\n", len(warnings))
	for _, w := range warnings {
		fmt.Fprintf(streams.Out, "  ⚠ %s\n", w)
	}
	fmt.Fprintln(streams.Out)
	fmt.Fprintln(streams.Out, "Tip: set required vars or use flags (--url, --key, --storage-key-id, --storage-key)")
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
