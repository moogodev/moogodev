// Package web holds the built frontend.
//
// The single-page app is built by the Vite project in web/ui and its output is
// committed to web/dist, then embedded here so a deployment is one file. The
// source tree (web/ui) is deliberately not embedded: it contains node_modules
// and is not served to anyone.
package web

import (
	"embed"
	"io/fs"
)

//go:embed all:dist
var embedded embed.FS

// Dist returns the built frontend rooted at the dist directory.
//
// It returns an error when the directory is missing, which is the case in a
// checkout that has never run the frontend build. Callers treat that as "no
// frontend" instead of refusing to start.
func Dist() (fs.FS, error) {
	return fs.Sub(embedded, "dist")
}
