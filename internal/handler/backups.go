package handler

import (
	"context"
	"errors"
	"io"
	"net/http"
	"strconv"
	"time"

	"github.com/google/uuid"

	"github.com/moogodev/moogodev/internal/backup"
	"github.com/moogodev/moogodev/internal/dbcontrol"
	"github.com/moogodev/moogodev/internal/dbplane"
	"github.com/moogodev/moogodev/internal/storage"
	"github.com/moogodev/moogodev/pkg/httpx"
	"github.com/moogodev/moogodev/pkg/logger"
	"github.com/moogodev/moogodev/pkg/sanitizer"
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
		response.Backups = append(response.Backups, describeBackup(&backups[index]))
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

// GetBackup handles GET /api/projects/{project_id}/backups/{backup_id}.
//
// The viewer is a page of its own that opens in a new tab, so it cannot rely on
// the list it was opened from. This returns the one entry it needs to name the
// snapshot it is showing.
func (handler *ControlPlane) GetBackup(w http.ResponseWriter, r *http.Request) {
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

	stored, err := handler.backups.GetBackup(r.Context(), project.ID, backupID)
	if err != nil {
		handler.writeBackupError(w, r, err, "read backup")
		return
	}

	httpx.WriteJSON(w, http.StatusOK, describeBackup(stored))
}

// DownloadBackup handles GET /api/projects/{project_id}/backups/{backup_id}/download.
//
// It streams the stored object as a file so the owner can keep a copy. Like the
// live-database download beside it, a paused project is allowed: a backup is a
// read, and reading one is exactly what a broken project's owner needs to do.
func (handler *ControlPlane) DownloadBackup(w http.ResponseWriter, r *http.Request) {
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

	body, stored, err := handler.backups.DownloadBackup(r.Context(), project.ID, backupID)
	if err != nil {
		handler.writeBackupError(w, r, err, "download backup")
		return
	}
	defer body.Close()

	// Content-Length comes from the recorded size, so a browser can show a real
	// progress bar. The body is a copy that was verified against that size and
	// checksum before this point, so the length is exact. The header is already
	// sent by the time the copy runs, so a failure now — a client that hung up
	// mid-download — cannot become a different status and is logged instead.
	w.Header().Set("Content-Type", "application/vnd.sqlite3")
	w.Header().Set("Content-Disposition", contentDisposition(snapshotFilename(project.Name, stored)))
	w.Header().Set("Cache-Control", "private, no-store")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	if stored.SizeBytes > 0 {
		w.Header().Set("Content-Length", strconv.FormatInt(stored.SizeBytes, 10))
	}

	if _, err := io.Copy(w, body); err != nil {
		handler.log.Warn("backup download interrupted", logger.Fields{
			"project_id": project.ID.String(),
			"backup_id":  backupID.String(),
			"error":      err.Error(),
		})
	}
}

// DeleteBackup handles DELETE /api/projects/{project_id}/backups/{backup_id}.
//
// Deleting a backup is destructive and unrecoverable, so the dashboard asks for
// confirmation first; the server does not need to, because the request itself
// is the owner's explicit decision about a copy they can still see in the list.
func (handler *ControlPlane) DeleteBackup(w http.ResponseWriter, r *http.Request) {
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

	if err := handler.backups.DeleteBackup(r.Context(), project.ID, backupID); err != nil {
		handler.writeBackupError(w, r, err, "delete backup")
		return
	}

	httpx.NoContent(w)
}

// QueryBackup handles POST /api/projects/{project_id}/backups/{backup_id}/query.
//
// This is the viewer's read path: the same shape as the console's /query, run
// against a downloaded copy of a backup instead of the live database. It is
// read-only by construction -- the statement is checked here and the file is
// opened query_only -- so a viewer can never edit a backup, which would be a
// meaningless edit to a snapshot anyway.
//
// A paused project is allowed, because the snapshot is a file rather than the
// live database and viewing it must keep working when the live one does not.
func (handler *ControlPlane) QueryBackup(w http.ResponseWriter, r *http.Request) {
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

	var request SQLRequest
	if err := decodeJSON(w, r, &request); err != nil {
		return
	}

	if err := sanitizer.Validate(request.Query); err != nil {
		writeSanitizerError(w, err)
		return
	}

	if !isReadStatement(request.Query) {
		httpx.WriteError(w, http.StatusBadRequest, "not_a_read",
			"a backup can only be read; use /query with a read statement")
		return
	}

	path, err := handler.backups.SnapshotPath(r.Context(), project.ID, backupID)
	if err != nil {
		handler.writeBackupError(w, r, err, "open backup")
		return
	}

	started := now()
	result, err := handler.databases.QuerySnapshot(r.Context(), path, request.Query, request.Args, 0)
	if err != nil && errors.Is(err, dbplane.ErrNotFound) {
		// The cached copy was evicted between being handed to us and being
		// opened, which the viewer's least-recently-used cache can do when
		// several backups are looked at at once. Fetch it again and run the
		// statement once more; a second miss is a real absence, not a race.
		if fresh, retryErr := handler.backups.SnapshotPath(r.Context(), project.ID, backupID); retryErr == nil {
			result, err = handler.databases.QuerySnapshot(r.Context(), fresh, request.Query, request.Args, 0)
		}
	}
	if err != nil {
		// A backup that cannot be opened or read is a backup problem, with the
		// same 404/422 the rest of the backup routes give. Anything else is the
		// statement itself failing, which belongs in the data plane's mapping
		// and activity log so it reads like the same statement on a live
		// database.
		if errors.Is(err, dbplane.ErrNotFound) || errors.Is(err, dbplane.ErrInvalidSnapshot) ||
			errors.Is(err, backup.ErrBackupCorrupt) || errors.Is(err, dbcontrol.ErrNotFound) {
			handler.writeBackupError(w, r, err, "backup query")
			return
		}
		handler.sql.writeDataPlaneError(w, r, project.ID, err, "backup query")
		return
	}

	httpx.WriteJSON(w, http.StatusOK, QueryResponse{
		Success:    true,
		Columns:    result.Columns,
		Rows:       result.Rows,
		RowCount:   len(result.Rows),
		Truncated:  result.Truncated,
		DurationMs: elapsedMs(started),
	})
}

// describeBackup projects a stored backup onto the wire shape.
func describeBackup(stored *dbcontrol.DatabaseBackup) BackupResponse {
	return BackupResponse{
		ID:        stored.ID,
		Kind:      string(stored.Kind),
		SizeBytes: stored.SizeBytes,
		SHA256:    stored.SHA256,
		CreatedAt: stored.CreatedAt,
	}
}

// snapshotFilename builds the download name for one backup: the project name,
// the reason it exists and its date.
//
// The project name is slugged rather than passed through because it lands in a
// response header; see backupFilename for the same reasoning.
func snapshotFilename(projectName string, stored *dbcontrol.DatabaseBackup) string {
	slug := slugifyProjectName(projectName)
	if slug == "" {
		slug = "project"
	}
	return slug + "_" + string(stored.Kind) + "_" + stored.CreatedAt.Format("02_01_2006") + ".sqlite"
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
//
// A missing object is a 404, not a 500. The row can outlive its object when a
// prune removed the bytes but not the row, or when the metadata and the bucket
// have drifted apart, and that is a thing the caller can see and act on.
func (handler *ControlPlane) writeBackupError(w http.ResponseWriter, r *http.Request, err error, action string) {
	switch {
	case errors.Is(err, dbcontrol.ErrNotFound), errors.Is(err, dbplane.ErrNotFound),
		errors.Is(err, storage.ErrObjectNotFound):
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
