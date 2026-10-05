// Package handler implements the HTTP endpoints.
package handler

import (
	"errors"
	"fmt"
	"io/fs"
	"net/http"
	"strings"

	"github.com/moogo/moogo/internal/docs"
	"github.com/moogo/moogo/pkg/httpx"
	"github.com/moogo/moogo/pkg/logger"
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
	inList := false
	inTable := false

	for i := 0; i < len(lines); i++ {
		line := lines[i]
		trimmed := strings.TrimSpace(line)

		// Code block
		if strings.HasPrefix(trimmed, "```") {
			if inCodeBlock {
				html.WriteString("</code></pre>\n")
				inCodeBlock = false
			} else {
				html.WriteString("<pre><code>")
				inCodeBlock = true
			}
			continue
		}

		if inCodeBlock {
			html.WriteString(line + "\n")
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
			if inList {
				html.WriteString("</ul>\n")
				inList = false
			}
			html.WriteString("<table>\n<thead>\n<tr>")
			for _, cell := range splitTableCells(trimmed) {
				html.WriteString("<th>" + escapeHTML(cell) + "</th>")
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
					html.WriteString("<td>" + escapeHTML(cell) + "</td>")
				}
				html.WriteString("</tr>\n")
				continue
			}
		}

		// Headers
		if strings.HasPrefix(trimmed, "# ") {
			if inList {
				html.WriteString("</ul>\n")
				inList = false
			}
			html.WriteString("<h1>" + escapeHTML(strings.TrimPrefix(trimmed, "# ")) + "</h1>\n")
			continue
		}
		if strings.HasPrefix(trimmed, "## ") {
			if inList {
				html.WriteString("</ul>\n")
				inList = false
			}
			html.WriteString("<h2>" + escapeHTML(strings.TrimPrefix(trimmed, "## ")) + "</h2>\n")
			continue
		}
		if strings.HasPrefix(trimmed, "### ") {
			if inList {
				html.WriteString("</ul>\n")
				inList = false
			}
			html.WriteString("<h3>" + escapeHTML(strings.TrimPrefix(trimmed, "### ")) + "</h3>\n")
			continue
		}

		// Unordered list
		if strings.HasPrefix(trimmed, "- ") || strings.HasPrefix(trimmed, "* ") {
			if !inList {
				html.WriteString("<ul>\n")
				inList = true
			}
			html.WriteString("<li>" + escapeHTML(strings.TrimPrefix(strings.TrimPrefix(trimmed, "- "), "* ")) + "</li>\n")
			continue
		}

		// Ordered list
		if len(trimmed) > 2 && trimmed[0] >= '0' && trimmed[0] <= '9' && trimmed[1] == '.' && trimmed[2] == ' ' {
			if !inList {
				html.WriteString("<ol>\n")
				inList = true
			}
			html.WriteString("<li>" + escapeHTML(strings.TrimPrefix(trimmed, trimmed[:3])) + "</li>\n")
			continue
		}

		if inList && trimmed == "" {
			continue
		}

		if inList && trimmed != "" && !strings.HasPrefix(trimmed, "- ") && !strings.HasPrefix(trimmed, "* ") && !(len(trimmed) > 2 && trimmed[0] >= '0' && trimmed[0] <= '9' && trimmed[1] == '.' && trimmed[2] == ' ') {
			html.WriteString("</ul>\n")
			inList = false
		}

		// Paragraph
		if trimmed != "" {
			if inList {
				html.WriteString("</ul>\n")
				inList = false
			}
			processed := escapeHTML(trimmed)
			processed = strings.ReplaceAll(processed, "**", "<strong>")
			processed = strings.ReplaceAll(processed, "*", "<em>")
			processed = strings.ReplaceAll(processed, "`", "<code>")
			html.WriteString("<p>" + processed + "</p>\n")
		}
	}

	if inList {
		html.WriteString("</ul>\n")
	}
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
    </style>
</head>
<body>
    %s
</body>
</html>`, html.String())
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
}// escapeHTML escapes HTML special characters.
//
// The ampersand has to be replaced first and the others on the escaped result.
// Doing it the other way round turns the "&" of a freshly written "&lt;" back
// into a bare "&", so "<b>" would come out as "&lt;b&gt;" -> "&lt;b&gt;"
// with a raw angle bracket left in the output, which is the one character this
// function exists to remove.
//
// This was a no-op: every replacement mapped a character to itself, so
// markdown was interpolated into the page unescaped. Nothing exploited it
// because the whole DocsHandler is currently shadowed by the SPA route in
// registerPages (the later chi.Get on the same pattern wins), but it is one
// route reorder away from serving stored XSS from any markdown file in the
// embed, and a function called escapeHTML that escapes nothing is worse than no
// function at all because it reads as protection.
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
