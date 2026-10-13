package mcp

import (
	"context"
	"errors"
	"fmt"

	mcplib "github.com/mark3labs/mcp-go/mcp"
	mcpserver "github.com/mark3labs/mcp-go/server"

	"github.com/moogodev/moogodev/internal/dbplane"
)

// ServerName and ServerVersion identify this server during initialize.
const (
	ServerName    = "moogo"
	ServerVersion = "0.1.0"
)

// Query limits for the query tool.
//
// The data plane caps every read at 1000 rows; the tool's own limit is applied
// on top of that, after the response arrives. It is not sent to the server,
// because /query has no limit parameter and rejects unknown body fields -- a
// limit in the request would come back as invalid_json rather than fewer rows.
const (
	defaultQueryLimit = 100
	maxQueryLimit     = 1000
)

// listSchemaStatement is the read behind list_schema. It is the sqlite_master
// catalogue, so it lists the schema the project's own queries will see.
const listSchemaStatement = "SELECT name, type, sql FROM sqlite_master WHERE type IN ('table', 'view') ORDER BY name"

// instructions are handed to the agent once, at initialize. They state the
// rules that matter most before the first call, so a correct tool is chosen
// before any SQL is written.
const instructions = "Moogo is a hosted SQLite database reached over HTTP. " +
	"Call list_schema to discover tables before writing queries. " +
	"query is read-only, exec runs one write, and transaction groups up to 100 writes so they commit together or not at all. " +
	"Always bind values through args; never build SQL by concatenation."

// Server holds the tool handlers over one data-plane client.
type Server struct {
	client *Client
}

// NewServer registers every Moogo tool on a fresh MCP server.
func NewServer(client *Client) *mcpserver.MCPServer {
	handlers := &Server{client: client}

	instance := mcpserver.NewMCPServer(
		ServerName,
		ServerVersion,
		mcpserver.WithInstructions(instructions),
		mcpserver.WithToolCapabilities(false),
		mcpserver.WithRecovery(),
	)

	instance.AddTool(queryTool(), handlers.query)
	instance.AddTool(execTool(), handlers.exec)
	instance.AddTool(transactionTool(), handlers.transaction)
	instance.AddTool(listSchemaTool(), handlers.listSchema)

	return instance
}

// toolAnnotations are the hints the client shows next to a tool. A tool that
// can change data should not look like one that cannot.
type toolAnnotations struct {
	readOnly    bool
	destructive bool
	idempotent  bool
}

func toolOptions(description string, annotations toolAnnotations, properties ...mcplib.ToolOption) mcplib.ToolOption {
	return func(tool *mcplib.Tool) {
		mcplib.WithDescription(description)(tool)
		mcplib.WithReadOnlyHintAnnotation(annotations.readOnly)(tool)
		mcplib.WithDestructiveHintAnnotation(annotations.destructive)(tool)
		mcplib.WithIdempotentHintAnnotation(annotations.idempotent)(tool)
		for _, property := range properties {
			property(tool)
		}
	}
}

// queryTool is the read tool.
func queryTool() mcplib.Tool {
	return mcplib.NewTool("query", toolOptions(
		"Run one read-only SQL statement and return its rows. Moogo is SQLite, so ordinary SELECT syntax works. "+
			"Rules: exactly one statement; bind values with ? placeholders and pass them in args, never concatenate them into sql; reads only (exec runs writes, transaction groups them). "+
			"Accepts SELECT, VALUES, PRAGMA (a small allowlist), EXPLAIN, and WITH ... SELECT. "+
			"Rows come back as arrays aligned with columns. Results are capped at 1000 rows: when truncated is true there is more to fetch, so page with LIMIT/OFFSET.",
		toolAnnotations{readOnly: true, destructive: false, idempotent: true},
		mcplib.WithString("sql",
			mcplib.Required(),
			mcplib.Description("One read-only SQL statement. Use ? for values."),
		),
		mcplib.WithArray("args",
			mcplib.Items(map[string]any{}),
			mcplib.Description("Positional values for the ? placeholders, in order. Never build sql by string concatenation."),
		),
		mcplib.WithInteger("limit",
			mcplib.Description("Maximum rows to return. Defaults to 100; never more than 1000."),
			mcplib.DefaultNumber(defaultQueryLimit),
			mcplib.Min(1),
			mcplib.Max(maxQueryLimit),
		),
	))
}

// execTool is the single-write tool.
func execTool() mcplib.Tool {
	return mcplib.NewTool("exec", toolOptions(
		"Run one write statement and report what changed. "+
			"Rules: exactly one statement; bind values with ? placeholders and args; writes only (reads belong in query). "+
			"Accepts INSERT, UPDATE, DELETE, CREATE, ALTER, DROP, and WITH ... that writes. "+
			"Returns rows_affected, the database size after the write, and last_insert_rowid for an INSERT or REPLACE only -- that is the new row's id, so no follow-up SELECT is needed. "+
			"When one logical change is several writes, use transaction so they commit together.",
		toolAnnotations{readOnly: false, destructive: true, idempotent: false},
		mcplib.WithString("sql",
			mcplib.Required(),
			mcplib.Description("One write statement. Use ? for values."),
		),
		mcplib.WithArray("args",
			mcplib.Items(map[string]any{}),
			mcplib.Description("Positional values for the ? placeholders, in order."),
		),
	))
}

// transactionTool is the atomic-batch tool.
func transactionTool() mcplib.Tool {
	return mcplib.NewTool("transaction", toolOptions(
		"Run up to 100 write statements as one atomic batch: every statement commits or none do. "+
			"Use it when one logical change is several writes. Each entry is {sql, args}; all entries are validated before anything runs. "+
			"A failure rolls the whole batch back and names the failing position, so retrying the same batch is safe. "+
			"Reads are not allowed here -- run them separately with query.",
		toolAnnotations{readOnly: false, destructive: true, idempotent: false},
		mcplib.WithArray("statements",
			mcplib.Required(),
			mcplib.Description("Write statements to run as one batch, in order. Each entry is {sql, args}."),
			mcplib.MinItems(1),
			mcplib.MaxItems(dbplane.MaxTransactionStatements),
			mcplib.Items(map[string]any{
				"type": "object",
				"properties": map[string]any{
					"sql": map[string]any{
						"type":        "string",
						"description": "One write statement. Use ? for values.",
					},
					"args": map[string]any{
						"type":        "array",
						"items":       map[string]any{},
						"description": "Positional values for the ? placeholders, in order.",
					},
				},
				"required": []string{"sql"},
			}),
		),
	))
}

// listSchemaTool is the schema-discovery tool.
func listSchemaTool() mcplib.Tool {
	return mcplib.NewTool("list_schema", toolOptions(
		"List every table and view in the project's database, with the SQL that created it. "+
			"Call this first when you do not already know the schema, then query the tables it names.",
		toolAnnotations{readOnly: true, destructive: false, idempotent: true},
	))
}

// queryArgs is the input of the query tool.
type queryArgs struct {
	SQL   string `json:"sql"`
	Args  []any  `json:"args"`
	Limit int    `json:"limit"`
}

// query runs a read and trims the result to the requested limit.
func (handlers *Server) query(ctx context.Context, request mcplib.CallToolRequest) (*mcplib.CallToolResult, error) {
	var input queryArgs
	if err := request.BindArguments(&input); err != nil {
		return mcplib.NewToolResultError("could not read the query arguments: " + err.Error()), nil
	}
	if input.SQL == "" {
		return mcplib.NewToolResultError("query: sql is required"), nil
	}

	limit := input.Limit
	if limit <= 0 {
		limit = defaultQueryLimit
	}
	if limit > maxQueryLimit {
		limit = maxQueryLimit
	}

	result, err := handlers.client.Query(ctx, input.SQL, input.Args)
	if err != nil {
		return toolError(err), nil
	}

	rows := result.Rows
	if rows == nil {
		rows = [][]any{}
	}
	truncated := result.Truncated
	// The server cap (1000) and the tool limit are different things: the first
	// is about protecting the connection, the second is what the agent asked
	// for. If more rows came back than were asked for, the result is truncated
	// from the agent's point of view even when the server did not truncate.
	if len(rows) > limit {
		rows = rows[:limit]
		truncated = true
	}

	columns := result.Columns
	if columns == nil {
		columns = []string{}
	}

	text := fmt.Sprintf("Returned %d row(s) across %d column(s).", len(rows), len(columns))
	if truncated {
		text += " More rows are available; page with LIMIT/OFFSET to see them."
	}

	return mcplib.NewToolResultStructured(map[string]any{
		"columns":     columns,
		"rows":        rows,
		"row_count":   len(rows),
		"truncated":   truncated,
		"duration_ms": result.DurationMs,
	}, text), nil
}

// execArgs is the input of the exec tool.
type execArgs struct {
	SQL  string `json:"sql"`
	Args []any  `json:"args"`
}

// exec runs a write and reports its effect.
func (handlers *Server) exec(ctx context.Context, request mcplib.CallToolRequest) (*mcplib.CallToolResult, error) {
	var input execArgs
	if err := request.BindArguments(&input); err != nil {
		return mcplib.NewToolResultError("could not read the exec arguments: " + err.Error()), nil
	}
	if input.SQL == "" {
		return mcplib.NewToolResultError("exec: sql is required"), nil
	}

	result, err := handlers.client.Exec(ctx, input.SQL, input.Args)
	if err != nil {
		return toolError(err), nil
	}

	structured := map[string]any{
		"rows_affected": result.RowsAffected,
		"size_bytes":    result.SizeBytes,
		"duration_ms":   result.DurationMs,
	}
	text := fmt.Sprintf("Wrote %d row(s); the database is now %d bytes.", result.RowsAffected, result.SizeBytes)
	if result.LastInsertRowID != 0 {
		structured["last_insert_rowid"] = result.LastInsertRowID
		text += fmt.Sprintf(" New rowid: %d.", result.LastInsertRowID)
	}

	return mcplib.NewToolResultStructured(structured, text), nil
}

// transactionArgs is the input of the transaction tool.
type transactionArgs struct {
	Statements []Statement `json:"statements"`
}

// transaction runs a batch of writes as one unit.
func (handlers *Server) transaction(ctx context.Context, request mcplib.CallToolRequest) (*mcplib.CallToolResult, error) {
	var input transactionArgs
	if err := request.BindArguments(&input); err != nil {
		return mcplib.NewToolResultError("could not read the transaction arguments: " + err.Error()), nil
	}
	if len(input.Statements) == 0 {
		return mcplib.NewToolResultError("transaction: at least one statement is required"), nil
	}
	if len(input.Statements) > dbplane.MaxTransactionStatements {
		return mcplib.NewToolResultError(fmt.Sprintf(
			"transaction: at most %d statements are allowed, got %d",
			dbplane.MaxTransactionStatements, len(input.Statements))), nil
	}

	result, err := handlers.client.Transaction(ctx, input.Statements)
	if err != nil {
		return toolError(err), nil
	}

	statements := make([]map[string]any, len(result.Statements))
	for index, statement := range result.Statements {
		entry := map[string]any{"rows_affected": statement.RowsAffected}
		if statement.LastInsertRowID != 0 {
			entry["last_insert_rowid"] = statement.LastInsertRowID
		}
		statements[index] = entry
	}

	return mcplib.NewToolResultStructured(map[string]any{
		"statements":    statements,
		"rows_affected": result.RowsAffected,
		"size_bytes":    result.SizeBytes,
		"duration_ms":   result.DurationMs,
	}, fmt.Sprintf("Committed %d statement(s), %d row(s) affected.", len(statements), result.RowsAffected)), nil
}

// listSchema returns the tables and views in the project's database.
func (handlers *Server) listSchema(ctx context.Context, _ mcplib.CallToolRequest) (*mcplib.CallToolResult, error) {
	result, err := handlers.client.Query(ctx, listSchemaStatement, nil)
	if err != nil {
		return toolError(err), nil
	}

	rows := result.Rows
	if rows == nil {
		rows = [][]any{}
	}
	columns := result.Columns
	if columns == nil {
		columns = []string{}
	}

	return mcplib.NewToolResultStructured(map[string]any{
		"columns":   columns,
		"rows":      rows,
		"row_count": len(rows),
	}, fmt.Sprintf("Found %d table(s) and view(s).", len(rows))), nil
}

// toolError formats a client failure as a tool error.
//
// A data-plane failure is reported with its stable code first, because that is
// what an agent should branch on; the message and detail follow for the human
// reading the transcript. The secret key never reaches this function, so it
// cannot reach the result.
func toolError(err error) *mcplib.CallToolResult {
	var apiError *APIError
	if errors.As(err, &apiError) {
		message := apiError.Code + ": " + apiError.Message
		if apiError.Detail != "" {
			message += " (" + apiError.Detail + ")"
		}
		return mcplib.NewToolResultError(message)
	}
	return mcplib.NewToolResultError(err.Error())
}
