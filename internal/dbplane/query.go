package dbplane

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/moogo/moogo/internal/metrics"
	"github.com/moogo/moogo/pkg/logger"
)

// defaultMaxRows caps a single query result.
//
// A host with 2 GB of RAM cannot absorb an unbounded result set, and
// "SELECT * FROM large_table" is an easy thing to write by accident.
const defaultMaxRows = 1000

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

	rows, err := connection.db.QueryContext(statementCtx, statement, args...)
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

	for rows.Next() {
		if len(result.Rows) >= maxRows {
			result.Truncated = true
			break
		}
		if err := rows.Scan(scanTargets...); err != nil {
			return nil, fmt.Errorf("scan row: %w", err)
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

	// Same basis as Query: the statement itself, with the wait for a slot
	// left to the queue-depth gauge.
	started := time.Now()
	var rowsAffected int64
	defer func() {
		took := time.Since(started)
		metrics.ObserveQuery("exec", projectID.String(), took)
		manager.logSlowStatement("exec", projectID, took, int(rowsAffected))
	}()

	statementCtx, cancel := context.WithTimeout(ctx, manager.queryTimeout)
	defer cancel()

	connection.writeLock.Lock()
	defer connection.writeLock.Unlock()

	// Check the size before writing, under the lock. Checking only afterwards
	// would be too late: the disk space would already be committed. This is
	// the one size check per statement; it both refuses writes to a database
	// that is already at its limit and, because it is serialized, catches a
	// write that jointly pushed past the limit with an earlier one.
	if err := manager.checkSize(ctx, connection.db); err != nil {
		return nil, err
	}

	execResult, err := connection.db.ExecContext(statementCtx, statement, args...)
	if err != nil {
		return nil, classifyError(err, statementCtx)
	}

	rowsAffected, err = execResult.RowsAffected()
	if err != nil {
		// Not fatal: some statements simply do not report a count.
		rowsAffected = 0
	}

	// The size for the response is read from the files on disk instead of
	// through a second PRAGMA while the write lock is held. A statement that
	// crosses the limit still succeeds here (rolling back would discard a
	// successful write); the next one is refused by the check above with
	// ErrSizeExceeded, which tells the caller the database needs attention.
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

// databaseSize reports the main database size via page_count times page_size.
//
// Using SQLite's own accounting rather than stat() means the number reflects
// allocated pages, which is what the limit is about.
func databaseSize(ctx context.Context, database *sql.DB) (int64, error) {
	var (
		pageCount int64
		pageSize  int64
	)
	const query = `SELECT page_count, page_size FROM pragma_page_count(), pragma_page_size()`

	if err := database.QueryRowContext(ctx, query).Scan(&pageCount, &pageSize); err != nil {
		return 0, fmt.Errorf("compute database size: %w", err)
	}
	return pageCount * pageSize, nil
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
	return fmt.Errorf("execute statement: %w", err)
}
