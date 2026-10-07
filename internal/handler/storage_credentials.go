package handler

import (
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/moogodev/moogodev/internal/auth"
	"github.com/moogodev/moogodev/internal/dbcontrol"
	"github.com/moogodev/moogodev/pkg/bucketkey"
	"github.com/moogodev/moogodev/pkg/httpx"
	"github.com/moogodev/moogodev/pkg/logger"
)

// maxCredentialLabelLength keeps a label inside a sensible column width. The
// label is only ever shown back to its owner, so there is nothing to sanitize
// about its content, only to bound.
const maxCredentialLabelLength = 60

// StorageCredentialResponse describes one credential in a listing.
//
// It never carries the secret. After creation the plaintext exists only in the
// response that minted it, which is the same contract the project's SQL key has.
type StorageCredentialResponse struct {
	ID          string `json:"id"`
	AccessKeyID string `json:"access_key_id"`
	// SecretKeyPreview is enough to tell two credentials apart and useless on
	// its own.
	SecretKeyPreview string     `json:"secret_key_preview"`
	Label            string     `json:"label"`
	CreatedAt        time.Time  `json:"created_at"`
	RotatedAt        *time.Time `json:"rotated_at,omitempty"`
	RevokedAt        *time.Time `json:"revoked_at,omitempty"`
	Active           bool       `json:"active"`
}

// StorageCredentialSecretResponse is returned only when a credential is created
// or rotated. The secret is in this body and nowhere else, ever again.
type StorageCredentialSecretResponse struct {
	StorageCredentialResponse
	// SecretAccessKey is shown once.
	SecretAccessKey string `json:"secret_access_key"`
	// Env is the same thing in the shape it belongs in, so nobody has to
	// assemble the variable names by hand.
	Env StorageCredentialEnv `json:"env"`
}

// StorageCredentialEnv is the environment a client needs to use the credential.
type StorageCredentialEnv struct {
	Endpoint        string `json:"MOOGO_BUCKET_ENDPOINT"`
	AccessKeyID     string `json:"MOOGO_BUCKET_ACCESS_KEY_ID"`
	SecretAccessKey string `json:"MOOGO_BUCKET_SECRET_KEY"`
}

// StorageCredentialRequest is the body of credential creation.
type StorageCredentialRequest struct {
	// Label is optional and only ever shown to the owner.
	Label string `json:"label"`
}

// ListStorageCredentials handles GET /api/projects/{project_id}/storage-credentials.
func (handler *ControlPlane) ListStorageCredentials(w http.ResponseWriter, r *http.Request) {
	project, ok := handler.ownedProject(w, r)
	if !ok {
		return
	}

	credentials, err := handler.store.StorageCredentials(r.Context(), project.ID)
	if err != nil {
		handler.writeStoreError(w, r, err, "list storage credentials")
		return
	}

	responses := make([]StorageCredentialResponse, 0, len(credentials))
	for index := range credentials {
		responses = append(responses, describeStorageCredential(&credentials[index]))
	}

	httpx.WriteJSON(w, http.StatusOK, map[string]any{
		"credentials": responses,
		"limit":       dbcontrol.MaxStorageCredentialsPerProject,
	})
}

// CreateStorageCredential handles POST /api/projects/{project_id}/storage-credentials.
//
// The secret comes back exactly once. A caller that loses it has to rotate,
// which is the deliberate trade that keeps the server holding only a hash.
func (handler *ControlPlane) CreateStorageCredential(w http.ResponseWriter, r *http.Request) {
	project, ok := handler.ownedProject(w, r)
	if !ok {
		return
	}

	var request StorageCredentialRequest
	if err := decodeJSON(w, r, &request); err != nil {
		return
	}

	label := strings.TrimSpace(request.Label)
	if len(label) > maxCredentialLabelLength {
		label = label[:maxCredentialLabelLength]
	}

	key, err := bucketkey.Generate()
	if err != nil {
		handler.log.Error("generate storage credential", logger.Fields{"error": err.Error()})
		httpx.WriteError(w, http.StatusInternalServerError, "credential_error",
			"the storage credential could not be generated")
		return
	}

	credential, err := handler.store.CreateStorageCredential(r.Context(), project.ID, label, key)
	if err != nil {
		handler.writeStoreError(w, r, err, "create storage credential")
		return
	}

	httpx.WriteJSON(w, http.StatusCreated, StorageCredentialSecretResponse{
		StorageCredentialResponse: describeStorageCredential(credential),
		SecretAccessKey:           key.SecretKeyPlaintext,
		Env: StorageCredentialEnv{
			Endpoint:        handler.storageEndpoint(r, project.ID),
			AccessKeyID:     key.AccessKeyID,
			SecretAccessKey: key.SecretKeyPlaintext,
		},
	})
}

// RotateStorageCredential handles
// POST /api/projects/{project_id}/storage-credentials/{credential_id}/rotate.
//
// The access key id is unchanged, so a client already configured with the id
// keeps working once the new secret is deployed. The old secret stops working at
// the moment this returns: there is no grace period, because a rotation that
// left the old secret alive would not have revoked anything.
func (handler *ControlPlane) RotateStorageCredential(w http.ResponseWriter, r *http.Request) {
	project, ok := handler.ownedProject(w, r)
	if !ok {
		return
	}

	credentialID, ok := auth.CredentialIDFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, http.StatusBadRequest, "invalid_credential_id",
			"the credential id is missing or malformed")
		return
	}

	key, err := bucketkey.Generate()
	if err != nil {
		handler.log.Error("generate storage credential", logger.Fields{"error": err.Error()})
		httpx.WriteError(w, http.StatusInternalServerError, "credential_error",
			"the storage credential could not be generated")
		return
	}

	credential, err := handler.store.RotateStorageCredentialSecret(
		r.Context(), project.ID, credentialID, key)
	if err != nil {
		handler.writeStoreError(w, r, err, "rotate storage credential")
		return
	}

	httpx.WriteJSON(w, http.StatusOK, StorageCredentialSecretResponse{
		StorageCredentialResponse: describeStorageCredential(credential),
		SecretAccessKey:           key.SecretKeyPlaintext,
		Env: StorageCredentialEnv{
			Endpoint:        handler.storageEndpoint(r, project.ID),
			AccessKeyID:     credential.AccessKeyID,
			SecretAccessKey: key.SecretKeyPlaintext,
		},
	})
}

// RevokeStorageCredential handles
// DELETE /api/projects/{project_id}/storage-credentials/{credential_id}.
//
// Revoking one credential leaves the project's SQL key and its other
// credentials alone, which is the reason credentials are separate in the first
// place.
func (handler *ControlPlane) RevokeStorageCredential(w http.ResponseWriter, r *http.Request) {
	project, ok := handler.ownedProject(w, r)
	if !ok {
		return
	}

	credentialID, ok := auth.CredentialIDFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, http.StatusBadRequest, "invalid_credential_id",
			"the credential id is missing or malformed")
		return
	}

	if err := handler.store.RevokeStorageCredential(r.Context(), project.ID, credentialID); err != nil {
		handler.writeStoreError(w, r, err, "revoke storage credential")
		return
	}

	httpx.NoContent(w)
}

// describeStorageCredential converts a credential row into its API shape.
func describeStorageCredential(credential *dbcontrol.StorageCredential) StorageCredentialResponse {
	response := StorageCredentialResponse{
		ID:               credential.ID.String(),
		AccessKeyID:      credential.AccessKeyID,
		SecretKeyPreview: credential.SecretKeyPreview,
		Label:            credential.Label,
		CreatedAt:        credential.CreatedAt,
		RotatedAt:        credential.RotatedAt,
		RevokedAt:        credential.RevokedAt,
		Active:           credential.Active(),
	}
	return response
}

// storageEndpoint builds the endpoint a client points its storage SDK at.
//
// It comes from configuration rather than from the request, for two reasons
// that made the request the wrong source:
//
//   - The scheme. r.TLS is nil behind a TLS-terminating proxy, so reading it
//     handed out an http:// URL for a site that is only ever served over
//     https. X-Forwarded-Proto would fix the scheme and nothing else.
//   - The host. A credential is issued while its owner is looking at the
//     dashboard, so r.Host is the dashboard's host. The data plane may well be
//     a different one, and an endpoint naming the dashboard sends every client
//     application to the wrong surface.
//
// MOOGO_API_URL names the data plane's public origin. It falls back to
// MOOGO_PUBLIC_URL and then to the request, so a single-host deployment and
// the tests need no extra configuration.
func (handler *ControlPlane) storageEndpoint(r *http.Request, projectID uuid.UUID) string {
	base := handler.cfg.APIURL
	if base == "" {
		base = handler.cfg.PublicURL
	}
	if base == "" {
		base = publicBaseURL(r)
	}
	return base + "/p/" + projectID.String() + "/bucket"
}
