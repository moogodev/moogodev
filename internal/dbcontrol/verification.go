package dbcontrol

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
)

// CreateVerificationToken issues a new address-confirmation token and voids any
// earlier unused one, so only the most recently requested link works.
//
// tokenHash is the SHA-256 of the raw token that goes into the email; the raw
// value is never stored, exactly as with password resets.
func (store *Store) CreateVerificationToken(
	ctx context.Context,
	userID uuid.UUID,
	tokenHash string,
	ttl time.Duration,
) error {
	transaction, err := store.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin verification token: %w", err)
	}
	defer func() { _ = transaction.Rollback(ctx) }()

	if _, err := transaction.Exec(ctx, `
		UPDATE email_verification_tokens
		SET used_at = now()
		WHERE user_id = $1 AND used_at IS NULL`, userID); err != nil {
		return fmt.Errorf("void old verification tokens: %w", err)
	}

	expiresAt := time.Now().Add(ttl)
	if _, err := transaction.Exec(ctx, `
		INSERT INTO email_verification_tokens (user_id, token_hash, expires_at)
		VALUES ($1, $2, $3)`, userID, tokenHash, expiresAt); err != nil {
		return fmt.Errorf("insert verification token: %w", err)
	}

	if err := transaction.Commit(ctx); err != nil {
		return fmt.Errorf("commit verification token: %w", err)
	}
	return nil
}

// VerifyEmail consumes a confirmation token and, if it is still valid, marks
// the account's address as verified -- in one transaction.
//
// One transaction matters here in a way it barely did for password resets.
// Marking the user verified and consuming the token are two writes, and an
// interrupted process between them would leave an account that is verified but
// whose token still works. Replaying that token is harmless -- the second run
// re-stamps the same value -- but the reverse order would leave a used token on
// an unverified account, which locks the person out until they request a new
// link.
//
// Every failure (unknown, used, expired) returns ErrVerificationTokenInvalid so
// the API cannot be probed to distinguish them.
func (store *Store) VerifyEmail(ctx context.Context, tokenHash string) error {
	transaction, err := store.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin email verification: %w", err)
	}
	defer func() { _ = transaction.Rollback(ctx) }()

	var (
		userID    uuid.UUID
		expiresAt time.Time
		usedAt    *time.Time
	)
	err = transaction.QueryRow(ctx, `
		SELECT user_id, expires_at, used_at
		FROM email_verification_tokens
		WHERE token_hash = $1`, tokenHash,
	).Scan(&userID, &expiresAt, &usedAt)
	if err != nil {
		if isNoRows(err) {
			return ErrVerificationTokenInvalid
		}
		return fmt.Errorf("load verification token: %w", err)
	}
	if usedAt != nil || time.Now().After(expiresAt) {
		return ErrVerificationTokenInvalid
	}

	if _, err := transaction.Exec(ctx, `
		UPDATE users SET email_verified_at = now() WHERE id = $1`, userID); err != nil {
		return fmt.Errorf("mark email verified: %w", err)
	}

	if _, err := transaction.Exec(ctx, `
		UPDATE email_verification_tokens SET used_at = now() WHERE token_hash = $1`,
		tokenHash); err != nil {
		return fmt.Errorf("mark verification token used: %w", err)
	}

	if err := transaction.Commit(ctx); err != nil {
		return fmt.Errorf("commit email verification: %w", err)
	}
	return nil
}

// EmailVerified reports whether an account's address has been proven.
//
// It exists as its own lookup rather than a field on UserByEmail because the
// two callers want opposite things: login needs the whole user to open a
// session, while the resend handler only needs to know whether to send
// anything, and loading a password hash to answer a yes/no question would be
// more than the decision needs.
func (store *Store) EmailVerified(ctx context.Context, userID uuid.UUID) (bool, error) {
	var verifiedAt *time.Time
	err := store.pool.QueryRow(ctx, `
		SELECT email_verified_at FROM users WHERE id = $1`, userID,
	).Scan(&verifiedAt)
	if err != nil {
		if isNoRows(err) {
			return false, ErrNotFound
		}
		return false, fmt.Errorf("load email verification: %w", err)
	}
	return verifiedAt != nil, nil
}

// MarkEmailVerified marks an address as proven without a token.
//
// This exists for the one case where a token would be pointless: a deployment
// with no mail delivery, where the address was never going to be confirmed by
// email. Sending a confirmation nobody can receive produces an account that
// Login refuses, which is worse than one that was never gated.
//
// It is deliberately not a verification path: the caller has to know that no
// mail is configured, and config refuses to boot in production without a
// sign-in path, so this never runs where it could let in an unproven address.
func (store *Store) MarkEmailVerified(ctx context.Context, userID uuid.UUID) error {
	if _, err := store.pool.Exec(ctx, `
		UPDATE users SET email_verified_at = now() WHERE id = $1`, userID,
	); err != nil {
		return fmt.Errorf("mark email verified: %w", err)
	}
	return nil
}
