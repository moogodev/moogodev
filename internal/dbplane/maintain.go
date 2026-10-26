package dbplane

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/google/uuid"

	"github.com/moogodev/moogodev/internal/metrics"
)

// MaintainResult is what one maintenance run changed.
//
// The sizes are read from the files on disk, WAL sidecar included, the same
// way a write reports its size: that is the number a caller is charged for,
// not what the data pages alone account for.
type MaintainResult struct {
	// Reindexed is true when the run rebuilt the indexes. SQLite refuses an
	// index rebuild while the file is read-only, so the caller is told
	// whether it happened instead of being left to assume it.
	Reindexed bool `json:"reindexed"`
	// Optimized is true when the query planner's statistics were rebuilt.
	Optimized bool `json:"optimized"`
	// Checkpointed is true when the write-ahead log was folded back into the
	// main file. A checkpoint has nothing to fold when the log is empty, so
	// false means there was nothing to do rather than that it failed.
	Checkpointed bool `json:"checkpointed"`
	// Vacuumed is false when the file had no free pages, so the rewrite would
	// have moved every page and returned nothing. That is a maintenance run
	// that did its other work, not one that failed.
	Vacuumed bool `json:"vacuumed"`
	// SizeBefore and SizeAfter are the database's on-disk size, WAL sidecar
	// included, on each side of the run. This is the number that matters after
	// a delete: rows stop taking space immediately, but the pages they used
	// stay inside the file until it is rewritten.
	SizeBefore int64 `json:"size_before_bytes"`
	SizeAfter  int64 `json:"size_after_bytes"`
	// FreelistBefore and FreelistAfter are the free pages carried inside the
	// file on each side of the run, in bytes. The difference is the space the
	// vacuum actually returned to the filesystem.
	FreelistBefore int64 `json:"freelist_before_bytes"`
	FreelistAfter  int64 `json:"freelist_after_bytes"`
	// DurationMs is how long the run held the project's write lock.
	DurationMs int64 `json:"duration_ms"`
}

// Maintain compacts a project's database and reports what it changed.
//
// The statements here are the ones the SQL API blocks, and for a good reason:
// VACUUM rewrites the whole file, which would let a caller release every byte
// the size limit is measured against. That is why this is not an /exec a client
// can send -- it is a surface of its own, and what it does is bounded exactly
// the way a write is:
//
//   - It runs under the project's write lock, so nothing else writes to the
//     file while it is being rewritten, and under the same statement and slot
//     budgets as any other statement. A request that gives up while queued
//     gets ErrBusy rather than holding the file.
//   - The size limit still applies, because it is the connection that carries
//     it: every pool for a project opens with max_page_count set, and SQLite
//     refuses a rewrite that would leave more pages than that. A vacuum that
//     crossed the limit comes back as ErrSizeExceeded through the same
//     SQLITE_FULL mapping an ordinary write uses. The file may only shrink or
//     stay the same size; it cannot be a way around the plan.
//   - The statements are constants. There is no caller text to interpolate and
//     nothing to validate, which is the only reason it is safe to hand SQLite
//     text no sanitizer wrote.
//
// The order is fixed. REINDEX and ANALYZE run first so their own writes are
// part of what the vacuum compacts, and the checkpoint runs last so the main
// file is complete and the log is empty: a snapshot taken right after a
// maintenance run is one consistent file with no sidecar to copy.
func (manager *Manager) Maintain(ctx context.Context, projectID uuid.UUID) (*MaintainResult, error) {
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

	if err := lockWrite(ctx, connection.writeLock); err != nil {
		return nil, ErrBusy
	}
	defer func() { <-connection.writeLock }()

	started := time.Now()
	var result MaintainResult
	defer func() {
		result.DurationMs = time.Since(started).Milliseconds()
		metrics.ObserveQuery("maintain", projectID.String(), time.Since(started))
		manager.logSlowStatement("maintain", projectID, time.Since(started), 0)
	}()

	// PRAGMA optimize updates index statistics based on query patterns.
	_, _ = connection.db.Exec("PRAGMA optimize")

	statementCtx, cancel := context.WithTimeout(ctx, manager.queryTimeout)
	defer cancel()

	path := manager.databasePath(projectID)
	result.SizeBefore = manager.diskSize(path)
	result.FreelistBefore, err = freelistBytes(statementCtx, connection.db)
	if err != nil {
		return nil, err
	}

	// Both statements are no-ops on a database with nothing to rebuild, and
	// both count as work done when they return: a table with no index has
	// nothing to reindex, and that is not a failure.
	if _, err := connection.db.ExecContext(statementCtx, "REINDEX"); err != nil {
		return nil, classifyError(err, statementCtx)
	}
	result.Reindexed = true

	if _, err := connection.db.ExecContext(statementCtx, "ANALYZE"); err != nil {
		return nil, classifyError(err, statementCtx)
	}
	result.Optimized = true

	// A vacuum rewrites the whole database into a temporary file and replaces
	// the original, so it needs room for the copy beside the file it is
	// compacting. SQLite keeps the rewrite under max_page_count -- the cap the
	// pool opened with -- so a run that would leave the file over its limit
	// fails as SQLITE_FULL and classifyError reports it as the size refusal it
	// is. There is no pre-check to run: whether the rewrite fits is a question
	// only the rewrite can answer, and SQLite answers it without spending the
	// disk.
	if result.FreelistBefore > 0 {
		if _, err := connection.db.ExecContext(statementCtx, "VACUUM"); err != nil {
			return nil, classifyError(err, statementCtx)
		}
		result.Vacuumed = true
	}

	// Folding the log back into the main file is what makes the reported size
	// the file's own rather than the file plus whatever the last write left
	// beside it. A log with nothing in it checks out successfully with zero
	// frames moved.
	var logFrames, checkpointedFrames, _ int
	if err := connection.db.QueryRowContext(statementCtx, "PRAGMA wal_checkpoint(TRUNCATE)").
		Scan(&logFrames, &checkpointedFrames, new(int)); err != nil {
		return nil, classifyError(err, statementCtx)
	}
	result.Checkpointed = checkpointedFrames > 0

	result.SizeAfter = manager.diskSize(path)
	result.FreelistAfter, err = freelistBytes(statementCtx, connection.db)
	if err != nil {
		return nil, err
	}
	return &result, nil
}

// freelistBytes is the space inside the file carried by pages no row uses.
//
// It is what a vacuum returns to the filesystem, so it is the difference the
// caller is told about, and a database carrying none needs no rewrite at all.
func freelistBytes(ctx context.Context, database *sql.DB) (int64, error) {
	var (
		freelistCount int64
		pageSize      int64
	)
	const query = `SELECT freelist_count, page_size ` +
		`FROM pragma_freelist_count(), pragma_page_size()`
	if err := database.QueryRowContext(ctx, query).Scan(&freelistCount, &pageSize); err != nil {
		return 0, fmt.Errorf("read freelist: %w", err)
	}
	return freelistCount * pageSize, nil
}

// diskSize is the main file plus its write-ahead log, which is the size a
// caller is charged for.
//
// A stat that fails reports zero rather than an error: the run has already
// succeeded by the time this is asked, and a missing number is a better answer
// than a failure reported for work that was done.
func (manager *Manager) diskSize(path string) int64 {
	size, err := DatabaseSizeBytes(path)
	if err != nil {
		return 0
	}
	return size + sidecarSize(path)
}
