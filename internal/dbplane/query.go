package dbplane

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"math"
	"strings"
	"time"

	"github.com/google/uuid"
	"modernc.org/sqlite"

	"github.com/moogodev/moogodev/internal/metrics"
	"github.com/moogodev/moogodev/pkg/logger"
)

// defaultMaxRows caps a single query result.
//
// A host with 2 GB of RAM cannot absorb an unbounded result set, and
// "SELECT * FROM large_table" is an easy thing to write by accident.
const defaultMaxRows = 1000

// defaultMaxResultBytes caps the payload of a single query response.
//
// The row cap bounds how many rows come back, not how many bytes: a thousand
// rows of a wide BLOB column are still a response that has to be held in
// memory twice (once as rows, once as JSON) on a 2 GB host. A result over
// this budget fails instead of being written.
const defaultMaxResultBytes = 16 << 20

// sqliteLimitLength is SQLITE_LIMIT_LENGTH from sqlite3.h -- the maximum size
// in bytes of a single string or BLOB value SQLite will accept or return.
// It is 0, not 1: id 1 is SQLITE_LIMIT_SQL_LENGTH.
const sqliteLimitLength = 0

// slowQueryThreshold is how long a statement runs before it is logged.
//
// One second is far above what SQLite needs for anything an interactive
// application sends, and far below what a missing index on a large table
// costs, so the line shows up exactly when there is something to look at.
const slowQueryThreshold = time.Second

// Query executes a read statement and returns the rows.
//
// Reads are not serialized against each other: WAL mode lets readers proceed
// while a write is in flight, so no lock is taken here.
//
// The statement runs on the pool opened query_only, so a statement that
// modifies data fails here even when the caller's classification called it a
// read. That is the enforcement behind the handler's routing hint.
//
// Rows are capped by maxRows. Without a cap a query like
// "SELECT * FROM huge" would stream an unbounded amount of data into memory on
// a 2 GB host.
func (manager *Manager) Query(
	ctx context.Context,
	projectID uuid.UUID,
	statement string,
	args []any,
	maxRows int,
) (*QueryResult, error) {
	if err := normalizeProjectID(projectID); err != nil {
		return nil, err
	}
	if maxRows <= 0 {
		maxRows = defaultMaxRows
	}

	connection, release, err := manager.acquire(projectID)
	if err != nil {
		return nil, err
	}
	defer release()

	// Statement slots are taken on the request context, not the statement
	// timeout: a caller that gives up while queued gets ErrBusy instead of
	// a running statement, and a slot that is granted gets the full time
	// budget for the statement itself.
	releaseSlots, err := manager.acquireSlots(ctx, projectID)
	if err != nil {
		return nil, err
	}
	defer releaseSlots()

	// Timed from here, not from the start: the wait for a slot is the
	// queue-depth gauge's story, and what follows is the statement itself.
	started := time.Now()
	rowsReturned := 0
	defer func() {
		took := time.Since(started)
		metrics.ObserveQuery("query", projectID.String(), took)
		manager.logSlowStatement("query", projectID, took, rowsReturned)
	}()

	// The statement timeout is enforced with a context, which SQLite honors at
	// the step boundary. A single blocking call would need an interrupt, and
	// that is not worth the complexity here.
	statementCtx, cancel := context.WithTimeout(ctx, manager.queryTimeout)
	defer cancel()

	// The statement runs on one checked-out connection so the per-value
	// length limit can be pinned onto it first: sqlite3_limit applies per
	// physical connection, and checkout is the point where this project's
	// ceiling is known to be in force, whether the pool opened the
	// connection at startup or a second ago.
	readConn, err := connection.readDB.Conn(statementCtx)
	if err != nil {
		return nil, classifyError(err, statementCtx)
	}
	defer readConn.Close()

	if err := applyValueLimit(readConn, manager.maxDBBytes); err != nil {
		return nil, err
	}

	rows, err := readConn.QueryContext(statementCtx, statement, args...)
	if err != nil {
		return nil, classifyError(err, statementCtx)
	}
	defer rows.Close()

	columnNames, err := rows.Columns()
	if err != nil {
		return nil, fmt.Errorf("read column names: %w", err)
	}

	values := make([]any, len(columnNames))
	scanTargets := make([]any, len(columnNames))
	for index := range values {
		scanTargets[index] = &values[index]
	}

	result := &QueryResult{Columns: columnNames, Rows: make([][]any, 0, 16)}
	resultBytes := 0

	for rows.Next() {
		if len(result.Rows) >= maxRows {
			result.Truncated = true
			break
		}
		if err := rows.Scan(scanTargets...); err != nil {
			return nil, fmt.Errorf("scan row: %w", err)
		}
		resultBytes += rowValueBytes(values)
		if resultBytes > defaultMaxResultBytes {
			return nil, ErrResultTooLarge
		}
		result.Rows = append(result.Rows, copyRow(values))
	}

	if err := rows.Err(); err != nil {
		return nil, classifyError(err, statementCtx)
	}
	rowsReturned = len(result.Rows)
	return result, nil
}

// Exec executes a write or DDL statement.
//
// The write lock is held for the whole operation, including the size check.
// The check runs inside the lock so every writer sees the size the previous
// writer committed: two statements that each fit on their own cannot jointly
// exceed the limit, which is exactly what the lock makes impossible.
func (manager *Manager) Exec(
	ctx context.Context,
	projectID uuid.UUID,
	statement string,
	args []any,
) (*ExecResult, error) {
	if err := normalizeProjectID(projectID); err != nil {
		return nil, err
	}

	connection, release, err := manager.acquire(projectID)
	if err != nil {
		return nil, err
	}
	defer release()

	releaseSlots, err := manager.acquireSlots(ctx, projectID)
	if err != nil {
		return nil, err
	}
	defer releaseSlots()

	// The write lock comes before anything charged to this statement. It is
	// a queue position, not the statement: a caller whose request ends while
	// queued gets ErrBusy instead of waiting for a response nobody will
	// read, and the 15 second budget below starts only once this writer
	// holds the lock -- a writer that queued for 14 seconds still gets the
	// full budget for its statement.
	if err := lockWrite(ctx, connection.writeLock); err != nil {
		return nil, ErrBusy
	}
	defer func() { <-connection.writeLock }()

	// Same basis as Query: the statement itself, with the wait for a slot
	// left to the queue-depth gauge and the wait for the lock to ErrBusy.
	started := time.Now()
	var rowsAffected int64
	defer func() {
		took := time.Since(started)
		metrics.ObserveQuery("exec", projectID.String(), took)
		manager.logSlowStatement("exec", projectID, took, int(rowsAffected))
	}()

	statementCtx, cancel := context.WithTimeout(ctx, manager.queryTimeout)
	defer cancel()

	// Check the size before writing, under the lock. Checking only afterwards
	// would be too late: the disk space would already be committed. This is
	// the fair pre-check, counting data pages only, and it serializes with
	// the write lock so every writer sees the size the previous writer
	// committed. The statement-level backstop is max_page_count: a statement
	// that would cross the limit fails inside SQLite with SQLITE_FULL and is
	// mapped to ErrSizeExceeded by classifyError.
	if err := manager.checkSize(ctx, connection.db); err != nil {
		return nil, err
	}

	// The write goes out on a checked-out connection for the same reason a
	// read does: the per-value length limit is applied here, before any
	// expression in the statement can materialize a value larger than the
	// project's whole database.
	writeConn, err := connection.db.Conn(statementCtx)
	if err != nil {
		return nil, classifyError(err, statementCtx)
	}
	defer writeConn.Close()

	if err := applyValueLimit(writeConn, manager.maxDBBytes); err != nil {
		return nil, err
	}

	execResult, err := writeConn.ExecContext(statementCtx, statement, args...)
	if err != nil {
		return nil, classifyError(err, statementCtx)
	}

	rowsAffected, err = execResult.RowsAffected()
	if err != nil {
		// Not fatal: some statements simply do not report a count.
		rowsAffected = 0
	}

	// The size for the response is read from the files on disk instead of
	// through a second PRAGMA while the write lock is held. A successful
	// statement stayed within the limit -- max_page_count refused anything
	// that would not -- so the number is the truth on disk, WAL sidecar
	// included.
	path := manager.databasePath(projectID)
	size, err := DatabaseSizeBytes(path)
	if err != nil {
		// The stat should not fail for a database that just accepted a
		// write, but if it does the driver's own accounting is the answer.
		if size, err = databaseSize(ctx, connection.db); err != nil {
			size = 0
		}
	} else {
		// Bytes written since the last checkpoint live in the WAL sidecar,
		// not the main file, so the sidecar is part of the size the caller
		// is told about.
		size += sidecarSize(path)
	}
	return &ExecResult{RowsAffected: rowsAffected, SizeBytes: size}, nil
}

// checkSize fails when a database is already at or over its limit.
func (manager *Manager) checkSize(ctx context.Context, database *sql.DB) error {
	size, err := databaseSize(ctx, database)
	if err != nil {
		return err
	}
	if size > manager.maxDBBytes {
		return fmt.Errorf("%w: database is %d bytes, limit is %d",
			ErrSizeExceeded, size, manager.maxDBBytes)
	}
	return nil
}

// logSlowStatement emits a log line for a statement that ran at least
// slowQueryThreshold.
//
// The statement text and its arguments are deliberately absent: they carry
// user data, and the line's job is to say which project, which operation,
// and how long it took -- never what was asked.
func (manager *Manager) logSlowStatement(
	op string, projectID uuid.UUID, took time.Duration, rows int,
) {
	if took < slowQueryThreshold {
		return
	}
	manager.logger.Info("slow statement", logger.Fields{
		"op":          op,
		"project_id":  projectID.String(),
		"duration_ms": took.Milliseconds(),
		"rows":        rows,
	})
}

// defaultPageSize is SQLite's compile-time page size, the size every moogo
// database is created with. It backs both the max_page_count cap (bytes
// divided by the page size) and the size accounting.
const defaultPageSize = 4096

// databaseSize reports the pages that hold data: allocated pages minus the
// freelist pages SQLite can reuse without growing the file.
//
// Counting allocated pages instead meant a database that had grown past its
// limit stayed over it even after rows were deleted, because the freed pages
// still counted -- the DELETE that would have made room was refused by the
// same check, and nothing could recover without an operator. Data pages
// reflect what the limit protects against, and freed pages stop counting the
// moment they are freed.
func databaseSize(ctx context.Context, database *sql.DB) (int64, error) {
	var (
		pageCount    int64
		freelistSize int64
		pageSize     int64
	)
	const query = `SELECT page_count, freelist_count, page_size ` +
		`FROM pragma_page_count(), pragma_freelist_count(), pragma_page_size()`

	if err := database.QueryRowContext(ctx, query).Scan(&pageCount, &freelistSize, &pageSize); err != nil {
		return 0, fmt.Errorf("compute database size: %w", err)
	}
	return (pageCount - freelistSize) * pageSize, nil
}

// applyValueLimit pins SQLITE_LIMIT_LENGTH onto a checked-out connection,
// using the project's own size limit as the ceiling: a value bigger than the
// whole database has no business existing, and a statement like
// "SELECT zeroblob(n)" builds one from two words, sidestepping every size
// check that looks at the file.
//
// sqlite3_limit is per physical connection, so this runs at every checkout:
// a connection the pool opened after startup carries the limit before it
// hands back a row.
func applyValueLimit(connection *sql.Conn, maxDBBytes int64) error {
	if maxDBBytes <= 0 {
		return nil
	}
	limit := maxDBBytes
	if limit > math.MaxInt {
		limit = math.MaxInt
	}
	if _, err := sqlite.Limit(connection, sqliteLimitLength, int(limit)); err != nil {
		return fmt.Errorf("apply value length limit: %w", err)
	}
	return nil
}

// rowValueBytes counts the payload a scanned row contributes to the response
// budget: variable-length values are strings and byte slices, and everything
// else is a fixed-width number that rounds off to nothing here.
func rowValueBytes(values []any) int {
	total := 0
	for _, value := range values {
		switch typed := value.(type) {
		case string:
			total += len(typed)
		case []byte:
			total += len(typed)
		}
	}
	return total
}

// copyRow duplicates a scanned row.
//
// The scan targets are reused across iterations, so appending values directly
// would make every row in the result alias the same backing array.
func copyRow(values []any) []any {
	row := make([]any, len(values))
	copy(row, values)
	return row
}

// classifyError translates driver and context errors into this package's
// sentinels, so handlers can map them to HTTP status codes without importing
// the SQLite driver.
func classifyError(err error, statementCtx context.Context) error {
	if errors.Is(err, context.DeadlineExceeded) || errors.Is(statementCtx.Err(), context.DeadlineExceeded) {
		return ErrTimeout
	}
	if errors.Is(err, ErrSizeExceeded) {
		return err
	}

	// SQLite reports a locked database as a busy or locked message. With the
	// write mutex in place this should not surface, so it is worth a distinct
	// error rather than being folded into a generic failure.
	message := err.Error()
	if strings.Contains(message, "database is locked") ||
		strings.Contains(message, "SQLITE_BUSY") ||
		strings.Contains(message, "database table is locked") {
		return fmt.Errorf("database is busy: %w", err)
	}
	// max_page_count refuses a statement that would grow the database past
	// its limit with SQLITE_FULL. The caller's pre-check cannot see it coming
	// -- the statement itself is what crosses -- so this is the size limit
	// speaking, not a broken statement.
	if strings.Contains(message, "database or disk is full") ||
		strings.Contains(message, "SQLITE_FULL") {
		return fmt.Errorf("%w: %v", ErrSizeExceeded, err)
	}
	return fmt.Errorf("execute statement: %w", err)
}
