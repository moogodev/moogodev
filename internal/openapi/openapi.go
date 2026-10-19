// Package openapi embeds the API's OpenAPI specification.
//
// The spec is the same document the TypeScript types in the dashboard are
// generated from, so a client that reads it sees the shapes the server actually
// returns rather than a description someone had to remember to update. It is
// served unauthenticated at /openapi.yaml because the routes it describes are
// themselves documented publicly: withholding the schema buys no security and
// costs every developer who would otherwise have to guess a response shape.
package openapi

import (
	"embed"
	"io/fs"
)

//go:embed moogo.yaml
var embedded embed.FS

// Spec returns the raw OpenAPI document.
func Spec() []byte {
	contents, err := embedded.ReadFile("moogo.yaml")
	if err != nil {
		// The file is compiled into the binary, so a read failure means the
		// build is broken rather than a runtime condition. An empty document
		// is returned instead of a panic so one bad handler cannot take the
		// whole process down over a documentation route.
		return nil
	}
	return contents
}

// FS exposes the embedded files for callers that want a filesystem view.
func FS() fs.FS {
	return embedded
}
