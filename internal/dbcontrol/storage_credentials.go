package dbcontrol

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"

	"github.com/moogodev/moogodev/pkg/bucketkey"
)

// ErrStorageCredentialLimit means the project already holds as many storage
// credentials as it is allowed.
//
// The limit exists because each credential is a separate long-lived secret. A
// project that can mint them without bound accumulates credentials nobody
// remembers revoking.
var ErrStorageCredentialLimit = errors.New("storage credential limit reached")

// MaxStorageCredentialsPerProject caps how many credentials one project holds.
//
// Exported so the dashboard can tell the owner how much room is left before
// they hit the wall, instead of only finding out when a create fails.
const MaxStorageCredentialsPerProject = 5

// selectCredentialColumns is the shared projection for credential reads.
const selectCredentialColumns = `
	SELECT id, project_id, access_key_id, secret_key_hash, secret_key_preview,
	       label, created_at, rotated_at, revoked_at
	FROM storage_credentials`

// scanCredential reads one credential row.
func scanCredential(row interface{ Scan(...any) error }) (*StorageCredential, error) {
	credential := &StorageCredential{}

	var (
		rotatedAt *time.Time
		revokedAt *time.Time
	)
	if err := row.Scan(
		&credential.ID,
		&credential.ProjectID,
		&credential.AccessKeyID,
		&credential.SecretKeyHash,
		&credential.SecretKeyPreview,
		&credential.Label,
		&credential.CreatedAt,
		&rotatedAt,
		&revokedAt,
	); err != nil {
		return nil, err
	}

	credential.RotatedAt = rotatedAt
	credential.RevokedAt = revokedAt
	return credential, nil
}

// CreateStorageCredential issues a new credential for a project.
//
// The returned plaintext is the only chance the owner has to read the secret.
// If it is lost the credential has to be rotated, which is the same trade the
// SQL secret key makes and the reason both are shown exactly once.
func (store *Store) CreateStorageCredential(
	ctx context.Context,
	projectID uuid.UUID,
	label string,
	key bucketkey.Generated,
) (*StorageCredential, error) {
	transaction, err := store.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin transaction: %w", err)
	}
	// Rollback after a successful commit returns ErrTxClosed, which is safe to
	// ignore, so this defer stays unconditional.
	defer func() { _ = transaction.Rollback(ctx) }()

	// Lock the project row so two simultaneous requests cannot both read a
	// count of four and each mint a fifth credential.
	const lockQuery = `SELECT 1 FROM projects WHERE id = $1 FOR UPDATE`
	var locked int
	if err := transaction.QueryRow(ctx, lockQuery, projectID).Scan(&locked); err != nil {
		if isNoRows(err) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("lock project row: %w", err)
	}

	const countQuery = `
		SELECT count(*)
		FROM storage_credentials
		WHERE project_id = $1 AND revoked_at IS NULL`

	var active int
	if err := transaction.QueryRow(ctx, countQuery, projectID).Scan(&active); err != nil {
		return nil, fmt.Errorf("count storage credentials: %w", err)
	}
	if active >= MaxStorageCredentialsPerProject {
		return nil, fmt.Errorf("%w: at most %d storage credentials per project",
			ErrStorageCredentialLimit, MaxStorageCredentialsPerProject)
	}

	const insertQuery = `
		INSERT INTO storage_credentials (
		    project_id, access_key_id, secret_key_hash, secret_key_preview, label)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, created_at`

	var (
		credentialID uuid.UUID
		createdAt    time.Time
	)
	if err := transaction.QueryRow(ctx, insertQuery,
		projectID, key.AccessKeyID, key.SecretKeyHash, key.SecretKeyPreview, label,
	).Scan(&credentialID, &createdAt); err != nil {
		return nil, fmt.Errorf("insert storage credential: %w", err)
	}

	if err := transaction.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit storage credential: %w", err)
	}

	return &StorageCredential{
		ID:               credentialID,
		ProjectID:        projectID,
		AccessKeyID:      key.AccessKeyID,
		SecretKeyHash:    key.SecretKeyHash,
		SecretKeyPreview: key.SecretKeyPreview,
		Label:            label,
		CreatedAt:        createdAt,
	}, nil
}

// StorageCredentialByAccessKeyID loads a credential for the storage auth path.
//
// Revoked credentials are still returned, but with their hash cleared. Callers
// verify the secret and a missing hash never matches, so a revoked credential
// stops working without needing a separate check that callers might forget. It
// is returned rather than hidden so the caller can answer a wrong-key request
// identically either way.
func (store *Store) StorageCredentialByAccessKeyID(
	ctx context.Context,
	accessKeyID string,
) (*StorageCredential, error) {
	query := selectCredentialColumns + ` WHERE access_key_id = $1`

	credential, err := scanCredential(store.pool.QueryRow(ctx, query, accessKeyID))
	if err != nil {
		if isNoRows(err) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("load storage credential: %w", err)
	}

	if !credential.Active() {
		credential.SecretKeyHash = ""
	}
	return credential, nil
}

// StorageCredentials lists a project's credentials, newest first.
func (store *Store) StorageCredentials(
	ctx context.Context,
	projectID uuid.UUID,
) ([]StorageCredential, error) {
	query := selectCredentialColumns + `
		WHERE project_id = $1
		ORDER BY created_at DESC`

	rows, err := store.pool.Query(ctx, query, projectID)
	if err != nil {
		return nil, fmt.Errorf("list storage credentials: %w", err)
	}
	defer rows.Close()

	var credentials []StorageCredential
	for rows.Next() {
		credential, err := scanCredential(rows)
		if err != nil {
			return nil, fmt.Errorf("scan storage credential: %w", err)
		}
		credentials = append(credentials, *credential)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate storage credentials: %w", err)
	}
	return credentials, nil
}

// RotateStorageCredentialSecret replaces a credential's secret and returns the
// new one.
//
// The access key id stays the same, so anything already configured with the id
// keeps working once the new secret is in place. That is what makes this a
// rotation rather than a replacement, and it is why the old secret keeps
// working until the very last commit.
func (store *Store) RotateStorageCredentialSecret(
	ctx context.Context,
	projectID uuid.UUID,
	credentialID uuid.UUID,
	key bucketkey.Generated,
) (*StorageCredential, error) {
	const query = `
		UPDATE storage_credentials
		   SET secret_key_hash     = $3,
		       secret_key_preview  = $4,
		       rotated_at          = now()
		 WHERE id = $2 AND project_id = $1 AND revoked_at IS NULL
		RETURNING id, project_id, access_key_id, secret_key_hash,
		          secret_key_preview, label, created_at, rotated_at, revoked_at`

	credential, err := scanCredential(
		store.pool.QueryRow(ctx, query, projectID, credentialID,
			key.SecretKeyHash, key.SecretKeyPreview))
	if err != nil {
		if isNoRows(err) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("rotate storage credential: %w", err)
	}
	return credential, nil
}

// RevokeStorageCredential marks a credential unusable.
//
// The row is kept rather than deleted so the owner can still see that it
// existed and when it died, and so an audit of "what authorized this request"
// has an answer. Only one of many credentials dying is a normal operation, so
// this must not be blocked by the per-project limit.
func (store *Store) RevokeStorageCredential(
	ctx context.Context,
	projectID uuid.UUID,
	credentialID uuid.UUID,
) error {
	const query = `
		UPDATE storage_credentials
		   SET revoked_at = now()
		 WHERE id = $2 AND project_id = $1 AND revoked_at IS NULL`

	result, err := store.pool.Exec(ctx, query, projectID, credentialID)
	if err != nil {
		return fmt.Errorf("revoke storage credential: %w", err)
	}
	if result.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}
