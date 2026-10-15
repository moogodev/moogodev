// Package backup snapshots every project's SQLite database to object storage.
//
// The service is deliberately small and boring. On each tick it asks the
// control plane which projects are due, takes a consistent snapshot of each
// with the data plane's VACUUM INTO path, uploads it, and records the result.
// Everything that can fail is logged and retried on a later tick rather than
// held in memory, so a process restart loses nothing but the current tick.
package backup

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/google/uuid"

	"github.com/moogodev/moogodev/internal/dbcontrol"
	"github.com/moogodev/moogodev/internal/metrics"
	"github.com/moogodev/moogodev/internal/storage"
	"github.com/moogodev/moogodev/pkg/logger"
)

// ErrBackupCorrupt means a stored object did not match the size or checksum
// recorded when it was uploaded. It is reported instead of restoring bytes that
// are not what the history says they are.
var ErrBackupCorrupt = errors.New("backup object is corrupt")

// ErrBackupInProgress means another backup of the same project is already
// running, so this one did not start. It is contention rather than a failure:
// nothing was recorded, and the caller can retry once the running backup
// finishes.
var ErrBackupInProgress = errors.New("a backup of this project is already running")

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
	// VerifyInterval is how often the drill loop looks for projects whose
	// newest backup has not been proven restorable recently.
	VerifyInterval time.Duration
	// VerifyMaxAge is how long a proven-restorable verdict is trusted before
	// the project is verified again.
	VerifyMaxAge time.Duration
	// VerifyBatchSize caps how many projects one drill pass handles. Each one
	// downloads a whole backup, so the cap is smaller than the backup batch.
	VerifyBatchSize int
	// AlertAfter is how many consecutive failures a project may accumulate
	// before a failing alert is sent. Zero disables the threshold, in which
	// case only the metric and the dashboard show the failure.
	AlertAfter int
	// WebhookURL is where alerts are POSTed as JSON. Empty disables delivery;
	// the threshold still governs the metric and the log line.
	WebhookURL string
}

// Projects is the control-plane surface the service needs.
type Projects interface {
	ProjectsDueForBackup(ctx context.Context, maxAge time.Duration, limit int) ([]dbcontrol.Project, error)
	ProjectBackupState(ctx context.Context, projectID uuid.UUID) (*dbcontrol.DatabaseBackupState, error)
	RecordBackupSuccess(ctx context.Context, projectID uuid.UUID, kind dbcontrol.BackupKind, objectKey string, sha256 string, sizeBytes int64, sourceModifiedAt time.Time) (previousFailures int, err error)
	MarkBackupCurrent(ctx context.Context, projectID uuid.UUID) error
	RecordBackupFailure(ctx context.Context, projectID uuid.UUID, reason string) (consecutiveFailures int, err error)
	DatabaseBackupByID(ctx context.Context, projectID uuid.UUID, backupID uuid.UUID) (*dbcontrol.DatabaseBackup, error)
	ListDatabaseBackups(ctx context.Context, projectID uuid.UUID, limit int, offset int) ([]dbcontrol.DatabaseBackup, error)
	LatestRegularBackup(ctx context.Context, projectID uuid.UUID) (*dbcontrol.DatabaseBackup, error)
	ExpiredBackups(ctx context.Context, projectID uuid.UUID, cutoff time.Time) ([]dbcontrol.DatabaseBackup, error)
	DeleteBackupRows(ctx context.Context, ids []uuid.UUID) error
	DeleteProjectBackups(ctx context.Context, projectID uuid.UUID) error
	// TryProjectBackupLock takes a per-project lock for the length of a backup,
	// so two runs cannot snapshot and upload the same project at once. A false
	// result is contention, not an error.
	TryProjectBackupLock(ctx context.Context, projectID uuid.UUID) (release func(), ok bool, err error)
	// ProjectsDueForVerification lists projects whose newest backup has not
	// been proven restorable within maxAge.
	ProjectsDueForVerification(ctx context.Context, maxAge time.Duration, limit int) ([]dbcontrol.Project, error)
	// RecordBackupVerification stores the outcome of one restore drill. A nil
	// verifyErr clears the previous failure.
	RecordBackupVerification(ctx context.Context, projectID uuid.UUID, verifyErr *string) error
	// CreateRestore queues an asynchronous restore for a project. It returns
	// dbcontrol.ErrRestoreInProgress when one is already queued or running.
	CreateRestore(ctx context.Context, projectID uuid.UUID, backupID uuid.UUID) (*dbcontrol.DatabaseRestore, error)
	// RestoreByID loads one queued restore, scoped to its project.
	RestoreByID(ctx context.Context, projectID uuid.UUID, restoreID uuid.UUID) (*dbcontrol.DatabaseRestore, error)
	// ActiveRestore returns a project's pending or running restore, or nil.
	ActiveRestore(ctx context.Context, projectID uuid.UUID) (*dbcontrol.DatabaseRestore, error)
	// PendingRestores lists restores that were queued but never started.
	PendingRestores(ctx context.Context, limit int) ([]dbcontrol.DatabaseRestore, error)
	// MarkRestoreRunning claims a pending restore, reporting whether the claim
	// was won.
	MarkRestoreRunning(ctx context.Context, restoreID uuid.UUID) (bool, error)
	// MarkRestoreFinished records a restore's terminal state. A nil errText
	// means it succeeded.
	MarkRestoreFinished(ctx context.Context, restoreID uuid.UUID, errText *string) error
	// MarkAbandonedRestores fails restores left running by a dead process.
	MarkAbandonedRestores(ctx context.Context) (int, error)

	// ProjectByID returns a project by ID, or ErrNotFound.
	ProjectByID(ctx context.Context, projectID uuid.UUID) (*dbcontrol.Project, error)
	// UserByID returns a user by ID, or ErrNotFound.
	UserByID(ctx context.Context, userID uuid.UUID) (*dbcontrol.User, error)
}

// Databases is the data-plane surface the service needs.
type Databases interface {
	BackupDatabase(ctx context.Context, projectID uuid.UUID) (string, error)
	DatabaseModTime(projectID uuid.UUID) (time.Time, error)
	RestoreDatabase(ctx context.Context, projectID uuid.UUID, snapshotPath string) error
	// VerifySnapshot checks that a downloaded backup is a well-formed database
	// without touching the live project.
	VerifySnapshot(ctx context.Context, path string) error
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
	path string
	// project scopes eviction: deleting one project must not throw away the
	// copies another project's viewer is using.
	project  uuid.UUID
	lastUsed time.Time
}

// Service runs the backup loop and the on-demand backup and restore paths.
type Service struct {
	projects  Projects
	databases Databases
	objects   Objects
	cfg       Config
	log       *logger.Logger

	// notifier receives failure-streak and recovery alerts. It is never nil:
	// a disabled webhook is a notifier that does nothing, so the record paths
	// do not have to check.
	notifier Notifier
	// alertAfter is the failure streak that triggers an alert. Zero disables
	// alerting.
	alertAfter int

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
	if cfg.VerifyInterval <= 0 {
		cfg.VerifyInterval = time.Hour
	}
	if cfg.VerifyMaxAge <= 0 {
		cfg.VerifyMaxAge = 7 * 24 * time.Hour
	}
	if cfg.VerifyBatchSize < 1 {
		cfg.VerifyBatchSize = 5
	}
	if log == nil {
		log = logger.Nop()
	}
	return &Service{projects: projects, databases: databases, objects: objects, cfg: cfg, log: log,
		notifier:   NewWebhook(cfg.WebhookURL, log),
		alertAfter: cfg.AlertAfter,
		snapshots:  make(map[uuid.UUID]snapshotEntry)}
}

// Interval reports how often the loop runs, for the caller that owns the loop.
func (service *Service) Interval() time.Duration {
	return service.cfg.Interval
}

// VerifyInterval reports how often the restore-drill loop should run.
func (service *Service) VerifyInterval() time.Duration {
	return service.cfg.VerifyInterval
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
		service.recordFailure(ctx, project.ID, dbcontrol.BackupDaily, err)
		return
	}

	state, err := service.projects.ProjectBackupState(ctx, project.ID)
	if err != nil {
		service.recordFailure(ctx, project.ID, dbcontrol.BackupDaily, err)
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

// VerifyDue downloads and checks the newest backup of every project whose last
// drill is older than VerifyMaxAge, returning how many were checked.
//
// The drill is what separates "there is an object in the bucket" from "that
// object can actually be restored". It re-downloads the newest regular backup,
// checks it against the size and checksum recorded at upload, and opens it
// read-only to run SQLite's own integrity check. A single project failing does
// not stop the pass: the next project is tried, and the failure is recorded so
// the dashboard can show it.
func (service *Service) VerifyDue(ctx context.Context, limit int) (int, error) {
	if limit <= 0 {
		limit = service.cfg.VerifyBatchSize
	}

	projects, err := service.projects.ProjectsDueForVerification(ctx, service.cfg.VerifyMaxAge, limit)
	if err != nil {
		return 0, err
	}

	verified := 0
	for index := range projects {
		if ctx.Err() != nil {
			return verified, ctx.Err()
		}
		service.VerifyProject(ctx, projects[index].ID)
		verified++
	}
	return verified, nil
}

// VerifyProject proves one project's newest backup is restorable and records
// the outcome. The returned error is the drill's own result; the loop caller
// wants the pass to continue either way, which is why it records rather than
// returns through VerifyDue.
func (service *Service) VerifyProject(ctx context.Context, projectID uuid.UUID) error {
	ctx, cancel := context.WithTimeout(ctx, service.cfg.Timeout)
	defer cancel()

	err := service.verifyLatest(ctx, projectID)

	var verifyErr *string
	if err != nil {
		message := err.Error()
		verifyErr = &message
	}

	result := "ok"
	if err != nil {
		result = "failure"
	}
	metrics.IncBackupVerification(result)

	// Record on a detached context: a drill that failed because it timed out
	// must still record why, or the dashboard would show a stale verdict.
	recordCtx, recordCancel := context.WithTimeout(context.WithoutCancel(ctx), 5*time.Second)
	defer recordCancel()
	if recordErr := service.projects.RecordBackupVerification(recordCtx, projectID, verifyErr); recordErr != nil {
		service.log.Error("record backup verification failed", logger.Fields{
			"project_id": projectID.String(),
			"error":      recordErr.Error(),
		})
	}

	if err != nil {
		service.log.Warn("backup verification failed", logger.Fields{
			"project_id": projectID.String(),
			"error":      err.Error(),
		})
	}
	return err
}

// verifyLatest downloads the newest regular backup and checks it end to end. A
// project that has no backup yet has nothing to verify, which is not an error.
func (service *Service) verifyLatest(ctx context.Context, projectID uuid.UUID) error {
	latest, err := service.projects.LatestRegularBackup(ctx, projectID)
	if err != nil {
		return err
	}
	if latest == nil {
		return nil
	}

	path, err := service.fetchToTemp(ctx, latest.ObjectKey, latest.SHA256, latest.SizeBytes)
	if err != nil {
		return err
	}
	defer os.Remove(path)

	return service.databases.VerifySnapshot(ctx, path)
}

// BackupProject snapshots a project and uploads it.
//
// On success it records the history row and advances the project's cursor. On
// failure it records the failure and returns the error, so a caller can decide
// whether to surface it without having to remember to record anything.
//
// It wraps the work to time it once for the duration metric, so every caller --
// the scheduler, the dashboard and the pre-restore safety snapshot -- measures
// the same span without repeating the bookkeeping.
func (service *Service) BackupProject(ctx context.Context, projectID uuid.UUID, kind dbcontrol.BackupKind) (*Result, error) {
	started := time.Now()
	result, err := service.backupProject(ctx, projectID, kind)
	// Contention means nothing ran, so it is not a duration to report.
	if !errors.Is(err, ErrBackupInProgress) {
		metrics.ObserveBackupDuration(string(kind), time.Since(started))
	}
	return result, err
}

func (service *Service) backupProject(ctx context.Context, projectID uuid.UUID, kind dbcontrol.BackupKind) (*Result, error) {
	// One backup per project at a time. The lock is cross-process, so it also
	// covers a manual run racing the scheduler on another instance, which is the
	// case that would otherwise write two history rows naming one object.
	release, acquired, err := service.projects.TryProjectBackupLock(ctx, projectID)
	if err != nil {
		service.recordFailure(ctx, projectID, kind, err)
		return nil, err
	}
	if !acquired {
		return nil, ErrBackupInProgress
	}
	defer release()

	// Read the watermark before the snapshot, never after: a write that lands
	// after the snapshot must leave the watermark behind the file so the next
	// tick tries again, rather than ahead of it and skipping the write.
	watermark, err := service.databases.DatabaseModTime(projectID)
	if err != nil {
		service.recordFailure(ctx, projectID, kind, err)
		return nil, err
	}

	snapshotPath, err := service.databases.BackupDatabase(ctx, projectID)
	if err != nil {
		service.recordFailure(ctx, projectID, kind, err)
		return nil, err
	}
	defer os.RemoveAll(filepath.Dir(snapshotPath))

	size, checksum, err := hashFile(snapshotPath)
	if err != nil {
		service.recordFailure(ctx, projectID, kind, err)
		return nil, err
	}

	now := time.Now()
	key := service.objectKey(projectID, kind, now)
	if err := service.putFile(ctx, key, snapshotPath, size, checksum); err != nil {
		service.recordFailure(ctx, projectID, kind, err)
		return nil, err
	}

	// The history row is written before the latest pointer is moved. The row is
	// what the list and the restore path read, so recording it first means a
	// failure here leaves the pointer aiming at the previous backup rather than
	// at an object no listing can name. An owner then still has a listed, usable
	// backup instead of an invisible one.
	previousFailures, err := service.projects.RecordBackupSuccess(ctx, projectID, kind, key, checksum, size, watermark)
	if err != nil {
		service.recordFailure(ctx, projectID, kind, err)
		return nil, err
	}

	// latest.json is a stable pointer to the newest regular backup. It is a
	// small document naming the object key, not a second copy of the database:
	// duplicating the bytes doubled the storage held for the newest backup of
	// every project, and the object it copied is already listed and fetchable.
	// The key sits outside the history and survives retention pruning, so an
	// operator keeps one predictable name to fetch without asking Postgres.
	//
	// A pre-restore snapshot does not move the pointer, because that snapshot is
	// not the newest state of the data, it is the state just before it was
	// replaced.
	//
	// A failure to move the pointer is logged and stepped over rather than
	// reported as a failed backup: the snapshot is uploaded and recorded, and
	// the pointer is a convenience key that the next backup of changed data
	// will bring up to date. Losing the whole backup over it would be worse.
	if kind != dbcontrol.BackupPreRestore {
		if err := service.writeLatestPointer(ctx, projectID, key, checksum, size, now); err != nil {
			service.log.Warn("update latest backup pointer failed", logger.Fields{
				"project_id": projectID.String(),
				"key":        key,
				"error":      err.Error(),
			})
		}
		// Also write (or refresh) the human-readable project metadata.
		if err := service.writeProjectMetadata(ctx, projectID); err != nil {
			service.log.Warn("write project metadata failed", logger.Fields{
				"project_id": projectID.String(),
				"error":      err.Error(),
			})
		}
	}

	metrics.IncBackupAttempt(string(kind), "success")
	metrics.SetBackupLastSuccess(projectID.String(), now)
	// A success clears the streak, and the gauge has to say so: otherwise a
	// project that recovered would keep matching a "has been failing" alert.
	metrics.SetBackupConsecutiveFailures(projectID.String(), 0)

	// A recovery is only worth an alert if the failure was loud enough to alert
	// on in the first place.
	if service.alertAfter > 0 && previousFailures >= service.alertAfter {
		service.notifier.BackupRecovered(ctx, projectID)
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

// StartRestore accepts a restore request and runs it in the background.
//
// The restore itself downloads a whole backup, takes a pre-restore snapshot and
// swaps the live file, which is far too slow to keep an HTTP request open for.
// This validates that the backup exists -- so a bad id is still answered with a
// not-found rather than a queued job that can only fail -- queues the work, and
// returns the queued row at once. The caller polls RestoreStatus.
//
// The running restore uses a context detached from the request: the request is
// over by the time the work finishes, and cancelling the download and the swap
// because the browser navigated away is exactly the half-finished state the
// queue exists to avoid.
func (service *Service) StartRestore(ctx context.Context, projectID uuid.UUID, backupID uuid.UUID) (*dbcontrol.DatabaseRestore, error) {
	// The lookup is what turns a guessed or stale id into a 404 now rather than
	// a failed job later.
	if _, err := service.projects.DatabaseBackupByID(ctx, projectID, backupID); err != nil {
		return nil, err
	}

	restore, err := service.projects.CreateRestore(ctx, projectID, backupID)
	if err != nil {
		return nil, err
	}

	go service.executeRestore(context.WithoutCancel(ctx), restore.ID, projectID, backupID)
	return restore, nil
}

// RestoreStatus returns one queued restore, scoped to its project.
func (service *Service) RestoreStatus(ctx context.Context, projectID uuid.UUID, restoreID uuid.UUID) (*dbcontrol.DatabaseRestore, error) {
	return service.projects.RestoreByID(ctx, projectID, restoreID)
}

// ActiveRestore returns a project's pending or running restore, or nil.
func (service *Service) ActiveRestore(ctx context.Context, projectID uuid.UUID) (*dbcontrol.DatabaseRestore, error) {
	return service.projects.ActiveRestore(ctx, projectID)
}

// ResumePendingRestores picks up restores that were queued but never started,
// returning how many it ran.
//
// It is called once at startup. A row left pending means the process died
// between accepting the request and claiming the work, so nothing was touched
// and the restore is safe to run now. Rows left *running* are the opposite --
// the swap may already have happened -- and are failed by MarkAbandonedRestores
// before this runs, so this only ever sees work that is genuinely outstanding.
//
// Each restore is claimed with a compare-and-swap before it runs, so two
// instances starting at once do not both take the same row.
func (service *Service) ResumePendingRestores(ctx context.Context, limit int) (int, error) {
	if abandoned, err := service.projects.MarkAbandonedRestores(ctx); err != nil {
		service.log.Warn("fail abandoned restores failed", logger.Fields{"error": err.Error()})
	} else if abandoned > 0 {
		service.log.Warn("failed restores abandoned by a previous run", logger.Fields{"restores": abandoned})
	}

	pending, err := service.projects.PendingRestores(ctx, limit)
	if err != nil {
		return 0, err
	}

	resumed := 0
	for index := range pending {
		if ctx.Err() != nil {
			return resumed, ctx.Err()
		}

		restore := pending[index]
		claimed, err := service.projects.MarkRestoreRunning(ctx, restore.ID)
		if err != nil {
			service.log.Warn("claim pending restore failed", logger.Fields{
				"restore_id": restore.ID.String(),
				"error":      err.Error(),
			})
			continue
		}
		if !claimed {
			// Another instance took it between the listing and the claim.
			continue
		}

		service.runClaimedRestore(ctx, restore.ID, restore.ProjectID, restore.BackupID)
		resumed++
	}
	return resumed, nil
}

// executeRestore claims and runs one queued restore in the background.
func (service *Service) executeRestore(ctx context.Context, restoreID, projectID, backupID uuid.UUID) {
	claimed, err := service.projects.MarkRestoreRunning(ctx, restoreID)
	if err != nil {
		service.log.Error("claim restore failed", logger.Fields{
			"restore_id": restoreID.String(),
			"error":      err.Error(),
		})
		return
	}
	if !claimed {
		// The row is no longer pending: another worker has it, or it was
		// closed out. Either way this caller must not run it.
		return
	}

	service.runClaimedRestore(ctx, restoreID, projectID, backupID)
}

// runClaimedRestore performs a restore whose row has already been marked
// running, and records its outcome.
func (service *Service) runClaimedRestore(ctx context.Context, restoreID, projectID, backupID uuid.UUID) {
	restoreCtx, cancel := context.WithTimeout(ctx, service.cfg.Timeout)
	defer cancel()

	restoreErr := service.RestoreProject(restoreCtx, projectID, backupID)

	var errText *string
	if restoreErr != nil {
		message := restoreErr.Error()
		errText = &message
	}

	// Record on a detached context: a restore that failed because it timed out
	// must still record why, or the row would sit running forever and block the
	// project from being restored again.
	recordCtx, recordCancel := context.WithTimeout(context.WithoutCancel(ctx), 5*time.Second)
	defer recordCancel()
	if err := service.projects.MarkRestoreFinished(recordCtx, restoreID, errText); err != nil {
		service.log.Error("record restore outcome failed", logger.Fields{
			"restore_id": restoreID.String(),
			"error":      err.Error(),
		})
	}

	if restoreErr != nil {
		service.log.Warn("restore failed", logger.Fields{
			"project_id": projectID.String(),
			"restore_id": restoreID.String(),
			"error":      restoreErr.Error(),
		})
		return
	}
	service.log.Info("restore finished", logger.Fields{
		"project_id": projectID.String(),
		"restore_id": restoreID.String(),
	})
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
// when it is the newest regular backup, the latest pointer that mirrors it.
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

	// The latest pointer mirrors the newest non-pre-restore backup. When that is
	// the one being deleted, the pointer is removed too, so the owner's data
	// does not linger under a key the list never showed them. A lookup failure
	// is logged and stepped over: the backup the owner asked to delete is
	// already gone, and leaving the pointer is recoverable while failing the
	// request would make the delete look unsuccessful.
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

	service.snapshots[backupID] = snapshotEntry{path: path, project: projectID, lastUsed: time.Now()}
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

// clearProjectSnapshots removes every cached backup copy belonging to one
// project, for a project being deleted. Scoping the sweep to the project means
// deleting one project does not force every other project's viewer to download
// its snapshot again.
func (service *Service) clearProjectSnapshots(projectID uuid.UUID) {
	service.snapshotMu.Lock()
	defer service.snapshotMu.Unlock()

	for backupID, entry := range service.snapshots {
		if entry.project != projectID {
			continue
		}
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
	service.clearProjectSnapshots(projectID)
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
	// A pruned backup must not stay readable from the viewer's cache: its object
	// and row are gone, so a cached copy would show data the list no longer has.
	for _, backupID := range removed {
		service.forgetSnapshot(backupID)
	}
	service.log.Info("pruned expired backups", logger.Fields{
		"project_id": projectID.String(),
		"count":      len(removed),
	})
}

// recordFailure stores why an attempt failed and drives the failure-streak
// metric and alert. The context is detached from the caller's so a timed-out
// backup still records its failure instead of losing it to the cancellation that
// caused it.
func (service *Service) recordFailure(ctx context.Context, projectID uuid.UUID, kind dbcontrol.BackupKind, cause error) {
	metrics.IncBackupAttempt(string(kind), "failure")

	recordCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), 5*time.Second)
	defer cancel()

	failures, err := service.projects.RecordBackupFailure(recordCtx, projectID, cause.Error())
	if err != nil {
		service.log.Error("record backup failure failed", logger.Fields{
			"project_id": projectID.String(),
			"error":      err.Error(),
		})
		return
	}

	metrics.SetBackupConsecutiveFailures(projectID.String(), failures)

	// Alert on the exact attempt that reaches the threshold, not on every later
	// one: a project that has been failing for a day should have produced one
	// alert, not one per tick.
	if service.alertAfter > 0 && failures == service.alertAfter {
		service.notifier.BackupFailing(recordCtx, projectID, failures, cause.Error())
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
// date. The other kinds can be taken several times a day — including twice in
// quick succession from two clicks of the same button — so they carry a
// timestamp with milliseconds. Second precision was not enough: two manual
// backups within the same second wrote to one key, so the second overwrote the
// first and both history rows pointed at the same object.
func (service *Service) objectKey(projectID uuid.UUID, kind dbcontrol.BackupKind, when time.Time) string {
	base := service.projectPrefix(projectID)
	stamp := when.UTC().Format("20060102T150405.000Z")

	switch kind {
	case dbcontrol.BackupDaily:
		return base + "daily/" + when.UTC().Format("2006-01-02") + ".sqlite"
	case dbcontrol.BackupManual:
		return base + "manual/" + stamp + ".sqlite"
	case dbcontrol.BackupPreRestore:
		return base + "pre-restore/" + stamp + ".sqlite"
	case dbcontrol.BackupInitial:
		return base + "initial/" + stamp + ".sqlite"
	default:
		return base + "other/" + stamp + ".sqlite"
	}
}

// projectPrefix is the key prefix shared by every object of one project,
// trailing slash included so it cannot match a sibling project whose id starts
// with the same digits.
func (service *Service) projectPrefix(projectID uuid.UUID) string {
	return service.cfg.Prefix + "/" + projectID.String() + "/"
}

// latestKey is the stable key for a project's newest regular backup.
//
// It names a small JSON pointer rather than a copy of the database. The suffix
// is .json so it cannot be mistaken for a restorable .sqlite file.
func (service *Service) latestKey(projectID uuid.UUID) string {
	return service.projectPrefix(projectID) + "latest.json"
}

// latestPointer is the document stored at latestKey. It names the newest regular
// backup so an operator has one stable key to read, without the storage cost of
// keeping a second full copy of the object it points at.
type latestPointer struct {
	ObjectKey string `json:"object_key"`
	SHA256    string `json:"sha256"`
	SizeBytes int64  `json:"size_bytes"`
	CreatedAt string `json:"created_at"`
}

// writeLatestPointer writes the small pointer document for a project's newest
// regular backup.
func (service *Service) writeLatestPointer(ctx context.Context, projectID uuid.UUID, objectKey, checksum string, size int64, createdAt time.Time) error {
	document, err := json.Marshal(latestPointer{
		ObjectKey: objectKey,
		SHA256:    checksum,
		SizeBytes: size,
		CreatedAt: createdAt.UTC().Format(time.RFC3339),
	})
	if err != nil {
		return fmt.Errorf("encode latest pointer: %w", err)
	}
	return service.putBytes(ctx, service.latestKey(projectID), document, "application/json")
}

// projectMetadataKey returns the key for the project metadata JSON file.
func (service *Service) projectMetadataKey(projectID uuid.UUID) string {
	return service.projectPrefix(projectID) + "project.json"
}

// projectMetadata is a small document describing the project for human readability
// when browsing the R2 bucket directly.
type projectMetadata struct {
	ProjectID    string `json:"project_id"`
	ProjectName  string `json:"project_name"`
	OwnerEmail   string `json:"owner_email"`
	DatabaseFile string `json:"database_file"`
	CreatedAt    string `json:"created_at"`
}

// writeProjectMetadata writes the project metadata document.
func (service *Service) writeProjectMetadata(ctx context.Context, projectID uuid.UUID) error {
	project, err := service.projects.ProjectByID(ctx, projectID)
	if err != nil {
		// Project not found is not a fatal error for backup; we just skip metadata.
		if errors.Is(err, dbcontrol.ErrNotFound) {
			return nil
		}
		return fmt.Errorf("load project for metadata: %w", err)
	}

	user, err := service.projects.UserByID(ctx, project.UserID)
	if err != nil {
		if errors.Is(err, dbcontrol.ErrNotFound) {
			return nil
		}
		return fmt.Errorf("load user for metadata: %w", err)
	}

	meta := projectMetadata{
		ProjectID:    project.ID.String(),
		ProjectName:  project.Name,
		OwnerEmail:   user.Email,
		DatabaseFile: projectID.String() + ".db",
		CreatedAt:    project.CreatedAt.UTC().Format(time.RFC3339),
	}

	document, err := json.Marshal(meta)
	if err != nil {
		return fmt.Errorf("encode project metadata: %w", err)
	}
	return service.putBytes(ctx, service.projectMetadataKey(projectID), document, "application/json")
}

// putBytes uploads an in-memory object, signing its own length and hash.
func (service *Service) putBytes(ctx context.Context, key string, data []byte, contentType string) error {
	sum := sha256.Sum256(data)
	if err := service.objects.PutObject(ctx, key, bytes.NewReader(data), int64(len(data)), hex.EncodeToString(sum[:]), contentType); err != nil {
		return fmt.Errorf("upload %s: %w", key, err)
	}
	return nil
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
