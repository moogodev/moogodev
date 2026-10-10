package sanitizer

import (
	"fmt"
	"strings"
)

// Error codes returned by this package.
//
// They are stable, machine-readable strings so clients can branch on them, and
// they deliberately avoid naming the internal rule that fired. A developer
// needs to know what to change, not how the check is implemented.
const (
	// CodeEmptyStatement means no SQL was supplied.
	CodeEmptyStatement = "sql_empty"
	// CodeSyntaxError means the statement could not be tokenized, typically an
	// unterminated string or comment.
	CodeSyntaxError = "sql_syntax_error"
	// CodeMultipleStatements means more than one statement was supplied.
	CodeMultipleStatements = "sql_multiple_statements"
	// CodeForbiddenKeyword means a keyword that would read files or load native
	// code was used.
	CodeForbiddenKeyword = "sql_forbidden_keyword"
	// CodeForbiddenFunction means a filesystem or extension builtin was used.
	CodeForbiddenFunction = "sql_forbidden_function"
	// CodeForbiddenPragma means a PRAGMA outside the allowlist was used.
	CodeForbiddenPragma = "sql_forbidden_pragma"
	// CodeTooLong means the statement exceeded the length limit.
	CodeTooLong = "sql_too_long"
	// CodeEmptyWrite is returned when an exec call has no statement to run.
	CodeEmptyWrite = "sql_empty_write"
)

// MaxStatementLength caps the SQL a single request may send.
//
// The limit exists to bound tokenizer work and error-message size. It is not a
// substitute for the body size limit on the HTTP layer.
const MaxStatementLength = 64 * 1024

// Error is a validation failure with a stable code for programmatic handling.
type Error struct {
	// Code is one of the Code* constants.
	Code string
	// Message explains the problem in terms the caller can act on.
	Message string
	// Keyword is the offending token, when one applies.
	Keyword string
}

func (err *Error) Error() string {
	if err.Keyword != "" {
		return fmt.Sprintf("%s: %s (offending token: %s)", err.Code, err.Message, err.Keyword)
	}
	return fmt.Sprintf("%s: %s", err.Code, err.Message)
}

func newSyntaxError(position int, reason string) *Error {
	return &Error{
		Code:    CodeSyntaxError,
		Message: fmt.Sprintf("%s at byte offset %d", reason, position),
	}
}

// Validate checks a user-supplied statement and returns a descriptive error
// when it must be rejected.
//
// Passing validation does not mean the SQL is correct or safe in every sense.
// It means the statement is a single statement that does not reach for files
// or native code. The database still enforces its own limits, and the
// connection is configured to fail rather than read outside its file.
// FirstKeyword returns the statement's leading keyword, uppercased, or an empty
// string when the statement does not start with one.
//
// Leading comments are skipped, so a statement that opens with "-- add the row
// here" is still recognised as the INSERT it is. The tokenizer is used rather
// than a prefix match for the reason the rest of this package exists: a column
// or table named insert is not an INSERT statement, and a string literal
// containing the word is not either.
//
// It exists for one caller: deciding whether a statement's rowid is one SQLite
// just assigned to a new row.
func FirstKeyword(statement string) string {
	tokens, err := tokenize(strings.TrimSpace(statement))
	if err != nil {
		return ""
	}

	for _, tok := range tokens {
		switch tok.kind {
		case tokenComment:
			continue
		case tokenKeyword:
			return tok.value
		default:
			return ""
		}
	}
	return ""
}

func Validate(statement string) error {
	trimmed := strings.TrimSpace(statement)

	if trimmed == "" {
		return &Error{
			Code:    CodeEmptyStatement,
			Message: "no SQL statement was provided",
		}
	}

	if len(trimmed) > MaxStatementLength {
		return &Error{
			Code: CodeTooLong,
			Message: fmt.Sprintf("statement is %d bytes, limit is %d",
				len(trimmed), MaxStatementLength),
		}
	}

	tokens, err := tokenize(trimmed)
	if err != nil {
		return err
	}

	if err := checkSingleStatement(tokens); err != nil {
		return err
	}
	if err := checkForbiddenKeywords(tokens); err != nil {
		return err
	}
	if err := checkForbiddenFunctions(tokens); err != nil {
		return err
	}
	if err := checkTriggers(tokens); err != nil {
		return err
	}
	if err := checkPragmas(tokens); err != nil {
		return err
	}
	return nil
}

// checkTriggers rejects CREATE TRIGGER.
//
// Triggers look like a multi-statement statement because their body sits
// between BEGIN and END and contains semicolons. Handling that properly needs a
// real parser that tracks nesting, and a hand-rolled approximation of one is
// exactly the kind of check that fails open on input SQLite accepts but this
// code does not. Triggers are also of little value to dashboard users, so the
// feature is declined rather than the parser risk absorbed.
func checkTriggers(tokens []token) error {
	for _, current := range tokens {
		if current.isKeyword("TRIGGER") {
			return &Error{
				Code:    CodeForbiddenKeyword,
				Message: "triggers are not supported",
				Keyword: "TRIGGER",
			}
		}
	}
	return nil
}

// checkSingleStatement rejects a second statement in the same request.
//
// A semicolon only counts when it sits outside a string literal or comment,
// which is why this runs on tokens rather than on the raw text. Without it,
// "SELECT 1; DROP DATABASE x" is a single prepared statement to the driver
// and two statements to SQLite.
func checkSingleStatement(tokens []token) error {
	// A trailing semicolon terminates the statement rather than starting a
	// new one, so only semicolons followed by real content are a problem.
	for index, current := range tokens {
		if current.kind != tokenPunctuation || current.value != ";" {
			continue
		}
		if !hasContentAfter(tokens, index+1) {
			continue
		}
		return &Error{
			Code:    CodeMultipleStatements,
			Message: "only one statement may be sent per request",
		}
	}
	return nil
}

// hasContentAfter reports whether any non-comment token follows the given index.
func hasContentAfter(tokens []token, start int) bool {
	for index := start; index < len(tokens); index++ {
		if tokens[index].kind != tokenComment {
			return true
		}
	}
	return false
}

// checkForbiddenKeywords rejects the statements that would read files or load
// native code.
//
// ATTACH and DETACH are the important pair: ATTACH opens an arbitrary path as
// a database, which turns the exec endpoint into a file reader for the entire
// host. VACUUM, REINDEX and the transaction-control words are blocked because
// they rewrite or replace the whole file, which bypasses the per-project size
// limit enforced on ordinary writes.
func checkForbiddenKeywords(tokens []token) error {
	forbidden := []string{
		"ATTACH",
		"DETACH",
		"VACUUM",
		"REINDEX",
		"ANALYZE",
		"BEGIN",
		"COMMIT",
		"ROLLBACK",
		"SAVEPOINT",
		"RELEASE",
	}

	for _, current := range tokens {
		for _, keyword := range forbidden {
			if current.isKeyword(keyword) {
				return &Error{
					Code:    CodeForbiddenKeyword,
					Message: "this statement type is not allowed",
					Keyword: keyword,
				}
			}
		}
	}
	return nil
}

// checkForbiddenFunctions rejects filesystem and native-code builtins.
//
// These are matched by name whether they appear as a function call or as an
// identifier. Treating the bare word as forbidden costs a column that happens
// to be named readfile, which is a far better trade than a readable /etc/passwd.
func checkForbiddenFunctions(tokens []token) error {
	for _, current := range tokens {
		if current.kind != tokenIdentifier {
			continue
		}
		if forbiddenFunctions[upperASCII(current.value)] {
			return &Error{
				Code:    CodeForbiddenFunction,
				Message: "this function is not allowed",
				Keyword: current.value,
			}
		}
	}
	return nil
}

// checkPragmas restricts PRAGMA to the read-only introspection set the
// dashboard needs.
//
// PRAGMA is allowlisted, not denylisted. Many pragmas write to the file
// (journal_mode, key, rekey, page_size, auto_vacuum, synchronous), and the
// denylist would have to stay ahead of all of them. An allowlist also keeps the
// schema inspector working, which is the whole reason PRAGMA is permitted at
// all.
func checkPragmas(tokens []token) error {
	for index, current := range tokens {
		if !current.isKeyword("PRAGMA") {
			continue
		}
		if !hasContentAfter(tokens, index+1) {
			return &Error{
				Code:    CodeForbiddenPragma,
				Message: "PRAGMA requires a name",
				Keyword: "PRAGMA",
			}
		}

		name := pragmaName(tokens[index+1:])
		if name == "" || !allowedPragmas[upperASCII(name)] {
			return &Error{
				Code:    CodeForbiddenPragma,
				Message: "this PRAGMA is not on the allowlist",
				Keyword: name,
			}
		}
	}

	// The function form never presents the PRAGMA keyword, so the loop above
	// never sees it: pragma_database_list() is one SELECT away from the
	// paths pragma database_list reports, and pragma_journal_mode() would
	// reach a pragma the keyword form's allowlist refuses. Matched by name
	// wherever it appears -- a column that happens to be called
	// pragma_custom is the cost, the same trade the forbidden functions
	// make.
	for _, current := range tokens {
		if current.kind != tokenIdentifier || !strings.HasPrefix(current.value, "PRAGMA_") {
			continue
		}
		name := strings.TrimPrefix(current.value, "PRAGMA_")
		if !allowedPragmas[name] {
			return &Error{
				Code:    CodeForbiddenPragma,
				Message: "this PRAGMA is not on the allowlist",
				Keyword: current.value,
			}
		}
	}
	return nil
}

// pragmaName extracts the pragma name from the tokens following PRAGMA.
//
// Both spellings are supported:
//
//	PRAGMA table_info(users)      -- keyword form, name is a bare word
//	pragma_table_info('users')    -- function form, name follows PRAGMA_
//
// The keyword form is the awkward case: SQLite's tokenizer treats
// table_info as two units (the TABLE keyword followed by the _info
// identifier), so the name has to be reassembled from adjacent tokens rather
// than read off a single one.
func pragmaName(tokens []token) string {
	// Skip comments to reach the first meaningful token.
	first := -1
	for index, current := range tokens {
		if current.kind != tokenComment {
			first = index
			break
		}
	}
	if first < 0 {
		return ""
	}

	leading := tokens[first]
	if leading.kind != tokenIdentifier && leading.kind != tokenKeyword {
		return ""
	}

	// Function form: the whole name is one identifier, already prefixed with
	// PRAGMA_ by the caller.
	if strings.HasPrefix(leading.value, "PRAGMA_") {
		return leading.value
	}

	name := leading.value

	// Keyword form: absorb immediately following identifiers so that
	// TABLE + _info reads back as TABLE_INFO. Only adjacent tokens qualify,
	// which stops "PRAGMA table_info users" from becoming TABLE_INFO_USERS.
	for index := first + 1; index < len(tokens); index++ {
		next := tokens[index]
		if next.kind != tokenIdentifier {
			break
		}
		// Only an identifier that was glued to the previous word can belong to
		// the name. A space-separated token is a different argument.
		if next.position != tokens[index-1].position+len(tokens[index-1].value) {
			break
		}
		name += next.value
	}

	return name
}
