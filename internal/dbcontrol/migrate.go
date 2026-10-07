package dbcontrol

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io/fs"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/moogodev/moogodev/pkg/logger"
)

// lockReleaseTimeout bounds the advisory lock release, which runs after the
// caller's context may already be done.
const lockReleaseTimeout = 5 * time.Second

// migrationFS holds the SQL migration files.
//
// Embedding them means a deployed binary carries its own schema history. The
// alternative, reading files from disk, breaks the moment the container image
// does not include them.
type migrationFS interface {
	ReadDir(name string) ([]fs.DirEntry, error)
	ReadFile(name string) ([]byte, error)
}

// migration is one versioned SQL file.
type migration struct {
	Version  int
	Name     string
	SQL      string
	Checksum string
}

// migrationsDir is where the SQL files live inside the embedded filesystem.
//
// Embed paths are relative to the package directory, so this starts with
// "migrations" and not with "postgres". Keeping it in one constant means the
// read and the embed directive cannot drift apart silently.
const migrationsDir = "migrations/postgres"

// advisoryLockID namespaces this service's migration lock inside Postgres.
//
// A fixed constant is deliberate: every instance must contend on the same lock,
// so it must not be derived from anything instance-specific.
const advisoryLockID int64 = 8_147_236_591_004_233

// migrate applies every migration that has not run yet.
//
// Each file runs inside its own transaction together with the bookkeeping row.
// That makes a migration and the record of it atomic: a crash mid-file leaves
// neither a half-applied schema nor a row claiming success.
//
// A session-level advisory lock is taken for the whole run, so several
// instances starting at once cannot apply the same migration twice.
func (store *Store) migrate(ctx context.Context, files migrationFS) error {
	// The lock must be held on one connection for the whole run. Running it on
	// the pool would let a later query land on a different connection, where
	// the lock does not exist.
	connection, err := store.pool.Acquire(ctx)
	if err != nil {
		return fmt.Errorf("acquire migration connection: %w", err)
	}
	defer connection.Release()

	if _, err := connection.Exec(ctx, "SELECT pg_advisory_lock($1)", advisoryLockID); err != nil {
		return fmt.Errorf("take migration lock: %w", err)
	}
	defer func() {
		// Unlock on a fresh context: the caller's context may already be
		// cancelled by the time this runs, which would leave the lock held
		// until the session ends.
		unlockCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), lockReleaseTimeout)
		defer cancel()
		_, _ = connection.Exec(unlockCtx, "SELECT pg_advisory_unlock($1)", advisoryLockID)
	}()

	if _, err := connection.Exec(ctx, schemaTableSQL); err != nil {
		return fmt.Errorf("create schema table: %w", err)
	}

	applied, err := appliedVersions(ctx, connection.Conn())
	if err != nil {
		return err
	}

	pending, err := loadMigrations(files)
	if err != nil {
		return err
	}

	for _, next := range pending {
		if appliedChecksum, alreadyApplied := applied[next.Version]; alreadyApplied {
			// A file whose contents changed after it ran is a mistake worth
			// stopping for: the database does not match the source tree, and
			// continuing would apply later migrations on top of a schema nobody
			// can reason about.
			if appliedChecksum != next.Checksum {
				return fmt.Errorf(
					"migration %04d_%s was already applied with a different checksum; "+
						"add a new migration instead of editing an applied one",
					next.Version, next.Name,
				)
			}
			continue
		}

		if err := applyMigration(ctx, connection.Conn(), next); err != nil {
			return err
		}

		store.logger.Info("migration applied", logger.Fields{
			"version":  next.Version,
			"name":     next.Name,
			"checksum": next.Checksum,
		})
	}

	return nil
}

// applyMigration runs one migration and records it in the same transaction.
func applyMigration(ctx context.Context, connection *pgx.Conn, next migration) error {
	transaction, err := connection.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin migration %d: %w", next.Version, err)
	}
	// After a successful commit this returns ErrTxClosed, which is safe to
	// ignore, so the rollback stays unconditional.
	defer func() { _ = transaction.Rollback(ctx) }()

	if _, err := transaction.Exec(ctx, next.SQL); err != nil {
		return fmt.Errorf("run migration %04d_%s: %w", next.Version, next.Name, err)
	}

	const recordQuery = `
		INSERT INTO schema_migrations (version, name, checksum)
		VALUES ($1, $2, $3)`

	if _, err := transaction.Exec(ctx, recordQuery, next.Version, next.Name, next.Checksum); err != nil {
		return fmt.Errorf("record migration %04d: %w", next.Version, err)
	}

	if err := transaction.Commit(ctx); err != nil {
		return fmt.Errorf("commit migration %04d: %w", next.Version, err)
	}
	return nil
}

// appliedVersions reads the versions already recorded, keyed by version.
func appliedVersions(ctx context.Context, connection *pgx.Conn) (map[int]string, error) {
	const query = `SELECT version, checksum FROM schema_migrations`

	rows, err := connection.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("read schema_migrations: %w", err)
	}
	defer rows.Close()

	applied := map[int]string{}
	for rows.Next() {
		var (
			version  int
			checksum string
		)
		if err := rows.Scan(&version, &checksum); err != nil {
			return nil, fmt.Errorf("scan schema_migrations: %w", err)
		}
		applied[version] = checksum
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate schema_migrations: %w", err)
	}
	return applied, nil
}

// loadMigrations reads and validates every migration file.
func loadMigrations(files migrationFS) ([]migration, error) {
	entries, err := files.ReadDir(migrationsDir)
	if err != nil {
		return nil, fmt.Errorf("read migrations: %w", err)
	}

	migrations := make([]migration, 0, len(entries))
	seen := map[int]string{}

	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".sql") {
			continue
		}

		version, name, err := parseMigrationName(entry.Name())
		if err != nil {
			return nil, err
		}

		if previous, exists := seen[version]; exists {
			return nil, fmt.Errorf(
				"migration version %d is used by both %s and %s", version, previous, entry.Name())
		}
		seen[version] = entry.Name()

		contents, err := files.ReadFile(migrationsDir + "/" + entry.Name())
		if err != nil {
			return nil, fmt.Errorf("read migration %s: %w", entry.Name(), err)
		}
		if len(strings.TrimSpace(string(contents))) == 0 {
			return nil, fmt.Errorf("migration %s is empty", entry.Name())
		}

		sum := sha256.Sum256(contents)

		migrations = append(migrations, migration{
			Version:  version,
			Name:     name,
			SQL:      string(contents),
			Checksum: hex.EncodeToString(sum[:]),
		})
	}

	// Order matters: migrations are numbered to express their sequence, and
	// applying 0002 before 0001 would fail on a missing table.
	sort.Slice(migrations, func(first, second int) bool {
		return migrations[first].Version < migrations[second].Version
	})

	return migrations, nil
}

// parseMigrationName splits a filename into its version and name.
//
// The version must be a fixed four-digit prefix. A width of zero would make
// "10_x.sql" sort before "9_x.sql" lexically and confuse anyone reading the
// directory.
func parseMigrationName(filename string) (int, string, error) {
	trimmed := strings.TrimSuffix(filename, ".sql")

	separator := strings.Index(trimmed, "_")
	if separator != 4 {
		return 0, "", fmt.Errorf(
			"migration %s must be named NNNN_description.sql", filename)
	}

	version, err := strconv.Atoi(trimmed[:separator])
	if err != nil {
		return 0, "", fmt.Errorf("migration %s has a non-numeric version", filename)
	}

	name := strings.TrimSpace(trimmed[separator+1:])
	if name == "" {
		return 0, "", fmt.Errorf("migration %s has no description", filename)
	}

	return version, name, nil
}

// schemaTableSQL creates the bookkeeping table.
const schemaTableSQL = `
CREATE TABLE IF NOT EXISTS schema_migrations (
	version     integer     PRIMARY KEY,
	name        text        NOT NULL,
	checksum    text        NOT NULL,
	applied_at  timestamptz NOT NULL DEFAULT now()
)`
