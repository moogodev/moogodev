package dbcontrol

import (
	"context"
	"errors"
	"os"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/moogodev/moogodev/internal/config"
	"github.com/moogodev/moogodev/pkg/bucketkey"
	"github.com/moogodev/moogodev/pkg/logger"
	"github.com/moogodev/moogodev/pkg/secretkey"
)

// mustStorageKey generates a storage credential key or fails the test.
func mustStorageKey(t *testing.T) bucketkey.Generated {
	t.Helper()
	generated, err := bucketkey.Generate()
	if err != nil {
		t.Fatalf("generate storage key: %v", err)
	}
	return generated
}

// These tests run against a real Postgres, because the logic they cover has no
// value against a fake: the project quota is a SELECT plus a row lock inside a
// transaction, tenant isolation is a WHERE clause, and single-use tokens are a
// DELETE ... RETURNING. A mock reproduces none of that, which is why this
// package sat at 4.7% coverage while carrying every query in the service.
//
// They are skipped unless MOOGO_TEST_DATABASE_URL is set, so the normal
// `go test ./...` run needs no database and CI without one still passes. To run
// them:
//
//	createdb moogo_test
//	MOOGO_TEST_DATABASE_URL='postgres://moogo@127.0.0.1:5432/moogo_test?sslmode=disable' go test ./internal/dbcontrol/
//
// Every test truncates the tables it touches rather than sharing state, so they
// can run in any order and in parallel.
func testStore(t *testing.T) *Store {
	t.Helper()

	url := os.Getenv("MOOGO_TEST_DATABASE_URL")
	if url == "" {
		t.Skip("set MOOGO_TEST_DATABASE_URL to run the database integration tests")
	}

	cfg := config.Config{
		DatabaseURL:      url,
		DBMaxConns:       8,
		DBMinConns:       0,
		DBConnectTimeout: 10 * time.Second,
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	store, err := New(ctx, cfg, logger.Nop())
	if err != nil {
		t.Fatalf("open test store: %v", err)
	}
	t.Cleanup(store.Close)

	truncate(t, store)
	return store
}

// truncate empties every table the tests write to. RESTART IDENTITY is not used
// because nothing asserts on sequence values, and it would be slower.
func truncate(t *testing.T, store *Store) {
	t.Helper()
	_, err := store.pool.Exec(context.Background(),
		`TRUNCATE bucket_objects, storage_credentials, buckets, activity_logs,
		 password_reset_tokens, email_verification_tokens, projects, users
		 CASCADE`)
	if err != nil {
		t.Fatalf("truncate: %v", err)
	}
}

// newTestUser creates a user with the given project quota.
func newTestUser(t *testing.T, store *Store, maxProjects int) *User {
	t.Helper()
	user, err := store.CreateUserWithPassword(
		context.Background(),
		uuid.NewString()+"@example.com",
		"Test",
		"hash",
		maxProjects,
		100*1024*1024,
		256*1024*1024,
	)
	if err != nil {
		t.Fatalf("create user: %v", err)
	}
	return user
}

// newTestProject creates one ready project owned by userID.
func newTestProject(t *testing.T, store *Store, userID uuid.UUID) *Project {
	t.Helper()
	key, err := secretkey.Generate()
	if err != nil {
		t.Fatalf("generate key: %v", err)
	}

	created, err := store.CreateProject(context.Background(), userID, "test", key)
	if err != nil {
		t.Fatalf("create project: %v", err)
	}
	if err := store.MarkProjectReady(context.Background(), created.Project.ID); err != nil {
		t.Fatalf("mark ready: %v", err)
	}
	return created.Project
}

// The project quota is the one number a paying customer's account depends on,
// and the check that enforces it is a transaction rather than a constraint. It
// has to refuse the project that crosses the line, not merely report it.
func TestProjectQuotaRefusesTheProjectThatCrossesIt(t *testing.T) {
	store := testStore(t)
	user := newTestUser(t, store, 2)

	for attempt := 1; attempt <= 2; attempt++ {
		key, err := secretkey.Generate()
		if err != nil {
			t.Fatalf("generate key: %v", err)
		}
		if _, err := store.CreateProject(context.Background(), user.ID, "p", key); err != nil {
			t.Fatalf("project %d should have been allowed: %v", attempt, err)
		}
	}

	key, err := secretkey.Generate()
	if err != nil {
		t.Fatalf("generate key: %v", err)
	}
	_, err = store.CreateProject(context.Background(), user.ID, "third", key)
	if !errors.Is(err, ErrQuotaExceeded) {
		t.Fatalf("expected ErrQuotaExceeded, got %v", err)
	}

	count, err := store.CountProjects(context.Background(), user.ID)
	if err != nil {
		t.Fatalf("count: %v", err)
	}
	if count != 2 {
		t.Errorf("expected 2 projects stored, got %d", count)
	}
}

// The quota check counts rows inside a transaction under a row lock. The point
// of the lock is that two simultaneous requests cannot both see room for one
// project. Without it this test fails; with only a count and no lock it fails
// too, which is why it is worth having.
func TestConcurrentCreatesCannotExceedTheQuota(t *testing.T) {
	store := testStore(t)
	const limit = 3

	user := newTestUser(t, store, limit)

	// Well past the quota, all at once, so the window is real.
	var group sync.WaitGroup
	var mutex sync.Mutex
	created := 0
	refused := 0

	for attempt := 0; attempt < 12; attempt++ {
		group.Add(1)
		go func() {
			defer group.Done()
			key, err := secretkey.Generate()
			if err != nil {
				return
			}
			_, err = store.CreateProject(context.Background(), user.ID, "race", key)

			mutex.Lock()
			defer mutex.Unlock()
			switch {
			case err == nil:
				created++
			case errors.Is(err, ErrQuotaExceeded):
				refused++
			}
		}()
	}
	group.Wait()

	if created > limit {
		t.Errorf("created %d projects with a quota of %d", created, limit)
	}
	if created+refused != 12 {
		t.Errorf("expected every attempt to be accounted for, got %d created and %d refused",
			created, refused)
	}

	stored, err := store.CountProjects(context.Background(), user.ID)
	if err != nil {
		t.Fatalf("count: %v", err)
	}
	if stored > limit {
		t.Errorf("database holds %d projects against a quota of %d", stored, limit)
	}
}

// A soft-deleted project must not keep occupying a slot, or an account that
// deletes a project still cannot create a replacement.
func TestSoftDeletedProjectFreesItsQuotaSlot(t *testing.T) {
	store := testStore(t)
	user := newTestUser(t, store, 1)

	project := newTestProject(t, store, user.ID)

	key, err := secretkey.Generate()
	if err != nil {
		t.Fatalf("generate key: %v", err)
	}
	if _, err := store.CreateProject(context.Background(), user.ID, "second", key); !errors.Is(err, ErrQuotaExceeded) {
		t.Fatalf("expected the quota to be full, got %v", err)
	}

	if err := store.SoftDeleteProject(context.Background(), project.ID, user.ID); err != nil {
		t.Fatalf("soft delete: %v", err)
	}

	key, err = secretkey.Generate()
	if err != nil {
		t.Fatalf("generate key: %v", err)
	}
	if _, err := store.CreateProject(context.Background(), user.ID, "replacement", key); err != nil {
		t.Errorf("a deleted project should free its slot: %v", err)
	}
}

// Deleting somebody else's project must fail, and must not delete it.
//
// The sentinel is ErrNotFound rather than ErrProjectNotOwned on purpose: the
// store's WHERE clause filters on user_id, so a non-owner's attempt matches no
// row and is indistinguishable from an id that does not exist. ErrNotFound is
// also what classifyStoreError maps to 404 alongside ErrProjectNotOwned, so the
// two are the same answer to the caller either way.
func TestSoftDeleteRefusesAProjectTheCallerDoesNotOwn(t *testing.T) {
	store := testStore(t)
	owner := newTestUser(t, store, 2)
	intruder := newTestUser(t, store, 2)

	project := newTestProject(t, store, owner.ID)

	err := store.SoftDeleteProject(context.Background(), project.ID, intruder.ID)
	if err == nil {
		t.Fatal("a non-owner must not be able to delete the project")
	}
	if !errors.Is(err, ErrNotFound) && !errors.Is(err, ErrProjectNotOwned) {
		t.Fatalf("expected a not-found style refusal, got %v", err)
	}

	// Still there, still the owner's, and still visible to the owner.
	reloaded, err := store.ProjectOwnedBy(context.Background(), project.ID, owner.ID)
	if err != nil {
		t.Fatalf("owner should still see the project: %v", err)
	}
	if reloaded.UserID != owner.ID {
		t.Error("project ownership changed")
	}
	if reloaded.Status == ProjectDeleting {
		t.Errorf("a refused delete still moved the status to %q", reloaded.Status)
	}
}

// Tenant isolation, both directions. This is the check that keeps one account
// from reading another's rows, so it is pinned from both sides.
func TestProjectOwnedByIsolatesTenants(t *testing.T) {
	store := testStore(t)
	alice := newTestUser(t, store, 2)
	bob := newTestUser(t, store, 2)

	alicesProject := newTestProject(t, store, alice.ID)
	bobsProject := newTestProject(t, store, bob.ID)

	if _, err := store.ProjectOwnedBy(context.Background(), alicesProject.ID, alice.ID); err != nil {
		t.Errorf("alice should own her project: %v", err)
	}
	if _, err := store.ProjectOwnedBy(context.Background(), alicesProject.ID, bob.ID); !errors.Is(err, ErrProjectNotOwned) {
		t.Errorf("bob must not reach alice's project, got %v", err)
	}
	if _, err := store.ProjectOwnedBy(context.Background(), bobsProject.ID, alice.ID); !errors.Is(err, ErrProjectNotOwned) {
		t.Errorf("alice must not reach bob's project, got %v", err)
	}

	// Listing is scoped too: neither sees the other's row.
	alicesProjects, err := store.ListProjects(context.Background(), alice.ID, 50, 0)
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if len(alicesProjects) != 1 || alicesProjects[0].ID != alicesProject.ID {
		t.Errorf("alice's listing is wrong: %+v", alicesProjects)
	}
}

// An object key is unique per project, not globally. Two projects must be able
// to hold the same key without one overwriting the other.
func TestObjectKeysAreScopedPerProject(t *testing.T) {
	store := testStore(t)
	alice := newTestUser(t, store, 2)
	bob := newTestUser(t, store, 2)

	alicesProject := newTestProject(t, store, alice.ID)
	bobsProject := newTestProject(t, store, bob.ID)

	alicesBucket, err := store.CreateBucket(context.Background(), alicesProject.ID, "default")
	if err != nil {
		t.Fatalf("create bucket: %v", err)
	}
	bobsBucket, err := store.CreateBucket(context.Background(), bobsProject.ID, "default")
	if err != nil {
		t.Fatalf("create bucket: %v", err)
	}

	if _, _, err := store.PutObject(context.Background(),
		alicesProject.ID, alicesBucket.ID, "shared.txt", 11, "text/plain", false); err != nil {
		t.Fatalf("alice's put: %v", err)
	}
	if _, _, err := store.PutObject(context.Background(),
		bobsProject.ID, bobsBucket.ID, "shared.txt", 22, "text/plain", false); err != nil {
		t.Fatalf("bob's put: %v", err)
	}

	alicesObject, err := store.ObjectByKey(context.Background(), alicesProject.ID, "shared.txt")
	if err != nil {
		t.Fatalf("alice's read: %v", err)
	}
	if alicesObject.SizeBytes != 11 {
		t.Errorf("alice's object was overwritten by bob: size %d", alicesObject.SizeBytes)
	}

	bobsObject, err := store.ObjectByKey(context.Background(), bobsProject.ID, "shared.txt")
	if err != nil {
		t.Fatalf("bob's read: %v", err)
	}
	if bobsObject.SizeBytes != 22 {
		t.Errorf("bob's object has size %d, want 22", bobsObject.SizeBytes)
	}
}

// The storage total is what the quota check compares against. It has to sum the
// project's own objects and nothing else.
func TestStorageUsedBytesCountsOnlyThatProject(t *testing.T) {
	store := testStore(t)
	alice := newTestUser(t, store, 2)
	bob := newTestUser(t, store, 2)

	alicesProject := newTestProject(t, store, alice.ID)
	bobsProject := newTestProject(t, store, bob.ID)

	for _, fixture := range []struct {
		project *Project
		bytes   int64
	}{{alicesProject, 100}, {bobsProject, 900}} {
		bucket, err := store.CreateBucket(context.Background(), fixture.project.ID, "default")
		if err != nil {
			t.Fatalf("create bucket: %v", err)
		}
		if _, _, err := store.PutObject(context.Background(),
			fixture.project.ID, bucket.ID, "f", fixture.bytes, "text/plain", false); err != nil {
			t.Fatalf("put: %v", err)
		}
	}

	alicesUsed, err := store.StorageUsedBytes(context.Background(), alicesProject.ID)
	if err != nil {
		t.Fatalf("usage: %v", err)
	}
	if alicesUsed != 100 {
		t.Errorf("alice's usage is %d, want 100", alicesUsed)
	}

	bobsUsed, err := store.StorageUsedBytes(context.Background(), bobsProject.ID)
	if err != nil {
		t.Fatalf("usage: %v", err)
	}
	if bobsUsed != 900 {
		t.Errorf("bob's usage is %d, want 900", bobsUsed)
	}
}

// A confirmation link is a password reset in everything but name. If the token
// were usable twice, an attacker who saw one confirmation email could sign in
// long after the owner assumed the link had expired.
func TestVerificationTokenIsSingleUse(t *testing.T) {
	store := testStore(t)
	user := newTestUser(t, store, 2)

	hash := "hash-of-a-verification-token"
	if err := store.CreateVerificationToken(
		context.Background(), user.ID, hash, time.Hour); err != nil {
		t.Fatalf("create token: %v", err)
	}

	if err := store.VerifyEmail(context.Background(), hash); err != nil {
		t.Fatalf("first use should succeed: %v", err)
	}

	verified, err := store.EmailVerified(context.Background(), user.ID)
	if err != nil {
		t.Fatalf("check verified: %v", err)
	}
	if !verified {
		t.Error("account should be verified after using the token")
	}

	if err := store.VerifyEmail(context.Background(), hash); !errors.Is(err, ErrVerificationTokenInvalid) {
		t.Errorf("a replayed token must be refused, got %v", err)
	}
}

func TestVerificationTokenIsRefusedWhenExpired(t *testing.T) {
	store := testStore(t)
	user := newTestUser(t, store, 2)

	hash := "expired-token-hash"
	// Already expired at creation, which the expiry filter then excludes.
	if err := store.CreateVerificationToken(
		context.Background(), user.ID, hash, -time.Hour); err != nil {
		t.Fatalf("create token: %v", err)
	}

	if err := store.VerifyEmail(context.Background(), hash); !errors.Is(err, ErrVerificationTokenInvalid) {
		t.Errorf("expected ErrVerificationTokenInvalid for an expired token, got %v", err)
	}
}

func TestVerifyEmailRefusesAnUnknownToken(t *testing.T) {
	store := testStore(t)

	err := store.VerifyEmail(context.Background(), "never-issued")
	if !errors.Is(err, ErrVerificationTokenInvalid) {
		t.Errorf("expected ErrVerificationTokenInvalid, got %v", err)
	}
}

// Same argument as verification, and the reason ResetPassword runs in a
// transaction with a DELETE ... RETURNING.
func TestPasswordResetTokenIsSingleUseAndClearsTheHash(t *testing.T) {
	store := testStore(t)
	user := newTestUser(t, store, 2)

	original, err := store.UserByEmail(context.Background(), user.Email)
	if err != nil {
		t.Fatalf("read user: %v", err)
	}
	if original.PasswordHash == "" {
		t.Fatal("expected a password hash on the account")
	}

	tokenHash := "reset-token-hash"
	if err := store.CreatePasswordResetToken(
		context.Background(), user.ID, tokenHash, time.Hour); err != nil {
		t.Fatalf("create reset token: %v", err)
	}

	if err := store.ResetPassword(context.Background(), tokenHash, "the-new-hash"); err != nil {
		t.Fatalf("first reset should succeed: %v", err)
	}

	updated, err := store.UserByEmail(context.Background(), user.Email)
	if err != nil {
		t.Fatalf("read user: %v", err)
	}
	if updated.PasswordHash != "the-new-hash" {
		t.Errorf("password hash is %q, want the new one", updated.PasswordHash)
	}

	if err := store.ResetPassword(context.Background(), tokenHash, "another-hash"); !errors.Is(err, ErrResetTokenInvalid) {
		t.Errorf("a replayed reset token must be refused, got %v", err)
	}

	after, err := store.UserByEmail(context.Background(), user.Email)
	if err != nil {
		t.Fatalf("read user: %v", err)
	}
	if after.PasswordHash != "the-new-hash" {
		t.Error("a refused replay must not change the stored hash")
	}
}

// Issuing a new reset has to retire the old one, or an address that asked twice
// keeps two working links.
func TestIssuingAResetRetiresThePreviousToken(t *testing.T) {
	store := testStore(t)
	user := newTestUser(t, store, 2)

	if err := store.CreatePasswordResetToken(
		context.Background(), user.ID, "first-hash", time.Hour); err != nil {
		t.Fatalf("create first: %v", err)
	}
	if err := store.CreatePasswordResetToken(
		context.Background(), user.ID, "second-hash", time.Hour); err != nil {
		t.Fatalf("create second: %v", err)
	}

	if err := store.ResetPassword(context.Background(), "first-hash", "x"); !errors.Is(err, ErrResetTokenInvalid) {
		t.Errorf("the superseded token should be refused, got %v", err)
	}
	if err := store.ResetPassword(context.Background(), "second-hash", "y"); err != nil {
		t.Errorf("the newest token should work: %v", err)
	}
}

// Registering an address twice must fail, and the second attempt must not
// overwrite the first account's password.
func TestCreateUserWithPasswordRefusesADuplicateEmail(t *testing.T) {
	store := testStore(t)
	email := uuid.NewString() + "@example.com"

	first, err := store.CreateUserWithPassword(
		context.Background(), email, "First", "first-hash", 2, 1024, 1024)
	if err != nil {
		t.Fatalf("create: %v", err)
	}

	_, err = store.CreateUserWithPassword(
		context.Background(), email, "Second", "second-hash", 2, 1024, 1024)
	if !errors.Is(err, ErrEmailTaken) {
		t.Fatalf("expected ErrEmailTaken, got %v", err)
	}

	unchanged, err := store.UserByEmail(context.Background(), email)
	if err != nil {
		t.Fatalf("read user: %v", err)
	}
	if unchanged.ID != first.ID {
		t.Error("the original account was replaced")
	}
	if unchanged.PasswordHash != "first-hash" {
		t.Errorf("password hash is %q, want the original", unchanged.PasswordHash)
	}
}

// A password account starts unverified, and only the token flips it.
func TestPasswordAccountStartsUnverified(t *testing.T) {
	store := testStore(t)
	user := newTestUser(t, store, 2)

	verified, err := store.EmailVerified(context.Background(), user.ID)
	if err != nil {
		t.Fatalf("check: %v", err)
	}
	if verified {
		t.Error("a new password account must not be pre-verified")
	}
}

// Rotating the project key must change the hash and stop the old key working,
// because the old one is in whatever application was deployed.
func TestRotateSecretKeyInvalidatesTheOldKey(t *testing.T) {
	store := testStore(t)
	user := newTestUser(t, store, 2)
	project := newTestProject(t, store, user.ID)

	before, err := store.ProjectByID(context.Background(), project.ID)
	if err != nil {
		t.Fatalf("read project: %v", err)
	}

	plaintext, err := store.RotateSecretKey(context.Background(), project.ID)
	if err != nil {
		t.Fatalf("rotate: %v", err)
	}
	if plaintext == "" {
		t.Fatal("rotate returned no plaintext key")
	}

	after, err := store.ProjectByID(context.Background(), project.ID)
	if err != nil {
		t.Fatalf("read project: %v", err)
	}
	if after.SecretKeyHash == before.SecretKeyHash {
		t.Error("the stored hash did not change")
	}
	if !secretkey.Verify(plaintext, after.SecretKeyHash) {
		t.Error("the returned plaintext does not match the stored hash")
	}
}

// Revoking a storage credential must take effect immediately: the row is
// emptied of its secret rather than flagged, so the hash can never match.
func TestRevokedStorageCredentialNoLongerVerifies(t *testing.T) {
	store := testStore(t)
	user := newTestUser(t, store, 2)
	project := newTestProject(t, store, user.ID)

	credential, err := store.CreateStorageCredential(
		context.Background(), project.ID, "test", mustStorageKey(t))
	if err != nil {
		t.Fatalf("create credential: %v", err)
	}

	live, err := store.StorageCredentialByAccessKeyID(context.Background(), credential.AccessKeyID)
	if err != nil {
		t.Fatalf("resolve credential: %v", err)
	}
	if live.SecretKeyHash == "" {
		t.Fatal("expected a live credential to carry a hash")
	}

	if err := store.RevokeStorageCredential(context.Background(), project.ID, credential.ID); err != nil {
		t.Fatalf("revoke: %v", err)
	}

	revoked, err := store.StorageCredentialByAccessKeyID(context.Background(), credential.AccessKeyID)
	if err != nil {
		t.Fatalf("resolve revoked credential: %v", err)
	}
	if revoked.SecretKeyHash != "" {
		t.Error("a revoked credential must not carry a usable hash")
	}
}

// The metrics scrape reads ProjectCount, so it has to count live projects
// and skip the soft-deleted ones: otherwise moogo_project_count drifts from
// reality every time somebody deletes a project.
func TestProjectCountCountsOnlyLiveProjects(t *testing.T) {
	store := testStore(t)
	user := newTestUser(t, store, 3)

	before, err := store.ProjectCount(context.Background())
	if err != nil {
		t.Fatalf("count before: %v", err)
	}

	newTestProject(t, store, user.ID)
	deleted := newTestProject(t, store, user.ID)

	if err := store.SoftDeleteProject(context.Background(), deleted.ID, user.ID); err != nil {
		t.Fatalf("soft delete: %v", err)
	}

	after, err := store.ProjectCount(context.Background())
	if err != nil {
		t.Fatalf("count after: %v", err)
	}
	// One live project created, one deleted: the count moves by exactly the
	// first, which proves both halves of the filter in one comparison.
	if after != before+1 {
		t.Errorf("count = %d, want %d", after, before+1)
	}
}