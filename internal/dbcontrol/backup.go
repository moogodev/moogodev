package dbcontrol

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
)

// BackupKind labels why a backup was taken. The dashboard shows it next to
// each entry, and the restore path refuses nothing based on it but does keep
// the pre-restore snapshot distinguishable so it is never mistaken for a user
// backup.
type BackupKind string

// The reasons a backup row can exist.
const (
	// BackupInitial is the upload taken right after a project is created.
	BackupInitial BackupKind = "initial"
	// BackupDaily is the scheduled backup.
	BackupDaily BackupKind = "daily"
	// BackupManual is a backup the owner triggered from the dashboard.
	BackupManual BackupKind = "manual"
	// BackupPreRestore is the safety snapshot taken immediately before a
	// restore overwrites the live database.
	BackupPreRestore BackupKind = "pre_restore"
)

// DatabaseBackup is one completed backup.
//
// Only backups that finished uploading appear here; a failed attempt lives in
// DatabaseBackupState and never becomes a row. That is what lets the dashboard
// treat every listed entry as something it can actually restore.
type DatabaseBackup struct {
	ID          uuid.UUID
	ProjectID   uuid.UUID
	Kind        BackupKind
	ObjectKey   string
	SizeBytes   int64
	SHA256      string
	SourceModAt *time.Time
	CreatedAt   time.Time
}

// DatabaseBackupState is the scheduler's cursor for one project.
//
// A zero value (nil times, zero sizes) is the state of a project that has never
// been backed up, which is a normal thing to be rather than an error.
type DatabaseBackupState struct {
	ProjectID            uuid.UUID
	LastSuccessAt        *time.Time
	LastSizeBytes        int64
	LastSHA256           *string
	LastSourceModifiedAt *time.Time
	ConsecutiveFailures  int
	LastError            *string
	UpdatedAt            time.Time
}

// BackupColumns is the projection every backup read shares.
const backupColumns = `
	id, project_id, kind, object_key, size_bytes, sha256,
	source_modified_at, created_at`

// scanBackup reads one row selected with backupColumns.
func scanBackup(row rowScanner) (*DatabaseBackup, error) {
	backup := &DatabaseBackup{}
	var kind string

	err := row.Scan(
		&backup.ID,
		&backup.ProjectID,
		&kind,
		&backup.ObjectKey,
		&backup.SizeBytes,
		&backup.SHA256,
		&backup.SourceModAt,
		&backup.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	backup.Kind = BackupKind(kind)
	return backup, nil
}

// ProjectsDueForBackup returns the projects the scheduler should look at now:
// those that can be backed up and whose last successful backup is either
// missing or older than maxAge.
//
// The cutoff is computed in Go and passed as a timestamp rather than built with
// an interval expression, so the comparison uses one clock and one timezone.
//
// Ready and paused are the eligible states. Pending and failed have no
// trustworthy file yet, and deleting has a file on its way out.
func (store *Store) ProjectsDueForBackup(ctx context.Context, maxAge time.Duration, limit int) ([]Project, error) {
	if limit <= 0 {
		limit = defaultListLimit
	}
	if limit > maxListLimit {
		limit = maxListLimit
	}

	cutoff := time.Now().Add(-maxAge)

	// The projection is selectProjectColumns with a p. alias, since this is the
	// one project read that joins. It has to stay in the same column order for
	// scanProject, which is why it is spelled out rather than shared.
	const query = `
		SELECT p.id, p.user_id, p.name, p.status, p.status_detail,
		       p.secret_key_hash, p.secret_key_prefix, p.secret_key_rotated_at,
		       p.created_at, p.updated_at
		  FROM projects p
		  LEFT JOIN database_backup_state s ON s.project_id = p.id
		 WHERE p.deleted_at IS NULL
		   AND p.status IN ($1, $2)
		   AND (s.last_success_at IS NULL OR s.last_success_at < $3)
		 ORDER BY s.last_success_at ASC NULLS FIRST, p.created_at ASC
		 LIMIT $4`

	rows, err := store.pool.Query(ctx, query,
		string(ProjectReady), string(ProjectPaused), cutoff, limit)
	if err != nil {
		return nil, fmt.Errorf("list projects due for backup: %w", err)
	}
	defer rows.Close()

	var projects []Project
	for rows.Next() {
		project, err := scanProject(rows)
		if err != nil {
			return nil, fmt.Errorf("scan project due for backup: %w", err)
		}
		projects = append(projects, *project)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate projects due for backup: %w", err)
	}
	return projects, nil
}

// ProjectBackupState loads the scheduler cursor for one project.
//
// A project that has never been backed up has no row; that is reported as an
// empty state rather than ErrNotFound, because every caller treats "never
// backed up" as a normal starting point rather than a missing resource.
func (store *Store) ProjectBackupState(ctx context.Context, projectID uuid.UUID) (*DatabaseBackupState, error) {
	const query = `
		SELECT project_id, last_success_at, last_size_bytes, last_sha256,
		       last_source_modified_at, consecutive_failures, last_error, updated_at
		  FROM database_backup_state
		 WHERE project_id = $1`

	state := &DatabaseBackupState{ProjectID: projectID}
	err := store.pool.QueryRow(ctx, query, projectID).Scan(
		&state.ProjectID,
		&state.LastSuccessAt,
		&state.LastSizeBytes,
		&state.LastSHA256,
		&state.LastSourceModifiedAt,
		&state.ConsecutiveFailures,
		&state.LastError,
		&state.UpdatedAt,
	)
	if err != nil {
		if isNoRows(err) {
			return state, nil
		}
		return nil, fmt.Errorf("load backup state: %w", err)
	}
	return state, nil
}

// RecordBackupSuccess appends a history row and advances the project's cursor in
// one transaction, so a crash cannot leave a listed backup whose state says the
// project is still overdue.
func (store *Store) RecordBackupSuccess(
	ctx context.Context,
	projectID uuid.UUID,
	kind BackupKind,
	objectKey string,
	sha256 string,
	sizeBytes int64,
	sourceModifiedAt time.Time,
) error {
	transaction, err := store.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin backup success transaction: %w", err)
	}
	defer func() { _ = transaction.Rollback(ctx) }()

	const insertBackup = `
		INSERT INTO database_backups
			(project_id, kind, object_key, size_bytes, sha256, source_modified_at)
		VALUES ($1, $2, $3, $4, $5, $6)`

	if _, err := transaction.Exec(ctx, insertBackup,
		projectID, string(kind), objectKey, sizeBytes, sha256, sourceModifiedAt); err != nil {
		return fmt.Errorf("insert backup: %w", err)
	}

	const upsertState = `
		INSERT INTO database_backup_state
			(project_id, last_success_at, last_size_bytes, last_sha256,
			 last_source_modified_at, consecutive_failures, last_error, updated_at)
		VALUES ($1, now(), $2, $3, $4, 0, NULL, now())
		ON CONFLICT (project_id) DO UPDATE
		   SET last_success_at        = now(),
		       last_size_bytes        = EXCLUDED.last_size_bytes,
		       last_sha256            = EXCLUDED.last_sha256,
		       last_source_modified_at = EXCLUDED.last_source_modified_at,
		       consecutive_failures   = 0,
		       last_error             = NULL,
		       updated_at             = now()`

	if _, err := transaction.Exec(ctx, upsertState,
		projectID, sizeBytes, sha256, sourceModifiedAt); err != nil {
		return fmt.Errorf("advance backup state: %w", err)
	}

	if err := transaction.Commit(ctx); err != nil {
		return fmt.Errorf("commit backup success: %w", err)
	}
	return nil
}

// MarkBackupCurrent advances the project's freshness clock without writing a
// history row, for the tick that finds nothing has changed on disk since the
// last backup. The existing backup is still current then, so the project should
// not be looked at again until maxAge has passed.
func (store *Store) MarkBackupCurrent(ctx context.Context, projectID uuid.UUID) error {
	const query = `
		INSERT INTO database_backup_state
			(project_id, last_success_at, consecutive_failures, last_error, updated_at)
		VALUES ($1, now(), 0, NULL, now())
		ON CONFLICT (project_id) DO UPDATE
		   SET last_success_at      = now(),
		       consecutive_failures = 0,
		       last_error           = NULL,
		       updated_at           = now()`

	if _, err := store.pool.Exec(ctx, query, projectID); err != nil {
		return fmt.Errorf("mark backup current: %w", err)
	}
	return nil
}

// RecordBackupFailure records a failed attempt without touching the history, so
// the list of restorable backups is unaffected by an outage.
func (store *Store) RecordBackupFailure(ctx context.Context, projectID uuid.UUID, reason string) error {
	const query = `
		INSERT INTO database_backup_state
			(project_id, consecutive_failures, last_error, updated_at)
		VALUES ($1, 1, $2, now())
		ON CONFLICT (project_id) DO UPDATE
		   SET consecutive_failures = database_backup_state.consecutive_failures + 1,
		       last_error           = EXCLUDED.last_error,
		       updated_at           = now()`

	if _, err := store.pool.Exec(ctx, query, projectID, reason); err != nil {
		return fmt.Errorf("record backup failure: %w", err)
	}
	return nil
}

// ListDatabaseBackups returns one project's backups, newest first.
func (store *Store) ListDatabaseBackups(ctx context.Context, projectID uuid.UUID, limit int, offset int) ([]DatabaseBackup, error) {
	if limit <= 0 {
		limit = defaultListLimit
	}
	if limit > maxListLimit {
		limit = maxListLimit
	}
	if offset < 0 {
		offset = 0
	}

	query := `SELECT ` + backupColumns + `
		  FROM database_backups
		 WHERE project_id = $1
		 ORDER BY created_at DESC
		 LIMIT $2 OFFSET $3`

	rows, err := store.pool.Query(ctx, query, projectID, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("list backups: %w", err)
	}
	defer rows.Close()

	backups := make([]DatabaseBackup, 0, limit)
	for rows.Next() {
		backup, err := scanBackup(rows)
		if err != nil {
			return nil, fmt.Errorf("scan backup: %w", err)
		}
		backups = append(backups, *backup)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate backups: %w", err)
	}
	return backups, nil
}

// DatabaseBackupByID loads a single backup row, scoped to a project so an id
// guessed for another project's backup cannot be restored.
func (store *Store) DatabaseBackupByID(ctx context.Context, projectID uuid.UUID, backupID uuid.UUID) (*DatabaseBackup, error) {
	query := `SELECT ` + backupColumns + `
		  FROM database_backups
		 WHERE id = $1 AND project_id = $2`

	backup, err := scanBackup(store.pool.QueryRow(ctx, query, backupID, projectID))
	if err != nil {
		if isNoRows(err) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("load backup: %w", err)
	}
	return backup, nil
}

// LatestRegularBackup returns the project's newest backup that is not a
// pre-restore snapshot: the one latest.sqlite mirrors.
//
// A project with no such backup -- only pre-restore snapshots, or none at all
// -- is reported as (nil, nil) rather than an error, because "there is nothing
// to point at" is a normal state and not a failure to look it up.
func (store *Store) LatestRegularBackup(ctx context.Context, projectID uuid.UUID) (*DatabaseBackup, error) {
	query := `SELECT ` + backupColumns + `
		  FROM database_backups
		 WHERE project_id = $1 AND kind <> $2
		 ORDER BY created_at DESC
		 LIMIT 1`

	backup, err := scanBackup(store.pool.QueryRow(ctx, query, projectID, string(BackupPreRestore)))
	if err != nil {
		if isNoRows(err) {
			return nil, nil
		}
		return nil, fmt.Errorf("load latest regular backup: %w", err)
	}
	return backup, nil
}

// ExpiredBackups returns a project's backups older than cutoff, newest of them
// last, excluding the single newest backup of the project.
//
// Keeping the newest row no matter how old it is means retention can never
// delete the project's only remaining restore point, which would leave a
// project with a backup feature and no backups.
func (store *Store) ExpiredBackups(ctx context.Context, projectID uuid.UUID, cutoff time.Time) ([]DatabaseBackup, error) {
	query := `SELECT ` + backupColumns + `
		  FROM database_backups
		 WHERE project_id = $1
		   AND created_at < $2
		   AND id <> (SELECT id FROM database_backups
		               WHERE project_id = $1
		               ORDER BY created_at DESC
		               LIMIT 1)
		 ORDER BY created_at ASC`

	rows, err := store.pool.Query(ctx, query, projectID, cutoff)
	if err != nil {
		return nil, fmt.Errorf("list expired backups: %w", err)
	}
	defer rows.Close()

	var backups []DatabaseBackup
	for rows.Next() {
		backup, err := scanBackup(rows)
		if err != nil {
			return nil, fmt.Errorf("scan expired backup: %w", err)
		}
		backups = append(backups, *backup)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate expired backups: %w", err)
	}
	return backups, nil
}

// DeleteBackupRows removes history rows by id.
//
// It is separate from the object deletion so the caller can delete the objects
// first: a row that is gone can no longer name the object it was pointing at,
// and an orphaned object is only a quota inconvenience while an orphaned row is
// a restore that fails.
func (store *Store) DeleteBackupRows(ctx context.Context, ids []uuid.UUID) error {
	if len(ids) == 0 {
		return nil
	}

	const query = `DELETE FROM database_backups WHERE id = ANY($1)`
	if _, err := store.pool.Exec(ctx, query, ids); err != nil {
		return fmt.Errorf("delete backup rows: %w", err)
	}
	return nil
}

// DeleteProjectBackups removes a project's backup history and cursor.
//
// It is called when a project or account is deleted, before the rows would
// otherwise cascade, so the object keys can be collected first.
func (store *Store) DeleteProjectBackups(ctx context.Context, projectID uuid.UUID) error {
	transaction, err := store.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin delete project backups: %w", err)
	}
	defer func() { _ = transaction.Rollback(ctx) }()

	if _, err := transaction.Exec(ctx, `DELETE FROM database_backups WHERE project_id = $1`, projectID); err != nil {
		return fmt.Errorf("delete backup history: %w", err)
	}
	if _, err := transaction.Exec(ctx, `DELETE FROM database_backup_state WHERE project_id = $1`, projectID); err != nil {
		return fmt.Errorf("delete backup state: %w", err)
	}
	if err := transaction.Commit(ctx); err != nil {
		return fmt.Errorf("commit delete project backups: %w", err)
	}
	return nil
}
