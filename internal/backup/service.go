// Package backup snapshots every project's SQLite database to object storage.
//
// The service is deliberately small and boring. On each tick it asks the
// control plane which projects are due, takes a consistent snapshot of each
// with the data plane's VACUUM INTO path, uploads it, and records the result.
// Everything that can fail is logged and retried on a later tick rather than
// held in memory, so a process restart loses nothing but the current tick.
package backup

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/google/uuid"

	"github.com/moogodev/moogodev/internal/dbcontrol"
	"github.com/moogodev/moogodev/internal/storage"
	"github.com/moogodev/moogodev/pkg/logger"
)

// ErrBackupCorrupt means a stored object did not match the size or checksum
// recorded when it was uploaded. It is reported instead of restoring bytes that
// are not what the history says they are.
var ErrBackupCorrupt = errors.New("backup object is corrupt")

// Config controls the backup loop. It mirrors the MOOGO_BACKUP_* settings.
type Config struct {
	// Prefix is the key prefix every backup object shares.
	Prefix string
	// Interval is how often the loop looks for work.
	Interval time.Duration
	// MaxAge is how stale a backup may get before a project is due again.
	MaxAge time.Duration
	// Retention is how long a backup is kept. Zero disables pruning.
	Retention time.Duration
	// BatchSize caps how many projects one pass handles.
	BatchSize int
	// Timeout bounds one project's snapshot-and-upload.
	Timeout time.Duration
}

// Projects is the control-plane surface the service needs.
type Projects interface {
	ProjectsDueForBackup(ctx context.Context, maxAge time.Duration, limit int) ([]dbcontrol.Project, error)
	ProjectBackupState(ctx context.Context, projectID uuid.UUID) (*dbcontrol.DatabaseBackupState, error)
	RecordBackupSuccess(ctx context.Context, projectID uuid.UUID, kind dbcontrol.BackupKind, objectKey string, sha256 string, sizeBytes int64, sourceModifiedAt time.Time) error
	MarkBackupCurrent(ctx context.Context, projectID uuid.UUID) error
	RecordBackupFailure(ctx context.Context, projectID uuid.UUID, reason string) error
	DatabaseBackupByID(ctx context.Context, projectID uuid.UUID, backupID uuid.UUID) (*dbcontrol.DatabaseBackup, error)
	ListDatabaseBackups(ctx context.Context, projectID uuid.UUID, limit int, offset int) ([]dbcontrol.DatabaseBackup, error)
	LatestRegularBackup(ctx context.Context, projectID uuid.UUID) (*dbcontrol.DatabaseBackup, error)
	ExpiredBackups(ctx context.Context, projectID uuid.UUID, cutoff time.Time) ([]dbcontrol.DatabaseBackup, error)
	DeleteBackupRows(ctx context.Context, ids []uuid.UUID) error
	DeleteProjectBackups(ctx context.Context, projectID uuid.UUID) error
}

// Databases is the data-plane surface the service needs.
type Databases interface {
	BackupDatabase(ctx context.Context, projectID uuid.UUID) (string, error)
	DatabaseModTime(projectID uuid.UUID) (time.Time, error)
	RestoreDatabase(ctx context.Context, projectID uuid.UUID, snapshotPath string) error
}

// Objects is the object-storage surface the service needs.
type Objects interface {
	PutObject(ctx context.Context, key string, body io.ReadSeeker, size int64, sha256Hex, contentType string) error
	GetObject(ctx context.Context, key string) (io.ReadCloser, storage.Object, error)
	DeleteObject(ctx context.Context, key string) error
	ListPrefix(ctx context.Context, prefix string) ([]storage.Object, error)
}

// Result describes a completed backup.
type Result struct {
	ObjectKey string
	SizeBytes int64
	SHA256    string
}

// maxCachedSnapshots bounds how many downloaded backups are kept on disk for
// the viewer at once. Each entry is a whole database file, so this is a disk
// budget as much as a count: six small project databases are nothing, but the
// cap keeps a viewer session against many projects from accumulating them.
const maxCachedSnapshots = 6

// snapshotEntry is one downloaded backup kept for viewing.
type snapshotEntry struct {
	path     string
	lastUsed time.Time
}

// Service runs the backup loop and the on-demand backup and restore paths.
type Service struct {
	projects  Projects
	databases Databases
	objects   Objects
	cfg       Config
	log       *logger.Logger

	// snapshotMu guards the viewer's downloaded-backup cache. It is held for
	// the length of a download, which serializes viewer requests across
	// projects; that is acceptable for a dashboard action and keeps the cache
	// a plain map rather than a per-key lock set.
	snapshotMu sync.Mutex
	snapshots  map[uuid.UUID]snapshotEntry
}

// New creates a backup service.
func New(projects Projects, databases Databases, objects Objects, cfg Config, log *logger.Logger) *Service {
	if cfg.Prefix == "" {
		cfg.Prefix = "database-backups"
	}
	if cfg.Interval <= 0 {
		cfg.Interval = 15 * time.Minute
	}
	if cfg.MaxAge <= 0 {
		cfg.MaxAge = 24 * time.Hour
	}
	if cfg.BatchSize < 1 {
		cfg.BatchSize = 20
	}
	if cfg.Timeout <= 0 {
		cfg.Timeout = 15 * time.Minute
	}
	if log == nil {
		log = logger.Nop()
	}
	return &Service{projects: projects, databases: databases, objects: objects, cfg: cfg, log: log,
		snapshots: make(map[uuid.UUID]snapshotEntry)}
}

// Interval reports how often the loop runs, for the caller that owns the loop.
func (service *Service) Interval() time.Duration {
	return service.cfg.Interval
}

// ListBackups returns a project's backup history, newest first, together with
// the scheduler's cursor for it.
//
// The history is read from the control plane rather than by listing the bucket:
// the metadata is already indexed, and one query is cheaper and simpler than a
// paginated listing. The listing also cannot show a half-uploaded object, which
// is what makes every entry safe to offer for restore.
func (service *Service) ListBackups(ctx context.Context, projectID uuid.UUID, limit int) ([]dbcontrol.DatabaseBackup, *dbcontrol.DatabaseBackupState, error) {
	backups, err := service.projects.ListDatabaseBackups(ctx, projectID, limit, 0)
	if err != nil {
		return nil, nil, err
	}
	state, err := service.projects.ProjectBackupState(ctx, projectID)
	if err != nil {
		return nil, nil, err
	}
	return backups, state, nil
}

// Run drives the loop until the context is done.
//
// It does one pass immediately so a restart does not wait a full interval
// before noticing overdue projects, then one pass per tick.
func (service *Service) Run(ctx context.Context) {
	service.runAndLog(ctx)

	ticker := time.NewTicker(service.cfg.Interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			service.runAndLog(ctx)
		}
	}
}

func (service *Service) runAndLog(ctx context.Context) {
	processed, err := service.RunOnce(ctx)
	if err != nil {
		if ctx.Err() != nil {
			return
		}
		service.log.Error("backup pass failed", logger.Fields{"error": err.Error()})
		return
	}
	if processed > 0 {
		service.log.Info("backup pass finished", logger.Fields{"projects": processed})
	}
}

// RunOnce processes the projects that are due, returning how many were handled.
//
// A single project failing does not stop the pass: the next project is tried,
// and the failure is recorded so the dashboard can show it.
func (service *Service) RunOnce(ctx context.Context) (int, error) {
	projects, err := service.projects.ProjectsDueForBackup(ctx, service.cfg.MaxAge, service.cfg.BatchSize)
	if err != nil {
		return 0, err
	}

	processed := 0
	for index := range projects {
		if ctx.Err() != nil {
			return processed, ctx.Err()
		}
		service.processProject(ctx, projects[index])
		processed++
	}
	return processed, nil
}

// processProject backs up one project, unless nothing has changed on disk since
// the last successful backup.
func (service *Service) processProject(ctx context.Context, project dbcontrol.Project) {
	ctx, cancel := context.WithTimeout(ctx, service.cfg.Timeout)
	defer cancel()

	modifiedAt, err := service.databases.DatabaseModTime(project.ID)
	if err != nil {
		service.recordFailure(ctx, project.ID, err)
		return
	}

	state, err := service.projects.ProjectBackupState(ctx, project.ID)
	if err != nil {
		service.recordFailure(ctx, project.ID, err)
		return
	}

	// A watermark that has not moved since the last successful backup means the
	// stored copy is still current. The check is one-way on purpose: recording
	// the pre-snapshot timestamp means a write that races the snapshot leaves
	// the watermark older than the file, so the next tick backs up again rather
	// than wrongly skipping a change.
	if state.LastSuccessAt != nil && state.LastSourceModifiedAt != nil &&
		!modifiedAt.After(*state.LastSourceModifiedAt) {
		if err := service.projects.MarkBackupCurrent(ctx, project.ID); err != nil {
			service.log.Warn("mark backup current failed", logger.Fields{
				"project_id": project.ID.String(),
				"error":      err.Error(),
			})
		}
		service.prune(ctx, project.ID)
		return
	}

	if _, err := service.BackupProject(ctx, project.ID, dbcontrol.BackupDaily); err != nil {
		// BackupProject records the failure itself.
		return
	}
	service.prune(ctx, project.ID)
}

// BackupProject snapshots a project and uploads it.
//
// On success it records the history row and advances the project's cursor. On
// failure it records the failure and returns the error, so a caller can decide
// whether to surface it without having to remember to record anything.
func (service *Service) BackupProject(ctx context.Context, projectID uuid.UUID, kind dbcontrol.BackupKind) (*Result, error) {
	// Read the watermark before the snapshot, never after: a write that lands
	// after the snapshot must leave the watermark behind the file so the next
	// tick tries again, rather than ahead of it and skipping the write.
	watermark, err := service.databases.DatabaseModTime(projectID)
	if err != nil {
		service.recordFailure(ctx, projectID, err)
		return nil, err
	}

	snapshotPath, err := service.databases.BackupDatabase(ctx, projectID)
	if err != nil {
		service.recordFailure(ctx, projectID, err)
		return nil, err
	}
	defer os.RemoveAll(filepath.Dir(snapshotPath))

	size, checksum, err := hashFile(snapshotPath)
	if err != nil {
		service.recordFailure(ctx, projectID, err)
		return nil, err
	}

	now := time.Now()
	key := service.objectKey(projectID, kind, now)
	if err := service.putFile(ctx, key, snapshotPath, size, checksum); err != nil {
		service.recordFailure(ctx, projectID, err)
		return nil, err
	}

	// latest.sqlite is a stable pointer to the newest regular backup. It
	// deliberately sits outside the history: it survives retention pruning and
	// gives an operator a predictable key to fetch without asking Postgres.
	// A pre-restore snapshot does not move it, because that snapshot is not the
	// newest state of the data, it is the state just before it was replaced.
	if kind != dbcontrol.BackupPreRestore {
		if err := service.putFile(ctx, service.latestKey(projectID), snapshotPath, size, checksum); err != nil {
			service.recordFailure(ctx, projectID, err)
			return nil, err
		}
	}

	if err := service.projects.RecordBackupSuccess(ctx, projectID, kind, key, checksum, size, watermark); err != nil {
		service.recordFailure(ctx, projectID, err)
		return nil, err
	}

	service.log.Info("database backed up", logger.Fields{
		"project_id": projectID.String(),
		"kind":       string(kind),
		"bytes":      size,
		"key":        key,
	})

	return &Result{ObjectKey: key, SizeBytes: size, SHA256: checksum}, nil
}

// RestoreProject replaces a project's live database with a stored backup.
//
// It takes a pre-restore snapshot of the current state first and refuses to
// continue if that fails, so a restore always has a way back. The downloaded
// object is checked against the size and checksum recorded at upload time
// before it is allowed near the live file.
func (service *Service) RestoreProject(ctx context.Context, projectID uuid.UUID, backupID uuid.UUID) error {
	stored, err := service.projects.DatabaseBackupByID(ctx, projectID, backupID)
	if err != nil {
		return err
	}

	if _, err := service.BackupProject(ctx, projectID, dbcontrol.BackupPreRestore); err != nil {
		return fmt.Errorf("safety snapshot before restore: %w", err)
	}

	downloaded, err := service.fetchToTemp(ctx, stored.ObjectKey, stored.SHA256, stored.SizeBytes)
	if err != nil {
		return err
	}
	defer os.Remove(downloaded)

	if err := service.databases.RestoreDatabase(ctx, projectID, downloaded); err != nil {
		return err
	}

	service.log.Info("database restored", logger.Fields{
		"project_id": projectID.String(),
		"backup_id":  backupID.String(),
		"key":        stored.ObjectKey,
	})
	return nil
}

// GetBackup returns one backup's metadata, scoped to the project.
func (service *Service) GetBackup(ctx context.Context, projectID uuid.UUID, backupID uuid.UUID) (*dbcontrol.DatabaseBackup, error) {
	return service.projects.DatabaseBackupByID(ctx, projectID, backupID)
}

// DownloadBackup opens a stored backup for streaming to the owner.
//
// The object is handed back unverified and unread: the caller streams it
// straight to the response, and a checksum of an arbitrary object is not
// needed to let the owner keep their own copy. Verification belongs on the
// restore and viewer paths, where the bytes are going to be opened as a
// database.
func (service *Service) DownloadBackup(ctx context.Context, projectID uuid.UUID, backupID uuid.UUID) (io.ReadCloser, *dbcontrol.DatabaseBackup, error) {
	stored, err := service.projects.DatabaseBackupByID(ctx, projectID, backupID)
	if err != nil {
		return nil, nil, err
	}

	body, _, err := service.objects.GetObject(ctx, stored.ObjectKey)
	if err != nil {
		return nil, nil, fmt.Errorf("download backup: %w", err)
	}
	return body, stored, nil
}

// DeleteBackup removes one stored backup: its object, its history row, and,
// when it is the newest regular backup, the latest.sqlite pointer that mirrors
// it.
//
// The object goes first and the row last. A row removed before its object can
// no longer name it, and an orphaned object is only a storage bill while an
// orphaned row is a restore that fails; deleting the object first means a
// failure leaves the entry visible and retryable instead of half-gone.
func (service *Service) DeleteBackup(ctx context.Context, projectID uuid.UUID, backupID uuid.UUID) error {
	stored, err := service.projects.DatabaseBackupByID(ctx, projectID, backupID)
	if err != nil {
		return err
	}

	if err := service.objects.DeleteObject(ctx, stored.ObjectKey); err != nil {
		return fmt.Errorf("delete backup object: %w", err)
	}

	// latest.sqlite mirrors the newest non-pre-restore backup. When that is the
	// one being deleted, the pointer is removed too, so the owner's data does
	// not linger under a key the list never showed them. A lookup failure is
	// logged and stepped over: the backup the owner asked to delete is already
	// gone, and leaving the pointer is recoverable while failing the request
	// would make the delete look unsuccessful.
	latest, latestErr := service.projects.LatestRegularBackup(ctx, projectID)
	if latestErr != nil {
		service.log.Warn("look up latest backup failed", logger.Fields{
			"project_id": projectID.String(),
			"error":      latestErr.Error(),
		})
	} else if latest != nil && latest.ID == backupID {
		if err := service.objects.DeleteObject(ctx, service.latestKey(projectID)); err != nil {
			return fmt.Errorf("delete latest backup pointer: %w", err)
		}
	}

	if err := service.projects.DeleteBackupRows(ctx, []uuid.UUID{backupID}); err != nil {
		return err
	}

	service.forgetSnapshot(backupID)
	service.log.Info("backup deleted", logger.Fields{
		"project_id": projectID.String(),
		"backup_id":  backupID.String(),
		"key":        stored.ObjectKey,
	})
	return nil
}

// SnapshotPath returns the path of a local copy of a backup, downloading and
// verifying it first when it is not already cached.
//
// The viewer opens this file read-only. The copy is cached because one page of
// the grid issues several queries (a page of rows plus a count, then the same
// again on every page step), and downloading the object for each would make the
// viewer unusably slow. The cache is bounded and evicts the least recently used
// entry.
func (service *Service) SnapshotPath(ctx context.Context, projectID uuid.UUID, backupID uuid.UUID) (string, error) {
	service.snapshotMu.Lock()
	defer service.snapshotMu.Unlock()

	if entry, ok := service.snapshots[backupID]; ok {
		if _, err := os.Stat(entry.path); err == nil {
			entry.lastUsed = time.Now()
			service.snapshots[backupID] = entry
			return entry.path, nil
		}
		// The file was removed underneath us; fall through and fetch it again.
		delete(service.snapshots, backupID)
	}

	stored, err := service.projects.DatabaseBackupByID(ctx, projectID, backupID)
	if err != nil {
		return "", err
	}

	// fetchToTemp verifies the download against the size and checksum recorded
	// at upload time, so a truncated object never reaches the viewer as a
	// plausible-looking database.
	path, err := service.fetchToTemp(ctx, stored.ObjectKey, stored.SHA256, stored.SizeBytes)
	if err != nil {
		return "", err
	}

	service.snapshots[backupID] = snapshotEntry{path: path, lastUsed: time.Now()}
	service.evictSnapshotsLocked()
	return path, nil
}

// evictSnapshotsLocked removes the least recently used cached backups until the
// cache is within its bound. It runs with snapshotMu held.
func (service *Service) evictSnapshotsLocked() {
	for len(service.snapshots) > maxCachedSnapshots {
		var (
			oldestID   uuid.UUID
			oldestUsed time.Time
			found      bool
		)
		for backupID, entry := range service.snapshots {
			if !found || entry.lastUsed.Before(oldestUsed) {
				oldestID, oldestUsed, found = backupID, entry.lastUsed, true
			}
		}
		_ = os.Remove(service.snapshots[oldestID].path)
		delete(service.snapshots, oldestID)
	}
}

// forgetSnapshot drops and removes a cached backup copy.
func (service *Service) forgetSnapshot(backupID uuid.UUID) {
	service.snapshotMu.Lock()
	defer service.snapshotMu.Unlock()

	if entry, ok := service.snapshots[backupID]; ok {
		_ = os.Remove(entry.path)
		delete(service.snapshots, backupID)
	}
}

// clearSnapshots removes every cached backup copy, for a project being deleted
// where the exact set of backup ids is not worth tracking down.
func (service *Service) clearSnapshots() {
	service.snapshotMu.Lock()
	defer service.snapshotMu.Unlock()

	for backupID, entry := range service.snapshots {
		_ = os.Remove(entry.path)
		delete(service.snapshots, backupID)
	}
}

// DeleteProjectBackups removes a project's stored objects and metadata.
//
// It sweeps the whole project prefix rather than the recorded keys, so an
// object whose history row was pruned, or an upload that failed after the
// object landed, is still removed. The metadata is only deleted once the sweep
// has run; a failure here leaves the history in place so a retry can finish the
// job rather than orphaning the objects silently.
func (service *Service) DeleteProjectBackups(ctx context.Context, projectID uuid.UUID) error {
	objects, err := service.objects.ListPrefix(ctx, service.projectPrefix(projectID))
	if err != nil {
		return fmt.Errorf("list backups to delete: %w", err)
	}

	var failures int
	for _, object := range objects {
		if err := service.objects.DeleteObject(ctx, object.Key); err != nil {
			failures++
			service.log.Warn("delete backup object failed", logger.Fields{
				"project_id": projectID.String(),
				"key":        object.Key,
				"error":      err.Error(),
			})
		}
	}

	if err := service.projects.DeleteProjectBackups(ctx, projectID); err != nil {
		return err
	}
	service.clearSnapshots()
	if failures > 0 {
		return fmt.Errorf("delete project backups: %d objects could not be removed", failures)
	}
	return nil
}

// prune deletes backups past the retention window. The newest backup of a
// project is always kept, so a project can never be pruned down to no restore
// point at all.
func (service *Service) prune(ctx context.Context, projectID uuid.UUID) {
	if service.cfg.Retention <= 0 {
		return
	}

	cutoff := time.Now().Add(-service.cfg.Retention)
	expired, err := service.projects.ExpiredBackups(ctx, projectID, cutoff)
	if err != nil {
		service.log.Warn("list expired backups failed", logger.Fields{
			"project_id": projectID.String(),
			"error":      err.Error(),
		})
		return
	}
	if len(expired) == 0 {
		return
	}

	// An object is deleted before its row. A row that is removed first can no
	// longer name the object, and an orphaned object is a storage bill while an
	// orphaned row is a restore that fails.
	var removed []uuid.UUID
	for _, stored := range expired {
		if err := service.objects.DeleteObject(ctx, stored.ObjectKey); err != nil {
			service.log.Warn("delete expired backup object failed", logger.Fields{
				"project_id": projectID.String(),
				"key":        stored.ObjectKey,
				"error":      err.Error(),
			})
			continue
		}
		removed = append(removed, stored.ID)
	}

	if err := service.projects.DeleteBackupRows(ctx, removed); err != nil {
		service.log.Warn("delete expired backup rows failed", logger.Fields{
			"project_id": projectID.String(),
			"error":      err.Error(),
		})
		return
	}
	service.log.Info("pruned expired backups", logger.Fields{
		"project_id": projectID.String(),
		"count":      len(removed),
	})
}

// recordFailure stores why an attempt failed. The context is detached from the
// caller's so a timed-out backup still records its failure instead of losing it
// to the cancellation that caused it.
func (service *Service) recordFailure(ctx context.Context, projectID uuid.UUID, cause error) {
	recordCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), 5*time.Second)
	defer cancel()

	if err := service.projects.RecordBackupFailure(recordCtx, projectID, cause.Error()); err != nil {
		service.log.Error("record backup failure failed", logger.Fields{
			"project_id": projectID.String(),
			"error":      err.Error(),
		})
	}
}

// putFile uploads a file from disk, opening it fresh so the reader can be
// rewound for a retry.
func (service *Service) putFile(ctx context.Context, key, path string, size int64, checksum string) error {
	file, err := os.Open(path)
	if err != nil {
		return fmt.Errorf("open snapshot for upload: %w", err)
	}
	defer file.Close()

	if err := service.objects.PutObject(ctx, key, file, size, checksum, "application/vnd.sqlite3"); err != nil {
		return fmt.Errorf("upload backup: %w", err)
	}
	return nil
}

// fetchToTemp downloads an object to a temp file and verifies it against the
// size and checksum recorded when it was uploaded.
//
// The verification is the point: the download is the one place a truncated
// upload, a half-written object or a wrong key would otherwise be installed
// over a working database.
func (service *Service) fetchToTemp(ctx context.Context, key, wantSHA256 string, wantSize int64) (string, error) {
	body, _, err := service.objects.GetObject(ctx, key)
	if err != nil {
		return "", fmt.Errorf("download backup: %w", err)
	}
	defer body.Close()

	temp, err := os.CreateTemp("", "moogo-restore-*")
	if err != nil {
		return "", fmt.Errorf("create download file: %w", err)
	}
	path := temp.Name()

	hasher := sha256.New()
	written, copyErr := io.Copy(io.MultiWriter(temp, hasher), body)
	closeErr := temp.Close()

	if copyErr != nil {
		_ = os.Remove(path)
		return "", fmt.Errorf("store downloaded backup: %w", copyErr)
	}
	if closeErr != nil {
		_ = os.Remove(path)
		return "", fmt.Errorf("close downloaded backup: %w", closeErr)
	}

	if wantSize > 0 && written != wantSize {
		_ = os.Remove(path)
		return "", fmt.Errorf("%w: expected %d bytes, got %d", ErrBackupCorrupt, wantSize, written)
	}
	if wantSHA256 != "" {
		if got := hex.EncodeToString(hasher.Sum(nil)); got != wantSHA256 {
			_ = os.Remove(path)
			return "", fmt.Errorf("%w: checksum mismatch", ErrBackupCorrupt)
		}
	}
	return path, nil
}

// objectKey is the key a backup of the given kind is stored under.
//
// Daily keys use the date, which is enough because the due window is at least a
// day: two successful daily backups of one project cannot land on the same
// date. The other kinds can be taken several times a day, so they carry a
// timestamp.
func (service *Service) objectKey(projectID uuid.UUID, kind dbcontrol.BackupKind, when time.Time) string {
	base := service.projectPrefix(projectID)

	switch kind {
	case dbcontrol.BackupDaily:
		return base + "daily/" + when.UTC().Format("2006-01-02") + ".sqlite"
	case dbcontrol.BackupManual:
		return base + "manual/" + when.UTC().Format("20060102T150405Z") + ".sqlite"
	case dbcontrol.BackupPreRestore:
		return base + "pre-restore/" + when.UTC().Format("20060102T150405Z") + ".sqlite"
	case dbcontrol.BackupInitial:
		return base + "initial/" + when.UTC().Format("20060102T150405Z") + ".sqlite"
	default:
		return base + "other/" + when.UTC().Format("20060102T150405Z") + ".sqlite"
	}
}

// projectPrefix is the key prefix shared by every object of one project,
// trailing slash included so it cannot match a sibling project whose id starts
// with the same digits.
func (service *Service) projectPrefix(projectID uuid.UUID) string {
	return service.cfg.Prefix + "/" + projectID.String() + "/"
}

// latestKey is the stable key for a project's newest regular backup.
func (service *Service) latestKey(projectID uuid.UUID) string {
	return service.projectPrefix(projectID) + "latest.sqlite"
}

// hashFile returns the size and hex SHA-256 of a file.
func hashFile(path string) (int64, string, error) {
	file, err := os.Open(path)
	if err != nil {
		return 0, "", fmt.Errorf("open snapshot: %w", err)
	}
	defer file.Close()

	hasher := sha256.New()
	size, err := io.Copy(hasher, file)
	if err != nil {
		return 0, "", fmt.Errorf("hash snapshot: %w", err)
	}
	return size, hex.EncodeToString(hasher.Sum(nil)), nil
}
