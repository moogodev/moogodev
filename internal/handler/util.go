package handler

import (
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

// now returns the current time, wrapped so the call sites read as one idea.
func now() time.Time {
	return time.Now()
}

// elapsedMs returns the milliseconds since a start time.
func elapsedMs(start time.Time) int64 {
	return time.Since(start).Milliseconds()
}

// uuidParam reads a UUID route parameter.
//
// Parsing lives here rather than in each handler so the parameter name is
// declared once. Handlers that need a different parameter name pass it in.
func uuidParam(r *http.Request, name string) (uuid.UUID, error) {
	return uuid.Parse(chi.URLParam(r, name))
}

// readKeywords are the statement keywords that return rows.
var readKeywords = map[string]bool{
	"SELECT":  true,
	"VALUES":  true,
	"PRAGMA":  true,
	"EXPLAIN": true,
}

// writeKeywords are the statement keywords that change data.
//
// The list exists to make a routing mistake obvious rather than to enforce
// security: an unlisted keyword is treated as a write, which sends it to the
// endpoint where the sanitizer still applies.
var writeKeywords = map[string]bool{
	"INSERT":    true,
	"UPDATE":    true,
	"DELETE":    true,
	"REPLACE":   true,
	"CREATE":    true,
	"ALTER":     true,
	"DROP":      true,
	"TRUNCATE":  true,
	"ATTACH":    true,
	"DETACH":    true,
	"VACUUM":    true,
	"REINDEX":   true,
	"ANALYZE":   true,
	"BEGIN":     true,
	"COMMIT":    true,
	"ROLLBACK":  true,
	"SAVEPOINT": true,
	"RELEASE":   true,
	"GRANT":     true,
	"REVOKE":    true,
}

// isReadStatement reports whether a statement returns rows.
//
// This decides which endpoint a caller meant. It is a routing hint, not a
// security gate: the sanitizer runs first on both endpoints, and the engine's
// query pool is opened query_only, so a wrong answer here cannot turn a write
// into one that modifies data.
func isReadStatement(statement string) bool {
	keyword := leadingKeyword(statement)

	switch {
	case readKeywords[keyword]:
		return true

	case keyword == "WITH":
		// A common table expression is a prefix, not a statement type. What
		// follows the last closing parenthesis decides: "WITH c AS (...) SELECT"
		// reads, "WITH c AS (...) INSERT" writes.
		return isReadAfterCTE(statement)

	default:
		return false
	}
}

// isReadAfterCTE finds the statement type behind a WITH clause.
//
// Only words outside parentheses count. The bodies of the common table
// expressions live inside them, so the first read or write keyword seen at the
// outer level is the statement itself: "WITH c AS (SELECT 1) INSERT" finds
// INSERT, not the SELECT hiding in the CTE body.
func isReadAfterCTE(statement string) bool {
	cursor := &scanCursor{text: statement}
	cursor.skipSpace()
	cursor.word() // consume WITH

	depth := 0

	for cursor.index < len(cursor.text) {
		cursor.skipSpace()
		if cursor.index >= len(cursor.text) {
			break
		}

		character := cursor.text[cursor.index]

		switch character {
		case '(':
			depth++
			cursor.index++
		case ')':
			depth--
			if depth < 0 {
				// Unbalanced parentheses. The sanitizer reports this before a
				// handler is reached, so no answer is needed here.
				return false
			}
			cursor.index++
		case ';':
			// The statement ended without a main body.
			return false
		case ',', '.':
			cursor.index++
		default:
			if depth != 0 {
				// Inside a CTE body: skip the whole word.
				cursor.word()
				continue
			}
			keyword := cursor.word()
			if readKeywords[keyword] {
				return true
			}
			if writeKeywords[keyword] {
				return false
			}
		}
	}

	return false
}

// leadingKeyword returns the first keyword of a statement, uppercased.
//
// Comments are skipped, because a statement that starts with an explanation is
// still the statement that follows it.
func leadingKeyword(statement string) string {
	cursor := &scanCursor{text: statement}
	cursor.skipSpace()
	return cursor.word()
}

// scanCursor walks SQL text, aware of comments and quoted sections.
type scanCursor struct {
	text  string
	index int
}

// skipSpace advances past whitespace and comments.
func (cursor *scanCursor) skipSpace() {
	for cursor.index < len(cursor.text) {
		character := cursor.text[cursor.index]

		if character == ' ' || character == '\t' || character == '\n' ||
			character == '\r' || character == '\f' || character == '\v' {
			cursor.index++
			continue
		}

		if cursor.atLineComment() {
			cursor.index += 2
			for cursor.index < len(cursor.text) && cursor.text[cursor.index] != '\n' {
				cursor.index++
			}
			continue
		}

		if cursor.atBlockComment() {
			cursor.index += 2
			for cursor.index < len(cursor.text) {
				if cursor.text[cursor.index] == '*' && cursor.index+1 < len(cursor.text) &&
					cursor.text[cursor.index+1] == '/' {
					cursor.index += 2
					break
				}
				cursor.index++
			}
			continue
		}

		return
	}
}

// atLineComment reports whether the cursor sits on a line comment.
func (cursor *scanCursor) atLineComment() bool {
	return strings.HasPrefix(cursor.text[cursor.index:], "--")
}

// atBlockComment reports whether the cursor sits on a block comment.
func (cursor *scanCursor) atBlockComment() bool {
	return strings.HasPrefix(cursor.text[cursor.index:], "/*")
}

// word reads the next bare word and returns it uppercased.
//
// Quoted text is skipped rather than returned: a literal like 'delete' is data,
// not a keyword, and treating it as one would misroute the statement. A
// bracket-quoted identifier such as [(x) SELECT] is consumed as one unit for
// the same reason: SQLite accepts it as a name, so the SELECT hiding inside it
// must not read as the statement type.
//
// The cursor always advances by at least one byte. A scanner that can sit still
// turns any unexpected character into an infinite loop.
func (cursor *scanCursor) word() string {
	start := cursor.index
	for cursor.index < len(cursor.text) {
		character := cursor.text[cursor.index]

		if character == '\'' || character == '"' || character == '`' {
			cursor.skipQuoted(character)
			continue
		}

		if character == '[' {
			cursor.skipBracket()
			continue
		}

		if isWordCharacter(character) {
			cursor.index++
			continue
		}

		break
	}

	if cursor.index == start {
		// Not a word character: step over it so the caller makes progress.
		cursor.index++
		return ""
	}

	return upperASCII(cursor.text[start:cursor.index])
}

// skipBracket advances past a bracket-quoted identifier.
//
// SQLite offers no escape inside brackets: the first ] closes the name, and
// an unterminated one runs to the end of the text.
func (cursor *scanCursor) skipBracket() {
	cursor.index++
	for cursor.index < len(cursor.text) {
		if cursor.text[cursor.index] == ']' {
			cursor.index++
			return
		}
		cursor.index++
	}
}

// skipQuoted advances past a quoted section, honouring doubled quotes.
func (cursor *scanCursor) skipQuoted(quote byte) {
	cursor.index++
	for cursor.index < len(cursor.text) {
		if cursor.text[cursor.index] == quote {
			if cursor.index+1 < len(cursor.text) && cursor.text[cursor.index+1] == quote {
				cursor.index += 2
				continue
			}
			cursor.index++
			return
		}
		cursor.index++
	}
}

// isWordCharacter reports whether a byte can be part of an unquoted word.
func isWordCharacter(character byte) bool {
	return character == '_' || character == '$' ||
		(character >= 'a' && character <= 'z') ||
		(character >= 'A' && character <= 'Z') ||
		(character >= '0' && character <= '9')
}

// upperASCII uppercases ASCII letters only.
//
// Byte-wise uppercasing would corrupt multi-byte UTF-8, turning one rune into
// several bytes and shifting every position after it.
func upperASCII(value string) string {
	uppered := []byte(value)
	for index, character := range uppered {
		if character >= 'a' && character <= 'z' {
			uppered[index] = character - ('a' - 'A')
		}
	}
	return string(uppered)
}
