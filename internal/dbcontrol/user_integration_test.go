package dbcontrol

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
)

// unusedTokenCount counts the single-use tokens a user still holds.
func unusedTokenCount(t *testing.T, store *Store, table string, userID uuid.UUID) int {
	t.Helper()
	var count int
	if err := store.pool.QueryRow(context.Background(),
		`SELECT count(*) FROM `+table+` WHERE user_id = $1 AND used_at IS NULL`,
		userID,
	).Scan(&count); err != nil {
		t.Fatalf("count %s: %v", table, err)
	}
	return count
}

// TestGoogleSignInSecuresAnUnverifiedRegistration is MG-03: somebody can
// register an address they do not own, leaving a password the inbox owner
// never set. A Google sign-in proves control of that address, so the conflict
// must mark it verified -- otherwise the attacker's password stays one
// confirmation click away from working -- and it must clear the password that
// was never proven to belong to the owner. Pending email tokens are voided
// because the sign-in supersedes them.
func TestGoogleSignInSecuresAnUnverifiedRegistration(t *testing.T) {
	store := testStore(t)
	ctx := context.Background()

	email := uuid.NewString() + "@example.com"
	registered, err := store.CreateUserWithPassword(
		ctx, email, "Not The Owner", "attacker-set-hash",
		5, 100*1024*1024, 256*1024*1024,
	)
	if err != nil {
		t.Fatalf("register: %v", err)
	}
	if registered.EmailVerifiedAt != nil {
		t.Fatal("precondition: registration must start unverified")
	}
	if err := store.CreateVerificationToken(ctx, registered.ID, "verify-hash", time.Hour); err != nil {
		t.Fatalf("verification token: %v", err)
	}
	if err := store.CreatePasswordResetToken(ctx, registered.ID, "reset-hash", time.Hour); err != nil {
		t.Fatalf("reset token: %v", err)
	}

	// The address owner signs in with Google.
	user, err := store.UpsertUserByEmail(ctx, email, "The Owner", "", 5, 100*1024*1024, 256*1024*1024)
	if err != nil {
		t.Fatalf("google sign-in: %v", err)
	}

	if user.EmailVerifiedAt == nil {
		t.Error("a Google sign-in must mark the address verified")
	}
	if user.PasswordHash != "" {
		t.Error("the unverified registration's password must be cleared")
	}
	if count := unusedTokenCount(t, store, "email_verification_tokens", user.ID); count != 0 {
		t.Errorf("%d verification tokens still valid after the sign-in", count)
	}
	if count := unusedTokenCount(t, store, "password_reset_tokens", user.ID); count != 0 {
		t.Errorf("%d reset tokens still valid after the sign-in", count)
	}
}

// TestGoogleSignInKeepsAVerifiedPasswordAccount is the other side: an
// account whose address was proven keeps its password and its verification
// timestamp across a Google sign-in, so signing in with Google cannot lock
// the owner out of the password they chose.
func TestGoogleSignInKeepsAVerifiedPasswordAccount(t *testing.T) {
	store := testStore(t)
	ctx := context.Background()

	email := uuid.NewString() + "@example.com"
	registered, err := store.CreateUserWithPassword(
		ctx, email, "The Owner", "owner-hash",
		5, 100*1024*1024, 256*1024*1024,
	)
	if err != nil {
		t.Fatalf("register: %v", err)
	}
	if err := store.MarkEmailVerified(ctx, registered.ID); err != nil {
		t.Fatalf("verify: %v", err)
	}
	if err := store.CreatePasswordResetToken(ctx, registered.ID, "reset-hash", time.Hour); err != nil {
		t.Fatalf("reset token: %v", err)
	}

	user, err := store.UpsertUserByEmail(ctx, email, "The Owner", "", 5, 100*1024*1024, 256*1024*1024)
	if err != nil {
		t.Fatalf("google sign-in: %v", err)
	}

	if user.EmailVerifiedAt == nil {
		t.Error("verification must survive the sign-in")
	}
	if user.PasswordHash != "owner-hash" {
		t.Errorf("password hash = %q, want the password kept", user.PasswordHash)
	}
	if count := unusedTokenCount(t, store, "password_reset_tokens", user.ID); count != 0 {
		t.Errorf("%d reset tokens still valid after the sign-in", count)
	}
}
