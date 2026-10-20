package cli

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net/http"
	"strings"
	"testing"
)

func TestDBPushSendsTheFileAsOneTransaction(t *testing.T) {
	api := newFakeAPI(t, func(call apiCall) (int, string) {
		if call.Method != http.MethodPost {
			t.Errorf("method = %s, want POST", call.Method)
		}
		if want := "/p/" + testProjectID + "/transaction"; call.Path != want {
			t.Errorf("path = %q, want %q", call.Path, want)
		}
		if want := "Bearer moogo_key_test"; call.Header.Get("Authorization") != want {
			t.Errorf("Authorization = %q, want %q", call.Header.Get("Authorization"), want)
		}
		if want := "application/json"; call.Header.Get("Content-Type") != want {
			t.Errorf("Content-Type = %q, want %q", call.Header.Get("Content-Type"), want)
		}
		if len(call.Body.Statements) != 2 {
			t.Fatalf("sent %d statements, want 2", len(call.Body.Statements))
		}
		if !strings.HasPrefix(call.Body.Statements[0].Query, "CREATE TABLE") {
			t.Errorf("first statement = %q", call.Body.Statements[0].Query)
		}
		return 200, `{"success": true, "rows_affected": 2, "size_bytes": 8192, "duration_ms": 5}`
	})

	path := writeSQL(t, "schema.sql",
		"CREATE TABLE users (id INTEGER PRIMARY KEY);\nINSERT INTO users VALUES (1);\n")

	code, out, errOut := api.run("db", "push", path)
	if code != ExitOK {
		t.Fatalf("exit = %d, out=%s err=%s", code, out, errOut)
	}
	if !strings.Contains(out, "applied 2 statements in 1 transaction") {
		t.Errorf("summary = %q", out)
	}
	if !strings.Contains(out, "2 rows affected") {
		t.Errorf("the summary should carry what the API reported: %q", out)
	}
}

// The API caps a transaction at 100 statements, and a seed of three hundred
// rows is ordinary. The file is applied in several transactions rather than
// refused, and the summary has to say so.
func TestDBPushSplitsAFilePastTheTransactionCap(t *testing.T) {
	var sizes []int
	api := newFakeAPI(t, func(call apiCall) (int, string) {
		sizes = append(sizes, len(call.Body.Statements))
		return 200, okTransaction
	})

	queries := strings.Repeat("INSERT INTO t VALUES (1);\n", maxStatementsPerTransaction+1)
	path := writeSQL(t, "big.sql", queries)

	code, out, errOut := api.run("db", "push", path)
	if code != ExitOK {
		t.Fatalf("exit = %d, out=%s err=%s", code, out, errOut)
	}

	if len(sizes) != 2 || sizes[0] != maxStatementsPerTransaction || sizes[1] != 1 {
		t.Errorf("batch sizes = %v, want [%d 1]", sizes, maxStatementsPerTransaction)
	}
	if !strings.Contains(out, "in 2 transactions") {
		t.Errorf("summary = %q", out)
	}
}

// A file read from a pipeline has no filename to open, and stdin is how a
// pipeline hands it over.
func TestDBPushReadsStandardInput(t *testing.T) {
	api := newFakeAPI(t, func(call apiCall) (int, string) {
		if len(call.Body.Statements) != 1 {
			t.Fatalf("sent %d statements, want 1", len(call.Body.Statements))
		}
		if !strings.HasSuffix(call.Body.Statements[0].Query, "SELECT 1") {
			t.Errorf("statement = %q, want it to end with the query from the pipe", call.Body.Statements[0].Query)
		}
		return 200, okTransaction
	})
	api.stdin = "-- from a pipeline\nSELECT 1;"

	code, out, errOut := api.run("db", "push", "-")
	if code != ExitOK {
		t.Fatalf("exit = %d, out=%s err=%s", code, out, errOut)
	}
}

// The API refuses the statement it does not like and says which one. That has
// to reach the terminal intact: "which line do I fix" is the whole question.
func TestDBPushNamesTheStatementTheAPIRefused(t *testing.T) {
	api := newFakeAPI(t, func(call apiCall) (int, string) {
		return 400, `{"error": {"code": "not_a_write", "message": "a transaction only accepts write statements; use /query for reads", "detail": "statement 2", "request_id": "req_test"}}`
	})

	path := writeSQL(t, "schema.sql", "CREATE TABLE t (id INTEGER);\nSELECT 1;\n")

	code, _, errOut := api.run("db", "push", path)
	if code != ExitFailure {
		t.Fatalf("exit = %d, want %d", code, ExitFailure)
	}
	for _, want := range []string{"not_a_write", "statement 2", "req_test"} {
		if !strings.Contains(errOut, want) {
			t.Errorf("error output %q is missing %q", errOut, want)
		}
	}
}

// SQL without a project key is a configuration problem, not a server one.
func TestDBPushWithoutAProjectKeyStopsBeforeTheRequest(t *testing.T) {
	api := newFakeAPI(t, func(call apiCall) (int, string) {
		t.Errorf("the CLI asked the API for something without a credential: %s %s", call.Method, call.Path)
		return 401, errorBody(http.StatusUnauthorized, "unauthorized", "authentication required")
	})

	path := writeSQL(t, "schema.sql", "CREATE TABLE t (id INTEGER);")

	code, _, errOut := api.runEnv(map[string]string{EnvSecretKey: ""}, "db", "push", path)
	if code != ExitUsage {
		t.Fatalf("exit = %d, want %d", code, ExitUsage)
	}
	if !strings.Contains(errOut, EnvSecretKey) {
		t.Errorf("the message should name the variable: %q", errOut)
	}
}

// Seeding twice must do nothing the second time, or a seed of users creates
// the users again on every deploy.
func TestDBSeedAppliesOnceAndRecordsTheContent(t *testing.T) {
	var transactions int
	recorded := map[string]string{}

	api := newFakeAPI(t, func(call apiCall) (int, string) {
		switch {
		case strings.HasSuffix(call.Path, "/exec"):
			if !strings.Contains(call.Body.Query, seedTable) {
				t.Errorf("exec ran something other than the seed table: %q", call.Body.Query)
			}
			return 200, `{"success": true, "rows_affected": 0, "size_bytes": 0}`

		case strings.HasSuffix(call.Path, "/query"):
			if !strings.Contains(call.Body.Query, seedTable) {
				t.Errorf("query ran something other than the seed table: %q", call.Body.Query)
			}
			hash, known := recorded[fmt.Sprint(call.Body.Args[0])]
			if !known {
				return 200, `{"success": true, "columns": ["sha256"], "rows": []}`
			}
			return 200, fmt.Sprintf(`{"success": true, "columns": ["sha256"], "rows": [["%s"]]}`, hash)

		case strings.HasSuffix(call.Path, "/transaction"):
			transactions++
			last := call.Body.Statements[len(call.Body.Statements)-1]
			if !strings.Contains(last.Query, seedTable) {
				t.Errorf("the last statement should record the seed, got %q", last.Query)
			}
			if len(last.Args) != 2 {
				t.Fatalf("the record carries %d arguments, want the name and the hash", len(last.Args))
			}
			recorded[fmt.Sprint(last.Args[0])] = fmt.Sprint(last.Args[1])
			return 200, `{"success": true, "rows_affected": 3, "size_bytes": 8192, "duration_ms": 3}`

		default:
			t.Errorf("unexpected request %s %s", call.Method, call.Path)
			return 404, errorBody(http.StatusNotFound, "not_found", "no such route")
		}
	})

	content := "INSERT INTO t VALUES (1);\nINSERT INTO t VALUES (2);\nINSERT INTO t VALUES (3);\n"
	path := writeSQL(t, "seed.sql", content)

	code, out, errOut := api.run("db", "seed", path)
	if code != ExitOK {
		t.Fatalf("first run: exit = %d, out=%s err=%s", code, out, errOut)
	}
	if !strings.Contains(out, "seeded seed.sql") || !strings.Contains(out, "3 statements") {
		t.Errorf("summary = %q", out)
	}

	// The recorded hash has to be the hash of the file, or the record says
	// nothing about what was applied.
	sum := sha256.Sum256([]byte(content))
	if recorded["seed.sql"] != hex.EncodeToString(sum[:]) {
		t.Errorf("recorded %q, want the sha256 of the file", recorded["seed.sql"])
	}

	code, out, errOut = api.run("db", "seed", path)
	if code != ExitOK {
		t.Fatalf("second run: exit = %d, out=%s err=%s", code, out, errOut)
	}
	if !strings.Contains(out, "already applied") {
		t.Errorf("second run should do nothing: %q", out)
	}
	if transactions != 1 {
		t.Errorf("the seed was applied %d times, want 1", transactions)
	}
}

// Changed content is a new seed, and --force is a way to say "yes, again".
func TestDBSeedRunsAgainWhenTheFileChangesOrForced(t *testing.T) {
	recorded := map[string]string{}
	var transactions int

	api := newFakeAPI(t, func(call apiCall) (int, string) {
		switch {
		case strings.HasSuffix(call.Path, "/exec"):
			return 200, `{"success": true}`
		case strings.HasSuffix(call.Path, "/query"):
			hash, known := recorded["seed.sql"]
			if !known {
				return 200, `{"success": true, "rows": []}`
			}
			return 200, fmt.Sprintf(`{"success": true, "rows": [["%s"]]}`, hash)
		default:
			transactions++
			last := call.Body.Statements[len(call.Body.Statements)-1]
			recorded[fmt.Sprint(last.Args[0])] = fmt.Sprint(last.Args[1])
			return 200, `{"success": true, "rows_affected": 1, "size_bytes": 8192, "duration_ms": 1}`
		}
	})

	path := writeSQL(t, "seed.sql", "INSERT INTO t VALUES (1);")
	code, out, errOut := api.run("db", "seed", path)
	if code != ExitOK {
		t.Fatalf("first run failed: %d out=%s err=%s", code, out, errOut)
	}

	path = writeSQL(t, "seed.sql", "INSERT INTO t VALUES (1);\nINSERT INTO t VALUES (2);")
	code, out, errOut = api.run("db", "seed", path)
	if code != ExitOK {
		t.Fatalf("a changed file should run again: %d out=%s err=%s", code, out, errOut)
	}
	if transactions != 2 {
		t.Errorf("a changed file should run again: %d transactions, want 2", transactions)
	}

	code, out, errOut = api.run("db", "seed", path)
	if code != ExitOK {
		t.Fatalf("third run: %d out=%s err=%s", code, out, errOut)
	}
	if !strings.Contains(out, "already applied") {
		t.Errorf("the changed file should now be recorded: %q", out)
	}

	code, out, errOut = api.run("db", "seed", "--force", path)
	if code != ExitOK || !strings.Contains(out, "seeded") {
		t.Errorf("--force should run it again: %q (exit %d)", out, code)
	}
	if transactions != 3 {
		t.Errorf("--force should apply the file: %d transactions, want 3", transactions)
	}
}

// A destructive command that runs from a typo is the one people remember, so
// it asks for the word in full.
func TestDBResetRefusesWithoutConfirmation(t *testing.T) {
	api := newFakeAPI(t, func(call apiCall) (int, string) {
		t.Errorf("reset without --yes reached the API: %s %s", call.Method, call.Path)
		return 200, okTransaction
	})

	code, _, errOut := api.run("db", "reset")
	if code != ExitUsage {
		t.Fatalf("exit = %d, want %d", code, ExitUsage)
	}
	if !strings.Contains(errOut, "--yes") {
		t.Errorf("the message should name the flag: %q", errOut)
	}
}

// Foreign keys decide the order: a table other rows point at cannot go first,
// and a reset that ignores that stops halfway with a constraint error.
func TestDBResetDropsChildrenBeforeParents(t *testing.T) {
	var dropped []string

	api := newFakeAPI(t, func(call apiCall) (int, string) {
		switch {
		case strings.Contains(call.Body.Query, "pragma_foreign_key_list"):
			return 200, `{"success": true, "columns": ["name", "table"], "rows": [
				["orders", "users"], ["order_items", "orders"]]}`

		case strings.HasPrefix(call.Body.Query, "SELECT name, type FROM sqlite_master"):
			return 200, `{"success": true, "columns": ["name", "type"], "rows": [
				["users", "table"], ["orders", "table"], ["order_items", "table"], ["report", "view"]]}`

		case strings.HasSuffix(call.Path, "/transaction"):
			for _, statement := range call.Body.Statements {
				dropped = append(dropped, statement.Query)
			}
			return 200, okTransaction

		default:
			t.Errorf("unexpected request %s %s", call.Method, call.Path)
			return 404, errorBody(http.StatusNotFound, "not_found", "no such route")
		}
	})

	code, out, errOut := api.run("db", "reset", "--yes")
	if code != ExitOK {
		t.Fatalf("exit = %d, out=%s err=%s", code, out, errOut)
	}

	want := []string{
		`DROP VIEW IF EXISTS "report"`,
		`DROP TABLE IF EXISTS "order_items"`,
		`DROP TABLE IF EXISTS "orders"`,
		`DROP TABLE IF EXISTS "users"`,
	}
	if len(dropped) != len(want) {
		t.Fatalf("dropped %q, want %q", dropped, want)
	}
	for index := range want {
		if dropped[index] != want[index] {
			t.Errorf("drop %d = %q, want %q", index, dropped[index], want[index])
		}
	}
	if !strings.Contains(out, "dropped 3 tables and 1 view") {
		t.Errorf("summary = %q", out)
	}
}

// Keys with a quote in their name are ordinary names, and the quoting has to
// survive them.
func TestDBResetQuotesIdentifiersFromTheCatalog(t *testing.T) {
	var dropped []string

	api := newFakeAPI(t, func(call apiCall) (int, string) {
		switch {
		case strings.Contains(call.Body.Query, "pragma_foreign_key_list"):
			return 200, `{"success": true, "rows": []}`
		case strings.HasPrefix(call.Body.Query, "SELECT name, type FROM sqlite_master"):
			return 200, `{"success": true, "rows": [["odd\"name", "table"]]}`
		default:
			for _, statement := range call.Body.Statements {
				dropped = append(dropped, statement.Query)
			}
			return 200, okTransaction
		}
	})

	if code, _, errOut := api.run("db", "reset", "--yes"); code != ExitOK {
		t.Fatalf("exit = %d, err=%s", code, errOut)
	}

	if len(dropped) != 1 || dropped[0] != `DROP TABLE IF EXISTS "odd""name"` {
		t.Errorf("dropped %q, want the identifier quoted by doubling its quote", dropped)
	}
}

// A cycle has no drop order, and saying so is better than half a reset.
func TestDBResetReportsACycleInsteadOfHalving(t *testing.T) {
	api := newFakeAPI(t, func(call apiCall) (int, string) {
		switch {
		case strings.Contains(call.Body.Query, "pragma_foreign_key_list"):
			return 200, `{"success": true, "rows": [["a", "b"], ["b", "a"]]}`
		case strings.HasPrefix(call.Body.Query, "SELECT name, type FROM sqlite_master"):
			return 200, `{"success": true, "rows": [["a", "table"], ["b", "table"]]}`
		default:
			t.Errorf("a cycle should stop before any drop: %s %s", call.Method, call.Path)
			return 200, okTransaction
		}
	})

	code, _, errOut := api.run("db", "reset", "--yes")
	if code != ExitFailure {
		t.Fatalf("exit = %d, want %d", code, ExitFailure)
	}
	if !strings.Contains(errOut, "cycle") {
		t.Errorf("the message should name the problem: %q", errOut)
	}
}

func TestDBResetSaysSoWhenThereIsNothingToDrop(t *testing.T) {
	api := newFakeAPI(t, func(call apiCall) (int, string) {
		if strings.Contains(call.Body.Query, "pragma_foreign_key_list") {
			return 200, `{"success": true, "rows": []}`
		}
		return 200, `{"success": true, "rows": []}`
	})

	code, out, errOut := api.run("db", "reset", "--yes")
	if code != ExitOK {
		t.Fatalf("exit = %d, out=%s err=%s", code, out, errOut)
	}
	if !strings.Contains(out, "nothing to drop") {
		t.Errorf("summary = %q", out)
	}
	if len(api.paths()) != 1 {
		t.Errorf("a reset of nothing should ask one question, asked %v", api.paths())
	}
}

// help is what a person reads before anything else, so it has to be there
// without a network round trip.
func TestHelpForEveryCommand(t *testing.T) {
	cases := [][]string{
		{"help"},
		{"db", "help"},
		{"db", "push", "--help"},
		{"db", "seed", "--help"},
		{"db", "reset", "--help"},
		{"bucket", "help"},
		{"bucket", "ls", "--help"},
		{"bucket", "rm", "--help"},
	}

	for _, args := range cases {
		api := newFakeAPI(t, func(call apiCall) (int, string) {
			t.Errorf("help reached the API: %s %s", call.Method, call.Path)
			return 200, okTransaction
		})

		code, out, _ := api.run(args...)
		if code != ExitOK {
			t.Errorf("%v: exit = %d, want %d", args, code, ExitOK)
		}
		if !strings.Contains(out, "moogo") {
			t.Errorf("%v: help output is empty", args)
		}
	}
}

func TestVersionNamesTheBuild(t *testing.T) {
	api := newFakeAPI(t, func(call apiCall) (int, string) {
		t.Errorf("version reached the API: %s %s", call.Method, call.Path)
		return 200, okTransaction
	})

	code, out, _ := api.run("version")
	if code != ExitOK {
		t.Fatalf("exit = %d", code)
	}
	if strings.TrimSpace(out) == "" {
		t.Error("version printed nothing")
	}
}
