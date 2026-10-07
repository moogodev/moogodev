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

// Scheduler runs the periodic maintenance jobs.
type Scheduler struct {
	store      *dbcontrol.Store
	reconciler *Reconciler
	log        *logger.Logger

	interval          time.Duration
	activityRetention time.Duration
}

// NewScheduler creates a Scheduler.
func NewScheduler(
	store *dbcontrol.Store,
	reconciler *Reconciler,
	log *logger.Logger,
	activityRetention time.Duration,
) *Scheduler {
	return &Scheduler{
		store:             store,
		reconciler:        reconciler,
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

	scheduler.runOnce(ctx)

	for {
		select {
		case <-ctx.Done():
			return
		case <-reconciler.C:
			scheduler.reconciler.RunOnce(ctx)
		case <-activity.C:
			scheduler.pruneActivity(ctx)
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
