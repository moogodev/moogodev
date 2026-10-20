package cli

import (
	"fmt"
	"io"
	"os"
	"strings"
)

// readSource reads a SQL file, or the terminal's stdin when the path is "-".
//
// The bytes are returned rather than the parsed statements because a seed file
// is identified by its content hash, and hashing what was sent -- not what the
// parser made of it -- is what makes "this file has already been applied" a
// statement about the file rather than about the parser.
func readSource(in io.Reader, path string) ([]byte, error) {
	if path == "-" {
		raw, err := io.ReadAll(in)
		if err != nil {
			return nil, fmt.Errorf("read stdin: %w", err)
		}
		return raw, nil
	}

	raw, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	return raw, nil
}

// readStatements reads a SQL file and splits it into the statements this API
// accepts. It reads from the terminal's stdin when the path is "-".
func readStatements(in io.Reader, path string) ([]string, error) {
	raw, err := readSource(in, path)
	if err != nil {
		return nil, err
	}

	statements, err := splitStatements(string(raw))
	if err != nil {
		return nil, fmt.Errorf("%s: %w", displayPath(path), err)
	}
	if len(statements) == 0 {
		return nil, fmt.Errorf("%s contains no statements", displayPath(path))
	}

	return statements, nil
}

// displayPath names a file in a message, and says what "-" means there.
func displayPath(path string) string {
	if path == "-" {
		return "standard input"
	}
	return path
}

// The lexer states a statement can be in while it is being split.
const (
	stateSQL = iota
	stateSingleQuote
	stateDoubleQuote
	stateBacktick
	stateLineComment
	stateBlockComment
)

// splitStatements splits SQL text on the semicolons that end a statement.
//
// A semicolon only ends a statement where a statement can end: not inside a
// string literal, not inside a quoted identifier, and not inside a comment.
// Getting this wrong is not cosmetic -- a split inside a literal sends half a
// statement to the API, which then refuses it, and the message names a line
// that has nothing wrong with it.
//
// Semicolons are dropped from the output. SQLite does not need the terminator
// when a statement travels alone, and dropping it keeps the count of
// statements in a file equal to the count of statements sent.
func splitStatements(text string) ([]string, error) {
	var (
		statements []string
		current    strings.Builder
		// content records whether the statement being built says anything at
		// all. A file of comments and blank lines has none, and sending those
		// would produce "transaction_empty" for a file that looks non-empty.
		content bool
		state   = stateSQL
		depth   int
	)

	flush := func() {
		statement := strings.TrimSpace(current.String())
		if content && statement != "" {
			statements = append(statements, statement)
		}
		current.Reset()
		content = false
	}

	for index := 0; index < len(text); index++ {
		char := text[index]
		next := byte(0)
		if index+1 < len(text) {
			next = text[index+1]
		}

		switch state {
		case stateSQL:
			switch {
			case char == ';':
				flush()
				continue

			case char == '-' && next == '-':
				state = stateLineComment
				current.WriteString("--")
				index++
				continue

			case char == '/' && next == '*':
				state = stateBlockComment
				depth = 1
				current.WriteString("/*")
				index++
				continue

			case char == '\'':
				state = stateSingleQuote
				content = true

			case char == '"':
				state = stateDoubleQuote
				content = true

			case char == '`':
				state = stateBacktick
				content = true

			case !isSpace(char):
				content = true
			}
			current.WriteByte(char)

		case stateSingleQuote, stateDoubleQuote, stateBacktick:
			closing := byte('\'')
			if state == stateDoubleQuote {
				closing = '"'
			}
			if state == stateBacktick {
				closing = '`'
			}

			// Two closing quotes in a row are one escaped quote inside the
			// literal, not the end of it: 'it''s here' is one string.
			if char == closing && next == closing {
				current.WriteByte(char)
				current.WriteByte(next)
				index++
				continue
			}
			if char == closing {
				state = stateSQL
			}
			current.WriteByte(char)

		case stateLineComment:
			current.WriteByte(char)
			if char == '\n' {
				state = stateSQL
			}

		case stateBlockComment:
			if char == '/' && next == '*' {
				// SQLite nests block comments, so this opens a deeper one and
				// only the matching close ends it.
				depth++
				current.WriteString("/*")
				index++
				continue
			}
			if char == '*' && next == '/' {
				depth--
				current.WriteString("*/")
				index++
				if depth == 0 {
					state = stateSQL
				}
				continue
			}
			current.WriteByte(char)
		}
	}

	switch state {
	case stateSingleQuote:
		return nil, fmt.Errorf("an unterminated string literal")
	case stateDoubleQuote:
		return nil, fmt.Errorf("an unterminated quoted identifier")
	case stateBacktick:
		return nil, fmt.Errorf("an unterminated quoted identifier")
	case stateLineComment:
		// A comment at the end of the file needs no newline to be closed;
		// SQLite ends it at the end of the input, and so do we.
		flush()
		return statements, nil
	case stateBlockComment:
		return nil, fmt.Errorf("an unterminated block comment")
	}

	flush()
	return statements, nil
}

// isSpace reports whether a byte separates SQL tokens. Deliberately not
// unicode.IsSpace: every byte above 0x7F belongs to the text it is in, and
// treating UTF-8 continuation bytes as whitespace would trim identifiers.
func isSpace(char byte) bool {
	switch char {
	case ' ', '\t', '\n', '\r', '\v', '\f':
		return true
	}
	return false
}
