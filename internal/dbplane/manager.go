// Package dbplane is the data plane: one SQLite file per user project.
//
// This is the product being sold. Everything here operates on a single
// project's database, with strict limits on size, duration, and concurrency.
package dbplane

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/google/uuid"

	// Registers the pure-Go SQLite driver as "sqlite". The blank import is the
	// documented way to use a driver that registers itself in init.
	_ "modernc.org/sqlite"

	"github.com/moogo/moogo/pkg/logger"
)

// Errors returned by this package.
var (
	// ErrNotFound means the project's database file does not exist.
	ErrNotFound = errors.New("database not found")
	// ErrSizeExceeded means the operation would push the database past its
	// configured limit.
	ErrSizeExceeded = errors.New("database size limit exceeded")
	// ErrTimeout means the statement exceeded its time budget.
	ErrTimeout = errors.New("statement timed out")
	// ErrClosed means the manager has been shut down.
	ErrClosed = errors.New("manager is closed")
)

// SQLite application_id and user_version.
//
// application_id is written into the file header and survives everywhere the
// file goes. It identifies a file as one of ours, which means a stray file in
// the data directory is never mistaken for a user database. user_version is the
// SQLite-internal schema counter, left at 1 because Moogo does not manage
// per-project schemas; the dashboard handles table changes directly.
const (
	applicationID = 0x4D4F4F47 // "MOOG" in ASCII
	userVersion   = 1
)

// Manager owns the per-project SQLite connections.
//
// One connection per project rather than a shared pool: SQLite allows a single
// writer, so extra connections buy nothing, and one handle per project makes
// the open-file count bounded and predictable on a 2 GB host.
type Manager struct {
	dataDir string
	logger  *logger.Logger

	// maxDBBytes is the per-database size limit.
	maxDBBytes int64
	// queryTimeout bounds a single statement.
	queryTimeout time.Duration

	mu       sync.Mutex
	projects map[uuid.UUID]*projectConnection
	closed   bool

	// Bucket storage
	bucketDir string
	bucketMu  sync.Mutex
}

// projectConnection is one project's database handle plus its write lock.
type projectConnection struct {
	db *sql.DB
	// writeLock serializes writes. SQLite answers a second concurrent writer
	// with SQLITE_BUSY, and a mutex in Go keeps that error away from users.
	//
	// Held by a pointer because sync.Mutex must not be copied.
	writeLock *sync.Mutex
}

// NewManager creates a Manager rooted at dataDir.
//
// The directory is created if missing, since a fresh host will not have it.
func NewManager(dataDir string, maxDBBytes int64, queryTimeout time.Duration, log *logger.Logger) (*Manager, error) {
	databaseDir := filepath.Join(dataDir, "dbs")
	bucketDir := filepath.Join(dataDir, "buckets")

	if err := os.MkdirAll(databaseDir, 0o700); err != nil {
		return nil, fmt.Errorf("create database directory: %w", err)
	}
	if err := os.MkdirAll(bucketDir, 0o700); err != nil {
		return nil, fmt.Errorf("create bucket directory: %w", err)
	}

	return &Manager{
		dataDir:      databaseDir,
		bucketDir:    bucketDir,
		logger:       log,
		maxDBBytes:   maxDBBytes,
		queryTimeout: queryTimeout,
		projects:     make(map[uuid.UUID]*projectConnection),
	}, nil
}

// databasePath returns the on-disk path for a project.
//
// The project ID is validated as a UUID first, so the path is assembled from
// components that cannot escape the data directory. A caller that skipped
// validation could pass ../../etc/passwd here and read arbitrary files.
func (manager *Manager) databasePath(projectID uuid.UUID) string {
	return filepath.Join(manager.dataDir, projectID.String()+".db")
}

// bucketProjectPath returns the on-disk root for a project's buckets.
//
// The path is assembled from a validated UUID, so traversal is impossible.
func (manager *Manager) bucketProjectPath(projectID uuid.UUID) string {
	return filepath.Join(manager.bucketDir, projectID.String())
}

// InitializeProject creates and configures a new project's database file.
//
// This is stage two of the creation saga. Postgres already holds the row, so a
// failure here leaves a project marked failed, which the reconciler retries.
func (manager *Manager) InitializeProject(ctx context.Context, projectID uuid.UUID) error {
	path := manager.databasePath(projectID)

	connection, err := openProjectDatabase(path, manager.queryTimeout)
	if err != nil {
		return err
	}
	defer connection.Close()

	// The header identifier is read first: a wrong value means this path
	// pointed at something that is not one of our databases.
	var existingApplicationID int
	if err := connection.QueryRowContext(ctx, `PRAGMA application_id`).Scan(&existingApplicationID); err != nil {
		return fmt.Errorf("read application_id: %w", err)
	}
	if existingApplicationID != 0 && existingApplicationID != applicationID {
		return fmt.Errorf("file %s is not a moogo database (application_id=%d)",
			path, existingApplicationID)
	}

	if _, err := connection.ExecContext(ctx, fmt.Sprintf(`PRAGMA application_id = %d`, applicationID)); err != nil {
		return fmt.Errorf("set application_id: %w", err)
	}
	if _, err := connection.ExecContext(ctx, fmt.Sprintf(`PRAGMA user_version = %d`, userVersion)); err != nil {
		return fmt.Errorf("set user_version: %w", err)
	}

	// Re-open through the manager so the handle is cached for later requests.
	cached, err := manager.connect(ctx, projectID)
	if err != nil {
		return err
	}
	manager.store(projectID, cached)
	return nil
}

// connect opens and caches a project's database, or returns the existing one.
func (manager *Manager) connect(ctx context.Context, projectID uuid.UUID) (*projectConnection, error) {
	manager.mu.Lock()
	defer manager.mu.Unlock()

	if manager.closed {
		return nil, ErrClosed
	}
	if existing, found := manager.projects[projectID]; found {
		return existing, nil
	}

	path := manager.databasePath(projectID)
	if _, err := os.Stat(path); err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("stat database file: %w", err)
	}

	connection, err := openProjectDatabase(path, manager.queryTimeout)
	if err != nil {
		return nil, err
	}

	cached := &projectConnection{
		db:        connection,
		writeLock: &sync.Mutex{},
	}
	manager.projects[projectID] = cached
	return cached, nil
}

func (manager *Manager) store(projectID uuid.UUID, connection *projectConnection) {
	manager.mu.Lock()
	defer manager.mu.Unlock()
	if manager.closed {
		return
	}
	manager.projects[projectID] = connection
}

// openProjectDatabase opens a project file with the pragmas every connection
// must have.
//
// These are set per connection rather than once, because SQLite pragmas are
// connection-scoped and a pooled or reopened connection would otherwise lose
// them. foreign_keys in particular defaults to OFF in SQLite, which silently
// means referential integrity is not enforced.
func openProjectDatabase(path string, queryTimeout time.Duration) (*sql.DB, error) {
	// _txlock=immediate asks for a write lock at BEGIN rather than on first
	// write, which turns a late SQLITE_BUSY into an immediate one. The write
	// mutex makes that rare, but a checkpoint or another process can still
	// hold the file.
	dsn := "file:" + path + "?_pragma=busy_timeout(5000)&_pragma=journal_mode(WAL)" +
		"&_pragma=foreign_keys(1)&_pragma=synchronous(NORMAL)&_txlock=immediate"

	database, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, fmt.Errorf("open database %s: %w", filepath.Base(path), err)
	}

	// One connection per project: SQLite serializes writers anyway, and this
	// keeps the open-handle count equal to the project count.
	database.SetMaxOpenConns(1)
	database.SetMaxIdleConns(1)
	database.SetConnMaxLifetime(0)

	ctx, cancel := context.WithTimeout(context.Background(), queryTimeout)
	defer cancel()

	if err := database.PingContext(ctx); err != nil {
		database.Close()
		return nil, fmt.Errorf("ping database %s: %w", filepath.Base(path), err)
	}

	return database, nil
}

// Close releases every open project handle.
func (manager *Manager) Close() error {
	manager.mu.Lock()
	if manager.closed {
		manager.mu.Unlock()
		return nil
	}
	manager.closed = true
	connections := manager.projects
	manager.projects = make(map[uuid.UUID]*projectConnection)
	manager.mu.Unlock()

	var closeErrors []error
	for projectID, connection := range connections {
		if err := connection.db.Close(); err != nil {
			closeErrors = append(closeErrors, fmt.Errorf("close project %s: %w", projectID, err))
		}
	}
	return errors.Join(closeErrors...)
}

// RemoveProject closes the handle and deletes the project's database files and
// its bucket.
//
// SQLite in WAL mode leaves -wal and -shm sidecars next to the main file.
// Removing only the .db would leak the sidecars and eventually fill the disk,
// so all three go together. The bucket goes with them for the same reason: a
// project deletion is final, so the objects would otherwise sit on the disk
// where nothing reads them — and where the nightly tar of buckets/ keeps
// archiving them.
func (manager *Manager) RemoveProject(projectID uuid.UUID) error {
	manager.mu.Lock()
	if connection, found := manager.projects[projectID]; found {
		delete(manager.projects, projectID)
		manager.mu.Unlock()
		if err := connection.db.Close(); err != nil {
			manager.logger.Warn("close project connection before removal failed",
				logger.Fields{"project_id": projectID.String(), "error": err.Error()})
		}
	} else {
		manager.mu.Unlock()
	}

	var removeErrors []error
	for _, suffix := range []string{"", "-wal", "-shm"} {
		path := manager.databasePath(projectID) + suffix
		if err := os.Remove(path); err != nil && !errors.Is(err, os.ErrNotExist) {
			removeErrors = append(removeErrors, fmt.Errorf("remove %s: %w", filepath.Base(path), err))
		}
	}

	// RemoveAll on a directory that is already gone is not an error, so a
	// project that never uploaded anything is unaffected.
	if err := os.RemoveAll(manager.bucketProjectPath(projectID)); err != nil {
		removeErrors = append(removeErrors, fmt.Errorf("remove bucket: %w", err))
	}

	return errors.Join(removeErrors...)
}

// ProjectExists reports whether a project's database file is present on disk.
//
// The reconciler uses this to decide between marking a project ready and
// rebuilding a missing file.
func (manager *Manager) ProjectExists(projectID uuid.UUID) bool {
	_, err := os.Stat(manager.databasePath(projectID))
	return err == nil
}

// DatabaseSize returns a project's database size in bytes.
//
// SQLite reports the main database size only, so the WAL sidecar is added in.
// A project with an unflushed WAL can be over its limit in total bytes on disk
// while page_count says otherwise.
func (manager *Manager) DatabaseSize(ctx context.Context, projectID uuid.UUID) (int64, error) {
	connection, err := manager.connect(ctx, projectID)
	if err != nil {
		return 0, err
	}

	size, err := databaseSize(ctx, connection.db)
	if err != nil {
		return 0, err
	}
	return size + sidecarSize(manager.databasePath(projectID)), nil
}

// BackupDatabase writes a consistent snapshot of a project's database to a new
// file and returns its path. The caller owns the returned file and must remove
// it.
//
// It uses VACUUM INTO rather than copying the file, and that is the whole point.
// The databases here run in WAL mode, which means a commit can sit in the -wal
// sidecar rather than in the main file, so copying the .db on its own would hand
// back a backup that is missing the most recent writes -- silently, and exactly
// when the owner most needs the backup to be complete. VACUUM INTO reads through
// the WAL and writes a fresh single-file database, so the result is a complete
// snapshot and is not left half-written if the process dies mid-copy.
//
// The returned file is a normal, complete SQLite database: the owner can open it
// with any SQLite client, and it is not tied to this server.
func (manager *Manager) BackupDatabase(ctx context.Context, projectID uuid.UUID) (string, error) {
	if err := normalizeProjectID(projectID); err != nil {
		return "", err
	}

	connection, err := manager.connect(ctx, projectID)
	if err != nil {
		return "", err
	}

	// VACUUM INTO refuses to overwrite, so the target has to be a path that does
	// not exist yet. The directory is created first and the file is left to
	// SQLite.
	dir, err := os.MkdirTemp("", "moogo-backup-")
	if err != nil {
		return "", fmt.Errorf("create backup directory: %w", err)
	}
	target := filepath.Join(dir, "database.sqlite")

	if _, err := connection.db.ExecContext(ctx, `VACUUM INTO ?`, target); err != nil {
		_ = os.RemoveAll(dir)
		return "", fmt.Errorf("snapshot database: %w", err)
	}

	// A zero-length result means VACUUM reported success but wrote nothing,
	// which would hand the caller an empty file that looks like a valid backup
	// of an empty database.
	info, err := os.Stat(target)
	if err != nil {
		_ = os.RemoveAll(dir)
		return "", fmt.Errorf("inspect snapshot: %w", err)
	}
	if info.Size() == 0 {
		_ = os.RemoveAll(dir)
		return "", errors.New("snapshot is empty")
	}

	return target, nil
}

// DatabaseSizeBytes returns the on-disk size of the main database file only,
// without opening a connection.
func DatabaseSizeBytes(path string) (int64, error) {	info, err := os.Stat(path)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return 0, ErrNotFound
		}
		return 0, err
	}
	return info.Size(), nil
}

// sidecarSize totals the WAL and shared-memory files for a database path.
//
// A missing sidecar is normal: it means no write is in flight and checkpointing
// has not happened yet, so it contributes zero rather than being an error.
func sidecarSize(path string) int64 {
	var total int64
	for _, suffix := range []string{"-wal", "-shm"} {
		info, err := os.Stat(path + suffix)
		if err == nil {
			total += info.Size()
		}
	}
	return total
}

// normalizeProjectID validates that a project identifier is a UUID.
//
// Handlers must call this before touching the filesystem. It is what makes
// path traversal structurally impossible: the path is built from a parsed UUID,
// never from caller-supplied text.
func normalizeProjectID(projectID uuid.UUID) error {
	if projectID == uuid.Nil {
		return fmt.Errorf("project id is required")
	}
	// A parsed UUID always renders to 36 characters. Anything else did not come
	// from a successful parse.
	if len(projectID.String()) != 36 {
		return fmt.Errorf("invalid project id")
	}
	return nil
}

// WriteObject streams an object to disk and returns the bytes written.
func (manager *Manager) WriteObject(projectID uuid.UUID, key string, r io.Reader) (int64, error) {
	projectPath := manager.bucketProjectPath(projectID)
	objectPath := filepath.Join(projectPath, key)

	// Ensure directory exists
	if err := os.MkdirAll(filepath.Dir(objectPath), 0o700); err != nil {
		return 0, fmt.Errorf("create object directory: %w", err)
	}

	// Create a temp file in the same directory for atomic rename
	tmpPath := objectPath + ".tmp"
	file, err := os.Create(tmpPath)
	if err != nil {
		return 0, fmt.Errorf("create temp file: %w", err)
	}

	n, err := io.Copy(file, r)
	closeErr := file.Close()
	if err != nil {
		_ = os.Remove(tmpPath)
		return n, fmt.Errorf("write object: %w", err)
	}
	if closeErr != nil {
		_ = os.Remove(tmpPath)
		return n, fmt.Errorf("close temp file: %w", closeErr)
	}

	// Atomic rename
	if err := os.Rename(tmpPath, objectPath); err != nil {
		_ = os.Remove(tmpPath)
		return n, fmt.Errorf("rename object: %w", err)
	}

	return n, nil
}

// ReadObject opens an object for reading. Returns the reader, size, and error.
func (manager *Manager) ReadObject(projectID uuid.UUID, key string) (io.ReadCloser, int64, error) {
	projectPath := manager.bucketProjectPath(projectID)
	objectPath := filepath.Join(projectPath, key)

	file, err := os.Open(objectPath)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return nil, 0, ErrNotFound
		}
		return nil, 0, fmt.Errorf("open object: %w", err)
	}

	info, err := file.Stat()
	if err != nil {
		file.Close()
		return nil, 0, fmt.Errorf("stat object: %w", err)
	}

	return file, info.Size(), nil
}

// MoveObject relocates an object to a new key within the same project.
//
// The destination directory is created first, because os.Rename fails across
// directories that do not exist yet and the failure would otherwise surface as
// a confusing "no such file" for the destination rather than the real cause.
//
// Cleanup of now-empty directories runs on the source side only. Renaming a
// file between two directories in the same tree can leave the source directory
// empty, and an empty directory in a bucket root would show up as a phantom
// folder in the object browser.
func (manager *Manager) MoveObject(projectID uuid.UUID, fromKey string, toKey string) error {
	projectPath := manager.bucketProjectPath(projectID)
	sourcePath := filepath.Join(projectPath, fromKey)
	targetPath := filepath.Join(projectPath, toKey)

	if sourcePath == targetPath {
		return nil
	}

	if err := os.MkdirAll(filepath.Dir(targetPath), 0o700); err != nil {
		return fmt.Errorf("create target directory: %w", err)
	}

	if err := os.Rename(sourcePath, targetPath); err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return ErrNotFound
		}
		return fmt.Errorf("move object: %w", err)
	}

	manager.cleanupEmptyDirs(filepath.Dir(sourcePath), projectPath)
	return nil
}

// DeleteObject removes an object from disk.
func (manager *Manager) DeleteObject(projectID uuid.UUID, key string) error {
	projectPath := manager.bucketProjectPath(projectID)
	objectPath := filepath.Join(projectPath, key)

	err := os.Remove(objectPath)
	if err != nil && !errors.Is(err, os.ErrNotExist) {
		return fmt.Errorf("remove object: %w", err)
	}

	// Clean up empty parent directories
	manager.cleanupEmptyDirs(filepath.Dir(objectPath), projectPath)

	return nil
}

// cleanupEmptyDirs removes empty directories up to the project root.
func (manager *Manager) cleanupEmptyDirs(dir, root string) {
	for dir != root && dir != "." {
		entries, err := os.ReadDir(dir)
		if err != nil || len(entries) > 0 {
			break
		}
		_ = os.Remove(dir)
		dir = filepath.Dir(dir)
	}
}

// StorageUsed returns the total bytes used by a project's bucket objects.
func (manager *Manager) StorageUsed(projectID uuid.UUID) (int64, error) {
	projectPath := manager.bucketProjectPath(projectID)

	var total int64
	err := filepath.WalkDir(projectPath, func(path string, d os.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if !d.IsDir() {
			info, err := d.Info()
			if err == nil {
				total += info.Size()
			}
		}
		return nil
	})
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return 0, nil
		}
		return 0, fmt.Errorf("walk bucket storage: %w", err)
	}
	return total, nil
}
