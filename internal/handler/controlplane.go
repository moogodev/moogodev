package handler

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/moogo/moogo/internal/auth"
	"github.com/moogo/moogo/internal/config"
	"github.com/moogo/moogo/internal/dbcontrol"
	"github.com/moogo/moogo/pkg/bucketkey"
	"github.com/moogo/moogo/pkg/httpx"
	"github.com/moogo/moogo/pkg/logger"
	"github.com/moogo/moogo/pkg/secretkey"
)

// Store is the control plane operations these handlers need.
//
// It is an interface so the handlers can be tested without a live Postgres,
// and so the data plane remains the only thing that touches SQLite files.
type Store interface {
	// UpsertUserByEmail receives the quota defaults so a brand-new user is
	// created with its limits already set. Passing them in keeps billing out of
	// the handler: the values come from configuration here and from the billing
	// system later, through the same call.
	UpsertUserByEmail(
		ctx context.Context,
		email string,
		name string,
		avatarURL string,
		maxProjects int,
		maxDBBytes int64,
		maxStorageBytes int64,
	) (*dbcontrol.User, error)
	UserByID(ctx context.Context, userID uuid.UUID) (*dbcontrol.User, error)

// SetPasswordHash replaces the bcrypt hash on a password account.
//
// The comparison is made by the handler against the hash it already read, so
// this write carries no old-password argument: the handler is the only caller
// and it has already refused everything it should refuse.
SetPasswordHash(ctx context.Context, userID uuid.UUID, passwordHash string) error

// UpdateUserName changes the display name. The name is cosmetic and is
	// never used to authenticate, so the handler lets it change freely.
	UpdateUserName(ctx context.Context, userID uuid.UUID, name string) error
	CreateProject(ctx context.Context, userID uuid.UUID, name string, key secretkey.Generated) (*dbcontrol.CreateProjectResult, error)
	MarkProjectReady(ctx context.Context, projectID uuid.UUID) error
	MarkProjectFailed(ctx context.Context, projectID uuid.UUID, reason string) error
	ListProjects(ctx context.Context, userID uuid.UUID, limit int, offset int) ([]dbcontrol.Project, error)
	ProjectOwnedBy(ctx context.Context, projectID uuid.UUID, userID uuid.UUID) (*dbcontrol.Project, error)
	RotateSecretKey(ctx context.Context, projectID uuid.UUID) (string, error)
	PauseProject(ctx context.Context, projectID uuid.UUID) error
	ResumeProject(ctx context.Context, projectID uuid.UUID) error
	SoftDeleteProject(ctx context.Context, projectID uuid.UUID, userID uuid.UUID) error
	ListActivity(ctx context.Context, projectID uuid.UUID, limit int) ([]dbcontrol.ActivityEntry, error)
	ListBuckets(ctx context.Context, projectID uuid.UUID) ([]dbcontrol.Bucket, error)
	CreateBucket(ctx context.Context, projectID uuid.UUID, name string) (*dbcontrol.Bucket, error)

	// StorageUsedBytes totals the object storage held by one project. The
	// bucket quota is per project rather than per bucket, so this counts the
	// whole project as a single pool.
	StorageUsedBytes(ctx context.Context, projectID uuid.UUID) (int64, error)

	// Storage credentials authorize object storage, separately from the SQL
	// secret key.
	StorageCredentials(ctx context.Context, projectID uuid.UUID) ([]dbcontrol.StorageCredential, error)
	CreateStorageCredential(
		ctx context.Context,
		projectID uuid.UUID,
		label string,
		key bucketkey.Generated,
	) (*dbcontrol.StorageCredential, error)
	RotateStorageCredentialSecret(
		ctx context.Context,
		projectID uuid.UUID,
		credentialID uuid.UUID,
		key bucketkey.Generated,
	) (*dbcontrol.StorageCredential, error)
	RevokeStorageCredential(ctx context.Context, projectID uuid.UUID, credentialID uuid.UUID) error
}

// Databases is the data plane surface the control plane handlers need.
//
// Engine is embedded because the dashboard console runs SQL against the
// project's own database. In production both halves are satisfied by the same
// *dbplane.Manager.
type Databases interface {
	Engine
	InitializeProject(ctx context.Context, projectID uuid.UUID) error
	RemoveProject(projectID uuid.UUID) error
	DatabaseSize(ctx context.Context, projectID uuid.UUID) (int64, error)
	// BackupDatabase writes a consistent snapshot to a new file and returns its
	// path. The caller owns the file and must remove it.
	BackupDatabase(ctx context.Context, projectID uuid.UUID) (string, error)
}

// ControlPlane serves the dashboard-facing API.
type ControlPlane struct {
	store     Store
	databases Databases
	sql       sqlRunner
	cfg       config.Config
	log       *logger.Logger
}

// NewControlPlane creates a ControlPlane handler.
func NewControlPlane(store Store, databases Databases, cfg config.Config, log *logger.Logger) *ControlPlane {
	return &ControlPlane{
		store:     store,
		databases: databases,
		sql:       sqlRunner{databases: databases, log: log},
		cfg:       cfg,
		log:       log,
	}
}

// MeResponse describes the signed-in account.
type MeResponse struct {
	User dbcontrol.User `json:"user"`
	// Quotas are echoed so the dashboard does not have to hardcode them.
	MaxProjects int   `json:"max_projects"`
	MaxDBBytes  int64 `json:"max_db_bytes"`
	Usage       Usage `json:"usage"`

	// HasPassword reports whether this account has a password of its own.
	//
	// It exists so the settings page can offer a password change to the accounts
	// that have one and explain the alternative to the accounts that do not,
	// instead of guessing from the session. An account created through Google has
	// no password row here, because that credential lives at Google and Moogo
	// never sees it.
	HasPassword bool `json:"has_password"`

	// Plan is the billing plan on the account, read from the row rather than
	// hardcoded by the dashboard. It is 'free' for every account today, but the
	// page should show what the server says so the value cannot drift when a real
	// plan is added.
	Plan string `json:"plan"`
}

// defaultPlanName is the plan every account carries until billing exists. It is
// spelled out in one place so the API, the settings page copy, and any future
// billing code cannot disagree about what an unconfigured account is called.
const defaultPlanName = "free"

// ChangePasswordRequest is the body of POST /api/account/password.
type ChangePasswordRequest struct {
	// CurrentPassword is required. Re-authenticating is what stops a hijacked
	// session from turning into a permanent lockout: without it, anyone holding a
	// stolen cookie could set a password and lock the owner out of their own
	// account with no way back.
	CurrentPassword string `json:"current_password"`
	NewPassword     string `json:"new_password"`
}

// ChangePassword handles POST /api/account/password.
//
// An account with no password of its own is refused rather than given one. That
// is the Google case: the credential lives at Google, and setting a password here
// would create a second way in that Google does not know about and cannot revoke.
func (handler *ControlPlane) ChangePassword(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthorized", "sign in required")
		return
	}

	var request ChangePasswordRequest
	if err := decodeJSON(w, r, &request); err != nil {
		return
	}

	user, err := handler.store.UserByID(r.Context(), userID)
	if err != nil {
		handler.writeStoreError(w, r, err, "load account")
		return
	}

	if user.PasswordHash == "" {
		httpx.WriteError(w, http.StatusBadRequest, "password_managed_externally",
			"this account signs in through Google, so there is no Moogo password to change")
		return
	}

	// The same answer for a wrong current password and an unknown account: which
	// one it was would tell an attacker whether the address exists.
	if !auth.VerifyPassword(request.CurrentPassword, user.PasswordHash) {
		httpx.WriteError(w, http.StatusUnauthorized, "invalid_credentials",
			"your current password is not correct")
		return
	}

	if err := validatePassword(request.NewPassword); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid_password", err.Error())
		return
	}

	if request.CurrentPassword == request.NewPassword {
		// Not a failure, but nothing to do: bcrypt would happily re-hash the same
		// string and report success, and the user would be told they had changed a
		// password they had not.
		httpx.WriteError(w, http.StatusBadRequest, "password_unchanged",
			"the new password must be different from the current one")
		return
	}

	hash, err := auth.HashPassword(request.NewPassword)
	if err != nil {
		handler.log.Error("hash password", logger.Fields{"error": err.Error()})
		httpx.WriteError(w, http.StatusInternalServerError, "internal", "could not update the password")
		return
	}

	if err := handler.store.SetPasswordHash(r.Context(), userID, hash); err != nil {
		// The store enforces the same rule the check above does, so this is a race
		// rather than the normal path: the row lost its password between the read
		// and the write. It still deserves the right message, because a 500 would
		// tell a Google-only user their password is broken rather than that the
		// request does not apply to them.
		if errors.Is(err, dbcontrol.ErrPasswordNotSet) {
			httpx.WriteError(w, http.StatusBadRequest, "password_managed_externally",
				"this account signs in through Google, so there is no Moogo password to change")
			return
		}
		handler.log.Error("update password", logger.Fields{
			"error":   err.Error(),
			"user_id": userID.String(),
		})
		httpx.WriteError(w, http.StatusInternalServerError, "internal", "could not update the password")
		return
	}

	httpx.WriteJSON(w, http.StatusOK, map[string]any{
		"success": true,
		"message": "Password updated. Your other sessions stay signed in.",
	})
}

// UpdateProfileRequest is the body of PATCH /api/account/profile.
type UpdateProfileRequest struct {
	Name string `json:"name"`
}

// UpdateProfile handles PATCH /api/account/profile.
//
// The display name is cosmetic only and does not gate any capability, so no
// re-authentication is required.
func (handler *ControlPlane) UpdateProfile(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthorized", "sign in required")
		return
	}

	var request UpdateProfileRequest
	if err := decodeJSON(w, r, &request); err != nil {
		return
	}

	if err := handler.store.UpdateUserName(r.Context(), userID, request.Name); err != nil {
		handler.writeStoreError(w, r, err, "update profile")
		return
	}

	httpx.WriteJSON(w, http.StatusOK, map[string]any{
		"success": true,
		"message": "Profile updated.",
	})
}

// Usage reports current consumption against the limits.
type Usage struct {
	ProjectCount  int   `json:"project_count"`
	MaxProjects   int   `json:"max_projects"`
	DatabaseBytes int64 `json:"database_bytes"`
	MaxDBBytes    int64 `json:"max_db_bytes"`
}

// ProjectRequest is the body of project creation.
type ProjectRequest struct {
	Name string `json:"name"`
}

// ProjectResponse describes one project.
type ProjectResponse struct {
	ID              uuid.UUID `json:"id"`
	Name            string    `json:"name"`
	Status          string    `json:"status"`
	StatusDetail    *string   `json:"status_detail,omitempty"`
	SecretKeyPrefix string    `json:"secret_key_prefix"`
	// SecretKey is populated only by the create and rotate responses, and only
	// once. Afterwards only the prefix remains.
	SecretKey     string    `json:"secret_key,omitempty"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
	DatabaseBytes int64     `json:"database_bytes"`
	// StorageBytes is the object storage this project holds. Like
	// DatabaseBytes it is measured per project, because that is the unit the
	// two quotas are enforced in.
	StorageBytes int64 `json:"storage_bytes"`
}

// Me handles GET /api/me.
func (handler *ControlPlane) Me(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthorized", "sign in required")
		return
	}

	user, err := handler.store.UserByID(r.Context(), userID)
	if err != nil {
		handler.writeStoreError(w, r, err, "load account")
		return
	}

	projects, err := handler.store.ListProjects(r.Context(), userID, quotaProbeLimit, 0)
	if err != nil {
		handler.writeStoreError(w, r, err, "list projects")
		return
	}

	var databaseBytes int64
	for index := range projects {
		// A single unreadable file must not break the whole listing: the size
		// is informational, and the project row itself is what matters.
		size, err := handler.databases.DatabaseSize(r.Context(), projects[index].ID)
		if err != nil {
			handler.log.Warn("database size unavailable", logger.Fields{
				"project_id": projects[index].ID.String(),
				"error":      err.Error(),
			})
			continue
		}
		databaseBytes += size
	}

	httpx.WriteJSON(w, http.StatusOK, MeResponse{
		User:        *user,
		MaxProjects: user.QuotaMaxProjects,
		MaxDBBytes:  user.QuotaMaxDBBytes,
		HasPassword: user.PasswordHash != "",
		Plan:        planOf(user),
		Usage: Usage{
			ProjectCount:  len(projects),
			MaxProjects:   user.QuotaMaxProjects,
			DatabaseBytes: databaseBytes,
			MaxDBBytes:    user.QuotaMaxDBBytes,
		},
	})
}

// planOf is the account's plan as a single word for display.
//
// billing_plan is NOT NULL with a default, but a row written before the column
// existed in a database where the column was added without a default would read
// as empty, and an empty string rendered as a blank cell is worse than saying
// what every account actually has.
func planOf(user *dbcontrol.User) string {
	if user.BillingPlan == "" {
		return defaultPlanName
	}
	return user.BillingPlan
}

// ListProjects handles GET /api/projects.
func (handler *ControlPlane) ListProjects(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthorized", "sign in required")
		return
	}

	limit, offset := pagination(r)

	projects, err := handler.store.ListProjects(r.Context(), userID, limit, offset)
	if err != nil {
		handler.writeStoreError(w, r, err, "list projects")
		return
	}

	responses := make([]ProjectResponse, 0, len(projects))
	for index := range projects {
		responses = append(responses, handler.describe(r.Context(), &projects[index], ""))
	}

	httpx.WriteJSON(w, http.StatusOK, map[string]any{
		"projects": responses,
		"limit":    limit,
		"offset":   offset,
	})
}

// CreateProject handles POST /api/projects.
//
// Creation runs in two stages because the two stores cannot share a
// transaction: Postgres gets the project row, then the SQLite file is
// materialized, then the status is set to ready. A failure between the stages
// leaves a pending or failed row, which the dashboard can show and the user
// can retry, rather than a row pointing at a file that does not exist.
func (handler *ControlPlane) CreateProject(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthorized", "sign in required")
		return
	}

	var request ProjectRequest
	if err := decodeJSON(w, r, &request); err != nil {
		return
	}

	name := strings.TrimSpace(request.Name)
	if name == "" {
		httpx.WriteError(w, http.StatusBadRequest, "invalid_name", "a project name is required")
		return
	}
	if len(name) > maxProjectNameLength {
		httpx.WriteError(w, http.StatusBadRequest, "invalid_name", "the project name is too long")
		return
	}

	key, err := secretkey.Generate()
	if err != nil {
		handler.log.Error("generate secret key", logger.Fields{"error": err.Error()})
		httpx.WriteError(w, http.StatusInternalServerError, "key_error", "the project key could not be generated")
		return
	}

	result, err := handler.store.CreateProject(r.Context(), userID, name, key)
	if err != nil {
		handler.writeStoreError(w, r, err, "create project")
		return
	}

	if err := handler.databases.InitializeProject(r.Context(), result.Project.ID); err != nil {
		// The row exists, so it is marked failed rather than deleted: a retry
		// has something to attach to, and the owner can see what happened.
		handler.log.Error("materialize project database", logger.Fields{
			"project_id": result.Project.ID.String(),
			"error":      err.Error(),
		})
		_ = handler.store.MarkProjectFailed(r.Context(), result.Project.ID, "database could not be created")

		httpx.WriteErrorWithDetail(w, http.StatusInternalServerError, "database_error",
			"the project database could not be created", err.Error())
		return
	}

	if err := handler.store.MarkProjectReady(r.Context(), result.Project.ID); err != nil {
		// The file exists and works; only the status is stale. It is still
		// usable, so this is reported as a server error without destroying the
		// project, and the reconciler will fix the status.
		handler.log.Error("mark project ready", logger.Fields{
			"project_id": result.Project.ID.String(),
			"error":      err.Error(),
		})
		httpx.WriteError(w, http.StatusInternalServerError, "status_error",
			"the project was created but its status could not be confirmed")
		return
	}

	response := handler.describe(r.Context(), result.Project, result.SecretKeyPlaintext)
	response.Status = string(dbcontrol.ProjectReady)

	httpx.WriteJSON(w, http.StatusCreated, response)
}

// GetProject handles GET /api/projects/{project_id}.
func (handler *ControlPlane) GetProject(w http.ResponseWriter, r *http.Request) {
	project, ok := handler.ownedProject(w, r)
	if !ok {
		return
	}
	httpx.WriteJSON(w, http.StatusOK, handler.describe(r.Context(), project, ""))
}

// Query handles POST /api/projects/{project_id}/query.
//
// This is the dashboard console's route to a project's data, and it exists
// separately from the public /db/{project_id}/query on purpose. The console is
// not an external client: the caller is signed in and owns the project, so
// making them paste a project key would only prove they had once seen a secret
// the server deliberately shows a single time.
//
// Statement handling is shared with the data plane, so the console cannot drift
// into accepting something the public API rejects, or the other way round.
func (handler *ControlPlane) Query(w http.ResponseWriter, r *http.Request) {
	project, ok := handler.ownedQueryableProject(w, r)
	if !ok {
		return
	}

	handler.sql.query(w, r, project.ID)
}

// Exec handles POST /api/projects/{project_id}/exec.
//
// The dashboard writes through its own session rather than the project key, for
// the same reason Query does. Read and write rules are unchanged.
func (handler *ControlPlane) Exec(w http.ResponseWriter, r *http.Request) {
	project, ok := handler.ownedQueryableProject(w, r)
	if !ok {
		return
	}

	handler.sql.exec(w, r, project.ID)
}

// ownedQueryableProject resolves an owned project and refuses the ones the data
// plane would refuse too.
//
// Without this the console would keep working on a paused project, because the
// pause check lives in the key middleware that the console path does not go
// through. Same codes and messages as the data plane so the console reports the
// same reason a client would get.
func (handler *ControlPlane) ownedQueryableProject(w http.ResponseWriter, r *http.Request) (*dbcontrol.Project, bool) {
	project, ok := handler.ownedProject(w, r)
	if !ok {
		return nil, false
	}

	if project.Paused() {
		httpx.WriteError(w, http.StatusForbidden, "project_paused", "project is paused")
		return nil, false
	}

	if !project.Ready() {
		httpx.WriteError(w, http.StatusForbidden, "project_not_ready", "project is not ready yet")
		return nil, false
	}

	return project, true
}

// RotateKey handles POST /api/projects/{project_id}/rotate-key.
//
// The previous key stops working immediately. That is the point of rotation,
// so no grace period is offered.
func (handler *ControlPlane) RotateKey(w http.ResponseWriter, r *http.Request) {
	project, ok := handler.ownedProject(w, r)
	if !ok {
		return
	}

	plaintext, err := handler.store.RotateSecretKey(r.Context(), project.ID)
	if err != nil {
		handler.writeStoreError(w, r, err, "rotate key")
		return
	}

	httpx.WriteJSON(w, http.StatusOK, map[string]any{
		"project_id":        project.ID,
		"secret_key":        plaintext,
		"secret_key_prefix": secretkey.Prefix(plaintext),
	})
}

// PauseProject handles POST /api/projects/{project_id}/pause.
//
// Pausing is an explicit, manual action. An already-paused project is a no-op
// that returns 204 so the client can retry safely.
func (handler *ControlPlane) PauseProject(w http.ResponseWriter, r *http.Request) {
	project, ok := handler.ownedProject(w, r)
	if !ok {
		return
	}

	if project.Status == dbcontrol.ProjectPaused {
		httpx.NoContent(w)
		return
	}

	if err := handler.store.PauseProject(r.Context(), project.ID); err != nil {
		handler.writeStoreError(w, r, err, "pause project")
		return
	}

	project.Status = dbcontrol.ProjectPaused
	response := handler.describe(r.Context(), project, "")
	httpx.WriteJSON(w, http.StatusOK, response)
}

// ResumeProject handles POST /api/projects/{project_id}/resume.
//
// Resuming restores the project to ready. A project that is not paused is a
// no-op returns 204.
func (handler *ControlPlane) ResumeProject(w http.ResponseWriter, r *http.Request) {
	project, ok := handler.ownedProject(w, r)
	if !ok {
		return
	}

	if project.Status != dbcontrol.ProjectPaused {
		httpx.NoContent(w)
		return
	}

	if err := handler.store.ResumeProject(r.Context(), project.ID); err != nil {
		handler.writeStoreError(w, r, err, "resume project")
		return
	}

	project.Status = dbcontrol.ProjectReady
	httpx.WriteJSON(w, http.StatusOK, handler.describe(r.Context(), project, ""))
}

// DeleteProject handles DELETE /api/projects/{project_id}.
func (handler *ControlPlane) DeleteProject(w http.ResponseWriter, r *http.Request) {
	project, ok := handler.ownedProject(w, r)
	if !ok {
		return
	}

	if err := handler.store.SoftDeleteProject(r.Context(), project.ID, project.UserID); err != nil {
		handler.writeStoreError(w, r, err, "delete project")
		return
	}

	// The row is already soft-deleted, so a failure here leaves an orphaned
	// file rather than a live project with no data. The sweep job removes it.
	if err := handler.databases.RemoveProject(project.ID); err != nil {
		handler.log.Error("remove project files", logger.Fields{
			"project_id": project.ID.String(),
			"error":      err.Error(),
		})
	}

	httpx.NoContent(w)
}

// Activity handles GET /api/projects/{project_id}/activity.
// DownloadDatabase handles GET /api/projects/{project_id}/database-backup.
//
// It streams a consistent snapshot of the project's SQLite file so the owner can
// keep a copy outside Moogo.
//
// The project is resolved through ownedProject, which is the same ownership
// check every other dashboard route uses. Unlike the console, a paused project
// is allowed here on purpose: a backup is a read, and it is most needed exactly
// when something has gone wrong and the project may be paused because of it.
//
// The snapshot is written to a temp file by the data plane and removed here. It
// is not streamed straight from the live database, because a file served while
// writes are landing in it can arrive truncated.
func (handler *ControlPlane) DownloadDatabase(w http.ResponseWriter, r *http.Request) {
	project, ok := handler.ownedProject(w, r)
	if !ok {
		return
	}

	path, err := handler.databases.BackupDatabase(r.Context(), project.ID)
	if err != nil {
		handler.log.Error("database backup failed", logger.Fields{
			"project_id": project.ID.String(),
			"error":      err.Error(),
		})
		httpx.WriteErrorWithDetail(w, http.StatusInternalServerError, "backup_failed",
			"the database could not be backed up", "try again in a moment")
		return
	}
	defer os.RemoveAll(dirOf(path))

	file, err := os.Open(path)
	if err != nil {
		handler.writeStoreError(w, r, err, "open database backup")
		return
	}
	defer file.Close()

	// Content-Length is set from the snapshot rather than left to the chunked
	// encoder, so a browser can show a real progress bar on a large database.
	if info, statErr := file.Stat(); statErr == nil {
		w.Header().Set("Content-Length", strconv.FormatInt(info.Size(), 10))
	}
	w.Header().Set("Content-Type", "application/vnd.sqlite3")
	w.Header().Set("Content-Disposition", contentDisposition(backupFilename(project.Name)))
	// A backup is a point-in-time snapshot, so it must never be cached by a
	// proxy that would then hand the same stale copy to a later request.
	w.Header().Set("Cache-Control", "private, no-store")
	w.Header().Set("X-Content-Type-Options", "nosniff")

	if _, err := io.Copy(w, file); err != nil {
		// The status line is already sent by this point, so there is nothing
		// useful left to say to the client; the log is what matters.
		handler.log.Warn("database backup download interrupted", logger.Fields{
			"project_id": project.ID.String(),
			"error":      err.Error(),
		})
	}
}

// backupFilename builds the download name: the project name, the date, and a
// .sqlite extension.
//
// The name is slugged rather than passed through because it lands in a response
// header. A project name containing a quote or a newline would otherwise let the
// owner reshape the Content-Disposition value, and a newline in a header is a
// response-splitting primitive.
func backupFilename(projectName string) string {
	slug := slugifyProjectName(projectName)
	if slug == "" {
		slug = "project"
	}
	return slug + "_" + time.Now().Format("02_01_2006") + ".sqlite"
}

// slugifyProjectName reduces a project name to characters that are safe in a
// filename and in a quoted header value.
//
// Separators -- spaces, dashes, underscores, dots and slashes -- all collapse to
// a single underscore. The dot and the slash matter: dropping them instead
// would turn "../../etc/passwd" into "etcpasswd", which is both ugly and liable
// to collide with a project actually named "etcpasswd".
func slugifyProjectName(name string) string {
	const maxLength = 40
	var builder strings.Builder
	for _, char := range strings.ToLower(name) {
		switch {
		case char >= 'a' && char <= 'z', char >= '0' && char <= '9':
			builder.WriteRune(char)
		case char == ' ' || char == '-' || char == '_' || char == '.' || char == '/':
			if builder.Len() > 0 && !strings.HasSuffix(builder.String(), "_") {
				builder.WriteByte('_')
			}
		}
		if builder.Len() >= maxLength {
			break
		}
	}
	return strings.Trim(builder.String(), "_")
}

// contentDisposition builds the header, preferring the RFC 5987 form so a name
// outside ASCII still survives.
func contentDisposition(filename string) string {
	ascii := strings.Map(func(r rune) rune {
		if r < 0x20 || r > 0x7e {
			return -1
		}
		return r
	}, filename)
	return fmt.Sprintf(`attachment; filename="%s"; filename*=UTF-8''%s`,
		ascii, url.PathEscape(filename))
}

// dirOf returns the directory containing a path.
func dirOf(path string) string {
	index := strings.LastIndexAny(path, `/\`)
	if index < 0 {
		return "."
	}
	return path[:index]
}

func (handler *ControlPlane) Activity(w http.ResponseWriter, r *http.Request) {
	project, ok := handler.ownedProject(w, r)
	if !ok {
		return
	}

	limit, _ := pagination(r)
	if limit > maxActivityLimit {
		limit = maxActivityLimit
	}

	entries, err := handler.store.ListActivity(r.Context(), project.ID, limit)
	if err != nil {
		handler.writeStoreError(w, r, err, "list activity")
		return
	}

	httpx.WriteJSON(w, http.StatusOK, map[string]any{
		"activity": entries,
		"limit":    limit,
	})
}

// describe converts a project row into its API shape.
func (handler *ControlPlane) describe(
	ctx context.Context,
	project *dbcontrol.Project,
	secretKeyPlaintext string,
) ProjectResponse {
	response := ProjectResponse{
		ID:              project.ID,
		Name:            project.Name,
		Status:          string(project.Status),
		StatusDetail:    project.StatusDetail,
		SecretKeyPrefix: project.SecretKeyPrefix,
		SecretKey:       secretKeyPlaintext,
		CreatedAt:       project.CreatedAt,
		UpdatedAt:       project.UpdatedAt,
	}

	// Both sizes are informational, so a failure on either leaves the field at
	// zero rather than failing the whole listing. One unreadable project must
	// not take the other four off the page.
	if size, err := handler.databases.DatabaseSize(ctx, project.ID); err == nil {
		response.DatabaseBytes = size
	}
	if size, err := handler.store.StorageUsedBytes(ctx, project.ID); err == nil {
		response.StorageBytes = size
	}

	return response
}

// ownedProject resolves the project id in the path and checks ownership.
//
// A project that belongs to somebody else returns the same 404 as one that
// does not exist. Distinguishing them would let an authenticated user confirm
// that another account's project id is real.
func (handler *ControlPlane) ownedProject(w http.ResponseWriter, r *http.Request) (*dbcontrol.Project, bool) {
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthorized", "sign in required")
		return nil, false
	}

	// The id comes from the context, which the router fills in after parsing
	// it. Reading it here rather than from the URL keeps the handler usable
	// under any router and keeps parsing in one place.
	projectID, found := auth.ProjectIDFromContext(r.Context())
	if !found {
		httpx.WriteError(w, http.StatusBadRequest, "invalid_project_id",
			"the project id is missing or malformed")
		return nil, false
	}

	project, err := handler.store.ProjectOwnedBy(r.Context(), projectID, userID)
	if err != nil {
		if errors.Is(err, dbcontrol.ErrProjectNotOwned) || errors.Is(err, dbcontrol.ErrNotFound) {
			httpx.WriteError(w, http.StatusNotFound, "project_not_found", "no such project")
			return nil, false
		}
		handler.writeStoreError(w, r, err, "load project")
		return nil, false
	}

	return project, true
}

// writeStoreError maps a control plane failure onto an HTTP response.
func (handler *ControlPlane) writeStoreError(w http.ResponseWriter, r *http.Request, err error, action string) {
	status, code, message := classifyStoreError(err)

	handler.log.Warn("control plane request failed", logger.Fields{
		"action":  action,
		"path":    r.URL.Path,
		"status":  status,
		"code":    code,
		"error":   err.Error(),
		"user_id": userIDString(r),
	})

	httpx.WriteErrorWithDetail(w, status, code, message, err.Error())
}

// classifyStoreError maps a sentinel error onto a status code.
func classifyStoreError(err error) (int, string, string) {
	switch {
	case errors.Is(err, dbcontrol.ErrQuotaExceeded):
		return http.StatusTooManyRequests, "quota_exceeded", "a quota has been reached"
	case errors.Is(err, dbcontrol.ErrStorageCredentialLimit):
		// 429, not 500: the caller can act on this by revoking a credential.
		return http.StatusTooManyRequests, "credential_limit",
			"this project already has as many storage credentials as it can hold"
	case errors.Is(err, dbcontrol.ErrProjectNotOwned), errors.Is(err, dbcontrol.ErrNotFound):
		return http.StatusNotFound, "not_found", "the requested item does not exist"
	default:
		return http.StatusInternalServerError, "internal_error", "the request could not be completed"
	}
}

// userIDString renders the user id for logging, or an empty string.
func userIDString(r *http.Request) string {
	if userID, ok := auth.UserIDFromContext(r.Context()); ok {
		return userID.String()
	}
	return ""
}

// pagination reads limit and offset with defaults and a hard ceiling.
func pagination(r *http.Request) (int, int) {
	limit := defaultPageLimit
	if raw := r.URL.Query().Get("limit"); raw != "" {
		if parsed, err := strconv.Atoi(raw); err == nil && parsed > 0 {
			limit = parsed
		}
	}

	offset := 0
	if raw := r.URL.Query().Get("offset"); raw != "" {
		if parsed, err := strconv.Atoi(raw); err == nil && parsed >= 0 {
			offset = parsed
		}
	}

	if limit > maxPageLimit {
		limit = maxPageLimit
	}
	return limit, offset
}

const (
	// defaultPageLimit is used when the caller does not ask for a page size.
	defaultPageLimit = 50
	// maxPageLimit caps what a single request can return.
	maxPageLimit = 200
	// quotaProbeLimit is a page size large enough to cover the project quota,
	// used when only a count is wanted.
	quotaProbeLimit = 1000
	// maxActivityLimit caps the audit log page size.
	maxActivityLimit = 200
	// maxProjectNameLength keeps names inside the database column.
	maxProjectNameLength = 64
)
