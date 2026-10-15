package dbcontrol

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
)

// ErrRestoreInProgress means the project already has a restore queued or
// running, so a second one was refused rather than queued behind it.
var ErrRestoreInProgress = errors.New("a restore of this project is already running")

// RestoreStatus is where one asynchronous restore stands.
type RestoreStatus string

const (
	// RestorePending is a restore that has been accepted but not started.
	RestorePending RestoreStatus = "pending"
	// RestoreRunning is a restore a worker has claimed and is executing.
	RestoreRunning RestoreStatus = "running"
	// RestoreSucceeded is a restore that replaced the live database.
	RestoreSucceeded RestoreStatus = "succeeded"
	// RestoreFailed is a restore that stopped with an error. Because the swap
	// happens last, a failed restore leaves the previous database in place.
	RestoreFailed RestoreStatus = "failed"
)

// Terminal reports whether no further transition is expected.
func (status RestoreStatus) Terminal() bool {
	return status == RestoreSucceeded || status == RestoreFailed
}

// DatabaseRestore is one entry in the restore queue.
type DatabaseRestore struct {
	ID        uuid.UUID
	ProjectID uuid.UUID
	// BackupID names the snapshot that was restored. It is a record rather than
	// a live reference, so the backup it names may since have been deleted.
	BackupID    uuid.UUID
	Status      RestoreStatus
	Error       *string
	RequestedAt time.Time
	StartedAt   *time.Time
	FinishedAt  *time.Time
}

// restoreColumns is the projection every restore read uses, kept in one place so
// the column order and scanRestore cannot drift apart.
const restoreColumns = `id, project_id, backup_id, status, error, requested_at, started_at, finished_at`

// CreateRestore queues a restore and returns it in the pending state.
//
// A project that already has a pending or running restore is refused with
// ErrRestoreInProgress. The rule is enforced by a partial unique index, so it
// holds across instances rather than only within the caller's process.
func (store *Store) CreateRestore(ctx context.Context, projectID uuid.UUID, backupID uuid.UUID) (*DatabaseRestore, error) {
	query := `INSERT INTO database_restores (id, project_id, backup_id, status)
		VALUES ($1, $2, $3, $4)
		RETURNING ` + restoreColumns

	restore, err := scanRestore(store.pool.QueryRow(ctx, query,
		uuid.New(), projectID, backupID, string(RestorePending)))
	if err != nil {
		if isUniqueViolation(err) {
			return nil, ErrRestoreInProgress
		}
		return nil, fmt.Errorf("create restore: %w", err)
	}
	return restore, nil
}

// RestoreByID loads one restore, scoped to its project.
func (store *Store) RestoreByID(ctx context.Context, projectID uuid.UUID, restoreID uuid.UUID) (*DatabaseRestore, error) {
	query := `SELECT ` + restoreColumns + `
		  FROM database_restores
		 WHERE id = $1 AND project_id = $2`

	restore, err := scanRestore(store.pool.QueryRow(ctx, query, restoreID, projectID))
	if err != nil {
		if isNoRows(err) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("load restore: %w", err)
	}
	return restore, nil
}

// ActiveRestore returns the project's pending or running restore, or nil when
// there is none. It is what lets a dashboard reloading mid-restore show the
// work in flight instead of offering the button again.
func (store *Store) ActiveRestore(ctx context.Context, projectID uuid.UUID) (*DatabaseRestore, error) {
	query := `SELECT ` + restoreColumns + `
		  FROM database_restores
		 WHERE project_id = $1 AND status IN ($2, $3)
		 ORDER BY requested_at DESC
		 LIMIT 1`

	restore, err := scanRestore(store.pool.QueryRow(ctx, query,
		projectID, string(RestorePending), string(RestoreRunning)))
	if err != nil {
		if isNoRows(err) {
			return nil, nil
		}
		return nil, fmt.Errorf("load active restore: %w", err)
	}
	return restore, nil
}

// PendingRestores returns restores that were accepted but never claimed,
// oldest first, so a process that restarted mid-restore can pick its own work
// back up.
//
// Running rows are not returned: a restore that was running when the process
// died cannot be resumed safely, because the swap may have happened before the
// crash. Those are failed by MarkAbandonedRestores instead.
func (store *Store) PendingRestores(ctx context.Context, limit int) ([]DatabaseRestore, error) {
	if limit <= 0 {
		limit = defaultListLimit
	}
	if limit > maxListLimit {
		limit = maxListLimit
	}

	query := `SELECT ` + restoreColumns + `
		  FROM database_restores
		 WHERE status = $1
		 ORDER BY requested_at ASC
		 LIMIT $2`

	rows, err := store.pool.Query(ctx, query, string(RestorePending), limit)
	if err != nil {
		return nil, fmt.Errorf("list pending restores: %w", err)
	}
	defer rows.Close()

	var restores []DatabaseRestore
	for rows.Next() {
		restore, err := scanRestore(rows)
		if err != nil {
			return nil, fmt.Errorf("scan pending restore: %w", err)
		}
		restores = append(restores, *restore)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate pending restores: %w", err)
	}
	return restores, nil
}

// MarkRestoreRunning claims a pending restore.
//
// The status filter makes the transition a compare-and-swap: a row that another
// worker already claimed is not claimed twice, and the caller sees a zero row
// count rather than a phantom success.
func (store *Store) MarkRestoreRunning(ctx context.Context, restoreID uuid.UUID) (bool, error) {
	query := `UPDATE database_restores
		     SET status = $2, started_at = now()
		   WHERE id = $1 AND status = $3`

	tag, err := store.pool.Exec(ctx, query, restoreID, string(RestoreRunning), string(RestorePending))
	if err != nil {
		return false, fmt.Errorf("mark restore running: %w", err)
	}
	return tag.RowsAffected() > 0, nil
}

// MarkRestoreFinished records a restore's terminal state. A nil errText means
// it succeeded.
func (store *Store) MarkRestoreFinished(ctx context.Context, restoreID uuid.UUID, errText *string) error {
	status := RestoreSucceeded
	if errText != nil {
		status = RestoreFailed
	}

	query := `UPDATE database_restores
		     SET status = $2, error = $3, finished_at = now()
		   WHERE id = $1`

	if _, err := store.pool.Exec(ctx, query, restoreID, string(status), errText); err != nil {
		return fmt.Errorf("mark restore finished: %w", err)
	}
	return nil
}

// MarkAbandonedRestores fails every running restore, returning how many were
// touched.
//
// It runs at startup. A restore is only running while a live process is
// executing it, so any running row at startup belongs to a process that died.
// Its outcome is unknown -- the swap may or may not have happened -- so it is
// reported as failed with an explanation rather than guessed at, and its
// project is freed to be restored again.
func (store *Store) MarkAbandonedRestores(ctx context.Context) (int, error) {
	const reason = "the server restarted while this restore was running"

	query := `UPDATE database_restores
		     SET status = $1, error = $2, finished_at = now()
		   WHERE status = $3`

	tag, err := store.pool.Exec(ctx, query, string(RestoreFailed), reason, string(RestoreRunning))
	if err != nil {
		return 0, fmt.Errorf("fail abandoned restores: %w", err)
	}
	return int(tag.RowsAffected()), nil
}

// scanRestore reads one restore row from any row source.
func scanRestore(row interface {
	Scan(dest ...any) error
}) (*DatabaseRestore, error) {
	restore := &DatabaseRestore{}
	err := row.Scan(
		&restore.ID,
		&restore.ProjectID,
		&restore.BackupID,
		&restore.Status,
		&restore.Error,
		&restore.RequestedAt,
		&restore.StartedAt,
		&restore.FinishedAt,
	)
	if err != nil {
		return nil, err
	}
	return restore, nil
}
