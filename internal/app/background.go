package app

import (
	"context"
	"time"

	"github.com/moogodev/moogodev/internal/dbcontrol"
	"github.com/moogodev/moogodev/internal/dbplane"
	"github.com/moogodev/moogodev/pkg/logger"
)

// Reconciler repairs projects whose Postgres row and SQLite file disagree.
//
// The window for that mismatch is real: a project is inserted as pending, then
// the file is created, then the status is set to ready. A crash in between
// leaves a row pointing at nothing, or a file nobody has registered. Without a
// repair pass the user is stuck on a project that cannot be used and cannot be
// fixed from the dashboard.
type Reconciler struct {
	store     *dbcontrol.Store
	databases *dbplane.Manager
	log       *logger.Logger
	// batchLimit caps how much work one pass does, so a large backlog does not
	// hold the loop for minutes.
	batchLimit int
	// retryInterval is how long a failed project is left alone before another
	// attempt. Without it, a permanently broken project is retried on every pass.
	retryInterval time.Duration
}

// NewReconciler creates a Reconciler.
func NewReconciler(
	store *dbcontrol.Store,
	databases *dbplane.Manager,
	log *logger.Logger,
) *Reconciler {
	return &Reconciler{
		store:         store,
		databases:     databases,
		log:           log,
		batchLimit:    50,
		retryInterval: time.Minute,
	}
}

// RunOnce performs one reconciliation pass.
func (reconciler *Reconciler) RunOnce(ctx context.Context) {
	projects, err := reconciler.store.ProjectsNeedingReconcile(ctx, reconciler.batchLimit)
	if err != nil {
		// A failed pass is not fatal. The next tick tries again, and logging is
		// enough: there is nobody to show an error to.
		reconciler.log.Error("reconcile query failed", logger.Fields{"error": err.Error()})
		return
	}

	for index := range projects {
		project := projects[index]

		// A project that failed moments ago is not retried immediately, or a
		// permanently broken disk would be retried on every pass forever.
		if time.Since(project.UpdatedAt) < reconciler.retryInterval {
			continue
		}

		if err := reconciler.databases.InitializeProject(ctx, project.ID); err != nil {
			reconciler.log.Warn("project could not be repaired", logger.Fields{
				"project_id": project.ID.String(),
				"status":     string(project.Status),
				"error":      err.Error(),
			})
			continue
		}

		if err := reconciler.store.MarkProjectReady(ctx, project.ID); err != nil {
			reconciler.log.Error("project status not updated", logger.Fields{
				"project_id": project.ID.String(),
				"error":      err.Error(),
			})
			continue
		}

		reconciler.log.Info("project reconciled", logger.Fields{
			"project_id": project.ID.String(),
			"was":        string(project.Status),
		})
	}
}

// backupRunner is the slice of the backup service the scheduler drives.
//
// It is an interface rather than the concrete *backup.Service so the scheduler
// can be built in a test without object storage, and so the scheduler does not
// grow a dependency on the backup package's configuration.
type backupRunner interface {
	// Interval is how often the backup loop should run.
	Interval() time.Duration
	// RunOnce backs up the projects that are due.
	RunOnce(ctx context.Context) (int, error)
	// VerifyInterval is how often the restore drill should run.
	VerifyInterval() time.Duration
	// VerifyDue proves the newest backups that have not been checked recently.
	VerifyDue(ctx context.Context, limit int) (int, error)
	// ResumePendingRestores picks up restores left queued by a restart.
	ResumePendingRestores(ctx context.Context, limit int) (int, error)
}

// Scheduler runs the periodic maintenance jobs.
type Scheduler struct {
	store      *dbcontrol.Store
	reconciler *Reconciler
	// backup is nil when off-site backups are not configured.
	backup backupRunner
	log    *logger.Logger

	interval          time.Duration
	activityRetention time.Duration
}

// NewScheduler creates a Scheduler.
//
// backup may be nil, in which case the backup loop is skipped entirely.
func NewScheduler(
	store *dbcontrol.Store,
	reconciler *Reconciler,
	backup backupRunner,
	log *logger.Logger,
	activityRetention time.Duration,
) *Scheduler {
	return &Scheduler{
		store:             store,
		reconciler:        reconciler,
		backup:            backup,
		log:               log,
		interval:          time.Minute,
		activityRetention: activityRetention,
	}
}

// Run drives the scheduler until the context is cancelled.
//
// The first pass happens immediately rather than after one interval, so a
// process that was restarted into a broken state repairs it immediately rather
// than a minute later.
func (scheduler *Scheduler) Run(ctx context.Context) {
	reconciler := time.NewTicker(scheduler.interval)
	defer reconciler.Stop()

	activity := time.NewTicker(scheduler.activityInterval())
	defer activity.Stop()

	// A nil channel blocks forever, so when backups are disabled the case
	// simply never fires.
	var backupTick <-chan time.Time
	if scheduler.backup != nil {
		ticker := time.NewTicker(scheduler.backup.Interval())
		defer ticker.Stop()
		backupTick = ticker.C
	}

	// The drill runs on its own, longer clock. A nil channel blocks forever, so
	// it is skipped when backups are disabled.
	var verifyTick <-chan time.Time
	if scheduler.backup != nil {
		ticker := time.NewTicker(scheduler.backup.VerifyInterval())
		defer ticker.Stop()
		verifyTick = ticker.C
	}

	scheduler.runOnce(ctx)

	for {
		select {
		case <-ctx.Done():
			return
		case <-reconciler.C:
			scheduler.reconciler.RunOnce(ctx)
		case <-activity.C:
			scheduler.pruneActivity(ctx)
		case <-backupTick:
			scheduler.runBackup(ctx)
		case <-verifyTick:
			scheduler.runVerification(ctx)
		}
	}
}

// activityInterval returns how often the activity log is pruned.
func (scheduler *Scheduler) activityInterval() time.Duration {
	// Pruning hourly is enough for a seven-day retention window, and it keeps
	// the write cost off the database at times when requests are dense.
	return time.Hour
}

// runOnce performs the startup pass.
func (scheduler *Scheduler) runOnce(ctx context.Context) {
	scheduler.reconciler.RunOnce(ctx)
	scheduler.pruneActivity(ctx)
	scheduler.runBackup(ctx)
	scheduler.runVerification(ctx)
	scheduler.resumeRestores(ctx)
}

// resumeRestores picks up restores that a previous process left queued, so a
// restart does not strand a project mid-restore.
func (scheduler *Scheduler) resumeRestores(ctx context.Context) {
	if scheduler.backup == nil {
		return
	}
	resumed, err := scheduler.backup.ResumePendingRestores(ctx, 0)
	if err != nil && ctx.Err() == nil {
		scheduler.log.Warn("resume pending restores failed", logger.Fields{"error": err.Error()})
		return
	}
	if resumed > 0 {
		scheduler.log.Info("resumed queued restores", logger.Fields{"restores": resumed})
	}
}

// runBackup performs one backup pass, if backups are configured.
func (scheduler *Scheduler) runBackup(ctx context.Context) {
	if scheduler.backup == nil {
		return
	}
	if _, err := scheduler.backup.RunOnce(ctx); err != nil && ctx.Err() == nil {
		scheduler.log.Warn("backup pass failed", logger.Fields{"error": err.Error()})
	}
}

// runVerification performs one restore-drill pass, if backups are configured.
//
// The limit is left to the service's own batch cap: the scheduler deliberately
// does not carry the backup package's configuration.
func (scheduler *Scheduler) runVerification(ctx context.Context) {
	if scheduler.backup == nil {
		return
	}
	checked, err := scheduler.backup.VerifyDue(ctx, 0)
	if err != nil && ctx.Err() == nil {
		scheduler.log.Warn("backup verification pass failed", logger.Fields{"error": err.Error()})
		return
	}
	if checked > 0 {
		scheduler.log.Info("backup verification pass finished", logger.Fields{"projects": checked})
	}
}

// pruneActivity deletes audit rows past the retention window.
func (scheduler *Scheduler) pruneActivity(ctx context.Context) {
	deleted, err := scheduler.store.PruneActivity(ctx, scheduler.activityRetention)
	if err != nil {
		scheduler.log.Warn("activity prune failed", logger.Fields{"error": err.Error()})
		return
	}

	if deleted > 0 {
		scheduler.log.Info("activity pruned", logger.Fields{"deleted": deleted})
	}
}
