package dbcontrol

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
)

// ErrDownloadTokenInvalid means a backup download link is unknown, already used,
// or expired. The three cases are collapsed into one so the API cannot be probed
// to tell a live link from a dead one.
var ErrDownloadTokenInvalid = errors.New("download link is invalid or expired")

// CreateBackupDownloadToken records a single-use link for one backup.
//
// tokenHash is the SHA-256 of the raw token that goes into the email; the raw
// value is never stored, so a database leak does not hand out working links.
// The ttl bounds how long the link stays live; it is single-use regardless.
func (store *Store) CreateBackupDownloadToken(
	ctx context.Context,
	projectID uuid.UUID,
	backupID uuid.UUID,
	tokenHash string,
	ttl time.Duration,
) error {
	// Opportunistic sweep: a token that has been used or has expired can never
	// be redeemed again, so it is dropped here rather than left to accumulate.
	// Links are issued rarely (one per manual backup), so the sweep is cheap.
	if _, err := store.pool.Exec(ctx, `
		DELETE FROM backup_download_tokens
		WHERE expires_at < now() OR used_at IS NOT NULL`); err != nil {
		return fmt.Errorf("sweep download tokens: %w", err)
	}

	if _, err := store.pool.Exec(ctx, `
		INSERT INTO backup_download_tokens (token_hash, project_id, backup_id, expires_at)
		VALUES ($1, $2, $3, $4)`,
		tokenHash, projectID, backupID, time.Now().Add(ttl)); err != nil {
		return fmt.Errorf("insert download token: %w", err)
	}
	return nil
}

// ConsumeBackupDownloadToken redeems a download link and returns the project
// and backup it points at.
//
// The row is stamped used_at in the same statement that selects it, so exactly
// one concurrent request can win: a second request with the same token updates
// no row and is refused. Every failure (unknown, used, expired) returns
// ErrDownloadTokenInvalid.
func (store *Store) ConsumeBackupDownloadToken(
	ctx context.Context,
	tokenHash string,
) (projectID uuid.UUID, backupID uuid.UUID, err error) {
	err = store.pool.QueryRow(ctx, `
		UPDATE backup_download_tokens
		SET used_at = now()
		WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()
		RETURNING project_id, backup_id`, tokenHash,
	).Scan(&projectID, &backupID)
	if err != nil {
		if isNoRows(err) {
			return uuid.Nil, uuid.Nil, ErrDownloadTokenInvalid
		}
		return uuid.Nil, uuid.Nil, fmt.Errorf("consume download token: %w", err)
	}
	return projectID, backupID, nil
}
