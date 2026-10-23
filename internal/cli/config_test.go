package cli

import (
	"strings"
	"testing"
)

func TestBuildProjectURLJoinsOriginAndID(t *testing.T) {
	projectURL, err := buildProjectURL("https://api.moogo.dev", "8f3c1a20-5b7e-4a91-9d3c-2f6b81e4a7d0")
	if err != nil {
		t.Fatalf("buildProjectURL: %v", err)
	}
	if projectURL != "https://api.moogo.dev/p/8f3c1a20-5b7e-4a91-9d3c-2f6b81e4a7d0" {
		t.Errorf("projectURL = %q, want the origin and id joined", projectURL)
	}
}

// A base the API cannot address produces a client that answers against whatever
// is mounted at the path that got guessed.
func TestBuildProjectURLRefusesWhatItCannotUse(t *testing.T) {
	tests := []struct {
		name      string
		base      string
		projectID string
	}{
		{"scheme missing", "api.moogo.dev", "abc"},
		{"wrong scheme", "ftp://api.moogo.dev", "abc"},
		{"id with a slash", "https://api.moogo.dev", "abc/def"},
		{"id empty", "https://api.moogo.dev", ""},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if _, err := buildProjectURL(test.base, test.projectID); err == nil {
				t.Errorf("%q + %q should be refused", test.base, test.projectID)
			}
		})
	}
}

func TestTheFlagWinsOverTheEnvironment(t *testing.T) {
	t.Setenv(EnvBaseURL, "https://from.env")
	t.Setenv(EnvProjectID, "environment-project")
	t.Setenv(EnvSQLKey, "from-environment")

	takesValue, isBool := sharedFlags()
	flags, err := parseFlags([]string{
		"--base-url", "https://from.flag",
		"--project-id", "flag-project",
		"--key", "from-flag",
	}, takesValue, isBool)
	if err != nil {
		t.Fatalf("parseFlags: %v", err)
	}

	config, err := resolve(flags)
	if err != nil {
		t.Fatalf("resolve: %v", err)
	}
	if config.ProjectID != "flag-project" {
		t.Errorf("ProjectID = %q, want the flag's", config.ProjectID)
	}
	if config.ProjectURL != "https://from.flag/p/flag-project" {
		t.Errorf("ProjectURL = %q, want the flag's base and id", config.ProjectURL)
	}
	if config.SecretKey != "from-flag" {
		t.Errorf("SecretKey = %q, want the flag's", config.SecretKey)
	}
}

func TestTheEnvironmentIsReadWhenNoFlagIsGiven(t *testing.T) {
	t.Setenv(EnvBaseURL, "https://api.moogo.dev")
	t.Setenv(EnvProjectID, "environment-project")
	t.Setenv(EnvSQLKey, "environment-key")
	t.Setenv(EnvBucketAccessKeyID, "environment-access")
	t.Setenv(EnvBucketSecretKey, "environment-secret")

	takesValue, isBool := sharedFlags()
	flags, err := parseFlags(nil, takesValue, isBool)
	if err != nil {
		t.Fatalf("parseFlags: %v", err)
	}

	config, err := resolve(flags)
	if err != nil {
		t.Fatalf("resolve: %v", err)
	}
	if config.ProjectID != "environment-project" {
		t.Errorf("ProjectID = %q", config.ProjectID)
	}
	if config.ProjectURL != "https://api.moogo.dev/p/environment-project" {
		t.Errorf("ProjectURL = %q", config.ProjectURL)
	}
	if config.SecretKey != "environment-key" || config.BucketAccessKeyID != "environment-access" {
		t.Errorf("credentials were not read from the environment: %+v", config)
	}
}

// The two credentials are checked separately, because they guard different
// things: a command that only runs SQL should not ask for a storage key, and
// a command that only stores objects should not ask for the SQL key.
func TestEachCredentialIsCheckedByTheCommandThatNeedsIt(t *testing.T) {
	t.Setenv(EnvBaseURL, "https://api.moogo.dev")
	t.Setenv(EnvProjectID, "abc")

	takesValue, isBool := sharedFlags()
	flags, err := parseFlags(nil, takesValue, isBool)
	if err != nil {
		t.Fatalf("parseFlags: %v", err)
	}

	config, err := resolve(flags)
	if err != nil {
		t.Fatalf("resolve: %v", err)
	}

	if err := config.requireSecret(); err == nil {
		t.Error("SQL without a SQL key should be refused")
	} else if !strings.Contains(err.Error(), EnvSQLKey) {
		t.Errorf("the message should name the variable: %v", err)
	}

	if err := config.requireStorage(); err == nil {
		t.Error("object storage without a storage credential should be refused")
	} else if !strings.Contains(err.Error(), EnvBucketAccessKeyID) {
		t.Errorf("the message should name the variable: %v", err)
	}
}
