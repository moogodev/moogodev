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
	"net/http"

	"github.com/google/uuid"

	"github.com/moogo/moogo/internal/auth"
	"github.com/moogo/moogo/internal/dbcontrol"
	"github.com/moogo/moogo/internal/dbplane"
	"github.com/moogo/moogo/pkg/httpx"
	"github.com/moogo/moogo/pkg/logger"
	"github.com/moogo/moogo/pkg/sanitizer"
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
	case errors.Is(err, dbplane.ErrTimeout):
		return http.StatusGatewayTimeout, "statement_timeout", "the statement took too long"
	case errors.Is(err, dbplane.ErrBusy):
		return http.StatusServiceUnavailable, "database_busy",
			"the project database is at its concurrency limit; retry shortly"
	case errors.Is(err, dbplane.ErrClosed):
		return http.StatusServiceUnavailable, "service_unavailable", "the service is restarting"
	case errors.Is(err, dbcontrol.ErrQuotaExceeded):
		return http.StatusTooManyRequests, "quota_exceeded", "a quota has been reached"
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
