package docs

import (
	"embed"
	"io/fs"
)

//go:embed files/*.md
var EmbeddedDocs embed.FS

// GetDocsFS returns the embedded docs filesystem.
func GetDocsFS() fs.FS {
	sub, err := fs.Sub(EmbeddedDocs, "files")
	if err != nil {
		// Fall back to the whole FS: a linked import that filtered out the
		// "files" prefix would break Doc() above, which opens filenames
		// directly (e.g. "quickstart.md"). Never return a nil FS.
		return EmbeddedDocs
	}
	return sub
}