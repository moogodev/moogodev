package dbcontrol

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"

	"github.com/moogodev/moogodev/pkg/secretkey"
)

// selectProjectColumns is the shared projection for project reads.
const selectProjectColumns = `
	SELECT id, user_id, name, status, status_detail,
	       secret_key_hash, secret_key_prefix, secret_key_rotated_at,
	       created_at, updated_at
	FROM projects`

// scanProject reads one project row produced by selectProjectColumns.
func scanProject(row interface{ Scan(...any) error }) (*Project, error) {
	project := &Project{}

	var (
		status       string
		statusDetail *string
		keyRotatedAt *time.Time
	)
	err := row.Scan(
		&project.ID,
		&project.UserID,
		&project.Name,
		&status,
		&statusDetail,
		&project.SecretKeyHash,
		&project.SecretKeyPrefix,
		&keyRotatedAt,
		&project.CreatedAt,
		&project.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}

	project.Status = ProjectStatus(status)
	project.StatusDetail = statusDetail
	project.SecretKeyRotatedAt = keyRotatedAt
	return project, nil
}

// ErrProjectNotOwned means the project does not exist or belongs to another
// user. The two cases are deliberately indistinguishable to the caller so a
// project ID cannot be probed for existence.
var ErrProjectNotOwned = errors.New("project not found")

// CreateProjectResult is the outcome of project creation.
type CreateProjectResult struct {
	Project *Project
	// SecretKeyPlaintext is the only copy of the raw key that ever exists
	// outside the client. It is returned once, at creation.
	SecretKeyPlaintext string
}

// CreateProject performs stage one of the creation saga: insert the project
// with status pending. Postgres is the source of truth; the caller
// materializes the SQLite file afterwards.
//
// The quota check runs inside the same transaction under a row lock on the
// user. Without the lock, two simultaneous requests could each count four
// projects and both succeed, exceeding the limit of five.
func (store *Store) CreateProject(
	ctx context.Context,
	userID uuid.UUID,
	name string,
	key secretkey.Generated,
) (*CreateProjectResult, error) {
	transaction, err := store.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin transaction: %w", err)
	}
	// Rollback after a successful commit returns ErrTxClosed, which is safe
	// to ignore, so this defer stays unconditional.
	defer func() { _ = transaction.Rollback(ctx) }()

	// Lock the user row to serialize concurrent project creation.
	const lockQuery = `SELECT 1 FROM users WHERE id = $1 FOR UPDATE`
	var locked int
	if err := transaction.QueryRow(ctx, lockQuery, userID).Scan(&locked); err != nil {
		if isNoRows(err) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("lock user row: %w", err)
	}

	const countQuery = `
		SELECT count(*)
		FROM projects
		WHERE user_id = $1 AND deleted_at IS NULL`

	var (
		projectCount int
		maxProjects  int
	)
	if err := transaction.QueryRow(ctx, countQuery, userID).Scan(&projectCount); err != nil {
		return nil, fmt.Errorf("count projects: %w", err)
	}

	const quotaQuery = `SELECT quota_max_projects FROM users WHERE id = $1`
	if err := transaction.QueryRow(ctx, quotaQuery, userID).Scan(&maxProjects); err != nil {
		return nil, fmt.Errorf("load project quota: %w", err)
	}

	if projectCount >= maxProjects {
		return nil, fmt.Errorf("%w: at most %d projects per account", ErrQuotaExceeded, maxProjects)
	}

	const insertQuery = `
		INSERT INTO projects (user_id, name, status, secret_key_hash, secret_key_prefix)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, created_at, updated_at`

	var (
		projectID uuid.UUID
		createdAt time.Time
		updatedAt time.Time
	)
	if err := transaction.QueryRow(ctx, insertQuery,
		userID, name, string(ProjectPending), key.Hash, key.Prefix,
	).Scan(&projectID, &createdAt, &updatedAt); err != nil {
		return nil, fmt.Errorf("insert project: %w", err)
	}

	if err := transaction.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit project: %w", err)
	}

	return &CreateProjectResult{
		Project: &Project{
			ID:              projectID,
			UserID:          userID,
			Name:            name,
			Status:          ProjectPending,
			SecretKeyPrefix: key.Prefix,
			CreatedAt:       createdAt,
			UpdatedAt:       updatedAt,
		},
		SecretKeyPlaintext: key.Plaintext,
	}, nil
}

// PauseProject transitions a ready project to the paused state. A paused
// project keeps its SQLite file but the key resolver refuses new bearer tokens,
// so no data can be read or written until ResumeProject is called.
func (store *Store) PauseProject(ctx context.Context, projectID uuid.UUID) error {
	return store.setProjectStatus(ctx, projectID, ProjectPaused, "manually paused")
}

// ResumeProject transitions a paused project back to ready.
func (store *Store) ResumeProject(ctx context.Context, projectID uuid.UUID) error {
	return store.setProjectStatus(ctx, projectID, ProjectReady, "")
}

// MarkProjectReady records that disk materialization succeeded.
func (store *Store) MarkProjectReady(ctx context.Context, projectID uuid.UUID) error {
	return store.setProjectStatus(ctx, projectID, ProjectReady, "")
}

// MarkProjectFailed records that disk materialization failed, keeping the
// reason so the dashboard can explain what went wrong.
func (store *Store) MarkProjectFailed(ctx context.Context, projectID uuid.UUID, reason string) error {
	return store.setProjectStatus(ctx, projectID, ProjectFailed, reason)
}

func (store *Store) setProjectStatus(
	ctx context.Context,
	projectID uuid.UUID,
	status ProjectStatus,
	detail string,
) error {
	// NULLIF turns an empty reason into SQL NULL, keeping status_detail clean.
	const query = `
		UPDATE projects
		   SET status = $2, status_detail = NULLIF($3, '')
		 WHERE id = $1`

	if _, err := store.pool.Exec(ctx, query, projectID, string(status), detail); err != nil {
		return fmt.Errorf("update project status: %w", err)
	}
	return nil
}

// ProjectByID loads a project by id.
//
// Soft-deleted rows are excluded so a removed project cannot be reached even
// while its file cleanup is still running.
func (store *Store) ProjectByID(ctx context.Context, projectID uuid.UUID) (*Project, error) {
	query := selectProjectColumns + ` WHERE id = $1 AND deleted_at IS NULL`

	project, err := scanProject(store.pool.QueryRow(ctx, query, projectID))
	if err != nil {
		if isNoRows(err) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("load project: %w", err)
	}
	return project, nil
}

// ListProjects returns a user's active projects, newest first.
func (store *Store) ListProjects(ctx context.Context, userID uuid.UUID, limit int, offset int) ([]Project, error) {
	// Clamp rather than reject: this is a listing helper, and a page size
	// outside this range is not worth failing a request over. A size above
	// the ceiling becomes the ceiling, not the default: falling back to the
	// default here would answer a request for 200 with 50 rows and a
	// "limit": 200 in the body, which reads as a server that cannot count.
	if limit <= 0 {
		limit = defaultListLimit
	}
	if limit > maxListLimit {
		limit = maxListLimit
	}
	if offset < 0 {
		offset = 0
	}

	query := selectProjectColumns + `
		WHERE user_id = $1 AND deleted_at IS NULL
		ORDER BY created_at DESC
		LIMIT $2 OFFSET $3`

	rows, err := store.pool.Query(ctx, query, userID, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("list projects: %w", err)
	}
	defer rows.Close()

	projects := make([]Project, 0, limit)
	for rows.Next() {
		project, err := scanProject(rows)
		if err != nil {
			return nil, fmt.Errorf("scan project: %w", err)
		}
		projects = append(projects, *project)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate projects: %w", err)
	}
	return projects, nil
}

// ProjectCount reports how many live projects this deployment holds.
//
// The metrics scrape reads it, so an error returns no number rather than a
// zero: a stale or wrong count would answer a scaling question with a lie,
// and absence is the honest answer.
func (store *Store) ProjectCount(ctx context.Context) (int, error) {
	const query = `SELECT count(*) FROM projects WHERE deleted_at IS NULL`

	var count int
	if err := store.pool.QueryRow(ctx, query).Scan(&count); err != nil {
		return 0, fmt.Errorf("count projects: %w", err)
	}
	return count, nil
}

// RotateSecretKey issues a new secret key for a project and invalidates the
// previous one, since only a single hash is stored per project.
//
// The returned plaintext is the user's only chance to read it. If it is lost,
// the key has to be rotated again.
func (store *Store) RotateSecretKey(ctx context.Context, projectID uuid.UUID) (string, error) {
	key, err := secretkey.Generate()
	if err != nil {
		return "", err
	}

	const query = `
		UPDATE projects
		   SET secret_key_hash       = $2,
		       secret_key_prefix     = $3,
		       secret_key_rotated_at = now()
		 WHERE id = $1 AND deleted_at IS NULL`

	result, err := store.pool.Exec(ctx, query, projectID, key.Hash, key.Prefix)
	if err != nil {
		return "", fmt.Errorf("rotate secret key: %w", err)
	}
	if result.RowsAffected() == 0 {
		return "", ErrNotFound
	}
	return key.Plaintext, nil
}

// SoftDeleteProject marks a project as deleted without removing the row, so
// the SQLite file cleanup can happen separately and stay auditable.
func (store *Store) SoftDeleteProject(ctx context.Context, projectID uuid.UUID, userID uuid.UUID) error {
	const query = `
		UPDATE projects
		   SET deleted_at = now(), status = $3
		 WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`

	result, err := store.pool.Exec(ctx, query, projectID, userID, string(ProjectDeleting))
	if err != nil {
		return fmt.Errorf("soft delete project: %w", err)
	}
	if result.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// ProjectsNeedingReconcile returns projects stuck in pending or failed, so
// the reconciler can finish or retry their materialization.
//
// Ordered oldest first: an entry that has been stuck the longest is the one
// most likely to be an abandoned attempt.
func (store *Store) ProjectsNeedingReconcile(ctx context.Context, limit int) ([]Project, error) {
	if limit <= 0 {
		limit = defaultListLimit
	}
	if limit > maxListLimit {
		limit = maxListLimit
	}

	query := selectProjectColumns + `
		WHERE status IN ($1, $2) AND deleted_at IS NULL
		ORDER BY created_at ASC
		LIMIT $3`

	rows, err := store.pool.Query(ctx, query,
		string(ProjectPending), string(ProjectFailed), limit)
	if err != nil {
		return nil, fmt.Errorf("load projects needing reconcile: %w", err)
	}
	defer rows.Close()

	var projects []Project
	for rows.Next() {
		project, err := scanProject(rows)
		if err != nil {
			return nil, fmt.Errorf("scan project needing reconcile: %w", err)
		}
		projects = append(projects, *project)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate projects needing reconcile: %w", err)
	}
	return projects, nil
}

// ProjectOwnedBy loads a project and verifies it belongs to the given user.
//
// Control plane endpoints use this so a guessed UUID for someone else's
// project cannot be read.
func (store *Store) ProjectOwnedBy(ctx context.Context, projectID uuid.UUID, userID uuid.UUID) (*Project, error) {
	project, err := store.ProjectByID(ctx, projectID)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			return nil, ErrProjectNotOwned
		}
		return nil, err
	}
	if project.UserID != userID {
		return nil, ErrProjectNotOwned
	}
	return project, nil
}

// Listing limits shared by the paginated read paths.
const (
	defaultListLimit = 50
	// maxListLimit matches the handler's maxPageLimit: a request the handler
	// accepts as 200 must not be quietly shrunk to something smaller here.
	maxListLimit = 200
)
