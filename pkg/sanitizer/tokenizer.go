// Package sanitizer validates user-supplied SQL before it reaches SQLite.
//
// This package exists because the exec endpoint accepts DDL. That makes the
// endpoint a file-read primitive for the whole server unless ATTACH and its
// relatives are blocked:
//
//	ATTACH DATABASE '/etc/passwd' AS leak;
//	SELECT * FROM leak.sqlite_master;
//
// Validation runs over tokens, never over the raw string. A substring match
// on "ATTACH" would reject legitimate queries such as a column named
// attachments or a string literal containing the word attach, which drives
// developers to work around the check rather than comply with it.
package sanitizer

// tokenKind classifies a lexed token.
type tokenKind int

const (
	tokenIdentifier tokenKind = iota
	tokenKeyword
	tokenString
	tokenNumber
	tokenPunctuation
	tokenComment
)

// token is one lexical unit of a SQL statement.
type token struct {
	kind tokenKind
	// value is the normalized text: uppercase for keywords and identifiers,
	// empty for comments.
	value string
	// position is the byte offset in the original statement, used in errors.
	position int
}

// isKeyword reports whether the token is the given keyword.
//
// Identifiers and keywords are compared separately so a column literally named
// "attach" is not treated as the ATTACH statement. SQLite does allow some
// keywords as identifiers; being strict here costs nothing because the query
// would be unusual.
func (token token) isKeyword(keyword string) bool {
	return token.kind == tokenKeyword && token.value == keyword
}

// isIdentifier reports whether the token is the given bare identifier.
func (token token) isIdentifier(name string) bool {
	return token.kind == tokenIdentifier && token.value == name
}

// tokenize splits a SQL statement into tokens.
//
// It handles the lexical forms where a naive scanner gets it wrong:
//
//   - single-quoted strings, with ” as an escaped quote
//   - double-quoted identifiers, with "" as an escaped quote
//   - backtick and bracket identifiers
//   - block comments and line comments
//
// An unterminated string or comment is an error rather than being silently
// closed, because guessing would mean validating different SQL than SQLite
// actually runs.
func tokenize(statement string) ([]token, error) {
	var tokens []token
	position := 0

	for position < len(statement) {
		character := statement[position]

		switch {
		case isWhitespace(character):
			position++
			continue

		case character == '-' && position+1 < len(statement) && statement[position+1] == '-':
			position = skipLineComment(statement, position)
			tokens = append(tokens, token{kind: tokenComment, position: position})
			continue

		case character == '/' && position+1 < len(statement) && statement[position+1] == '*':
			next, err := skipBlockComment(statement, position)
			if err != nil {
				return nil, err
			}
			position = next
			tokens = append(tokens, token{kind: tokenComment, position: position})
			continue

		case character == '\'':
			next, err := skipQuoted(statement, position, '\'')
			if err != nil {
				return nil, err
			}
			tokens = append(tokens, token{kind: tokenString, position: position})
			position = next
			continue

		case character == '"':
			next, err := skipQuoted(statement, position, '"')
			if err != nil {
				return nil, err
			}
			tokens = append(tokens, token{kind: tokenIdentifier, position: position})
			position = next
			continue

		case character == '`':
			next, err := skipQuoted(statement, position, '`')
			if err != nil {
				return nil, err
			}
			tokens = append(tokens, token{kind: tokenIdentifier, position: position})
			position = next
			continue

		case character == '[':
			next := skipBracketIdentifier(statement, position)
			tokens = append(tokens, token{kind: tokenIdentifier, position: position})
			position = next
			continue

		case isDigit(character):
			start := position
			for position < len(statement) && isNumberPart(statement[position]) {
				position++
			}
			tokens = append(tokens, token{kind: tokenNumber, position: start})
			continue

		case isIdentifierStart(character):
			start := position
			for position < len(statement) && isIdentifierPart(statement[position]) {
				position++
			}
			text := statement[start:position]
			kind := tokenIdentifier
			if sqlKeywords[upperASCII(text)] {
				kind = tokenKeyword
			}
			tokens = append(tokens, token{kind: kind, value: upperASCII(text), position: start})
			continue

		default:
			tokens = append(tokens, token{
				kind:     tokenPunctuation,
				value:    string(character),
				position: position,
			})
			position++
		}
	}

	return tokens, nil
}

// skipLineComment advances past a -- comment, which runs to end of line.
func skipLineComment(statement string, start int) int {
	position := start
	for position < len(statement) && statement[position] != '\n' {
		position++
	}
	return position
}

// skipBlockComment advances past a /* */ comment.
func skipBlockComment(statement string, start int) (int, error) {
	position := start + 2
	for position < len(statement) {
		if statement[position] == '*' && position+1 < len(statement) && statement[position+1] == '/' {
			return position + 2, nil
		}
		position++
	}
	return 0, newSyntaxError(start, "unterminated block comment")
}

// skipQuoted advances past a quoted run, treating a doubled quote as an escape.
//
// A doubled delimiter is the SQL way to embed the delimiter itself:
//
//	'it''s here'  and  "say ""hi"""
func skipQuoted(statement string, start int, delimiter byte) (int, error) {
	position := start + 1
	for position < len(statement) {
		if statement[position] != delimiter {
			position++
			continue
		}
		// A doubled delimiter is an escaped quote, not the end of the run.
		if position+1 < len(statement) && statement[position+1] == delimiter {
			position += 2
			continue
		}
		return position + 1, nil
	}
	return 0, newSyntaxError(start, "unterminated quoted literal")
}

// skipBracketIdentifier advances past a [bracketed] identifier. SQLite does not
// support escaping inside brackets, so it runs to the closing bracket.
func skipBracketIdentifier(statement string, start int) int {
	position := start + 1
	for position < len(statement) && statement[position] != ']' {
		position++
	}
	if position < len(statement) {
		position++
	}
	return position
}

func isWhitespace(character byte) bool {
	switch character {
	case ' ', '\t', '\n', '\r', '\f', '\v':
		return true
	}
	return false
}

func isDigit(character byte) bool {
	return character >= '0' && character <= '9'
}

func isNumberPart(character byte) bool {
	return isDigit(character) || character == '.' ||
		character == 'e' || character == 'E' ||
		character == 'x' || character == 'X' ||
		(character >= 'a' && character <= 'f') ||
		(character >= 'A' && character <= 'F')
}

// isIdentifierStart accepts letters, underscore and dollar. SQLite allows $ in
// identifiers, unlike most other engines, and rejecting it would break a valid
// query.
func isIdentifierStart(character byte) bool {
	return character == '_' || character == '$' || isASCIILetter(character)
}

func isIdentifierPart(character byte) bool {
	return isIdentifierStart(character) || isDigit(character)
}

func isASCIILetter(character byte) bool {
	return (character >= 'a' && character <= 'z') || (character >= 'A' && character <= 'Z')
}

// upperASCII uppercases ASCII letters only, leaving bytes of a UTF-8 identifier
// untouched. strings.ToUpper would mangle multi-byte characters.
func upperASCII(text string) string {
	hasLower := false
	for index := 0; index < len(text); index++ {
		if text[index] >= 'a' && text[index] <= 'z' {
			hasLower = true
			break
		}
	}
	if !hasLower {
		return text
	}

	buffer := []byte(text)
	for index := range buffer {
		if buffer[index] >= 'a' && buffer[index] <= 'z' {
			buffer[index] -= 'a' - 'A'
		}
	}
	return string(buffer)
}
