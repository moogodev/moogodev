package cli

import (
	"strings"
	"testing"
)

func TestSplitProjectURLKeepsTheProjectID(t *testing.T) {
	base, projectID, err := splitProjectURL("https://api.moogo.dev/p/8f3c1a20-5b7e-4a91-9d3c-2f6b81e4a7d0/")
	if err != nil {
		t.Fatalf("splitProjectURL: %v", err)
	}
	if base != "https://api.moogo.dev/p/8f3c1a20-5b7e-4a91-9d3c-2f6b81e4a7d0" {
		t.Errorf("base = %q, want the URL trimmed of its trailing slash", base)
	}
	if projectID != "8f3c1a20-5b7e-4a91-9d3c-2f6b81e4a7d0" {
		t.Errorf("projectID = %q, want the last path segment", projectID)
	}
}

// Guessing a base for a URL that does not have the project's shape produces a
// client that answers against whatever is mounted at the path it guessed.
func TestSplitProjectURLRefusesWhatItCannotRead(t *testing.T) {
	for _, value := range []string{
		"https://api.moogo.dev",
		"https://api.moogo.dev/p/",
		"https://api.moogo.dev/p/abc/def",
		"ftp://api.moogo.dev/p/abc",
	} {
		if _, _, err := splitProjectURL(value); err == nil {
			t.Errorf("%q should be refused", value)
		}
	}
}

func TestTheFlagWinsOverTheEnvironment(t *testing.T) {
	t.Setenv(EnvProjectURL, "https://from.env/p/environment-project")
	t.Setenv(EnvSecretKey, "from-environment")

	takesValue, isBool := sharedFlags()
	flags, err := parseFlags([]string{"--url", "https://from.flag/p/flag-project", "--key", "from-flag"}, takesValue, isBool)
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
	if config.SecretKey != "from-flag" {
		t.Errorf("SecretKey = %q, want the flag's", config.SecretKey)
	}
}

func TestTheEnvironmentIsReadWhenNoFlagIsGiven(t *testing.T) {
	t.Setenv(EnvProjectURL, "https://api.moogo.dev/p/environment-project")
	t.Setenv(EnvSecretKey, "environment-key")
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
	if config.SecretKey != "environment-key" || config.BucketAccessKeyID != "environment-access" {
		t.Errorf("credentials were not read from the environment: %+v", config)
	}
}

// The two credentials are checked separately, because they guard different
// things: a command that only runs SQL should not ask for a storage key, and
// a command that only stores objects should not ask for the project key.
func TestEachCredentialIsCheckedByTheCommandThatNeedsIt(t *testing.T) {
	t.Setenv(EnvProjectURL, "https://api.moogo.dev/p/abc")

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
		t.Error("SQL without a project key should be refused")
	} else if !strings.Contains(err.Error(), EnvSecretKey) {
		t.Errorf("the message should name the variable: %v", err)
	}

	if err := config.requireStorage(); err == nil {
		t.Error("object storage without a storage credential should be refused")
	} else if !strings.Contains(err.Error(), EnvBucketAccessKeyID) {
		t.Errorf("the message should name the variable: %v", err)
	}
}
