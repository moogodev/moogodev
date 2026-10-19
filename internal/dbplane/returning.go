package dbplane

import "strings"

// hasReturningClause reports whether a write statement carries a top-level
// RETURNING clause, and so asks SQLite to hand back the rows it touched.
//
// The decision decides ExecContext versus QueryContext. Getting it wrong in the
// permissive direction is safe: a statement that only looks like it has
// RETURNING runs through QueryContext, which for a plain write returns an empty
// result set and leaves the write itself unchanged. Getting it wrong the other
// way -- calling a real RETURNING an ordinary write -- is the bug this exists
// to prevent, because ExecContext silently discards the rows the caller asked
// for.
//
// The scan is aware of string literals, quoted identifiers, bracket names and
// comments so that a value or a name reading "returning" is never mistaken for
// the clause. It tracks parenthesis depth because a subquery's own RETURNING
// (or a column list) sits inside parens and is not the statement's. And it
// ignores a "returning" that directly follows a keyword introducing a name --
// INTO, TABLE, UPDATE and friends -- since there it is a table or alias, as in
// "INSERT INTO returning ...".
func hasReturningClause(statement string) bool {
	cursor := &clauseCursor{text: statement}
	depth := 0
	previous := ""

	for {
		cursor.skipSpace()
		if cursor.index >= len(cursor.text) {
			return false
		}

		character := cursor.text[cursor.index]

		switch {
		case character == '(':
			depth++
			cursor.index++
			previous = ""
			continue
		case character == ')':
			if depth > 0 {
				depth--
			}
			cursor.index++
			previous = ""
			continue
		case character == '\'' || character == '"' || character == '`':
			cursor.skipQuoted(character)
			previous = ""
			continue
		case character == '[':
			cursor.skipBracket()
			previous = ""
			continue
		}

		word := cursor.word()
		if word == "" {
			continue
		}

		if depth == 0 && word == "RETURNING" && !namePosition(previous) {
			return true
		}
		previous = word
	}
}

// namePosition reports whether a keyword introduces a name rather than being a
// clause boundary. A bare "returning" right after one of these is a table, an
// alias or a column -- not the RETURNING clause.
func namePosition(previous string) bool {
	switch previous {
	case "INTO", "TABLE", "UPDATE", "FROM", "JOIN", "INDEX",
		"VIEW", "ATTACH", "DETACH", "RENAME", "ON", "USING":
		return true
	}
	return false
}

// clauseCursor walks SQL text, aware of comments and quoted sections. It is a
// focused twin of the handler's scanCursor: dbplane cannot import handler, and
// the two walk for different purposes, so sharing would cost a cross-package
// dependency for little reuse.
type clauseCursor struct {
	text  string
	index int
}

// skipSpace advances past whitespace and comments.
func (cursor *clauseCursor) skipSpace() {
	for cursor.index < len(cursor.text) {
		character := cursor.text[cursor.index]

		if character == ' ' || character == '\t' || character == '\n' ||
			character == '\r' || character == '\f' || character == '\v' {
			cursor.index++
			continue
		}

		if strings.HasPrefix(cursor.text[cursor.index:], "--") {
			cursor.index += 2
			for cursor.index < len(cursor.text) && cursor.text[cursor.index] != '\n' {
				cursor.index++
			}
			continue
		}

		if strings.HasPrefix(cursor.text[cursor.index:], "/*") {
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

// word reads the next bare word and returns it uppercased.
//
// Quoted text is skipped rather than returned, so a literal like 'returning' is
// data and never a keyword. The cursor always advances by at least one byte so
// an unexpected character cannot loop forever.
func (cursor *clauseCursor) word() string {
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

		if isClauseWordCharacter(character) {
			cursor.index++
			continue
		}

		break
	}

	if cursor.index == start {
		cursor.index++
		return ""
	}

	return upperASCII(cursor.text[start:cursor.index])
}

// skipBracket advances past a bracket-quoted identifier.
func (cursor *clauseCursor) skipBracket() {
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
func (cursor *clauseCursor) skipQuoted(quote byte) {
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

// isClauseWordCharacter reports whether a byte can be part of an unquoted word.
func isClauseWordCharacter(character byte) bool {
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
