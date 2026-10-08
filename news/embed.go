// Package newsweb holds the built frontend of the news service.
//
// The Vite project lives in news/ and its output goes to news/dist, which is
// committed and embedded here so a deployment is one binary — the same
// arrangement as web/web.go and web/dist.
package newsweb

import (
	"embed"
	"io/fs"
)

//go:embed all:dist
var embedded embed.FS

// Dist returns the built frontend rooted at the dist directory.
//
// It returns an error when the directory is missing, which is the case in a
// checkout that has never run news' frontend build. Callers treat that as
// "no frontend" instead of refusing to start, so the API can still serve.
func Dist() (fs.FS, error) {
	return fs.Sub(embedded, "dist")
}
