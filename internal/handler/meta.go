package handler

import (
	"fmt"
	"html"
	"io/fs"
	"net/http"
	"sort"
	"strings"

	"github.com/moogodev/moogodev/pkg/logger"
)

// SlugsProvider lists the documentation corpus by slug.
//
// The sitemap needs it so /docs/<each page> can be advertised without a
// second copy of the file list living in the handler.
type SlugsProvider interface {
	Slugs() []string
}

// Meta serves the crawler endpoints: /sitemap.xml and /robots.txt.
//
// Both answer on the API binary because in the single-node deployment that is
// the process on the public origin -- there is no separate static site that
// could answer for it.
type Meta struct {
	publicURL string
	docs      SlugsProvider
	log       *logger.Logger
}

// NewMeta creates the crawler handler. publicURL is the origin the site is
// published on, used verbatim in both responses.
func NewMeta(publicURL string, docs SlugsProvider, log *logger.Logger) *Meta {
	return &Meta{publicURL: strings.TrimRight(publicURL, "/"), docs: docs, log: log}
}

// staticPages are the marketing pages every deployment has, in the order a
// reader meets them. The dashboard is deliberately absent: it renders from a
// session and a crawler sees an empty shell.
var staticPages = []string{"/", "/plan", "/announcement", "/terms", "/privacy", "/docs"}

// Sitemap answers GET /sitemap.xml.
//
// The URL set is static pages plus the documentation corpus. Entries are
// absolute because that is what the format requires, and the whole response
// is cacheable for an hour: it is derived from files baked into the binary at
// build time, so it cannot change while the process runs.
func (handler *Meta) Sitemap(w http.ResponseWriter, r *http.Request) {
	var body strings.Builder
	body.WriteString(`<?xml version="1.0" encoding="UTF-8"?>` + "\n")
	body.WriteString(`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">` + "\n")

	writeURL := func(path string) {
		fmt.Fprintf(&body, "  <url><loc>%s</loc></url>\n",
			html.EscapeString(handler.publicURL+path))
	}
	for _, page := range staticPages {
		writeURL(page)
	}
	for _, slug := range handler.docSlugs() {
		if slug == "index" {
			continue
		}
		writeURL("/docs/" + slug)
	}
	body.WriteString("</urlset>\n")

	w.Header().Set("Content-Type", "application/xml; charset=utf-8")
	w.Header().Set("Cache-Control", "public, max-age=3600")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(body.String()))
}

// Robots answers GET /robots.txt.
//
// The allow list is permissive and the disallow list keeps a crawler off the
// parts that answer nothing useful to one: the API, the data plane, and the
// dashboard, where what renders depends on a cookie a crawler does not have.
// The sitemap line is how a crawler finds the URL set at all.
func (handler *Meta) Robots(w http.ResponseWriter, r *http.Request) {
	body := "User-agent: *\n" +
		"Disallow: /app\n" +
		"Disallow: /api/\n" +
		"Disallow: /p/\n" +
		"Disallow: /db/\n" +
		"Disallow: /bucket/\n" +
		"Disallow: /pub/\n" +
		"Allow: /\n" +
		"\n" +
		"Sitemap: " + handler.publicURL + "/sitemap.xml\n"

	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.Header().Set("Cache-Control", "public, max-age=3600")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(body))
}

// docSlugs reads the corpus, falling back to no documentation entries on
// failure: a sitemap with the marketing pages is better than no sitemap
// because one file would not open.
func (handler *Meta) docSlugs() []string {
	if handler.docs == nil {
		return nil
	}
	slugs := handler.docs.Slugs()
	sort.Strings(slugs)
	return slugs
}

// Slugs lists every document by slug -- the filename without .md.
//
// It is a directory read rather than a package-level list so a document added
// to the corpus shows up in the sitemap without anything else remembering to
// register it.
func (handler *DocsHandler) Slugs() []string {
	entries, err := fs.ReadDir(handler.docsFS, ".")
	if err != nil {
		handler.log.Warn("list docs for slugs", logger.Fields{"error": err.Error()})
		return nil
	}

	slugs := make([]string, 0, len(entries))
	for _, entry := range entries {
		name := entry.Name()
		if entry.IsDir() || !strings.HasSuffix(name, ".md") {
			continue
		}
		slugs = append(slugs, strings.TrimSuffix(name, ".md"))
	}
	sort.Strings(slugs)
	return slugs
}
