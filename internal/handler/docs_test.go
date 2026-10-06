package handler

import (
	"io/fs"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"testing/fstest"

	"github.com/moogo/moogo/pkg/logger"
)

// escapeHTML used to replace every character with itself, so markdown was
// interpolated into the docs page unescaped. /api/docs/* serves that page in
// the app's own origin, which is exactly where unescaped markdown would be
// stored XSS.
//
// These tests pin the behaviour so that a regression cannot turn the docs
// endpoints into a stored XSS bug without a test failing first.
func TestEscapeHTMLRemovesMarkupCharacters(t *testing.T) {
	testCases := []struct {
		name  string
		input string
		want  string
	}{
		{"script tag", `<script>alert(1)</script>`, "&lt;script&gt;alert(1)&lt;/script&gt;"},
		{"img onerror", `<img src=x onerror=alert(1)>`, "&lt;img src=x onerror=alert(1)&gt;"},
		{"bare ampersand", "a & b", "a &amp; b"},
		{"single quotes", `it's`, "it&#39;s"},
		{"double quotes", `say "hi"`, "say &#34;hi&#34;"},
		{"backtick", "a`b", "a&#96;b"},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			got := escapeHTML(testCase.input)
			if got != testCase.want {
				t.Errorf("escapeHTML(%q) = %q, want %q", testCase.input, got, testCase.want)
			}
		})
	}
}

// The property that matters: after escaping, the output contains no character
// that could open a tag or an attribute.
func TestEscapeHTMLLeavesNoRawMarkup(t *testing.T) {
	hostile := `<script>alert(document.cookie)</script><img src=x onerror=steal()>`

	got := escapeHTML(hostile)
	for _, char := range []string{"<", ">", `"`, "'"} {
		if strings.Contains(got, char) {
			t.Errorf("output still contains %q: %q", char, got)
		}
	}
}

// The ampersand must be escaped first, or the entities written by the later
// replacements get their own "&" re-escaped into something that renders as a
// literal tag again.
func TestEscapeHTMLIsIdempotentSafe(t *testing.T) {
	once := escapeHTML(`<b>`)

	// Escaping "<b>" must produce an entity, not a re-escaped ampersand that
	// the browser reads back as "<b>".
	if strings.Contains(once, "&amp;lt;") {
		t.Errorf("ampersand was escaped after the angle bracket: %q", once)
	}
	if once != "&lt;b&gt;" {
		t.Errorf("escapeHTML(%q) = %q, want %q", "<b>", once, "&lt;b&gt;")
	}
}

// The markdown converter is the only caller that turns a markdown file into a
// page, so the escaping has to be applied there and not merely available.
func TestMarkdownToHTMLEscapesContent(t *testing.T) {
	hostile := "# Heading\n\n<script>alert(1)</script>\n\n- <img src=x onerror=alert(1)>\n\n`code <b>`\n"

	html := markdownToHTML(hostile)
	for _, char := range []string{"<script>", "<img "} {
		if strings.Contains(html, char) {
			t.Errorf("rendered page contains unescaped %q", char)
		}
	}
}

// A table used to be recognised by the separator row alone, so the header was
// emitted as body cells before <table> was even opened, the "---" rule was
// written out as a <th> header, and </table> was never written at all.
func TestMarkdownToHTMLTableStructure(t *testing.T) {
	source := "| Endpoint | Accepts | Rejects |\n" +
		"|---|---|---|\n" +
		"| `/query` | Reads | Writes |\n" +
		"| `/exec` | Writes | Reads |\n"

	got := markdownToHTML(source)

	if idx := strings.Index(got, "<table>"); idx == -1 {
		t.Fatal("no <table> in output")
	}
	if idx := strings.Index(got, "<tr>"); idx < strings.Index(got, "<table>") {
		t.Error("a table row appears before <table>")
	}

	// The header must come from the row above the rule, not from the rule.
	if !strings.Contains(got, "<th>Endpoint</th><th>Accepts</th><th>Rejects</th>") {
		t.Errorf("header cells are wrong: %s", got)
	}
	if strings.Contains(got, "<th>---</th>") {
		t.Error("the ---|--- separator was rendered as a header cell")
	}

	if !strings.Contains(got, "<td>Writes</td>") {
		t.Errorf("body cells are missing: %s", got)
	}
	if !strings.Contains(got, "</tbody>\n</table>") {
		t.Error("the table is never closed")
	}
}

// The table has to be closed when whatever follows it is not a row, otherwise
// every later heading and paragraph is swallowed into the table body.
func TestMarkdownToHTMLTableEndsAtNonRow(t *testing.T) {
	source := "| A | B |\n|---|---|\n| 1 | 2 |\n\n## After\n"

	got := markdownToHTML(source)

	if strings.Index(got, "</table>") > strings.Index(got, "<h2>After</h2>") {
		t.Error("the table was closed after the heading instead of before it")
	}
}

// A pipe inside a sentence is not a table, and a single pipe at one end is not
// a row either.
func TestMarkdownToHTMLIgnoresNonTablePipes(t *testing.T) {
	for _, source := range []string{
		"Use a|b to join two fields.\n",
		"| dangling pipe\n",
	} {
		if got := markdownToHTML(source); strings.Contains(got, "<table>") {
			t.Errorf("%q was rendered as a table: %s", source, got)
		}
	}
}

// The table separator is what tells a header row from a body row, so a row of
// dashes in body position must not be mistaken for the rule.
func TestIsTableSeparator(t *testing.T) {
	testCases := []struct {
		line string
		want bool
	}{
		{"|---|---|", true},
		{"| --- | --- |", true},
		{"|:---|---:|", true},
		{"| Endpoint | Accepts |", false},
		{"||", false},
		{"text", false},
		{"|", false},
	}

	for _, testCase := range testCases {
		if got := isTableSeparator(testCase.line); got != testCase.want {
			t.Errorf("isTableSeparator(%q) = %v, want %v", testCase.line, got, testCase.want)
		}
	}
}

// A cell is written into the page, so it has to be escaped like any other
// markdown content.
func TestMarkdownToHTMLTableCellsAreEscaped(t *testing.T) {
	got := markdownToHTML("| A | B |\n|---|---|\n| <script>alert(1)</script> | x |\n")

	if strings.Contains(got, "<script>") {
		t.Errorf("table cell was not escaped: %s", got)
	}
	if !strings.Contains(got, "&lt;script&gt;") {
		t.Errorf("expected an escaped script tag in the cell: %s", got)
	}
}

// testDocsFS is a docs filesystem with two documents in it.
func testDocsFS() fs.FS {
	return fstest.MapFS{
		"index.md":      {Data: []byte("# Index\n\nstart [here](/docs/quickstart)")},
		"quickstart.md": {Data: []byte("# Quickstart\n\nCreate a table.")},
	}
}

func serveDocs(t *testing.T, path string) *httptest.ResponseRecorder {
	t.Helper()

	built := NewDocsHandler(testDocsFS(), logger.Nop())
	recorder := httptest.NewRecorder()
	built.Doc(recorder, httptest.NewRequest(http.MethodGet, path, nil))

	return recorder
}

// The slug is the filename without .md, taken from either prefix, so the page
// and the API return the same document for the same slug.
func TestDocResolvesSlugFromEitherPrefix(t *testing.T) {
	for _, path := range []string{"/docs/quickstart", "/docs/quickstart/", "/api/docs/quickstart"} {
		t.Run(path, func(t *testing.T) {
			recorder := serveDocs(t, path)

			if recorder.Code != http.StatusOK {
				t.Fatalf("expected 200, got %d (%s)", recorder.Code, recorder.Body.String())
			}
			if !strings.Contains(recorder.Body.String(), "Create a table.") {
				t.Errorf("wrong document served: %s", recorder.Body.String())
			}
			if got := recorder.Header().Get("Content-Type"); !strings.HasPrefix(got, "text/html") {
				t.Errorf("expected text/html, got %q", got)
			}
		})
	}
}

// A slug with no name, with or without the trailing slash, is the index.
func TestDocWithoutSlugServesIndex(t *testing.T) {
	for _, path := range []string{"/docs/", "/api/docs/"} {
		t.Run(path, func(t *testing.T) {
			recorder := serveDocs(t, path)

			if recorder.Code != http.StatusOK {
				t.Fatalf("expected 200, got %d (%s)", recorder.Code, recorder.Body.String())
			}
			if !strings.Contains(recorder.Body.String(), "start") {
				t.Errorf("expected the index document: %s", recorder.Body.String())
			}
		})
	}
}

// The slug becomes a filename, so anything that could walk out of the embedded
// filesystem has to be refused before the Open.
func TestDocRejectsTraversalAndNestedSlugs(t *testing.T) {
	for _, path := range []string{
		"/docs/../secrets",
		"/docs/%2e%2e/secrets",
		"/docs/nested/page",
		"/docs/..",
	} {
		t.Run(path, func(t *testing.T) {
			recorder := serveDocs(t, path)

			if recorder.Code != http.StatusBadRequest {
				t.Errorf("expected 400, got %d (%s)", recorder.Code, recorder.Body.String())
			}
			if !strings.Contains(recorder.Body.String(), "invalid_slug") {
				t.Errorf("expected invalid_slug, got %s", recorder.Body.String())
			}
		})
	}
}

// A document that is not there is a 404. It used to be a 500, because the
// not-found check compared the error message against a string that the
// wrapped *fs.PathError never equals.
func TestDocMissingIsNotFound(t *testing.T) {
	recorder := serveDocs(t, "/docs/nope")

	if recorder.Code != http.StatusNotFound {
		t.Errorf("expected 404, got %d (%s)", recorder.Code, recorder.Body.String())
	}
	if !strings.Contains(recorder.Body.String(), "not_found") {
		t.Errorf("expected not_found, got %s", recorder.Body.String())
	}
}

// The list is the index of the embedded filesystem, and an empty one still has
// to be an array so a client can loop over it without a null guard.
func TestDocListReturnsAnArray(t *testing.T) {
	for _, documents := range []fs.FS{
		testDocsFS(),
		fstest.MapFS{},
	} {
		built := NewDocsHandler(documents, logger.Nop())
		recorder := httptest.NewRecorder()
		built.DocList(recorder, httptest.NewRequest(http.MethodGet, "/api/docs", nil))

		if recorder.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d", recorder.Code)
		}
		if !strings.HasPrefix(recorder.Body.String(), `{"documents":[`) {
			t.Errorf("documents is not an array: %s", recorder.Body.String())
		}
	}

	built := NewDocsHandler(testDocsFS(), logger.Nop())
	recorder := httptest.NewRecorder()
	built.DocList(recorder, httptest.NewRequest(http.MethodGet, "/api/docs", nil))

	for _, slug := range []string{`"slug":"index"`, `"slug":"quickstart"`} {
		if !strings.Contains(recorder.Body.String(), slug) {
			t.Errorf("missing %s in %s", slug, recorder.Body.String())
		}
	}
}

// The inline rules used to be single ReplaceAll calls that opened <strong>,
// <em> and <code> and never closed them, and links were not converted at all.
// Each construct is pinned with the closing tag in the expectation.
func TestMarkdownToHTMLInlineConstructs(t *testing.T) {
	testCases := []struct {
		name    string
		source  string
		want    string
		notWant string
	}{
		{"link", "See [quickstart](/docs/quickstart).", `<a href="/docs/quickstart">quickstart</a>`, "[quickstart]"},
		{"anchor link", "Jump to [the table](#the-table).", `<a href="#the-table">the table</a>`, ""},
		{"bold closes", "Use **SQL**, not a DSL.", "<strong>SQL</strong>", ""},
		{"italic closes", "the shared-cluster problem is one *your* app has", "<em>your</em>", ""},
		{"code span", "run `CREATE TABLE t` once", "<code>CREATE TABLE t</code>", "&#96;CREATE"},
		{"code swallows markup", "`**not bold**`", "<code>**not bold**</code>", "<strong>"},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			got := markdownToHTML(testCase.source)
			if !strings.Contains(got, testCase.want) {
				t.Errorf("expected %q in output:\n%s", testCase.want, got)
			}
			if testCase.notWant != "" && strings.Contains(got, testCase.notWant) {
				t.Errorf("did not expect %q in output:\n%s", testCase.notWant, got)
			}
		})
	}
}

// A javascript: URL is the one link target that must never be emitted: the
// docs are served in the app origin, so an attacker-controlled markdown file
// would otherwise run script on click.
func TestMarkdownToHTMLRejectsUnsafeHrefs(t *testing.T) {
	source := "[click](javascript:alert(1)) and [ok](https://example.com/x)"

	got := markdownToHTML(source)

	if strings.Contains(got, "javascript:") {
		t.Errorf("a javascript: href was emitted:\n%s", got)
	}
	if !strings.Contains(got, `<a href="https://example.com/x">ok</a>`) {
		t.Errorf("the safe link was dropped as well:\n%s", got)
	}
}

// Blockquotes in the docs are hard-wrapped " > " lines with a bare ">" as the
// paragraph separator. They used to render as raw "> text" paragraphs.
func TestMarkdownToHTMLBlockquote(t *testing.T) {
	source := "> **Tip:** one line\n> still the quote\n>\n> second paragraph\n\nAfter\n"

	got := markdownToHTML(source)

	if !strings.Contains(got, "<blockquote>") {
		t.Fatalf("no blockquote in output:\n%s", got)
	}
	if strings.Contains(got, "\n> ") {
		t.Errorf("raw quote markers left in output:\n%s", got)
	}
	if !strings.Contains(got, "<strong>Tip:</strong>") {
		t.Errorf("inline markdown inside the quote was not converted:\n%s", got)
	}
	// The paragraph break inside the quote must not escape the quote, and the
	// text after the blank line must be back outside it.
	if idx, close := strings.Index(got, "<p>second paragraph</p>"), strings.Index(got, "</blockquote>"); idx == -1 || idx > close {
		t.Errorf("the second quote paragraph is outside the blockquote:\n%s", got)
	}
	if strings.Index(got, "</blockquote>") > strings.Index(got, "<p>After</p>") {
		t.Errorf("the blockquote swallowed the following paragraph:\n%s", got)
	}
}

// An ordered list closed with </ul>, which the browser treats as an error and
// recovers from by ending the list early; and a two-digit marker was not a
// marker at all, so the item fell through to the paragraph branch.
func TestMarkdownToHTMLOrderedListStructure(t *testing.T) {
	source := "1. first\n2. second\n\n## After\n"
	got := markdownToHTML(source)

	if !strings.Contains(got, "<ol>") || !strings.Contains(got, "</ol>") {
		t.Errorf("ordered list is not opened and closed as <ol>:\n%s", got)
	}
	if strings.Contains(got, "</ul>") {
		t.Errorf("the ordered list was closed with </ul>:\n%s", got)
	}
	if strings.Index(got, "</ol>") > strings.Index(got, "<h2>After</h2>") {
		t.Errorf("the list was closed after the heading:\n%s", got)
	}

	multiDigit := markdownToHTML("12. twelfth\n")
	if !strings.Contains(multiDigit, "<ol>") {
		t.Errorf("a two-digit marker did not open an ordered list:\n%s", multiDigit)
	}
}

// The docs hard-wrap their prose. One <p> per source line put a paragraph
// margin between every line of a single paragraph.
func TestMarkdownToHTMLJoinsWrappedLines(t *testing.T) {
	source := "first line of a paragraph\nsecond line of the same paragraph\n\nNext one.\n"

	got := markdownToHTML(source)

	if strings.Contains(got, "<p>second line") {
		t.Errorf("wrapped lines were not joined into one paragraph:\n%s", got)
	}
	if !strings.Contains(got, "<p>first line of a paragraph second line of the same paragraph</p>") {
		t.Errorf("expected the wrapped lines joined with a space:\n%s", got)
	}
	if !strings.Contains(got, "<p>Next one.</p>") {
		t.Errorf("the blank line did not end the paragraph:\n%s", got)
	}
}

// A fenced block holding markup is text, not markup: the block content used to
// be written through unescaped.
func TestMarkdownToHTMLFencedCodeIsEscaped(t *testing.T) {
	source := "```html\n<script>alert(1)</script>\n```\n"

	got := markdownToHTML(source)

	if strings.Contains(got, "<script>") {
		t.Errorf("fenced code block was not escaped:\n%s", got)
	}
	if !strings.Contains(got, "&lt;script&gt;") {
		t.Errorf("expected the escaped tag inside the block:\n%s", got)
	}
}

// The docs wrap long list items onto an indented continuation line. That line
// used to close the list and become a paragraph after it.
func TestMarkdownToHTMLListItemContinuation(t *testing.T) {
	source := "- You want **SQL**, so you should be able to point the\n  official tooling at your data.\n- Second item.\n\nAfter.\n"

	got := markdownToHTML(source)

	if !strings.Contains(got, "<li>You want <strong>SQL</strong>, so you should be able to point the official tooling at your data.</li>") {
		t.Errorf("the indented continuation line did not stay in the item:\n%s", got)
	}
	if strings.Contains(got, "<p>official tooling") {
		t.Errorf("the continuation line became a paragraph:\n%s", got)
	}
}
