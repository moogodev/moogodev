package dbplane

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"

	"github.com/google/uuid"
)

// defaultMaxRows caps a single query result.
//
// A host with 2 GB of RAM cannot absorb an unbounded result set, and
// "SELECT * FROM large_table" is an easy thing to write by accident.
const defaultMaxRows = 1000

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

	connection, err := manager.connect(ctx, projectID)
	if err != nil {
		return nil, err
	}

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
	return result, nil
}

// Exec executes a write or DDL statement.
//
// The write lock is held for the whole operation, including the size recheck.
// Releasing it before the recheck would let two concurrent large writes each
// see a size under the limit and jointly exceed it.
func (manager *Manager) Exec(
	ctx context.Context,
	projectID uuid.UUID,
	statement string,
	args []any,
) (*ExecResult, error) {
	if err := normalizeProjectID(projectID); err != nil {
		return nil, err
	}

	connection, err := manager.connect(ctx, projectID)
	if err != nil {
		return nil, err
	}

	// Check the size before writing. Checking only afterwards would be too
	// late: the disk space would already be committed.
	if err := manager.checkSize(ctx, connection.db); err != nil {
		return nil, err
	}

	statementCtx, cancel := context.WithTimeout(ctx, manager.queryTimeout)
	defer cancel()

	connection.writeLock.Lock()
	defer connection.writeLock.Unlock()

	execResult, err := connection.db.ExecContext(statementCtx, statement, args...)
	if err != nil {
		return nil, classifyError(err, statementCtx)
	}

	rowsAffected, err := execResult.RowsAffected()
	if err != nil {
		// Not fatal: some statements simply do not report a count.
		rowsAffected = 0
	}

	// Recheck after the write and report if the result now exceeds the limit.
	// The data stays, since rolling back would discard a successful statement;
	// the error tells the caller the database needs attention.
	size, err := databaseSize(ctx, connection.db)
	if err == nil && size > manager.maxDBBytes {
		return &ExecResult{
			RowsAffected: rowsAffected,
			SizeBytes:    size,
		}, fmt.Errorf("%w: database is now %d bytes, limit is %d",
			ErrSizeExceeded, size, manager.maxDBBytes)
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
