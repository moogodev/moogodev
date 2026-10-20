package cli

import (
	"runtime/debug"
	"strings"
)

// buildVersion names this client.
//
// A build from a tagged release reports that tag. Everything else reports the
// revision it was built from, which is what a bug report actually needs: "dev"
// identifies every build ever made from a working tree, while "dev+40f25b5"
// identifies one.
func buildVersion() string {
	info, ok := debug.ReadBuildInfo()
	if !ok {
		return "dev"
	}

	// Go stamps a build from a working tree with a pseudo-version of the last
	// commit, dirty or not. It says nothing a person can use, so it is only
	// kept when it came from a real tag.
	version := strings.TrimPrefix(info.Main.Version, "v")
	if version == "" || strings.HasPrefix(version, "0.0.0-") || version == "(devel)" {
		version = ""
	}

	revision := ""
	for _, setting := range info.Settings {
		if setting.Key == "vcs.revision" && len(setting.Value) >= 7 {
			revision = setting.Value[:7]
			break
		}
	}

	switch {
	case version != "" && revision != "":
		return version + "+" + revision
	case version != "":
		return version
	case revision != "":
		return "dev+" + revision
	default:
		return "dev"
	}
}
