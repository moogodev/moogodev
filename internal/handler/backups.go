package handler

import (
	"context"
	"errors"
	"net/http"
	"time"

	"github.com/google/uuid"

	"github.com/moogodev/moogodev/internal/backup"
	"github.com/moogodev/moogodev/internal/dbcontrol"
	"github.com/moogodev/moogodev/internal/dbplane"
	"github.com/moogodev/moogodev/pkg/httpx"
	"github.com/moogodev/moogodev/pkg/logger"
)

// BackupResponse is one entry the dashboard lists and can restore from.
//
// The object key is deliberately absent: it is an internal detail of the
// bucket layout and the client identifies a backup by its id.
type BackupResponse struct {
	ID        uuid.UUID `json:"id"`
	Kind      string    `json:"kind"`
	SizeBytes int64     `json:"size_bytes"`
	SHA256    string    `json:"sha256"`
	CreatedAt time.Time `json:"created_at"`
}

// BackupStateResponse summarizes the scheduler's position for a project.
type BackupStateResponse struct {
	// LastSuccessAt is nil until the first backup succeeds.
	LastSuccessAt *time.Time `json:"last_success_at"`
	LastSizeBytes int64      `json:"last_size_bytes"`
	// ConsecutiveFailures and LastError make a project that keeps failing
	// visible instead of silently missing from the list.
	ConsecutiveFailures int     `json:"consecutive_failures"`
	LastError           *string `json:"last_error"`
}

// BackupsResponse is the list endpoint's body.
type BackupsResponse struct {
	// Enabled is false when the server has no backup storage configured. The
	// list is then empty and the dashboard hides the actions rather than
	// offering buttons that always fail.
	Enabled bool                `json:"enabled"`
	Backups []BackupResponse    `json:"backups"`
	State   BackupStateResponse `json:"state"`
}

// ListBackups handles GET /api/projects/{project_id}/backups.
func (handler *ControlPlane) ListBackups(w http.ResponseWriter, r *http.Request) {
	project, ok := handler.ownedProject(w, r)
	if !ok {
		return
	}

	response := BackupsResponse{Backups: []BackupResponse{}}

	if handler.backups == nil {
		httpx.WriteJSON(w, http.StatusOK, response)
		return
	}

	limit, _ := pagination(r)
	if limit > maxActivityLimit {
		limit = maxActivityLimit
	}

	backups, state, err := handler.backups.ListBackups(r.Context(), project.ID, limit)
	if err != nil {
		handler.writeStoreError(w, r, err, "list backups")
		return
	}

	response.Enabled = true
	for index := range backups {
		response.Backups = append(response.Backups, BackupResponse{
			ID:        backups[index].ID,
			Kind:      string(backups[index].Kind),
			SizeBytes: backups[index].SizeBytes,
			SHA256:    backups[index].SHA256,
			CreatedAt: backups[index].CreatedAt,
		})
	}
	if state != nil {
		response.State = BackupStateResponse{
			LastSuccessAt:       state.LastSuccessAt,
			LastSizeBytes:       state.LastSizeBytes,
			ConsecutiveFailures: state.ConsecutiveFailures,
			LastError:           state.LastError,
		}
	}

	httpx.WriteJSON(w, http.StatusOK, response)
}

// CreateBackup handles POST /api/projects/{project_id}/backups.
//
// The backup runs while the request is open rather than in a detached
// goroutine. It is a destructive-adjacent, user-initiated action whose result
// the dashboard should report, and an aborted request aborts the backup safely:
// the snapshot is staged in a temp file and the history row is written only
// after the upload succeeds, so a cancelled attempt leaves nothing behind.
func (handler *ControlPlane) CreateBackup(w http.ResponseWriter, r *http.Request) {
	project, ok := handler.ownedProject(w, r)
	if !ok {
		return
	}

	if handler.backups == nil {
		handler.writeBackupsDisabled(w)
		return
	}

	if _, err := handler.backups.BackupProject(r.Context(), project.ID, dbcontrol.BackupManual); err != nil {
		handler.writeBackupError(w, r, err, "manual backup")
		return
	}

	httpx.WriteJSON(w, http.StatusCreated, map[string]any{
		"success": true,
		"message": "Backup completed.",
	})
}

// RestoreBackup handles POST /api/projects/{project_id}/backups/{backup_id}/restore.
//
// It replaces the live database with the chosen snapshot and is therefore
// destructive. The service takes a pre-restore snapshot first and verifies the
// downloaded object against its recorded checksum, so the only ways this can
// fail leave the live database untouched.
func (handler *ControlPlane) RestoreBackup(w http.ResponseWriter, r *http.Request) {
	project, ok := handler.ownedProject(w, r)
	if !ok {
		return
	}

	if handler.backups == nil {
		handler.writeBackupsDisabled(w)
		return
	}

	backupID, err := uuidParam(r, "backup_id")
	if err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid_backup_id",
			"the backup id is missing or malformed")
		return
	}

	if err := handler.backups.RestoreProject(r.Context(), project.ID, backupID); err != nil {
		handler.writeBackupError(w, r, err, "restore backup")
		return
	}

	httpx.WriteJSON(w, http.StatusOK, map[string]any{
		"success": true,
		"message": "Database restored. A pre-restore backup was saved first.",
	})
}

// scheduleInitialBackup takes the first backup of a brand-new project without
// holding up the response.
//
// It runs in the background: the project already exists and is usable, so
// making the owner wait on an upload would trade their time for a convenience.
// The context is detached from the request so the backup is not cancelled the
// moment the response is written, but it keeps the request's values and gets
// its own timeout.
func (handler *ControlPlane) scheduleInitialBackup(ctx context.Context, projectID uuid.UUID) {
	if handler.backups == nil {
		return
	}

	base := context.WithoutCancel(ctx)
	go func() {
		ctx, cancel := context.WithTimeout(base, handler.cfg.BackupTimeout)
		defer cancel()

		if _, err := handler.backups.BackupProject(ctx, projectID, dbcontrol.BackupInitial); err != nil {
			handler.log.Warn("initial backup failed", logger.Fields{
				"project_id": projectID.String(),
				"error":      err.Error(),
			})
		}
	}()
}

// writeBackupsDisabled answers a mutating call when no backup storage exists.
func (handler *ControlPlane) writeBackupsDisabled(w http.ResponseWriter) {
	httpx.WriteError(w, http.StatusServiceUnavailable, "backups_disabled",
		"database backups are not enabled on this server")
}

// writeBackupError maps a backup or restore failure onto a response.
//
// The corrupt-snapshot case is a 422 rather than a 500: the file exists but is
// not usable, and the client can act on that by choosing another backup. The
// restore-in-progress case is a 409 so a retry is the obvious next step.
func (handler *ControlPlane) writeBackupError(w http.ResponseWriter, r *http.Request, err error, action string) {
	switch {
	case errors.Is(err, dbcontrol.ErrNotFound):
		httpx.WriteError(w, http.StatusNotFound, "backup_not_found", "no such backup")
	case errors.Is(err, backup.ErrBackupCorrupt), errors.Is(err, dbplane.ErrInvalidSnapshot):
		handler.log.Warn("backup unusable", logger.Fields{
			"action":  action,
			"path":    r.URL.Path,
			"error":   err.Error(),
			"user_id": userIDString(r),
		})
		httpx.WriteError(w, http.StatusUnprocessableEntity, "backup_unusable",
			"the stored backup could not be verified and was not used")
	case errors.Is(err, dbplane.ErrRestoring):
		httpx.WriteError(w, http.StatusConflict, "restore_in_progress",
			"a restore of this project is already running")
	default:
		handler.writeStoreError(w, r, err, action)
	}
}
