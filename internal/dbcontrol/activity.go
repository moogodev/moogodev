package dbcontrol

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
)

// RecordActivity appends an audit entry for a request.
//
// Audit writes are best effort: a failure here is logged by the caller but must
// never turn a successful request into an error, since the data plane work has
// already committed by this point.
func (store *Store) RecordActivity(
	ctx context.Context,
	projectID *uuid.UUID,
	userID *uuid.UUID,
	method string,
	path string,
	status int,
	duration time.Duration,
	source string,
) error {
	const query = `
		INSERT INTO activity_logs
		       (project_id, user_id, method, path, status, duration_ms, source)
		VALUES ($1, $2, $3, $4, $5, $6, $7)`

	_, err := store.pool.Exec(ctx, query,
		projectID, userID, method, path, status, duration.Milliseconds(), source,
	)
	if err != nil {
		return fmt.Errorf("record activity: %w", err)
	}
	return nil
}

// ListActivity returns recent audit entries for a project, newest first.
func (store *Store) ListActivity(ctx context.Context, projectID uuid.UUID, limit int) ([]ActivityEntry, error) {
	if limit <= 0 {
		limit = defaultListLimit
	}
	if limit > maxListLimit {
		limit = maxListLimit
	}

	const query = `
		SELECT id, project_id, user_id, method, path, status, duration_ms, source, created_at
		FROM activity_logs
		WHERE project_id = $1
		ORDER BY created_at DESC
		LIMIT $2`

	rows, err := store.pool.Query(ctx, query, projectID, limit)
	if err != nil {
		return nil, fmt.Errorf("list activity: %w", err)
	}
	defer rows.Close()

	entries := make([]ActivityEntry, 0, limit)
	for rows.Next() {
		entry := ActivityEntry{}
		if err := rows.Scan(
			&entry.ID,
			&entry.ProjectID,
			&entry.UserID,
			&entry.Method,
			&entry.Path,
			&entry.Status,
			&entry.Duration,
			&entry.Source,
			&entry.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan activity: %w", err)
		}
		entries = append(entries, entry)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate activity: %w", err)
	}
	return entries, nil
}

// PruneActivity deletes audit entries older than the retention window.
//
// This runs on a schedule. Without it the audit table grows without bound and
// becomes the reason the disk fills up, which is the same failure mode the
// per-project database limit exists to prevent.
func (store *Store) PruneActivity(ctx context.Context, retention time.Duration) (int64, error) {
	if retention <= 0 {
		return 0, nil
	}

	const query = `DELETE FROM activity_logs WHERE created_at < now() - $1::interval`

	result, err := store.pool.Exec(ctx, query, retention.String())
	if err != nil {
		return 0, fmt.Errorf("prune activity: %w", err)
	}
	return result.RowsAffected(), nil
}
