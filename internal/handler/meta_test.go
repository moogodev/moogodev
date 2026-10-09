package handler

import (
	"encoding/xml"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/moogodev/moogodev/pkg/logger"
)

// sitemapDocument mirrors just enough of the sitemap schema to parse the
// document and read the locations. Unmarshalling doubles as validation: a
// document that is not well-formed XML fails here rather than in a crawler.
type sitemapDocument struct {
	XMLName xml.Name `xml:"urlset"`
	URLs    []struct {
		Loc string `xml:"loc"`
	} `xml:"url"`
}

func TestSitemapListsTheMarketingPagesAndDocs(t *testing.T) {
	docs := NewDocsHandler(GetDocsFS(), logger.Nop())
	meta := NewMeta("https://moogo.dev/", docs, logger.Nop())

	recorder := httptest.NewRecorder()
	meta.Sitemap(recorder, httptest.NewRequest(http.MethodGet, "/sitemap.xml", nil))

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", recorder.Code)
	}
	if contentType := recorder.Header().Get("Content-Type"); !strings.HasPrefix(contentType, "application/xml") {
		t.Errorf("content type = %q, want XML", contentType)
	}

	var document sitemapDocument
	if err := xml.Unmarshal(recorder.Body.Bytes(), &document); err != nil {
		t.Fatalf("the sitemap is not XML: %v", err)
	}

	locs := map[string]bool{}
	for _, entry := range document.URLs {
		locs[entry.Loc] = true
	}

	for _, want := range []string{
		"https://moogo.dev/",
		"https://moogo.dev/plan",
		"https://moogo.dev/announcement",
		"https://moogo.dev/terms",
		"https://moogo.dev/privacy",
		"https://moogo.dev/docs",
		"https://moogo.dev/docs/quickstart",
	} {
		if !locs[want] {
			t.Errorf("missing %s", want)
		}
	}

	// index.md is the /docs landing page, not a page under /docs/:slug -- a
	// slug of "index" is not found by the SPA and would advertise a 404.
	if locs["https://moogo.dev/docs/index"] {
		t.Error("/docs/index is not a route and must not be advertised")
	}

	// The public URL had a trailing slash when it arrived; a doubled slash in
	// a loc is a different URL to a crawler.
	for loc := range locs {
		if strings.Contains(loc, "moogo.dev//") {
			t.Errorf("doubled slash in %q", loc)
		}
	}
}

func TestRobotsKeepsCrawlersOffTheMachines(t *testing.T) {
	meta := NewMeta("https://moogo.dev", nil, logger.Nop())

	recorder := httptest.NewRecorder()
	meta.Robots(recorder, httptest.NewRequest(http.MethodGet, "/robots.txt", nil))

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", recorder.Code)
	}
	body := recorder.Body.String()
	for _, want := range []string{
		"User-agent: *",
		"Disallow: /api/",
		"Disallow: /app",
		"Disallow: /p/",
		"Sitemap: https://moogo.dev/sitemap.xml",
	} {
		if !strings.Contains(body, want) {
			t.Errorf("robots.txt is missing %q:\n%s", want, body)
		}
	}
}
