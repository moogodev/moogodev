package dbplane

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"net/url"
	"os"
	"path/filepath"
)

// QuerySnapshot runs a read-only statement against a standalone SQLite file,
// such as a database backup that was downloaded for viewing.
//
// Unlike Query it is not bound to a project: the file lives outside the data
// directory, so there is no handle to cache and no write lock to take. The two
// guarantees that matter are kept. The connection opens the file with
// mode=ro and query_only, so SQLite refuses any modification at the statement
// level no matter what the caller sent; and the file is checked to be one of
// ours by its application_id before a single row is read, so a stray path is
// rejected rather than queried.
//
// The statement runs with the same row cap, value-length limit and response
// byte budget as a live read, because a viewer must not be able to pull an
// unbounded result out of a large backup either.
func (manager *Manager) QuerySnapshot(
	ctx context.Context,
	path string,
	statement string,
	args []any,
	maxRows int,
) (*QueryResult, error) {
	if path == "" || !filepath.IsAbs(path) {
		return nil, fmt.Errorf("snapshot path must be an absolute path")
	}
	args = normalizeArgs(args)
	if maxRows <= 0 {
		maxRows = defaultMaxRows
	}

	if err := statSnapshot(path); err != nil {
		return nil, err
	}

	// mode=ro keeps SQLite from creating -wal or -shm sidecars next to the
	// cached file, and query_only is the statement-level backstop for a write.
	// The connection-scoped pragmas match the read pool's tuning: a bounded
	// page cache and in-memory scratch space, since the snapshot is a file we
	// do not own and must not litter.
	//
	// The path is escaped as a file: URI rather than concatenated. A cache
	// directory under a user's home, or any path with a space or a character
	// SQLite reads as URI syntax, would otherwise be split and open the wrong
	// file — or none. url.URL turns the absolute path into file:///... with the
	// special characters percent-encoded, which is the form SQLite's URI
	// parser expects.
	dsn := (&url.URL{Scheme: "file", Path: path}).String() +
		"?mode=ro&_pragma=query_only(1)&_pragma=busy_timeout(5000)" +
		"&_pragma=temp_store(MEMORY)&_pragma=cache_size(-2000)"

	database, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, fmt.Errorf("open snapshot: %w", err)
	}
	defer database.Close()

	database.SetMaxOpenConns(1)
	database.SetMaxIdleConns(1)

	statementCtx, cancel := context.WithTimeout(ctx, manager.queryTimeout)
	defer cancel()

	connection, err := database.Conn(statementCtx)
	if err != nil {
		return nil, classifyError(err, statementCtx)
	}
	defer connection.Close()

	// A file that does not carry our application_id is not a Moogo database,
	// whatever it is named. Checking before the caller's statement runs keeps
	// the viewer from becoming a general SQLite reader over the host. The
	// check is strict, matching restore: every database this product creates
	// is branded at creation and VACUUM INTO carries the brand into each
	// backup, so a file without it was never ours.
	var application int
	if err := connection.QueryRowContext(statementCtx, `PRAGMA application_id`).Scan(&application); err != nil {
		return nil, classifyError(err, statementCtx)
	}
	if application != applicationID {
		return nil, ErrInvalidSnapshot
	}

	return readStatement(statementCtx, connection, statement, args, maxRows, manager.maxDBBytes)
}

// statSnapshot checks that a snapshot path names an existing regular file.
//
// A missing file is reported as ErrNotFound so the handler maps it to the same
// 404 it would give for a backup whose object is gone.
func statSnapshot(path string) error {
	info, err := os.Stat(path)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return ErrNotFound
		}
		return fmt.Errorf("stat snapshot: %w", err)
	}
	if info.IsDir() {
		return fmt.Errorf("snapshot path is a directory")
	}
	return nil
}
