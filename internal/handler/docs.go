// Package handler implements the HTTP endpoints.
package handler

import (
	"errors"
	"fmt"
	"io/fs"
	"net/http"
	"regexp"
	"strconv"
	"strings"

	"github.com/moogodev/moogodev/internal/docs"
	"github.com/moogodev/moogodev/pkg/httpx"
	"github.com/moogodev/moogodev/pkg/logger"
)

// DocsFS is the embedded documentation filesystem.
type DocsFS interface {
	Open(name string) (fs.File, error)
}

// DocsHandler serves documentation from embedded markdown files.
type DocsHandler struct {
	docsFS DocsFS
	log    *logger.Logger
}

// NewDocsHandler creates a DocsHandler.
func NewDocsHandler(docsFS DocsFS, log *logger.Logger) *DocsHandler {
	return &DocsHandler{docsFS: docsFS, log: log}
}

// Doc serves GET /docs/:slug.
//
// The slug is the markdown filename without .md extension. E.g. /docs/DECISIONS
// serves docs/DECISIONS.md. Empty slug serves index.md.
func (handler *DocsHandler) Doc(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodHead {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.WriteHeader(http.StatusOK)
		return
	}

	slug := strings.TrimPrefix(r.URL.Path, "/api/docs/")
	slug = strings.TrimPrefix(slug, "/docs/")

	// A bare "/docs" or "/docs/" does not carry the trailing slash the
	// TrimPrefix above needs, so the leading slash is trimmed here as well;
	// without it the literal "docs" check below never matches and the
	// traversal guard rejects the path with invalid_slug.
	slug = strings.Trim(slug, "/")

	if slug == "" || slug == "docs" {
		slug = "index"
	}

	// Prevent path traversal
	if strings.Contains(slug, "..") || strings.Contains(slug, "/") {
		httpx.WriteError(w, http.StatusBadRequest, "invalid_slug", "invalid document slug")
		return
	}

	filename := slug + ".md"
	file, err := handler.docsFS.Open(filename)
	if err != nil {
		if isNotFound(err) {
			httpx.WriteError(w, http.StatusNotFound, "not_found", "document not found")
			return
		}
		handler.log.Warn("open doc failed", logger.Fields{"slug": slug, "error": err.Error()})
		httpx.WriteError(w, http.StatusInternalServerError, "doc_error", "could not load document")
		return
	}
	defer file.Close()

	stat, err := file.Stat()
	if err != nil {
		handler.log.Warn("stat doc failed", logger.Fields{"slug": slug, "error": err.Error()})
		httpx.WriteError(w, http.StatusInternalServerError, "doc_error", "could not load document")
		return
	}

	// Read the markdown content
	content := make([]byte, stat.Size())
	_, err = file.Read(content)
	if err != nil {
		handler.log.Warn("read doc failed", logger.Fields{"slug": slug, "error": err.Error()})
		httpx.WriteError(w, http.StatusInternalServerError, "doc_error", "could not load document")
		return
	}

	// Convert markdown to HTML (simple conversion for now)
	html := markdownToHTML(string(content))

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(html))
}

// DocList serves GET /docs (lists all available documents).
func (handler *DocsHandler) DocList(w http.ResponseWriter, r *http.Request) {
	entries, err := fs.ReadDir(handler.docsFS, ".")
	if err != nil {
		handler.log.Warn("read docs dir failed", logger.Fields{"error": err.Error()})
		httpx.WriteError(w, http.StatusInternalServerError, "doc_error", "could not list documents")
		return
	}

	// Initialized rather than declared nil so an empty directory answers
	// {"documents":[]} instead of {"documents":null}. Both are valid JSON but
	// only one is an array, and a client that loops over the result without a
	// null guard gets a TypeError on the response that claims to be a list.
	docs := make([]map[string]string, 0, len(entries))
	for _, entry := range entries {
		if !entry.IsDir() && strings.HasSuffix(entry.Name(), ".md") {
			name := strings.TrimSuffix(entry.Name(), ".md")
			docs = append(docs, map[string]string{
				"slug":  name,
				"title": formatTitle(name),
			})
		}
	}

	httpx.WriteJSON(w, http.StatusOK, map[string]any{
		"documents": docs,
	})
}

// isNotFound checks if an error is a "file not found" error.
//
// errors.Is with fs.ErrNotExist is the authoritative check: both embed.FS and
// os return a *fs.PathError wrapping fs.ErrNotExist, and its message ("open
// x.md: file does not exist") never equals the bare string the old comparison
// looked for, which turned every missing document into a 500 instead of a 404.
func isNotFound(err error) bool {
	return errors.Is(err, fs.ErrNotExist)
}

// markdownToHTML converts markdown to HTML (basic implementation).
func markdownToHTML(markdown string) string {
	lines := strings.Split(markdown, "\n")
	var html strings.Builder

	inCodeBlock := false
	listTag := ""
	liOpen := false
	inTable := false
	var quoteLines []string

	// closeList writes the correct closing tag for whichever list is open.
	// Writing a literal "</ul>" was the bug: an ordered list closed with the
	// wrong tag, which the browser repairs by ending the list at the first
	// stray </ul> and rendering everything after it outside the list.
	//
	// The current item's lines are buffered until it is flushed, because the
	// docs wrap long items — and the emphasis inside them — across lines, and
	// inline markdown cannot match a "**" that is split between them.
	var liContent []string
	flushItem := func() {
		if !liOpen {
			return
		}
		html.WriteString("<li>" + inlineMarkdown(strings.Join(liContent, " ")) + "</li>\n")
		liContent = nil
		liOpen = false
	}
	closeList := func() {
		flushItem()
		if listTag != "" {
			html.WriteString("</" + listTag + ">\n")
			listTag = ""
		}
	}

	openItem := func(tag, content string) {
		flushItem()
		if listTag != tag {
			closeList()
			listTag = tag
			html.WriteString("<" + tag + ">\n")
		}
		liOpen = true
		liContent = append(liContent, content)
	}

	// flushQuote ends a block of consecutive "> " lines. A bare ">" line is a
	// paragraph break inside the quote, which is how the quotes in the docs
	// separate their paragraphs.
	flushQuote := func() {
		if len(quoteLines) == 0 {
			return
		}

		html.WriteString("<blockquote>\n")
		var paragraph []string
		flushParagraph := func() {
			if len(paragraph) == 0 {
				return
			}
			html.WriteString("<p>" + inlineMarkdown(strings.Join(paragraph, " ")) + "</p>\n")
			paragraph = paragraph[:0]
		}
		for _, quoteLine := range quoteLines {
			if quoteLine == "" {
				flushParagraph()
				continue
			}
			paragraph = append(paragraph, quoteLine)
		}
		flushParagraph()
		html.WriteString("</blockquote>\n")
		quoteLines = nil
	}

	// Prose is hard-wrapped in the source files. Emitting one <p> per source
	// line put a paragraph margin between every line of the same paragraph,
	// so consecutive plain lines are buffered and joined, as markdown does.
	var prose []string
	flushProse := func() {
		if len(prose) == 0 {
			return
		}
		html.WriteString("<p>" + inlineMarkdown(strings.Join(prose, " ")) + "</p>\n")
		prose = nil
	}

	for i := 0; i < len(lines); i++ {
		line := lines[i]
		trimmed := strings.TrimSpace(line)

		// Code block fence
		if strings.HasPrefix(trimmed, "```") {
			flushProse()
			flushQuote()
			closeList()
			if inCodeBlock {
				html.WriteString("</code></pre>\n")
			} else {
				html.WriteString("<pre><code>")
			}
			inCodeBlock = !inCodeBlock
			continue
		}

		if inCodeBlock {
			// Code block content is escaped like everything else: a fenced
			// block holding an <img> tag would otherwise be written into the
			// page as live markup.
			html.WriteString(escapeHTML(line) + "\n")
			continue
		}

		// Blockquote: consecutive lines starting with ">".
		if strings.HasPrefix(trimmed, ">") {
			flushProse()
			if inTable {
				html.WriteString("</tbody>\n</table>\n")
				inTable = false
			}
			closeList()
			quoteLines = append(quoteLines, strings.TrimSpace(strings.TrimPrefix(trimmed, ">")))
			continue
		}
		flushQuote()

		// A blank line ends the buffered prose. A list survives it, so that
		// "item\n\nparagraph" closes the list on the paragraph line rather
		// than merging the paragraph into the last item.
		if trimmed == "" {
			flushProse()
			continue
		}

		// Table header: a row of pipes whose next line is the ---|--- rule.
		//
		// The lookahead is what makes a table recognisable. Matching on the
		// separator alone treated the row *above* it as body cells, so the
		// table opened in the middle of its own header and </table> was
		// never written at all.
		if isTableRow(trimmed) && i+1 < len(lines) &&
			isTableSeparator(strings.TrimSpace(lines[i+1])) {
			flushProse()
			closeList()
			html.WriteString("<table>\n<thead>\n<tr>")
			for _, cell := range splitTableCells(trimmed) {
				html.WriteString("<th>" + inlineMarkdown(cell) + "</th>")
			}
			html.WriteString("</tr>\n</thead>\n<tbody>\n")
			inTable = true
			i++ // skip the separator row
			continue
		}

		// A body row of an open table. The first line that is not a row ends
		// the table, and then falls through to be handled as whatever it is.
		if inTable {
			if !isTableRow(trimmed) {
				html.WriteString("</tbody>\n</table>\n")
				inTable = false
			} else {
				html.WriteString("<tr>")
				for _, cell := range splitTableCells(trimmed) {
					html.WriteString("<td>" + inlineMarkdown(cell) + "</td>")
				}
				html.WriteString("</tr>\n")
				continue
			}
		}

		// Headers
		if strings.HasPrefix(trimmed, "# ") {
			flushProse()
			closeList()
			html.WriteString("<h1>" + inlineMarkdown(strings.TrimPrefix(trimmed, "# ")) + "</h1>\n")
			continue
		}
		if strings.HasPrefix(trimmed, "## ") {
			flushProse()
			closeList()
			html.WriteString("<h2>" + inlineMarkdown(strings.TrimPrefix(trimmed, "## ")) + "</h2>\n")
			continue
		}
		if strings.HasPrefix(trimmed, "### ") {
			flushProse()
			closeList()
			html.WriteString("<h3>" + inlineMarkdown(strings.TrimPrefix(trimmed, "### ")) + "</h3>\n")
			continue
		}

		// Unordered list item
		if strings.HasPrefix(trimmed, "- ") || strings.HasPrefix(trimmed, "* ") {
			flushProse()
			openItem("ul", trimmed[2:])
			continue
		}

		// Ordered list item. The marker is one or more digits followed by
		// ". ", so "12. " is a marker as much as "1. " is.
		if content, ok := orderedListItemContent(trimmed); ok {
			flushProse()
			openItem("ol", content)
			continue
		}

		// An indented line while a list is open continues the current item
		// rather than ending the list: the docs wrap long items onto the next
		// line with a two-space indent.
		if listTag != "" && line != "" && (line[0] == ' ' || line[0] == '\t') {
			liContent = append(liContent, trimmed)
			continue
		}

		if listTag != "" {
			closeList()
		}

		// Paragraph: buffered so that hard-wrapped source lines rejoin.
		prose = append(prose, trimmed)
	}

	flushProse()
	closeList()
	flushQuote()
	if inTable {
		html.WriteString("</tbody>\n</table>\n")
	}

	return fmt.Sprintf(`<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Moogo Documentation</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 2rem; line-height: 1.6; color: #1a1a2e; background: #f8f9fa; }
        h1, h2, h3 { color: #1a1a2e; margin-top: 2rem; }
        code { background: #e9ecef; padding: 0.2em 0.4em; border-radius: 4px; font-family: ui-monospace, SFMono-Regular, monospace; }
        pre { background: #2d2d2d; color: #f8f8f2; padding: 1rem; border-radius: 8px; overflow-x: auto; }
        pre code { background: none; padding: 0; color: inherit; }
        table { width: 100%%; border-collapse: collapse; margin: 1rem 0; }
        th, td { border: 1px solid #dee2e6; padding: 0.75rem; text-align: left; }
        th { background: #e9ecef; font-weight: 600; }
        a { color: #2563eb; }
        a:hover { text-decoration: underline; }
        ul, ol { padding-left: 1.5rem; }
        li { margin: 0.5rem 0; }
        blockquote { border-left: 4px solid #dee2e6; margin: 1rem 0; padding: 0.25rem 1rem; color: #555; background: #f1f3f5; border-radius: 0 8px 8px 0; }
        blockquote p { margin: 0.5rem 0; }
    </style>
</head>
<body>
    %s
</body>
</html>`, html.String())
}

// orderedListItemContent returns the item text when trimmed starts with an
// ordered marker such as "1. " or "12. ", and false otherwise.
//
// The old check read only trimmed[1] == '.', so "10. " never opened an <ol>
// and the item fell through to the paragraph branch.
func orderedListItemContent(trimmed string) (string, bool) {
	i := 0
	for i < len(trimmed) && trimmed[i] >= '0' && trimmed[i] <= '9' {
		i++
	}
	if i == 0 || i+2 > len(trimmed) {
		return "", false
	}
	if trimmed[i] != '.' || trimmed[i+1] != ' ' {
		return "", false
	}
	return trimmed[i+2:], true
}

var (
	codeSpanPattern  = regexp.MustCompile("`([^`]+)`")
	linkPattern      = regexp.MustCompile(`\[([^\]]+)\]\(([^)\s]+)\)`)
	boldPattern      = regexp.MustCompile(`\*\*([^*]+)\*\*`)
	italicPattern    = regexp.MustCompile(`\*([^*\s][^*]*[^*\s]|[^*\s])\*`)
	referencePattern = regexp.MustCompile(`(^|[\s(])(https?://[^\s<>"')\]]+)`)
)

// inlineMarkdown converts the inline markdown of one line or cell: code spans,
// links, bold, italic, and bare URLs.
//
// Everything is escaped first, so the markup this function inserts is the only
// markup left in the output. The order matters: code spans are masked out
// before any other rule runs, so `**not bold**` inside backticks stays literal
// — and a construct that *wraps* a code span ("**`0` means no limit**") still
// has both of its markers in the same string, which they never are when the
// line is processed segment by segment.
func inlineMarkdown(s string) string {
	spans := codeSpanPattern.FindAllStringSubmatch(s, -1)
	if len(spans) == 0 {
		return convertInlineText(s)
	}

	codes := make([]string, len(spans))
	for i, span := range spans {
		codes[i] = "<code>" + escapeHTML(span[1]) + "</code>"
	}

	// The mask is NUL-delimited digits: escapeHTML leaves it untouched and no
	// markdown rule below matches it, so it survives to the restore pass.
	n := 0
	masked := codeSpanPattern.ReplaceAllStringFunc(s, func(string) string {
		mask := "\x00" + strconv.Itoa(n) + "\x00"
		n++
		return mask
	})

	out := convertInlineText(masked)
	for i, code := range codes {
		out = strings.Replace(out, "\x00"+strconv.Itoa(i)+"\x00", code, 1)
	}
	return out
}

// convertInlineText escapes and then links/bolds/italicises a run of text
// that contains no code spans.
func convertInlineText(s string) string {
	out := escapeHTML(s)

	// Links. The URL was escaped with the text, so a quote cannot break out
	// of the href attribute; javascript: is rejected outright.
	out = linkPattern.ReplaceAllStringFunc(out, func(match string) string {
		sub := linkPattern.FindStringSubmatch(match)
		if !safeHref(sub[2]) {
			return sub[1]
		}
		return `<a href="` + sub[2] + `">` + sub[1] + `</a>`
	})

	// Bare URLs. The leading capture keeps the match off the inside of an
	// anchor: the href is preceded by '"' and the anchor text by '>', so a
	// URL already wrapped by the link rule above is never wrapped twice.
	out = referencePattern.ReplaceAllString(out, "$1<a href=\"$2\">$2</a>")

	out = boldPattern.ReplaceAllString(out, "<strong>$1</strong>")
	out = italicPattern.ReplaceAllString(out, "<em>$1</em>")
	return out
}

// safeHref reports whether url may be placed in an href attribute.
func safeHref(url string) bool {
	lower := strings.ToLower(strings.TrimSpace(url))
	switch {
	case strings.HasPrefix(lower, "http://"), strings.HasPrefix(lower, "https://"):
		return true
	case strings.HasPrefix(lower, "mailto:"):
		return true
	case strings.HasPrefix(lower, "/"), strings.HasPrefix(lower, "#"):
		return true
	case strings.ContainsAny(lower, ":"):
		// Any other scheme (javascript:, data:, ...) is refused.
		return false
	}
	// A relative URL without a scheme.
	return !strings.Contains(lower, ":")
}

// isTableRow reports whether a trimmed line is a markdown table row.
//
// It needs a pipe at each end and at least one between them, so a paragraph
// that merely mentions a pipe ("use a|b") is not mistaken for a row.
func isTableRow(trimmed string) bool {
	return strings.HasPrefix(trimmed, "|") &&
		strings.HasSuffix(trimmed, "|") &&
		strings.Count(trimmed, "|") >= 2
}

// isTableSeparator reports whether a trimmed line is the ---|--- rule that
// marks the end of a table header.
//
// Every cell has to be made only of dashes (optionally padded with colons for
// alignment), which is what keeps a body row such as "| -- | -- |" out.
func isTableSeparator(trimmed string) bool {
	if !isTableRow(trimmed) {
		return false
	}

	for _, cell := range splitTableCells(trimmed) {
		dashes := strings.Trim(strings.TrimSpace(cell), ":")
		if dashes == "" || strings.Trim(dashes, "-") != "" {
			return false
		}
	}

	return true
}

// splitTableCells splits a table row into its trimmed cells.
func splitTableCells(trimmed string) []string {
	cells := strings.Split(strings.Trim(trimmed, "|"), "|")
	for i, cell := range cells {
		cells[i] = strings.TrimSpace(cell)
	}
	return cells
}

// formatTitle formats a slug as a title.
func formatTitle(slug string) string {
	slug = strings.ReplaceAll(slug, "-", " ")
	slug = strings.ReplaceAll(slug, "_", " ")
	words := strings.Fields(slug)
	for i, word := range words {
		if len(word) > 0 {
			words[i] = strings.ToUpper(word[:1]) + word[1:]
		}
	}
	return strings.Join(words, " ")
}

// escapeHTML escapes HTML special characters.
//
// The ampersand has to be replaced first and the others on the escaped result.
// Doing it the other way round turns the "&" of a freshly written "&lt;" back
// into a bare "&", so "<b>" would come out as "&lt;b&gt;" -> "&lt;b&gt;"
// with a raw angle bracket left in the output, which is the one character this
// function exists to remove.
//
// This used to be a no-op: every replacement mapped a character to itself, so
// markdown was interpolated into the page unescaped. It matters now that
// /api/docs/* serves these pages in the app's own origin: unescaped markdown
// from the embedded filesystem would be stored XSS there, and a function called
// escapeHTML that escapes nothing is worse than no function at all because it
// reads as protection.
func escapeHTML(s string) string {
	replacer := strings.NewReplacer(
		"&", "&amp;",
		"<", "&lt;",
		">", "&gt;",
		"`", "&#96;",
		"'", "&#39;",
		`"`, "&#34;",
	)
	return replacer.Replace(s)
}

// GetDocsFS returns the embedded docs filesystem.
func GetDocsFS() fs.FS {
	return docs.GetDocsFS()
}
