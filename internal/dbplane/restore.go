package dbplane

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"time"

	"github.com/google/uuid"

	"github.com/moogodev/moogodev/pkg/logger"
)

// ErrInvalidSnapshot means a backup file was offered for restore but is not a
// well-formed Moogo database. It is returned before anything live is touched.
var ErrInvalidSnapshot = errors.New("invalid database snapshot")

// DatabaseModTime returns the newest modification time among a project's
// database file and its WAL sidecars.
//
// The backup scheduler uses it as a change watermark: a write bumps the main
// file or a sidecar, so a timestamp that has not moved since the last snapshot
// means there is nothing new to back up. The main file must exist; the sidecars
// are optional and simply contribute when present.
func (manager *Manager) DatabaseModTime(projectID uuid.UUID) (time.Time, error) {
	if err := normalizeProjectID(projectID); err != nil {
		return time.Time{}, err
	}

	target := manager.databasePath(projectID)
	info, err := os.Stat(target)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return time.Time{}, ErrNotFound
		}
		return time.Time{}, fmt.Errorf("stat database file: %w", err)
	}

	newest := info.ModTime()
	for _, suffix := range []string{"-wal", "-shm"} {
		sidecar, err := os.Stat(target + suffix)
		if err != nil {
			if errors.Is(err, os.ErrNotExist) {
				continue
			}
			return time.Time{}, fmt.Errorf("stat %s: %w", filepath.Base(target+suffix), err)
		}
		if sidecar.ModTime().After(newest) {
			newest = sidecar.ModTime()
		}
	}
	return newest, nil
}

// RestoreDatabase replaces a project's live database with a snapshot file.
//
// This is destructive and irreversible from the caller's point of view: after
// it returns, every write since the snapshot is gone. It is the caller's job to
// take a safety snapshot first, which the backup service does.
//
// The snapshot is validated before anything is touched, then staged next to the
// target so the final swap is a rename within one filesystem rather than a copy
// across two. The slow part -- reading the snapshot -- happens before the
// project is taken out of service; only the close-and-rename is done while the
// project is unavailable.
//
// While a restore is running, acquisitions for this project are refused with
// ErrRestoring: a handle opened against the old file after it is closed would
// otherwise keep serving deleted bytes. The per-project marker is used rather
// than manager.mu because handle.close waits on in-flight queries, and those
// finish by taking manager.mu -- holding it here would deadlock.
func (manager *Manager) RestoreDatabase(ctx context.Context, projectID uuid.UUID, snapshotPath string) error {
	if err := normalizeProjectID(projectID); err != nil {
		return err
	}

	if err := validateSnapshot(ctx, snapshotPath); err != nil {
		return err
	}

	staged, err := manager.stageSnapshot(snapshotPath)
	if err != nil {
		return err
	}
	swapped := false
	defer func() {
		if !swapped {
			_ = os.Remove(staged)
		}
	}()

	manager.mu.Lock()
	if manager.closed {
		manager.mu.Unlock()
		return ErrClosed
	}
	manager.restoring[projectID] = true
	handle, found := manager.dbs[projectID]
	delete(manager.dbs, projectID)
	delete(manager.refs, projectID)
	delete(manager.used, projectID)
	manager.mu.Unlock()

	defer func() {
		manager.mu.Lock()
		delete(manager.restoring, projectID)
		manager.mu.Unlock()
	}()

	if found {
		if err := handle.close(); err != nil {
			manager.logger.Warn("close project connection before restore failed",
				logger.Fields{"project_id": projectID.String(), "error": err.Error()})
		}
	}

	target := manager.databasePath(projectID)

	// The sidecars belong to the database being replaced. Leaving them would
	// let SQLite replay a WAL written against the old file onto the restored
	// one, which is exactly the corruption a restore is meant to undo.
	for _, suffix := range []string{"-wal", "-shm"} {
		if err := os.Remove(target + suffix); err != nil && !errors.Is(err, os.ErrNotExist) {
			return fmt.Errorf("remove %s: %w", filepath.Base(target+suffix), err)
		}
	}

	if err := os.Rename(staged, target); err != nil {
		return fmt.Errorf("install restored database: %w", err)
	}
	swapped = true

	// Flush the directory entry so a crash right after a successful restore
	// does not roll the rename back and leave the old file in place.
	if dir, err := os.Open(manager.dataDir); err == nil {
		_ = dir.Sync()
		_ = dir.Close()
	}
	return nil
}

// stageSnapshot copies a snapshot into the data directory under a temporary
// name, returning the staged path.
//
// The copy is separated from the swap so the expensive read happens before the
// project is taken offline, and so the swap itself is a same-filesystem rename.
func (manager *Manager) stageSnapshot(snapshotPath string) (string, error) {
	source, err := os.Open(snapshotPath)
	if err != nil {
		return "", fmt.Errorf("open snapshot: %w", err)
	}
	defer source.Close()

	staged, err := os.CreateTemp(manager.dataDir, ".moogo-restore-*")
	if err != nil {
		return "", fmt.Errorf("create staging file: %w", err)
	}
	stagedPath := staged.Name()

	if _, err := io.Copy(staged, source); err != nil {
		_ = staged.Close()
		_ = os.Remove(stagedPath)
		return "", fmt.Errorf("stage snapshot: %w", err)
	}
	if err := staged.Sync(); err != nil {
		_ = staged.Close()
		_ = os.Remove(stagedPath)
		return "", fmt.Errorf("sync staged snapshot: %w", err)
	}
	if err := staged.Close(); err != nil {
		_ = os.Remove(stagedPath)
		return "", fmt.Errorf("close staged snapshot: %w", err)
	}
	return stagedPath, nil
}

// validateSnapshot opens a candidate backup and checks that it is a Moogo
// database that passes SQLite's own integrity check.
//
// The application_id check is what stops a stray file -- a text file, another
// SQLite schema, an empty download -- from being installed over a live
// database. integrity_check is the second gate: it catches a truncated or
// bit-rotted file that still carries the header.
func validateSnapshot(ctx context.Context, path string) error {
	database, err := sql.Open("sqlite", "file:"+path+"?_pragma=query_only(1)&_pragma=busy_timeout(5000)")
	if err != nil {
		return fmt.Errorf("%w: open snapshot: %v", ErrInvalidSnapshot, err)
	}
	defer database.Close()

	var fileApplicationID int
	if err := database.QueryRowContext(ctx, `PRAGMA application_id`).Scan(&fileApplicationID); err != nil {
		return fmt.Errorf("%w: read application_id: %v", ErrInvalidSnapshot, err)
	}
	if fileApplicationID != applicationID {
		return fmt.Errorf("%w: file is not a moogo database", ErrInvalidSnapshot)
	}

	var integrity string
	if err := database.QueryRowContext(ctx, `PRAGMA integrity_check`).Scan(&integrity); err != nil {
		return fmt.Errorf("%w: integrity check: %v", ErrInvalidSnapshot, err)
	}
	if integrity != "ok" {
		return fmt.Errorf("%w: %s", ErrInvalidSnapshot, integrity)
	}
	return nil
}
