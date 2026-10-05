package dbcontrol

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
)

// selectUserColumns is the shared projection for user reads. Keeping it in one
// place stops the read paths from drifting apart.
//
// password_hash is projected so a login can verify a password without a second
// query. It is carried on the User struct with json:"-", so it never reaches a
// response even though it is present in memory.
const selectUserColumns = `
	SELECT id, email, name, avatar_url, password_hash, email_verified_at,
	       quota_max_projects, quota_max_db_bytes, quota_max_storage_bytes,
	       billing_plan, billing_customer_id, created_at, updated_at
	FROM users`

// returningUserColumns is the same projection spelled for RETURNING.
//
// It is kept separate rather than reused, because selectUserColumns ends in
// "FROM users" and cannot be followed by RETURNING.
const returningUserColumns = `
	RETURNING id, email, name, avatar_url, password_hash, email_verified_at,
	          quota_max_projects, quota_max_db_bytes, quota_max_storage_bytes,
	          billing_plan, billing_customer_id, created_at, updated_at`

// scanUser reads one user row produced by selectUserColumns or
// returningUserColumns.
//
// password_hash and email_verified_at are both nullable, so they are scanned
// into pointers and copied across only when present.
func scanUser(row interface{ Scan(...any) error }) (*User, error) {
	user := &User{}
	var passwordHash *string
	err := row.Scan(
		&user.ID,
		&user.Email,
		&user.Name,
		&user.AvatarURL,
		&passwordHash,
		&user.EmailVerifiedAt,
		&user.QuotaMaxProjects,
		&user.QuotaMaxDBBytes,
		&user.QuotaMaxStorageBytes,
		&user.BillingPlan,
		&user.BillingCustomerID,
		&user.CreatedAt,
		&user.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	if passwordHash != nil {
		user.PasswordHash = *passwordHash
	}
	return user, nil
}

// UpsertUserByEmail finds the user for an email address, creating it on first
// login. Called after a successful Google OAuth callback.
//
// The email is normalized to lowercase so the same person cannot end up with
// two accounts purely because the provider returned different casing.
func (store *Store) UpsertUserByEmail(
	ctx context.Context,
	email string,
	name string,
	avatarURL string,
	maxProjects int,
	maxDBBytes int64,
	maxStorageBytes int64,
) (*User, error) {
	normalizedEmail := strings.ToLower(strings.TrimSpace(email))
	if normalizedEmail == "" {
		return nil, fmt.Errorf("email is required")
	}

	// Quota columns are set on insert only. An existing user's quotas are never
	// reset from config, because billing may have raised them in the meantime.
	//
	// email_verified_at is set to now() on insert and never cleared on
	// conflict. Google returns the address with email_verified already true --
	// the provider is the authority on that point -- so a first Google sign-in
	// is verified from birth. Preserving it on conflict means a Google sign-in
	// by somebody who had earlier registered by password cannot walk an
	// already-verified account back to unverified.
	const query = `
		INSERT INTO users (email, name, avatar_url, email_verified_at,
		                   quota_max_projects, quota_max_db_bytes, quota_max_storage_bytes)
		VALUES ($1, $2, $3, now(), $4, $5, $6)
		ON CONFLICT (email) DO UPDATE
		   SET name       = CASE WHEN EXCLUDED.name       <> '' THEN EXCLUDED.name       ELSE users.name       END,
		       avatar_url = CASE WHEN EXCLUDED.avatar_url <> '' THEN EXCLUDED.avatar_url ELSE users.avatar_url END` + returningUserColumns

	user, err := scanUser(store.pool.QueryRow(ctx, query,
		normalizedEmail, name, avatarURL, maxProjects, maxDBBytes, maxStorageBytes,
	))
	if err != nil {
		return nil, fmt.Errorf("upsert user: %w", err)
	}
	return user, nil
}

// UserByID loads a user by primary key.
func (store *Store) UserByID(ctx context.Context, userID uuid.UUID) (*User, error) {
	query := selectUserColumns + ` WHERE id = $1`

	user, err := scanUser(store.pool.QueryRow(ctx, query, userID))
	if err != nil {
		if isNoRows(err) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("load user by id: %w", err)
	}
	return user, nil
}

// UserByEmail loads a user by email address.
func (store *Store) UserByEmail(ctx context.Context, email string) (*User, error) {
	normalizedEmail := strings.ToLower(strings.TrimSpace(email))
	query := selectUserColumns + ` WHERE email = $1`

	user, err := scanUser(store.pool.QueryRow(ctx, query, normalizedEmail))
	if err != nil {
		if isNoRows(err) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("load user by email: %w", err)
	}
	return user, nil
}

// CountProjects counts a user's active projects.
//
// Soft-deleted rows are excluded so quota frees up immediately while the
// SQLite file removal stays auditable in the background.
func (store *Store) CountProjects(ctx context.Context, userID uuid.UUID) (int, error) {
	const query = `
		SELECT count(*)
		FROM projects
		WHERE user_id = $1 AND deleted_at IS NULL`

	var projectCount int
	if err := store.pool.QueryRow(ctx, query, userID).Scan(&projectCount); err != nil {
		return 0, fmt.Errorf("count projects: %w", err)
	}
	return projectCount, nil
}

// CreateUserWithPassword creates an account from a registration form.
//
// Unlike the Google upsert, this is a strict insert: if the email is already
// taken the caller gets ErrEmailTaken so the UI can say "that email is
// registered" rather than silently logging a new person into an existing
// account. Quota defaults are applied at insert time, exactly as the upsert
// does.
//
// email_verified_at is left NULL. A typed address has been proven by nothing,
// and the caller must send a confirmation link before the account can sign in.
// Inserting now() here would make the verification flow unreachable.
func (store *Store) CreateUserWithPassword(
	ctx context.Context,
	email string,
	name string,
	passwordHash string,
	maxProjects int,
	maxDBBytes int64,
	maxStorageBytes int64,
) (*User, error) {
	normalizedEmail := strings.ToLower(strings.TrimSpace(email))
	if normalizedEmail == "" {
		return nil, fmt.Errorf("email is required")
	}

	const query = `
		INSERT INTO users (email, name, password_hash,
		                   quota_max_projects, quota_max_db_bytes, quota_max_storage_bytes)
		VALUES ($1, $2, $3, $4, $5, $6)` + returningUserColumns

	user, err := scanUser(store.pool.QueryRow(ctx, query,
		normalizedEmail, name, passwordHash, maxProjects, maxDBBytes, maxStorageBytes,
	))
	if err != nil {
		if isUniqueViolation(err) {
			return nil, ErrEmailTaken
		}
		return nil, fmt.Errorf("create user: %w", err)
	}
	return user, nil
}

// CreatePasswordResetToken stores a new reset token for a user and voids any
// earlier unused token, so only the most recently requested link works.
//
// tokenHash is the SHA-256 of the raw token that goes into the email; the raw
// value is never stored.
func (store *Store) CreatePasswordResetToken(
	ctx context.Context,
	userID uuid.UUID,
	tokenHash string,
	ttl time.Duration,
) error {
	transaction, err := store.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin reset token: %w", err)
	}
	defer func() { _ = transaction.Rollback(ctx) }()

	// Void prior links for this user. A user who requests a reset twice should
	// only have the newest link live; the older one is already stale.
	if _, err := transaction.Exec(ctx, `
		UPDATE password_reset_tokens
		SET used_at = now()
		WHERE user_id = $1 AND used_at IS NULL`, userID); err != nil {
		return fmt.Errorf("void old reset tokens: %w", err)
	}

	expiresAt := time.Now().Add(ttl)
	if _, err := transaction.Exec(ctx, `
		INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
		VALUES ($1, $2, $3)`, userID, tokenHash, expiresAt); err != nil {
		return fmt.Errorf("insert reset token: %w", err)
	}

	if err := transaction.Commit(ctx); err != nil {
		return fmt.Errorf("commit reset token: %w", err)
	}
	return nil
}

// ResetPassword verifies a reset token and, if it is still valid, sets the
// user's new password and marks the token used — all in one transaction so a
// partial failure cannot leave a consumed token with an unchanged password, or
// a changed password with a live token.
//
// Every failure (unknown, used, expired) returns ErrResetTokenInvalid so the
// API cannot be probed to distinguish them.
func (store *Store) ResetPassword(ctx context.Context, tokenHash, newPasswordHash string) error {
	transaction, err := store.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin password reset: %w", err)
	}
	defer func() { _ = transaction.Rollback(ctx) }()

	var (
		userID    uuid.UUID
		expiresAt time.Time
		usedAt    *time.Time
	)
	err = transaction.QueryRow(ctx, `
		SELECT user_id, expires_at, used_at
		FROM password_reset_tokens
		WHERE token_hash = $1`, tokenHash,
	).Scan(&userID, &expiresAt, &usedAt)
	if err != nil {
		if isNoRows(err) {
			return ErrResetTokenInvalid
		}
		return fmt.Errorf("load reset token: %w", err)
	}
	if usedAt != nil || time.Now().After(expiresAt) {
		return ErrResetTokenInvalid
	}

	if _, err := transaction.Exec(ctx, `
		UPDATE users SET password_hash = $1 WHERE id = $2`,
		newPasswordHash, userID); err != nil {
		return fmt.Errorf("set password: %w", err)
	}

	if _, err := transaction.Exec(ctx, `
		UPDATE password_reset_tokens SET used_at = now() WHERE token_hash = $1`,
		tokenHash); err != nil {
		return fmt.Errorf("mark reset token used: %w", err)
	}

	if err := transaction.Commit(ctx); err != nil {
		return fmt.Errorf("commit password reset: %w", err)
	}
	return nil
}

// SetPasswordHash replaces the bcrypt hash on an account that has a password.
//
// No transaction is needed for a single statement. The WHERE clause carries
// `password_hash IS NOT NULL` and that is the whole point of the function: an
// UPDATE on a nullable column will happily write one, so without this guard this
// query would give a Google-only account a Moogo password the first time anything
// called it — a second way in that Google does not know about and cannot revoke.
// A zero-row update is therefore reported as ErrPasswordNotSet rather than
// ErrNotFound, because the row exists; it is the column that does not.
func (store *Store) SetPasswordHash(ctx context.Context, userID uuid.UUID, passwordHash string) error {
	const query = `
		UPDATE users SET password_hash = $1
		 WHERE id = $2 AND password_hash IS NOT NULL`

	tag, err := store.pool.Exec(ctx, query, passwordHash, userID)
	if err != nil {
		return fmt.Errorf("set password hash: %w", err)
	}
	if tag.RowsAffected() == 0 {
		// A missing row and a row without a password are told apart with a second
		// query, because the caller needs to say the right thing: "that account
		// does not exist" and "that account signs in with Google" are different
		// answers for the user.
		var exists bool
		if err := store.pool.QueryRow(ctx,
			`SELECT true FROM users WHERE id = $1`, userID).Scan(&exists); err != nil {
			if isNoRows(err) {
				return ErrNotFound
			}
			return fmt.Errorf("check user exists: %w", err)
		}
		return ErrPasswordNotSet
	}
	return nil
}

// UpdateUserName updates the display name for an account.
//
// The name is purely cosmetic and not used for authentication, so no
// re-authentication is required. Empty string is accepted and means "no name".
func (store *Store) UpdateUserName(ctx context.Context, userID uuid.UUID, name string) error {
	const query = `UPDATE users SET name = $1 WHERE id = $2`

	tag, err := store.pool.Exec(ctx, query, strings.TrimSpace(name), userID)
	if err != nil {
		return fmt.Errorf("update user name: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}
