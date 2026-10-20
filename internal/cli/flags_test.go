package cli

import (
	"strings"
	"testing"
)

func TestParseFlagsTakesOptionsAnywhere(t *testing.T) {
	takesValue, isBool := sharedFlags()
	takesValue["limit"] = true
	isBool["json"] = true

	flags, err := parseFlags([]string{"avatars/", "--json", "--limit", "10", "reports"}, takesValue, isBool)
	if err != nil {
		t.Fatalf("parseFlags: %v", err)
	}

	if !flags.bools["json"] {
		t.Error("--json was not recorded")
	}
	if flags.value("limit") != "10" {
		t.Errorf("limit = %q, want 10", flags.value("limit"))
	}
	wantPositionals := []string{"avatars/", "reports"}
	if len(flags.positional) != len(wantPositionals) {
		t.Fatalf("positional = %q, want %q", flags.positional, wantPositionals)
	}
	for index := range wantPositionals {
		if flags.positional[index] != wantPositionals[index] {
			t.Errorf("positional %d = %q, want %q", index, flags.positional[index], wantPositionals[index])
		}
	}
}

func TestParseFlagsAcceptsTheEqualsForm(t *testing.T) {
	takesValue, isBool := sharedFlags()
	takesValue["limit"] = true
	isBool["json"] = true

	flags, err := parseFlags([]string{"--limit=25", "--json=false"}, takesValue, isBool)
	if err != nil {
		t.Fatalf("parseFlags: %v", err)
	}
	if flags.value("limit") != "25" {
		t.Errorf("limit = %q, want 25", flags.value("limit"))
	}
	if flags.bools["json"] {
		t.Error("--json=false should not enable --json")
	}
}

// A dash on its own is standard input, not an option.
func TestParseFlagsKeepsALoneDash(t *testing.T) {
	takesValue, isBool := sharedFlags()

	flags, err := parseFlags([]string{"-"}, takesValue, isBool)
	if err != nil {
		t.Fatalf("parseFlags: %v", err)
	}
	if len(flags.positional) != 1 || flags.positional[0] != "-" {
		t.Fatalf("positional = %q, want [\"-\"]", flags.positional)
	}
}

func TestParseFlagsRejectsWhatItDoesNotKnow(t *testing.T) {
	takesValue, isBool := sharedFlags()

	if _, err := parseFlags([]string{"--frobnicate"}, takesValue, isBool); err == nil {
		t.Error("an unknown flag should be refused")
	}
	if _, err := parseFlags([]string{"--limit"}, takesValue, isBool); err == nil {
		t.Error("a value flag with no value should be refused")
	}
	if _, err := parseFlags([]string{"--json=perhaps"}, takesValue, isBool); err == nil {
		t.Error("a boolean flag given prose should be refused")
	}
}

// A negative or non-numeric limit would only be refused by the API, with a
// message that does not mention the flag that caused it.
func TestNumberRefusesWhatIsNotANumber(t *testing.T) {
	takesValue, isBool := sharedFlags()
	takesValue["limit"] = true
	flags, err := parseFlags([]string{"--limit", "ten"}, takesValue, isBool)
	if err != nil {
		t.Fatalf("parseFlags: %v", err)
	}

	if _, err = flags.number("limit"); err == nil {
		t.Fatal("a non-numeric limit should be refused")
	}
	if message := err.Error(); !strings.Contains(message, "--limit") {
		t.Errorf("the error should name the flag: %v", err)
	}
}
