package dbcontrol

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"net/url"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/moogo/moogo/internal/config"
	"github.com/moogo/moogo/pkg/logger"
)

// A fresh database must migrate from the first file to the last with nobody
// in the room.
//
// This is the regression test for a bug that shipped: 0011_add_plan_column.sql
// re-added a column 0001_init.sql already creates, so every new deployment
// died at boot with SQLSTATE 42701 before serving a request. No test caught
// it because none of them ran the real migration tree against an empty
// database — they all reused one that had been migrated before. This one
// creates a scratch database, boots a store into it, and checks that every
// embedded file is recorded with its own checksum.
func TestFreshDatabaseMigratesFromScratch(t *testing.T) {
	base := os.Getenv("MOOGO_TEST_DATABASE_URL")
	if base == "" {
		t.Skip("set MOOGO_TEST_DATABASE_URL to run the database integration tests")
	}

	parsed, err := url.Parse(base)
	if err != nil {
		t.Fatalf("parse MOOGO_TEST_DATABASE_URL: %v", err)
	}

	adminURL := *parsed
	adminURL.Path = "/postgres"

	scratchURL := *parsed
	scratchURL.Path = "/moogo_fresh_" + randomSuffix(t)

	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	admin, err := pgx.Connect(ctx, adminURL.String())
	if err != nil {
		t.Fatalf("connect to the admin database: %v", err)
	}
	defer admin.Close(ctx)

	// Creating a database needs CREATEDB, which the operator behind
	// MOOGO_TEST_DATABASE_URL may not have. A skip keeps the rest of the
	// integration run useful; the gate that matters runs where it works.
	if _, err := admin.Exec(ctx, fmt.Sprintf("CREATE DATABASE %q", scratchURL.Path[1:])); err != nil {
		t.Skipf("cannot create a scratch database: %v", err)
	}

	dropScratch := func() {
		dropCtx, dropCancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer dropCancel()
		// FORCE so a pool connection that has not finished closing yet
		// cannot make the drop fail and leave the scratch database behind.
		_, _ = admin.Exec(dropCtx, fmt.Sprintf(`DROP DATABASE %q WITH (FORCE)`, scratchURL.Path[1:]))
	}

	// New runs the migrations, which is the code path under test.
	store, err := New(ctx, config.Config{
		DatabaseURL:      scratchURL.String(),
		DBMaxConns:       4,
		DBMinConns:       0,
		DBConnectTimeout: 10 * time.Second,
	}, logger.Nop())
	if err != nil {
		dropScratch()
		t.Fatalf("migrate a fresh database: %v", err)
	}
	defer func() {
		store.Close()
		dropScratch()
	}()

	embedded, err := loadMigrations(migrations)
	if err != nil {
		t.Fatalf("load the embedded migrations: %v", err)
	}

	connection, err := store.pool.Acquire(ctx)
	if err != nil {
		t.Fatalf("acquire a connection: %v", err)
	}
	defer connection.Release()

	applied, err := appliedVersions(ctx, connection.Conn())
	if err != nil {
		t.Fatalf("read schema_migrations: %v", err)
	}

	if len(applied) != len(embedded) {
		t.Errorf("expected %d recorded migrations, got %d", len(embedded), len(applied))
	}
	for _, next := range embedded {
		checksum, ok := applied[next.Version]
		if !ok {
			t.Errorf("migration %04d_%s did not run", next.Version, next.Name)
			continue
		}
		if checksum != next.Checksum {
			t.Errorf("migration %04d_%s was recorded with the wrong checksum", next.Version, next.Name)
		}
	}
}

// randomSuffix returns eight hex characters for a scratch database name.
func randomSuffix(t *testing.T) string {
	t.Helper()
	var bytes [4]byte
	if _, err := rand.Read(bytes[:]); err != nil {
		t.Fatalf("generate a database name suffix: %v", err)
	}
	return hex.EncodeToString(bytes[:])
}
