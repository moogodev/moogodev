package dbcontrol

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
)

// TestBackupDownloadTokenIsSingleUse proves the core promise of the download
// link: the first redemption returns the backup it names, and a second
// redemption of the same token is refused. This is what bounds a leaked email
// link to one download rather than to its whole time window.
func TestBackupDownloadTokenIsSingleUse(t *testing.T) {
	store := testStore(t)
	user := newTestUser(t, store, 1)
	project := newTestProject(t, store, user.ID)
	ctx := context.Background()

	backupID := uuid.New()
	hash := "single-use-token-hash"
	if err := store.CreateBackupDownloadToken(ctx, project.ID, backupID, hash, time.Hour); err != nil {
		t.Fatalf("create token: %v", err)
	}

	gotProject, gotBackup, err := store.ConsumeBackupDownloadToken(ctx, hash)
	if err != nil {
		t.Fatalf("first consume: %v", err)
	}
	if gotProject != project.ID || gotBackup != backupID {
		t.Errorf("consume returned (%s, %s), want (%s, %s)",
			gotProject, gotBackup, project.ID, backupID)
	}

	if _, _, err := store.ConsumeBackupDownloadToken(ctx, hash); !errors.Is(err, ErrDownloadTokenInvalid) {
		t.Errorf("second consume error = %v, want ErrDownloadTokenInvalid", err)
	}
}

// TestBackupDownloadTokenRejectsExpired covers the time bound: a token that was
// never used still dies at its expiry.
func TestBackupDownloadTokenRejectsExpired(t *testing.T) {
	store := testStore(t)
	user := newTestUser(t, store, 1)
	project := newTestProject(t, store, user.ID)
	ctx := context.Background()

	hash := "expired-token-hash"
	if err := store.CreateBackupDownloadToken(ctx, project.ID, uuid.New(), hash, -time.Minute); err != nil {
		t.Fatalf("create token: %v", err)
	}

	if _, _, err := store.ConsumeBackupDownloadToken(ctx, hash); !errors.Is(err, ErrDownloadTokenInvalid) {
		t.Errorf("consume error = %v, want ErrDownloadTokenInvalid", err)
	}
}

// TestBackupDownloadTokenUnknown covers the token that was never issued.
func TestBackupDownloadTokenUnknown(t *testing.T) {
	store := testStore(t)

	if _, _, err := store.ConsumeBackupDownloadToken(context.Background(), "never-issued"); !errors.Is(err, ErrDownloadTokenInvalid) {
		t.Errorf("consume error = %v, want ErrDownloadTokenInvalid", err)
	}
}

// TestBackupDownloadTokenSweptOnCreate proves used and expired rows do not
// accumulate: issuing a new link sweeps the ones that can never be redeemed.
func TestBackupDownloadTokenSweptOnCreate(t *testing.T) {
	store := testStore(t)
	user := newTestUser(t, store, 1)
	project := newTestProject(t, store, user.ID)
	ctx := context.Background()

	used := "used-token-hash"
	if err := store.CreateBackupDownloadToken(ctx, project.ID, uuid.New(), used, time.Hour); err != nil {
		t.Fatalf("create used token: %v", err)
	}
	if _, _, err := store.ConsumeBackupDownloadToken(ctx, used); err != nil {
		t.Fatalf("consume: %v", err)
	}

	// Issuing the next link sweeps the consumed one.
	if err := store.CreateBackupDownloadToken(ctx, project.ID, uuid.New(), "fresh-token-hash", time.Hour); err != nil {
		t.Fatalf("create fresh token: %v", err)
	}

	var count int
	if err := store.pool.QueryRow(ctx,
		`SELECT count(*) FROM backup_download_tokens WHERE token_hash = $1`, used,
	).Scan(&count); err != nil {
		t.Fatalf("count used token: %v", err)
	}
	if count != 0 {
		t.Errorf("used token row still present after sweep (count = %d)", count)
	}
}
