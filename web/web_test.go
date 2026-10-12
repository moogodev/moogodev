package web

import (
	"io/fs"
	"testing"
)

// TestDistCarriesTheMachineReadableDocs pins the contract between the frontend
// build and the routes that serve the documentation to clients without
// JavaScript.
//
// internal/router reads these paths out of the embedded frontend by name, so a
// build that stopped writing them would only fail at request time; this fails
// at test time instead. A checkout that has never built the frontend skips
// rather than fails, matching Dist()'s "no frontend" contract.
func TestDistCarriesTheMachineReadableDocs(t *testing.T) {
	dist, err := Dist()
	if err != nil {
		t.Skipf("frontend not built: %v", err)
	}

	for _, name := range []string{
		"index.html",
		"llms.txt",
		"llms-full.txt",
		"docs/quickstart.md",
	} {
		if _, err := fs.Stat(dist, name); err != nil {
			t.Errorf("%s missing from the embedded frontend: %v", name, err)
		}
	}
}
