package sanitizer

import (
	"errors"
	"strings"
	"testing"
)

// TestValidateRejectsFileAccess is the core security test.
//
// Each statement here reads files from the host or loads native code. If any of
// them passes validation, the exec endpoint is a file-read primitive and the
// package is not fit to deploy.
func TestValidateRejectsFileAccess(t *testing.T) {
	testCases := []struct {
		name      string
		statement string
		wantCode  string
	}{
		{
			name:      "attach reads an arbitrary file",
			statement: "ATTACH DATABASE '/etc/passwd' AS leak",
			wantCode:  CodeForbiddenKeyword,
		},
		{
			name:      "attach with select follows",
			statement: "ATTACH DATABASE '/etc/passwd' AS leak; SELECT * FROM leak.sqlite_master",
			wantCode:  CodeMultipleStatements,
		},
		{
			name:      "attach lowercase",
			statement: "attach database '/etc/passwd' as leak",
			wantCode:  CodeForbiddenKeyword,
		},
		{
			name:      "detach",
			statement: "DETACH DATABASE leak",
			wantCode:  CodeForbiddenKeyword,
		},
		{
			name:      "attach hidden in mixed case",
			statement: "AtTaCh DaTaBaSe '/etc/passwd' AS leak",
			wantCode:  CodeForbiddenKeyword,
		},
		{
			name:      "readfile",
			statement: "SELECT readfile('/etc/passwd')",
			wantCode:  CodeForbiddenFunction,
		},
		{
			name:      "readfile uppercase",
			statement: "SELECT READFILE('/etc/passwd')",
			wantCode:  CodeForbiddenFunction,
		},
		{
			name:      "writefile",
			statement: "SELECT writefile('/tmp/pwned', 'data')",
			wantCode:  CodeForbiddenFunction,
		},
		{
			name:      "load extension",
			statement: "SELECT load_extension('/tmp/evil.so')",
			wantCode:  CodeForbiddenFunction,
		},
		{
			name:      "attach after a comment",
			statement: "-- harmless\nATTACH DATABASE '/etc/passwd' AS leak",
			wantCode:  CodeForbiddenKeyword,
		},
		{
			name:      "attach after a block comment",
			statement: "/* harmless */ ATTACH DATABASE '/etc/passwd' AS leak",
			wantCode:  CodeForbiddenKeyword,
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			err := Validate(testCase.statement)
			if err == nil {
				t.Fatalf("statement was accepted but must be rejected: %q", testCase.statement)
			}

			var sanitizerError *Error
			if !errors.As(err, &sanitizerError) {
				t.Fatalf("expected *Error, got %T: %v", err, err)
			}
			if sanitizerError.Code != testCase.wantCode {
				t.Errorf("expected code %q, got %q (%v)",
					testCase.wantCode, sanitizerError.Code, err)
			}
		})
	}
}

// TestValidateAllowsLegitimateQueries guards against over-blocking.
//
// A sanitizer that rejects valid SQL pushes developers toward workarounds, which
// is how security controls get bypassed in practice. These must all pass.
func TestValidateAllowsLegitimateQueries(t *testing.T) {
	statements := []string{
		"SELECT id, name FROM users WHERE status = ?",
		"INSERT INTO users (name) VALUES (?)",
		"UPDATE users SET name = ? WHERE id = ?",
		"DELETE FROM users WHERE id = ?",
		"CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT NOT NULL)",
		"ALTER TABLE users ADD COLUMN email TEXT",
		"DROP TABLE IF EXISTS stale",
		"CREATE INDEX idx_users_name ON users (name)",
		"SELECT count(*) FROM users",

		// These contain the words ATTACH and readfile but are harmless. A
		// substring matcher would reject all of them.
		"SELECT note FROM orders WHERE note = 'please attach receipt'",
		"CREATE TABLE attachments (id INTEGER PRIMARY KEY)",
		"SELECT * FROM attachments",
		"INSERT INTO attachments (filename) VALUES ('readfile-notes.txt')",
		"SELECT * FROM docs WHERE title = 'How to ATTACH a database'",

		// Pragmas the dashboard needs for schema inspection.
		"PRAGMA table_info(users)",
		"pragma table_info(users)",
		"PRAGMA index_list(users)",
		"PRAGMA foreign_key_list(users)",
		"PRAGMA foreign_key_check",

		// Quoted identifiers and unusual but valid syntax.
		`SELECT "order" FROM "select"`,
		"SELECT * FROM t WHERE a = 1 -- trailing comment",
		"SELECT * FROM t /* inline */ WHERE a = 1",
		"SELECT 'it''s here'",
		`SELECT "say ""hi"""`,
		"SELECT * FROM [bracketed table]",

		// Semicolons inside literals must not count as statement separators.
		"INSERT INTO notes (body) VALUES ('first; second')",
		"SELECT 'a; b; c' AS multi",

		// Trailing semicolon is the same single statement.
		"SELECT 1;",
		"SELECT 1 ;   ",
	}

	for _, statement := range statements {
		t.Run(statement, func(t *testing.T) {
			if err := Validate(statement); err != nil {
				t.Errorf("legitimate query was rejected: %q\n  error: %v", statement, err)
			}
		})
	}
}

func TestValidateRejectsMultipleStatements(t *testing.T) {
	testCases := []struct {
		name      string
		statement string
	}{
		{"two selects", "SELECT 1; SELECT 2"},
		{"drop after select", "SELECT 1; DROP TABLE users"},
		{"statement after comment", "SELECT 1 /* x */; DELETE FROM users"},
		{"three statements", "SELECT 1; SELECT 2; SELECT 3"},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			err := Validate(testCase.statement)
			if err == nil {
				t.Fatalf("multiple statements were accepted: %q", testCase.statement)
			}

			var sanitizerError *Error
			if !errors.As(err, &sanitizerError) || sanitizerError.Code != CodeMultipleStatements {
				t.Errorf("expected code %q, got %v", CodeMultipleStatements, err)
			}
		})
	}
}

func TestValidateRejectsDisallowedPragmas(t *testing.T) {
	// These pragmas all rewrite the file, which would let a caller bypass the
	// per-project size limit enforced on ordinary writes.
	testCases := []struct {
		name      string
		statement string
	}{
		{"journal mode", "PRAGMA journal_mode = WAL"},
		{"page size", "PRAGMA page_size = 65536"},
		{"auto vacuum", "PRAGMA auto_vacuum = FULL"},
		{"synchronous", "PRAGMA synchronous = OFF"},
		{"key", "PRAGMA key = 'secret'"},
		{"rekey", "PRAGMA rekey = 'other'"},
		{"bare pragma", "PRAGMA"},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			err := Validate(testCase.statement)
			if err == nil {
				t.Fatalf("pragma was accepted but must be rejected: %q", testCase.statement)
			}

			var sanitizerError *Error
			if !errors.As(err, &sanitizerError) || sanitizerError.Code != CodeForbiddenPragma {
				t.Errorf("expected code %q, got %v", CodeForbiddenPragma, err)
			}
		})
	}
}

func TestValidateRejectsRewriteStatements(t *testing.T) {
	// These rewrite or replace the whole file, bypassing per-write size checks.
	statements := []string{
		"VACUUM",
		"VACUUM INTO '/tmp/copy.db'",
		"REINDEX",
		"ANALYZE",
		"BEGIN TRANSACTION",
		"COMMIT",
		"ROLLBACK",
		"SAVEPOINT sp1",
		"CREATE TRIGGER audit AFTER INSERT ON users BEGIN UPDATE counters SET n = n + 1; END",
	}

	for _, statement := range statements {
		t.Run(statement, func(t *testing.T) {
			if err := Validate(statement); err == nil {
				t.Errorf("statement was accepted but must be rejected: %q", statement)
			}
		})
	}
}

func TestValidateRejectsMalformedInput(t *testing.T) {
	testCases := []struct {
		name      string
		statement string
		wantCode  string
	}{
		{"empty", "", CodeEmptyStatement},
		{"whitespace only", "   \n\t ", CodeEmptyStatement},
		{"unterminated string", "SELECT 'unterminated", CodeSyntaxError},
		{"unterminated identifier", `SELECT "unterminated`, CodeSyntaxError},
		{"unterminated block comment", "SELECT 1 /* never closed", CodeSyntaxError},
		{"too long", strings.Repeat("SELECT 1; ", 10000), CodeTooLong},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			err := Validate(testCase.statement)
			if err == nil {
				t.Fatalf("input was accepted but must be rejected: %q", testCase.statement)
			}

			var sanitizerError *Error
			if !errors.As(err, &sanitizerError) || sanitizerError.Code != testCase.wantCode {
				t.Errorf("expected code %q, got %v", testCase.wantCode, err)
			}
		})
	}
}

// TestPragmaNameForms covers both accepted pragma spellings.
func TestPragmaNameForms(t *testing.T) {
	allowed := []string{
		"PRAGMA table_info(users)",
		"pragma_table_info('users')",
		"PRAGMA_TABLE_INFO('users')",
		"PRAGMA index_info(idx_name)",
		"PRAGMA foreign_key_list(orders)",
	}
	for _, statement := range allowed {
		if err := Validate(statement); err != nil {
			t.Errorf("allowed pragma form was rejected: %q: %v", statement, err)
		}
	}
}

func TestValidateRejectsTriggers(t *testing.T) {
	// Trigger bodies wrap multiple statements between BEGIN and END, which a
	// single-statement check cannot distinguish from a real multi-statement
	// injection. Triggers are declined rather than parsed around.
	statements := []string{
		"CREATE TRIGGER audit AFTER INSERT ON users BEGIN UPDATE counters SET n = n + 1; END",
		"CREATE TRIGGER t BEFORE DELETE ON users BEGIN SELECT raise(ABORT, 'no'); END",
	}

	for _, statement := range statements {
		t.Run(statement, func(t *testing.T) {
			if err := Validate(statement); err == nil {
				t.Errorf("trigger was accepted but must be rejected: %q", statement)
			}
		})
	}
}

// TestKeywordListCoversSecurityWords is a guard against a keyword being
// dropped from sqlKeywords and silently reclassified as an identifier, which
// would let it slip past the keyword checks.
func TestKeywordListCoversSecurityWords(t *testing.T) {
	mustBeKeywords := []string{
		"ATTACH", "DETACH", "VACUUM", "REINDEX", "ANALYZE",
		"BEGIN", "COMMIT", "ROLLBACK", "SAVEPOINT", "RELEASE",
		"PRAGMA", "CREATE", "DROP", "DELETE", "INSERT", "UPDATE", "SELECT",
	}

	for _, keyword := range mustBeKeywords {
		if !sqlKeywords[keyword] {
			t.Errorf("security-relevant keyword %q is missing from sqlKeywords and "+
				"would be lexed as an identifier", keyword)
		}
	}
}

func TestErrorMessageIncludesKeyword(t *testing.T) {
	err := Validate("ATTACH DATABASE '/etc/passwd' AS leak")
	if err == nil {
		t.Fatal("expected an error")
	}

	message := err.Error()
	if !strings.Contains(message, "ATTACH") {
		t.Errorf("error message should name the offending keyword, got: %s", message)
	}
	if !strings.Contains(message, CodeForbiddenKeyword) {
		t.Errorf("error message should include the code, got: %s", message)
	}
}

// TestQuotedForbiddenFunctionIsRejected: SQLite calls a function by the name
// its identifier spells, and quoting does not change that name. The tokenizer
// has to unquote and normalize quoted identifiers, or "readfile" arrives as an
// identifier with an empty value and sails past the by-name check.
func TestQuotedForbiddenFunctionIsRejected(t *testing.T) {
	testCases := []struct {
		name      string
		statement string
	}{
		{"double-quoted call", `SELECT "readfile"('/etc/passwd')`},
		{"double-quoted uppercase", `SELECT "READFILE"('/etc/passwd')`},
		{"double-quoted mixed case", `SELECT "ReadFile"('/etc/passwd')`},
		{"backtick call", "SELECT `writefile`('/tmp/x', 'y')"},
		{"bracket call", `SELECT [load_extension]('evil')`},
		{"quoted as a bare name", `SELECT "readfile" FROM users`},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			err := Validate(testCase.statement)
			if err == nil {
				t.Fatalf("expected %s to be rejected", testCase.statement)
			}
			var validationErr *Error
			if !errors.As(err, &validationErr) || validationErr.Code != CodeForbiddenFunction {
				t.Errorf("err = %v, want %s", err, CodeForbiddenFunction)
			}
		})
	}
}

// TestQuotedPragmaNamesAreRead: the allowlist has to see the name the pragma
// actually spells, not an empty token. An allowed pragma stays allowed behind
// any quoting style, and a forbidden one is still forbidden behind one.
func TestQuotedPragmaNamesAreRead(t *testing.T) {
	allowed := []string{
		`PRAGMA "table_info"(users)`,
		"PRAGMA `index_list`(users)",
		`PRAGMA [foreign_key_list](orders)`,
	}
	for _, statement := range allowed {
		if err := Validate(statement); err != nil {
			t.Errorf("%s: err = %v, want allowed", statement, err)
		}
	}

	forbidden := []string{
		`PRAGMA "journal_mode"`,
		"PRAGMA `page_size`",
		`PRAGMA [rekey]`,
	}
	for _, statement := range forbidden {
		err := Validate(statement)
		if err == nil {
			t.Errorf("%s: expected rejection", statement)
			continue
		}
		var validationErr *Error
		if !errors.As(err, &validationErr) || validationErr.Code != CodeForbiddenPragma {
			t.Errorf("%s: err = %v, want %s", statement, err, CodeForbiddenPragma)
		}
	}
}
