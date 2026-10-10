// Package handler implements the HTTP endpoints.
//
// Handlers here hold no business rules of their own: they validate input, call
// the sanitizer, delegate to the control or data plane, and map errors onto
// HTTP status codes.
package handler

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"

	"github.com/google/uuid"

	"github.com/moogodev/moogodev/internal/auth"
	"github.com/moogodev/moogodev/internal/dbcontrol"
	"github.com/moogodev/moogodev/internal/dbplane"
	"github.com/moogodev/moogodev/pkg/httpx"
	"github.com/moogodev/moogodev/pkg/logger"
	"github.com/moogodev/moogodev/pkg/sanitizer"
)

// Engine is the SQLite surface the SQL handlers use.
//
// It is an interface rather than *dbplane.Manager so the handlers can be tested
// without opening a file per project, and so the SQL API cannot accidentally
// reach a control plane operation.
type Engine interface {
	Query(
		ctx context.Context,
		projectID uuid.UUID,
		statement string,
		args []any,
		limit int,
	) (*dbplane.QueryResult, error)
	Exec(
		ctx context.Context,
		projectID uuid.UUID,
		statement string,
		args []any,
	) (*dbplane.ExecResult, error)
	Transaction(
		ctx context.Context,
		projectID uuid.UUID,
		statements []dbplane.TransactionStatement,
	) (*dbplane.TransactionResult, error)
}

// DataPlane serves the SQL API.
type DataPlane struct {
	runner sqlRunner
}

// NewDataPlane creates a DataPlane handler.
func NewDataPlane(databases Engine, log *logger.Logger) *DataPlane {
	return &DataPlane{runner: sqlRunner{databases: databases, log: log}}
}

// sqlRunner executes a statement once the caller has been authorized.
//
// The only thing that differs between a data plane request and a dashboard
// console request is how authorization happened: the first presents a project
// key, the second a session cookie over a project the caller owns. Everything
// after that -- decoding the body, sanitizing, steering reads and writes to the
// right endpoint, executing, and mapping errors onto status codes -- is
// identical, so it lives here instead of being written twice.
//
// Keeping one copy is what stops the two paths from drifting apart in a way
// that is invisible until the console starts behaving differently from the
// public API for the same statement.
type sqlRunner struct {
	databases Engine
	log       *logger.Logger
}

// SQLRequest is the body accepted by both SQL endpoints.
type SQLRequest struct {
	// Query is the SQL text. Parameters go in Args, never interpolated into
	// Query.
	Query string `json:"query"`
	// Args are the bound values, positionally matching ? placeholders.
	Args []any `json:"args"`
}

// QueryResponse is the successful result of a read.
type QueryResponse struct {
	Success bool `json:"success"`
	// Columns describe the shape of every row.
	Columns []string `json:"columns"`
	// Rows holds one entry per row, aligned with Columns.
	Rows [][]any `json:"rows"`
	// RowCount is the number of rows returned, which is Rows length unless the
	// result was truncated.
	RowCount int `json:"row_count"`
	// Truncated reports that the row cap was reached, so the client knows not
	// to treat this as the whole table.
	Truncated bool `json:"truncated"`
	// DurationMs is server-side execution time, useful for spotting a slow
	// query without the client timing round trips.
	DurationMs int64 `json:"duration_ms"`
}

// ExecResponse is the successful result of a write.
type ExecResponse struct {
	Success      bool  `json:"success"`
	RowsAffected int64 `json:"rows_affected"`
	SizeBytes    int64 `json:"size_bytes"`
	DurationMs   int64 `json:"duration_ms"`
}

// TransactionRequest is the body accepted by the transaction endpoint.
type TransactionRequest struct {
	Statements []TransactionStatement `json:"statements"`
}

// TransactionStatement is one statement in the batch.
type TransactionStatement struct {
	Query string `json:"query"`
	Args  []any  `json:"args"`
}

// TransactionResponse is the successful result of a committed transaction.
type TransactionResponse struct {
	Success bool `json:"success"`
	// Statements carries one entry per submitted statement, in order.
	Statements []TransactionStatementResult `json:"statements"`
	// RowsAffected is the total across the batch.
	RowsAffected int64 `json:"rows_affected"`
	// SizeBytes is the database size after the commit.
	SizeBytes int64 `json:"size_bytes"`
	// DurationMs is server-side execution time for the whole transaction.
	DurationMs int64 `json:"duration_ms"`
}

// TransactionStatementResult is the outcome of one statement in the batch.
type TransactionStatementResult struct {
	RowsAffected int64 `json:"rows_affected"`
}

// Transaction handles POST /db/{project_id}/transaction.
//
// It runs a batch of writes as one unit: either every statement commits, or
// none of them do. That is the guarantee a request-based API cannot otherwise
// offer -- without it, "create the todo, then log the activity, then bump the
// counter" is three requests that can half-finish, and a client that retries is
// left guessing what already happened.
func (handler *DataPlane) Transaction(w http.ResponseWriter, r *http.Request) {
	projectID, ok := auth.ProjectIDFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthorized", "authentication required")
		return
	}

	handler.runner.transaction(w, r, projectID)
}

// transaction runs a write batch for an already-authorized caller.
//
// Every statement is validated before the first one runs. The engine would roll
// the batch back anyway, but validating up front means a batch with one bad
// statement is refused with that statement's error and without touching the
// database at all -- and the caller learns which line to fix instead of which
// position happened to fail.
func (runner sqlRunner) transaction(w http.ResponseWriter, r *http.Request, projectID uuid.UUID) {
	var request TransactionRequest
	if err := decodeJSON(w, r, &request); err != nil {
		return
	}

	if len(request.Statements) == 0 {
		httpx.WriteError(w, http.StatusBadRequest, "transaction_empty",
			"a transaction needs at least one statement")
		return
	}

	if len(request.Statements) > dbplane.MaxTransactionStatements {
		httpx.WriteError(w, http.StatusBadRequest, "too_many_statements",
			fmt.Sprintf("a transaction may carry at most %d statements", dbplane.MaxTransactionStatements))
		return
	}

	batch := make([]dbplane.TransactionStatement, len(request.Statements))
	for index, statement := range request.Statements {
		if err := sanitizer.Validate(statement.Query); err != nil {
			// The position is added here because a batch failure is otherwise
			// unattributable: "ATTACH is not allowed" says nothing about which of
			// forty statements carried it.
			writeStatementError(w, err, index+1)
			return
		}

		// Reads keep going to /query. A transaction here is about making several
		// writes atomic; a SELECT inside one would have to be returned as rows,
		// and the row cap and read-only pool that protect /query would not be
		// waiting on the other side of it.
		if isReadStatement(statement.Query) {
			httpx.WriteErrorWithDetail(w, http.StatusBadRequest, "not_a_write",
				"a transaction only accepts write statements; use /query for reads",
				fmt.Sprintf("statement %d", index+1))
			return
		}

		batch[index] = dbplane.TransactionStatement{Query: statement.Query, Args: statement.Args}
	}

	started := now()
	result, err := runner.databases.Transaction(r.Context(), projectID, batch)
	if err != nil {
		runner.writeDataPlaneError(w, r, projectID, err, "transaction")
		return
	}

	statements := make([]TransactionStatementResult, len(result.Statements))
	for index, statement := range result.Statements {
		statements[index] = TransactionStatementResult{RowsAffected: statement.RowsAffected}
	}

	httpx.WriteJSON(w, http.StatusOK, TransactionResponse{
		Success:      true,
		Statements:   statements,
		RowsAffected: result.RowsAffected,
		SizeBytes:    result.SizeBytes,
		DurationMs:   elapsedMs(started),
	})
}

// writeStatementError is writeSanitizerError with the position of the offending
// statement folded into the detail, so a refusal inside a batch says which one.
func writeStatementError(w http.ResponseWriter, err error, position int) {
	var sanitizerError *sanitizer.Error
	if !errors.As(err, &sanitizerError) {
		httpx.WriteErrorWithDetail(w, http.StatusBadRequest, "sql_invalid",
			"the statement could not be accepted", fmt.Sprintf("statement %d", position))
		return
	}

	detail := sanitizerError.Keyword
	if detail == "" {
		detail = fmt.Sprintf("statement %d", position)
	} else {
		detail = fmt.Sprintf("%s (statement %d)", detail, position)
	}

	httpx.WriteJSON(w, http.StatusBadRequest, httpx.ErrorBody{
		Error: httpx.ErrorDetail{
			Code:    sanitizerError.Code,
			Message: sanitizerError.Message,
			Detail:  detail,
		},
	})
}

// Query handles POST /db/{project_id}/query.
//
// The endpoint accepts read statements only. Enforced here rather than left to
// the data plane so that a write sent to the wrong endpoint produces a clear
// error instead of silently succeeding.
func (handler *DataPlane) Query(w http.ResponseWriter, r *http.Request) {
	projectID, ok := auth.ProjectIDFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthorized", "authentication required")
		return
	}

	handler.runner.query(w, r, projectID)
}

// Exec handles POST /db/{project_id}/exec.
//
// Read statements are rejected here too. Routing them through exec would let a
// caller pull an unlimited result set past the row cap that Query applies.
func (handler *DataPlane) Exec(w http.ResponseWriter, r *http.Request) {
	projectID, ok := auth.ProjectIDFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthorized", "authentication required")
		return
	}

	handler.runner.exec(w, r, projectID)
}

// query runs a read statement for an already-authorized caller.
func (runner sqlRunner) query(w http.ResponseWriter, r *http.Request, projectID uuid.UUID) {
	var request SQLRequest
	if err := decodeJSON(w, r, &request); err != nil {
		return
	}

	// Sanitize before touching the database. The data plane does not sanitize
	// on its own, because the exec path is the one that can reach files.
	if err := sanitizer.Validate(request.Query); err != nil {
		writeSanitizerError(w, err)
		return
	}

	if !isReadStatement(request.Query) {
		httpx.WriteError(w, http.StatusBadRequest, "not_a_read",
			"this endpoint only accepts read statements; use /exec for writes")
		return
	}

	started := now()
	result, err := runner.databases.Query(r.Context(), projectID, request.Query, request.Args, 0)
	if err != nil {
		runner.writeDataPlaneError(w, r, projectID, err, "query")
		return
	}

	httpx.WriteJSON(w, http.StatusOK, QueryResponse{
		Success:    true,
		Columns:    result.Columns,
		Rows:       result.Rows,
		RowCount:   len(result.Rows),
		Truncated:  result.Truncated,
		DurationMs: elapsedMs(started),
	})
}

// exec runs a write statement for an already-authorized caller.
func (runner sqlRunner) exec(w http.ResponseWriter, r *http.Request, projectID uuid.UUID) {
	var request SQLRequest
	if err := decodeJSON(w, r, &request); err != nil {
		return
	}

	if err := sanitizer.Validate(request.Query); err != nil {
		writeSanitizerError(w, err)
		return
	}

	if isReadStatement(request.Query) {
		httpx.WriteError(w, http.StatusBadRequest, "not_a_write",
			"this endpoint only accepts write statements; use /query for reads")
		return
	}

	started := now()
	result, err := runner.databases.Exec(r.Context(), projectID, request.Query, request.Args)
	if err != nil {
		runner.writeDataPlaneError(w, r, projectID, err, "exec")
		return
	}

	httpx.WriteJSON(w, http.StatusOK, ExecResponse{
		Success:      true,
		RowsAffected: result.RowsAffected,
		SizeBytes:    result.SizeBytes,
		DurationMs:   elapsedMs(started),
	})
}

// writeSanitizerError maps a validation failure onto an HTTP response.
func writeSanitizerError(w http.ResponseWriter, err error) {
	var sanitizerError *sanitizer.Error
	if !errors.As(err, &sanitizerError) {
		httpx.WriteError(w, http.StatusBadRequest, "sql_invalid", "the statement could not be accepted")
		return
	}

	// A syntax error is the caller's mistake and worth 400. A rejected
	// statement is also a 400: the client sent something this API will not run,
	// and no retry of the same request will change that.
	httpx.WriteJSON(w, http.StatusBadRequest, httpx.ErrorBody{
		Error: httpx.ErrorDetail{
			Code:    sanitizerError.Code,
			Message: sanitizerError.Message,
			Detail:  sanitizerError.Keyword,
		},
	})
}

// writeDataPlaneError maps a data plane failure onto an HTTP response and
// records it in the activity log.
func (runner sqlRunner) writeDataPlaneError(
	w http.ResponseWriter,
	r *http.Request,
	projectID uuid.UUID,
	err error,
	operation string,
) {
	status, code, message := classifyDataPlaneError(err)

	// A busy project is the one failure worth retrying as-is: the slot will
	// free up, and the header tells the client how soon to try rather than
	// hammering the endpoint.
	if errors.Is(err, dbplane.ErrBusy) {
		w.Header().Set("Retry-After", "1")
	}

	runner.log.Warn("data plane request failed", logger.Fields{
		"project_id": projectID.String(),
		"operation":  operation,
		"path":       r.URL.Path,
		"status":     status,
		"code":       code,
		"error":      err.Error(),
	})

	// The detail carries the driver's message, which can name tables and
	// columns. That is useful to the project's own developer and carries
	// nothing about the host.
	httpx.WriteErrorWithDetail(w, status, code, message, err.Error())
}

// classifyDataPlaneError maps a sentinel error onto a status code.
func classifyDataPlaneError(err error) (int, string, string) {
	switch {
	case errors.Is(err, dbplane.ErrNotFound):
		return http.StatusNotFound, "database_not_found", "the project database does not exist"
	case errors.Is(err, dbplane.ErrSizeExceeded):
		return http.StatusRequestEntityTooLarge, "database_too_large",
			"the database has reached its size limit"
	case errors.Is(err, dbplane.ErrResultTooLarge):
		return http.StatusRequestEntityTooLarge, "result_too_large",
			"the result set is over the response size limit; narrow the query or page the result"
	case errors.Is(err, dbplane.ErrTimeout):
		return http.StatusGatewayTimeout, "statement_timeout", "the statement took too long"
	case errors.Is(err, dbplane.ErrBusy):
		return http.StatusServiceUnavailable, "database_busy",
			"the project database is at its concurrency limit; retry shortly"
	case errors.Is(err, dbplane.ErrClosed):
		return http.StatusServiceUnavailable, "service_unavailable", "the service is restarting"
	case errors.Is(err, dbcontrol.ErrQuotaExceeded):
		return http.StatusTooManyRequests, "quota_exceeded", "a quota has been reached"
	case errors.Is(err, dbplane.ErrEmptyTransaction):
		return http.StatusBadRequest, "transaction_empty", "a transaction needs at least one statement"
	case errors.Is(err, dbplane.ErrTooManyStatements):
		return http.StatusBadRequest, "too_many_statements", "the transaction carries too many statements"
	default:
		return http.StatusBadRequest, "sql_error", "the statement could not be executed"
	}
}

// decodeJSON reads a JSON body into target, writing the error response itself.
//
// A body that is too large is reported separately from a malformed one: the
// first is a client mistake worth correcting, the second is usually a bug.
// A body that is not declared as JSON is a third case, and is refused before
// it is read: see httpx.RequireJSON for why the check exists.
func decodeJSON(w http.ResponseWriter, r *http.Request, target any) error {
	if !httpx.RequireJSON(w, r) {
		return errors.New("unsupported media type")
	}
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	// Numbers arrive as json.Number, not float64: an id like
	// 9007199254740993 is a legal JSON number and a wrong float64. The
	// digits survive decoding exactly; the engine converts them to an
	// int64 or float64 before anything binds them.
	decoder.UseNumber()

	if err := decoder.Decode(target); err != nil {
		var maxBytesError *http.MaxBytesError
		if errors.As(err, &maxBytesError) {
			httpx.WriteError(w, http.StatusRequestEntityTooLarge, "body_too_large",
				"the request body exceeds the size limit")
			return err
		}

		httpx.WriteError(w, http.StatusBadRequest, "invalid_json", "the request body is not valid JSON")
		return err
	}
	return nil
}
