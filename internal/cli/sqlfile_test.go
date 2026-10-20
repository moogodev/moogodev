package cli

import (
	"strings"
	"testing"
)

// A semicolon inside a string or an identifier ends nothing. Splitting there
// sends half a statement, which the API refuses with a message about a line
// that is not the problem.
func TestSplitStatementsKeepsSemicolonsInsideLiterals(t *testing.T) {
	statements, err := splitStatements(`INSERT INTO notes VALUES ('one; two', "semi; colon"); SELECT 1;`)
	if err != nil {
		t.Fatalf("splitStatements: %v", err)
	}

	want := []string{
		`INSERT INTO notes VALUES ('one; two', "semi; colon")`,
		`SELECT 1`,
	}
	if len(statements) != len(want) {
		t.Fatalf("got %d statements %q, want %d", len(statements), statements, len(want))
	}
	for index := range want {
		if statements[index] != want[index] {
			t.Errorf("statement %d = %q, want %q", index, statements[index], want[index])
		}
	}
}

// Two quotes in a row are one escaped quote, not the end of the literal.
func TestSplitStatementsHandlesEscapedQuotes(t *testing.T) {
	statements, err := splitStatements(`INSERT INTO notes VALUES ('it''s; fine'); SELECT 1;`)
	if err != nil {
		t.Fatalf("splitStatements: %v", err)
	}
	if len(statements) != 2 {
		t.Fatalf("got %d statements %q, want 2", len(statements), statements)
	}
	if !strings.Contains(statements[0], `'it''s; fine'`) {
		t.Errorf("the literal did not survive: %q", statements[0])
	}
}

// Comments are not statements, and a semicolon inside one is not a separator.
func TestSplitStatementsIgnoresComments(t *testing.T) {
	const source = `
-- a comment with a ; in it
CREATE TABLE t (id INTEGER); /* block; comment */
/* nested /* still a comment; */ */
SELECT 1;
`

	statements, err := splitStatements(source)
	if err != nil {
		t.Fatalf("splitStatements: %v", err)
	}
	if len(statements) != 2 {
		t.Fatalf("got %d statements %q, want 2", len(statements), statements)
	}
	if !strings.Contains(statements[0], "CREATE TABLE") {
		t.Errorf("first statement = %q, want the CREATE TABLE in it", statements[0])
	}
}

// A file of comments and blank lines has nothing to send. Sending it would
// produce "transaction_empty" for a file that looks perfectly full.
func TestSplitStatementsDropsCommentOnlyFragments(t *testing.T) {
	statements, err := splitStatements("-- nothing here\n\n/* nor here */\n; ; ;\nSELECT 1;\n")
	if err != nil {
		t.Fatalf("splitStatements: %v", err)
	}
	if len(statements) != 1 || statements[0] != "SELECT 1" {
		t.Fatalf("got %q, want just SELECT 1", statements)
	}
}

func TestSplitStatementsDropsAStrailingTerminator(t *testing.T) {
	statements, err := splitStatements("SELECT 1;")
	if err != nil {
		t.Fatalf("splitStatements: %v", err)
	}
	if len(statements) != 1 || statements[0] != "SELECT 1" {
		t.Fatalf("got %q, want the statement without its semicolon", statements)
	}
}

// An unterminated literal is a mistake in the file, and the message should say
// so here rather than let the API answer with a parse error about statement 3.
func TestSplitStatementsReportsUnterminatedText(t *testing.T) {
	if _, err := splitStatements("INSERT INTO t VALUES ('oops);"); err == nil {
		t.Error("an unterminated string literal should be refused")
	}
	if _, err := splitStatements("SELECT /* never closed"); err == nil {
		t.Error("an unterminated block comment should be refused")
	}
}

// Every byte above 0x7F is text. Treating UTF-8 continuation bytes as space
// would trim identifiers that contain them.
func TestSplitStatementsLeavesUnicodeAlone(t *testing.T) {
	statements, err := splitStatements("INSERT INTO t VALUES ('café; naïve');")
	if err != nil {
		t.Fatalf("splitStatements: %v", err)
	}
	if len(statements) != 1 || !strings.Contains(statements[0], "café; naïve") {
		t.Fatalf("got %q, want the literal intact", statements)
	}
}
