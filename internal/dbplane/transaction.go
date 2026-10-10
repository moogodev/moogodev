package dbplane

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"

	"github.com/moogodev/moogodev/internal/metrics"
)

// MaxTransactionStatements caps how many statements one transaction may carry.
//
// The request body limit already bounds the bytes, but not the count: ten
// thousand statements of sixty characters each fit inside one megabyte, and the
// cost that matters is not the bytes but the work -- ten thousand statements
// hold the project's write lock for ten thousand round trips through the driver.
// A hundred is far past any request that is genuinely one logical change, and
// a migration of more than a hundred tables should be split into batches that
// can each be checked.
const MaxTransactionStatements = 100

// Transaction runs a batch of writes as one unit.
//
// Everything that makes Exec safe is held for the whole batch rather than per
// statement: the project handle, a statement slot, and the write lock. That last
// one is the point of the endpoint -- the statements inside cannot interleave
// with another writer, so a read-modify-write across them is safe without the
// caller coordinating anything.
//
// The lock is taken before the size check and released after the commit, for the
// same reason Exec holds it: every writer sees the size the previous writer
// committed, and max_page_count refuses anything that would cross the ceiling
// from inside SQLite, rolling the transaction back rather than leaving the file
// over the limit.
//
// A failure anywhere rolls the whole thing back and returns the error that
// caused it. The rollback error, when there is one, is deliberately not the one
// reported: the caller needs to know which statement failed and why, and
// "could not roll back" is never the more useful of the two.
func (manager *Manager) Transaction(
	ctx context.Context,
	projectID uuid.UUID,
	statements []TransactionStatement,
) (*TransactionResult, error) {
	if err := normalizeProjectID(projectID); err != nil {
		return nil, err
	}

	// An empty batch is refused rather than committed as a no-op: it is a
	// client bug, and answering 200 would hide it behind a success.
	if len(statements) == 0 {
		return nil, ErrEmptyTransaction
	}
	if len(statements) > MaxTransactionStatements {
		return nil, ErrTooManyStatements
	}

	connection, release, err := manager.acquire(projectID)
	if err != nil {
		return nil, err
	}
	defer release()

	// One slot for the batch. A transaction is one logical operation, so it
	// spends one slot's worth of concurrency however many statements it carries.
	releaseSlots, err := manager.acquireSlots(ctx, projectID)
	if err != nil {
		return nil, err
	}
	defer releaseSlots()

	if err := lockWrite(ctx, connection.writeLock); err != nil {
		return nil, ErrBusy
	}
	defer func() { <-connection.writeLock }()

	started := time.Now()
	var totalAffected int64
	defer func() {
		took := time.Since(started)
		metrics.ObserveQuery("transaction", projectID.String(), took)
		manager.logSlowStatement("transaction", projectID, took, int(totalAffected))
	}()

	// One budget for the whole transaction rather than one per statement. The
	// request is a single unit of work, and a caller that spends fifteen seconds
	// across a hundred statements has still had fifteen seconds of the database.
	statementCtx, cancel := context.WithTimeout(ctx, manager.queryTimeout)
	defer cancel()

	if err := manager.checkSize(ctx, connection.db); err != nil {
		return nil, err
	}

	// The per-value length limit is pinned onto the connection before any
	// statement runs, for the same reason Exec does it: one statement building a
	// zeroblob larger than the whole database has to be refused by the engine.
	writeConn, err := connection.db.Conn(statementCtx)
	if err != nil {
		return nil, classifyError(err, statementCtx)
	}
	defer writeConn.Close()

	if err := applyValueLimit(writeConn, manager.maxDBBytes); err != nil {
		return nil, err
	}

	// The DSN carries _txlock=immediate, so the write lock is taken here rather
	// than on the first write. A batch that would have upgraded a shared read
	// lock to reserved and then found the file locked by a checkpoint fails at
	// the start, where it can still be retried, instead of half way through.
	tx, err := writeConn.BeginTx(statementCtx, nil)
	if err != nil {
		return nil, classifyError(err, statementCtx)
	}
	// Rollback on every path out of this function that is not a successful
	// commit. After Commit has returned, Rollback is a no-op that reports
	// ErrTxDone, so this is safe to leave in place for the success path too.
	defer func() { _ = tx.Rollback() }()

	results := make([]TransactionStatementResult, 0, len(statements))
	for index, statement := range statements {
		execResult, err := tx.ExecContext(
			statementCtx,
			statement.Query,
			normalizeArgs(statement.Args)...,
		)
		if err != nil {
			// The failing statement is named, because "the transaction failed"
			// leaves the caller to bisect a hundred statements to find which one
			// it was. The batch position is enough; the SQL text is the caller's
			// own and already knows it to them.
			return nil, fmt.Errorf("statement %d: %w", index+1, classifyError(err, statementCtx))
		}

		affected, err := execResult.RowsAffected()
		if err != nil {
			// Not fatal: CREATE TABLE and friends simply report no count.
			affected = 0
		}
		insertID, err := execResult.LastInsertId()
		if err != nil {
			insertID = 0
		}
		results = append(results, TransactionStatementResult{
			RowsAffected:    affected,
			LastInsertRowID: insertID,
		})
		totalAffected += affected
	}

	if err := tx.Commit(); err != nil {
		return nil, classifyError(err, statementCtx)
	}

	return &TransactionResult{
		Statements:   results,
		RowsAffected: totalAffected,
		SizeBytes:    manager.databaseSizeAfterWrite(projectID, connection.db),
	}, nil
}

// databaseSizeAfterWrite reports the on-disk size once a write has committed.
//
// It is read from the files rather than through a PRAGMA for the reason Exec
// does the same: a committed statement stayed inside the limit -- max_page_count
// refused anything that would not -- so the number on disk is the truth, WAL
// sidecar included.
func (manager *Manager) databaseSizeAfterWrite(projectID uuid.UUID, database *sql.DB) int64 {
	path := manager.databasePath(projectID)
	size, err := DatabaseSizeBytes(path)
	if err != nil {
		// The stat should not fail for a database that just committed a write,
		// but if it does the driver's own accounting is the better answer.
		if size, err = databaseSize(context.Background(), database); err != nil {
			return 0
		}
	} else {
		size += sidecarSize(path)
	}
	return size
}

// ErrEmptyTransaction is a batch with no statements in it.
var ErrEmptyTransaction = errors.New("transaction has no statements")

// ErrTooManyStatements is a batch past MaxTransactionStatements.
var ErrTooManyStatements = errors.New("transaction has too many statements")
