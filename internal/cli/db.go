package cli

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"net/http"
	"path/filepath"
	"sort"
	"strings"
)

// maxStatementsPerTransaction mirrors the cap the API puts on one transaction.
//
// A file that carries more than this is applied in several transactions rather
// than refused: three hundred seed rows are ordinary, and telling someone to
// split their file by hand is not advice. Each transaction still commits as a
// unit, so the failure mode is "the first N batches are in", never "half of a
// single statement".
const maxStatementsPerTransaction = 100

// The request and response shapes of the data plane's SQL routes.
//
// Mirrored here rather than imported from the server's package on purpose:
// this is a client of the API, and a client that shares the server's structs
// can no longer notice when the wire format drifts from what the documentation
// promises.
type statement struct {
	Query string `json:"query"`
	Args  []any  `json:"args"`
}

type transactionRequest struct {
	Statements []statement `json:"statements"`
}

type transactionResponse struct {
	Success      bool  `json:"success"`
	RowsAffected int64 `json:"rows_affected"`
	SizeBytes    int64 `json:"size_bytes"`
	DurationMs   int64 `json:"duration_ms"`
}

type sqlRequest struct {
	Query string `json:"query"`
	Args  []any  `json:"args"`
}

type queryResponse struct {
	Success bool     `json:"success"`
	Columns []string `json:"columns"`
	Rows    [][]any  `json:"rows"`
}

type execResponse struct {
	Success      bool  `json:"success"`
	RowsAffected int64 `json:"rows_affected"`
	SizeBytes    int64 `json:"size_bytes"`
}

// maintainResponse is the body the maintenance endpoint returns.
type maintainResponse struct {
	Success      bool  `json:"success"`
	Vacuumed     bool  `json:"vacuumed"`
	Reindexed    bool  `json:"reindexed"`
	Optimized    bool  `json:"optimized"`
	Checkpointed bool  `json:"checkpointed"`
	SizeBefore   int64 `json:"size_before_bytes"`
	SizeAfter    int64 `json:"size_after_bytes"`
	FreedBytes   int64 `json:"freed_bytes"`
	DurationMs   int64 `json:"duration_ms"`
}

// runDB dispatches the db subcommands.
func runDB(ctx context.Context, streams Streams, args []string) int {
	if len(args) == 0 {
		fmt.Fprintln(streams.Err, "moogo db needs a subcommand: push, seed, reset or vacuum")
		dbUsage(streams.Err)
		return ExitUsage
	}

	switch sub := args[0]; sub {
	case "push":
		return dbPush(ctx, streams, args[1:])
	case "seed":
		return dbSeed(ctx, streams, args[1:])
	case "reset":
		return dbReset(ctx, streams, args[1:])
	case "vacuum":
		return dbVacuum(ctx, streams, args[1:])
	case "help", "-h", "--help":
		dbUsage(streams.Out)
		return ExitOK
	default:
		fmt.Fprintf(streams.Err, "moogo: unknown db subcommand %q\n\n", sub)
		dbUsage(streams.Err)
		return ExitUsage
	}
}

// dbPush applies a SQL file to the project's database.
func dbPush(ctx context.Context, streams Streams, args []string) int {
	takesValue, isBool := sharedFlags()
	flags, err := parseFlags(args, takesValue, isBool)
	if err != nil {
		return fail(streams, err)
	}
	if flags.wantsHelp() {
		dbPushUsage(streams.Out)
		return ExitOK
	}

	if len(flags.positional) != 1 {
		return fail(streams, &commandError{errors.New(
			"usage: moogo db push <file> — use - to read the SQL from standard input")})
	}

	config, err := resolve(flags)
	if err != nil {
		return fail(streams, err)
	}
	if err := config.requireSecret(); err != nil {
		return fail(streams, err)
	}

	queries, err := readStatements(streams.In, flags.positional[0])
	if err != nil {
		return fail(streams, err)
	}

	result, err := applyStatements(ctx, newClient(config), config.projectCredential(), statementsOf(queries))
	if err != nil {
		return fail(streams, err)
	}

	fmt.Fprintf(streams.Out, "applied %s\n", applySummary(result))
	return ExitOK
}

// dbVacuum compacts the database and reports how much space it freed.
func dbVacuum(ctx context.Context, streams Streams, args []string) int {
	takesValue, isBool := sharedFlags()
	flags, err := parseFlags(args, takesValue, isBool)
	if err != nil {
		return fail(streams, err)
	}
	if flags.wantsHelp() {
		dbVacuumUsage(streams.Out)
		return ExitOK
	}
	if len(flags.positional) != 0 {
		return fail(streams, &commandError{errors.New("usage: moogo db vacuum")})
	}

	config, err := resolve(flags)
	if err != nil {
		return fail(streams, err)
	}
	if err := config.requireSecret(); err != nil {
		return fail(streams, err)
	}

	var response maintainResponse
	client := newClient(config)
	if err := client.do(ctx, http.MethodPost, config.sqlEndpoint("/maintenance"), config.projectCredential(), nil, &response); err != nil {
		return fail(streams, err)
	}

	if !response.Success {
		return fail(streams, errors.New("maintenance did not succeed"))
	}

	fmt.Fprintf(streams.Out, "vacuumed: %s freed (%s before → %s after), reindexed: %v, analyzed: %v, checkpointed: %v (%dms)\n",
		humanBytes(response.FreedBytes),
		humanBytes(response.SizeBefore),
		humanBytes(response.SizeAfter),
		response.Reindexed,
		response.Optimized,
		response.Checkpointed,
		response.DurationMs)
	return ExitOK
}

// dbSeed applies a seed file, and records its content so the same file is not
// applied twice.
//
// The recording happens in the same transaction as the seed itself: a seed
// that ran but was not recorded would run again on the next invocation, which
// is exactly the duplication the command exists to prevent.
func dbSeed(ctx context.Context, streams Streams, args []string) int {
	takesValue, isBool := sharedFlags()
	isBool["force"] = true
	flags, err := parseFlags(args, takesValue, isBool)
	if err != nil {
		return fail(streams, err)
	}
	if flags.wantsHelp() {
		dbSeedUsage(streams.Out)
		return ExitOK
	}

	if len(flags.positional) > 1 {
		return fail(streams, &commandError{errors.New("usage: moogo db seed [file]")})
	}

	file := seedFileDefault
	if len(flags.positional) == 1 {
		file = flags.positional[0]
	}

	config, err := resolve(flags)
	if err != nil {
		return fail(streams, err)
	}
	if err := config.requireSecret(); err != nil {
		return fail(streams, err)
	}

	raw, err := readSource(streams.In, file)
	if err != nil {
		return fail(streams, err)
	}

	queries, err := splitStatements(string(raw))
	if err != nil {
		return fail(streams, fmt.Errorf("%s: %w", displayPath(file), err))
	}
	if len(queries) == 0 {
		return fail(streams, fmt.Errorf("%s contains no statements", displayPath(file)))
	}

	sum := sha256.Sum256(raw)
	hash := hex.EncodeToString(sum[:])
	name := seedName(file)

	client := newClient(config)
	as := config.projectCredential()

	var created execResponse
	if err := client.do(ctx, http.MethodPost, config.sqlEndpoint("/exec"), as,
		sqlRequest{Query: seedTableDDL, Args: []any{}}, &created); err != nil {
		return fail(streams, err)
	}

	if !flags.bools["force"] {
		recorded, err := recordedSeed(ctx, client, as, name)
		if err != nil {
			return fail(streams, err)
		}
		if recorded == hash {
			fmt.Fprintf(streams.Out,
				"%s already applied (%s…); nothing to do — use --force to run it again\n",
				name, shortHash(hash))
			return ExitOK
		}
	}

	batch := statementsOf(queries)
	batch = append(batch, statement{Query: seedRecordSQL, Args: []any{name, hash}})

	result, err := applyStatements(ctx, client, as, batch)
	if err != nil {
		return fail(streams, err)
	}
	// The last statement recorded the file; it is bookkeeping, not content.
	result.Statements--

	fmt.Fprintf(streams.Out, "seeded %s — applied %s\n", name, applySummary(result))
	return ExitOK
}

// dbReset drops every table and view in the project.
//
// Dropping runs as one order rather than as one query per table because
// SQLite checks foreign keys while it works: dropping a table other rows still
// point at fails, so the tables that do the pointing have to go first.
func dbReset(ctx context.Context, streams Streams, args []string) int {
	takesValue, isBool := sharedFlags()
	isBool["yes"] = true
	flags, err := parseFlags(args, takesValue, isBool)
	if err != nil {
		return fail(streams, err)
	}
	if flags.wantsHelp() {
		dbResetUsage(streams.Out)
		return ExitOK
	}

	if len(flags.positional) > 0 {
		return fail(streams, &commandError{errors.New("usage: moogo db reset --yes")})
	}
	if !flags.bools["yes"] {
		return fail(streams, &commandError{errors.New(
			"reset drops every table and view in the project and cannot be undone\n" +
				"  run it as: moogo db reset --yes")})
	}

	config, err := resolve(flags)
	if err != nil {
		return fail(streams, err)
	}
	if err := config.requireSecret(); err != nil {
		return fail(streams, err)
	}

	client := newClient(config)
	as := config.projectCredential()

	tables, views, err := listTables(ctx, client, as)
	if err != nil {
		return fail(streams, err)
	}
	if len(tables) == 0 && len(views) == 0 {
		fmt.Fprintf(streams.Out, "nothing to drop: project %s has no tables or views\n", config.ProjectID)
		return ExitOK
	}

	references, err := foreignKeys(ctx, client, as)
	if err != nil {
		return fail(streams, err)
	}

	order, err := dropOrder(tables, references)
	if err != nil {
		return fail(streams, err)
	}

	batch := make([]statement, 0, len(views)+len(order))
	for _, view := range views {
		batch = append(batch, statement{Query: "DROP VIEW IF EXISTS " + quoteIdentifier(view), Args: []any{}})
	}
	for _, table := range order {
		batch = append(batch, statement{Query: "DROP TABLE IF EXISTS " + quoteIdentifier(table), Args: []any{}})
	}

	result, err := applyStatements(ctx, client, as, batch)
	if err != nil {
		return fail(streams, err)
	}

	// What was dropped is the whole answer, so the two kinds are named only
	// when there are some of them: "dropped 3 tables" says more than
	// "dropped 3 tables and 0 views".
	dropped := []string{}
	if len(order) > 0 {
		dropped = append(dropped, plural(len(order), "table"))
	}
	if len(views) > 0 {
		dropped = append(dropped, plural(len(views), "view"))
	}
	fmt.Fprintf(streams.Out, "dropped %s\n", strings.Join(dropped, " and "))
	if result.Transactions > 1 {
		fmt.Fprintf(streams.Out, "(in %d transactions of at most %d statements)\n",
			result.Transactions, maxStatementsPerTransaction)
	}
	return ExitOK
}

// applyResult is what a batch of statements did.
type applyResult struct {
	Transactions int
	Statements   int
	RowsAffected int64
	DurationMs   int64
	SizeBytes    int64
}

// applyStatements runs statements as one transaction per
// maxStatementsPerTransaction, in order.
//
// Every transaction is a separate request, so a failure names the batch it
// happened in: "transaction 2 of 3" says how much was already committed, which
// is the first thing anyone asks after a batch goes wrong.
func applyStatements(ctx context.Context, client *client, as credential, statements []statement) (applyResult, error) {
	var result applyResult

	for start := 0; start < len(statements); start += maxStatementsPerTransaction {
		end := min(start+maxStatementsPerTransaction, len(statements))
		payload := transactionRequest{Statements: statements[start:end]}

		var response transactionResponse
		err := client.do(ctx, http.MethodPost, client.config.sqlEndpoint("/transaction"), as, payload, &response)
		if err != nil {
			return result, fmt.Errorf("transaction %d of %d: %w",
				result.Transactions+1, transactionCount(len(statements)), err)
		}

		result.Transactions++
		result.Statements += len(payload.Statements)
		result.RowsAffected += response.RowsAffected
		result.DurationMs += response.DurationMs
		result.SizeBytes = response.SizeBytes
	}

	return result, nil
}

// transactionCount is how many transactions applyStatements will send.
func transactionCount(statements int) int {
	if statements == 0 {
		return 0
	}
	return (statements + maxStatementsPerTransaction - 1) / maxStatementsPerTransaction
}

// statementsOf wraps plain SQL in the request shape, with no arguments.
func statementsOf(queries []string) []statement {
	batch := make([]statement, len(queries))
	for index, query := range queries {
		batch[index] = statement{Query: query, Args: []any{}}
	}
	return batch
}

// applySummary renders what a batch did, in one line.
func applySummary(result applyResult) string {
	summary := fmt.Sprintf("%s in %s (%dms)",
		plural(result.Statements, "statement"),
		plural(result.Transactions, "transaction"),
		result.DurationMs)
	if result.RowsAffected > 0 {
		summary += fmt.Sprintf(", %d rows affected", result.RowsAffected)
	}
	if result.SizeBytes > 0 {
		summary += fmt.Sprintf(", database %s", humanBytes(result.SizeBytes))
	}
	return summary
}

// Where a seed file's content is recorded, and how.
//
// The table is named with a moogo prefix so a project's own tables never look
// like bookkeeping, and a reset drops it along with everything else: after a
// reset the seeds are gone from the database, so they should be gone from the
// record of what was applied as well.
const (
	seedFileDefault = "seed.sql"
	seedTable       = "_moogo_seed"

	seedTableDDL = `CREATE TABLE IF NOT EXISTS ` + seedTable + ` (
	path TEXT PRIMARY KEY,
	sha256 TEXT NOT NULL,
	applied_at TEXT NOT NULL DEFAULT (datetime('now'))
)`

	seedLookupQuery = `SELECT sha256 FROM ` + seedTable + ` WHERE path = ?`

	seedRecordSQL = `INSERT INTO ` + seedTable + ` (path, sha256, applied_at) VALUES (?, ?, datetime('now')) ` +
		`ON CONFLICT(path) DO UPDATE SET sha256 = excluded.sha256, applied_at = excluded.applied_at`
)

// seedName is the key a seed file is recorded under.
//
// The basename rather than the path: the same file applied from two checkouts
// is one seed, and a path would make the second checkout apply it again. A
// file read from standard input has no name at all, so it is recorded as one
// seed whatever was piped in.
func seedName(path string) string {
	if path == "-" {
		return "stdin"
	}
	return filepath.Base(path)
}

// recordedSeed returns the content hash stored for a seed file, or "" when the
// file has not been applied.
func recordedSeed(ctx context.Context, client *client, as credential, name string) (string, error) {
	var lookup queryResponse
	payload := sqlRequest{Query: seedLookupQuery, Args: []any{name}}
	if err := client.do(ctx, http.MethodPost, client.config.sqlEndpoint("/query"), as, payload, &lookup); err != nil {
		return "", err
	}

	for _, row := range lookup.Rows {
		if len(row) == 1 {
			if hash, ok := row[0].(string); ok {
				return hash, nil
			}
		}
	}
	return "", nil
}

// listTables asks the project what it holds.
//
// sqlite_master is the catalog of the file itself, which is why it can answer
// this at all: there is no metadata store beside the database to keep in step
// with it.
func listTables(ctx context.Context, client *client, as credential) (tables, views []string, err error) {
	var catalog queryResponse
	payload := sqlRequest{Query: listTablesQuery, Args: []any{}}
	if err := client.do(ctx, http.MethodPost, client.config.sqlEndpoint("/query"), as, payload, &catalog); err != nil {
		return nil, nil, err
	}

	for _, row := range catalog.Rows {
		if len(row) != 2 {
			continue
		}
		name, named := row[0].(string)
		kind, typed := row[1].(string)
		if !named || !typed {
			continue
		}

		if kind == "view" {
			views = append(views, name)
			continue
		}
		tables = append(tables, name)
	}

	// A view is dropped before the tables it was written against, so the order
	// they came back in is the order they go in.
	sort.Strings(views)
	sort.Strings(tables)
	return tables, views, nil
}

// foreignKeys returns which table references which, as child -> parents.
func foreignKeys(ctx context.Context, client *client, as credential) (map[string][]string, error) {
	var graph queryResponse
	payload := sqlRequest{Query: foreignKeysQuery, Args: []any{}}
	if err := client.do(ctx, http.MethodPost, client.config.sqlEndpoint("/query"), as, payload, &graph); err != nil {
		return nil, err
	}

	references := map[string][]string{}
	for _, row := range graph.Rows {
		if len(row) != 2 {
			continue
		}
		child, childOK := row[0].(string)
		parent, parentOK := row[1].(string)
		if !childOK || !parentOK {
			continue
		}
		references[child] = append(references[child], parent)
	}
	return references, nil
}

// The two reads that drive a reset. Both are ordinary SELECTs against the
// project's own catalog, and both are refused by the API if it ever decides
// they should not be readable -- which is a better answer than a reset that
// guesses.
const (
	listTablesQuery = `SELECT name, type FROM sqlite_master ` +
		`WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%' ORDER BY name`

	// The pragma is a table-valued function here: SQLite evaluates it once per
	// row of sqlite_master, so one round trip answers the question for every
	// table instead of one request each.
	foreignKeysQuery = `SELECT m.name, f."table" FROM sqlite_master AS m, ` +
		`pragma_foreign_key_list(m.name) AS f WHERE m.type = 'table'`
)

// dropOrder returns the tables in an order SQLite will accept: every table
// before the tables it references.
//
// Dropping a table that rows still point at runs an implicit delete of those
// rows, which foreign key enforcement refuses -- so a reset that ignores the
// graph stops halfway with an error about a constraint nobody wrote. Tables in
// a cycle cannot be ordered at all; SQLite only allows that when the keys are
// deferred, and it is rare enough to name rather than to work around.
func dropOrder(tables []string, references map[string][]string) ([]string, error) {
	waiting := map[string]int{}
	dependents := map[string][]string{}
	for _, table := range tables {
		waiting[table] = 0
	}

	for child, parents := range references {
		if _, known := waiting[child]; !known {
			continue
		}
		for _, parent := range parents {
			if child == parent {
				continue
			}
			if _, known := waiting[parent]; !known {
				continue
			}
			waiting[parent]++
			dependents[child] = append(dependents[child], parent)
		}
	}

	ordered := make([]string, 0, len(tables))
	ready := make([]string, 0, len(tables))
	for _, table := range tables {
		if waiting[table] == 0 {
			ready = append(ready, table)
		}
	}

	for len(ready) > 0 {
		table := ready[0]
		ready = ready[1:]
		ordered = append(ordered, table)

		for _, parent := range dependents[table] {
			waiting[parent]--
			if waiting[parent] == 0 {
				ready = append(ready, parent)
			}
		}
	}

	if len(ordered) != len(tables) {
		stuck := make([]string, 0, len(tables))
		for _, table := range tables {
			if waiting[table] > 0 {
				stuck = append(stuck, table)
			}
		}
		return nil, fmt.Errorf(
			"the foreign keys between %s form a cycle, so no drop order exists — "+
				"drop these tables one at a time, or report this as a bug",
			joinNames(stuck))
	}

	return ordered, nil
}

// joinNames renders a short list of identifiers for a message.
func joinNames(names []string) string {
	const shown = 6
	if len(names) <= shown {
		return joinComma(names)
	}
	return joinComma(names[:shown]) + fmt.Sprintf(" and %d more", len(names)-shown)
}

func joinComma(names []string) string {
	joined := ""
	for index, name := range names {
		if index > 0 {
			joined += ", "
		}
		joined += `"` + name + `"`
	}
	return joined
}

// quoteIdentifier wraps an identifier for SQL.
//
// Names come from the catalog, so they can contain anything a table name is
// allowed to contain, and the quote has to survive that. Doubling the quote is
// SQL's own escape and needs no second rule.
func quoteIdentifier(name string) string {
	return `"` + strings.ReplaceAll(name, `"`, `""`) + `"`
}

func dbUsage(writer io.Writer) {
	fmt.Fprint(writer, `moogo db — the project's database

Usage:
  moogo db push <file>    apply a SQL file to the project's database
  moogo db seed [file]    apply a seed file once (default seed.sql)
  moogo db reset --yes    drop every table and view in the project
  moogo db vacuum         reclaim free space after deleting rows

The file is applied as a transaction, so it either lands whole or not at all.
A file of more than 100 statements -- the API's cap on one transaction -- is
applied in several transactions, in order.

Only write statements belong here. Reads go to /query, and the API answers a
SELECT sent to /transaction with not_a_write.

Deleting rows frees pages but does not shrink the database file on disk. Run
vacuum to rewrite the file and return those pages to the filesystem. Vacuum
is its own endpoint because it rewrites the whole file; it cannot be sent to
the SQL console.

`)
}

func dbPushUsage(writer io.Writer) {
	fmt.Fprint(writer, `moogo db push <file> — apply a SQL file to the project's database

  moogo db push schema.sql
  moogo db push -            read the SQL from standard input

Flags: --url, --key, --help
`)
}

func dbSeedUsage(writer io.Writer) {
	fmt.Fprint(writer, `moogo db seed [file] — apply a seed file once

The file's content is recorded in the project's database, so running it again
with the same content does nothing. Change the file and it runs again;
--force runs it regardless.

  moogo db seed                    apply seed.sql
  moogo db seed fixtures/seed.sql
  cat seed.sql | moogo db seed -   recorded as one seed named "stdin"

Flags: --force, --url, --key, --help
`)
}

func dbResetUsage(writer io.Writer) {
	fmt.Fprint(writer, `moogo db reset --yes — drop every table and view

Every table and view is dropped, including the record of applied seeds, and
the project is left with an empty database. It cannot be undone; a scheduled
backup taken before this is the only way back.

Foreign keys are honoured: tables are dropped in dependency order, so a schema
with references between its tables resets cleanly.

Flags: --yes, --url, --key, --help
`)
}

func dbVacuumUsage(writer io.Writer) {
	fmt.Fprint(writer, `moogo db vacuum — reclaim free space after deleting rows

  moogo db vacuum

Deleting rows frees pages but does not shrink the database file on disk.
vacuum rewrites the file, reindexes tables, rebuilds query planner statistics
and folds the write-ahead log back in, returning freed pages to the
filesystem. It is its own operation because rewriting the whole file is exactly
what the SQL API refuses.

Flags: --url, --key, --help
`)
}
