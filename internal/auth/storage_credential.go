package auth

import (
	"context"
	"net/http"

	"github.com/moogodev/moogodev/internal/dbcontrol"
	"github.com/moogodev/moogodev/pkg/bucketkey"
	"github.com/moogodev/moogodev/pkg/httpx"
)

// StorageCredentialResolver loads a credential by its access key id.
//
// An interface for the same reason ProjectResolver is one: this package stays
// independent of the concrete store, so the test fakes stay trivial.
type StorageCredentialResolver interface {
	StorageCredentialByAccessKeyID(
		ctx context.Context,
		accessKeyID string,
	) (*dbcontrol.StorageCredential, error)
}

// StorageAccessKeyHeader names the header carrying the access key id.
//
// Storage auth is deliberately not AWS Signature V4. Signing exists so a client
// can prove possession of a secret without sending it, for a transport the
// client does not control. Over TLS the secret goes in the Authorization header
// the way it does everywhere else in this API, and the access key id says
// which credential to check it against.
const StorageAccessKeyHeader = "X-Moogo-Access-Key-Id"

// RequireStorageCredential authorizes an object storage request using a
// dedicated storage credential rather than the project's SQL secret key.
//
// The two are separate on purpose. A secret scoped to running SELECT has no
// business being able to overwrite every file in a project, and rotating the
// SQL key should not be able to silently break every running application.
//
// The credential decides which project is being accessed, and the project id in
// the path is checked against it. A credential for project A presented
// alongside project B's URL is rejected rather than quietly serving A's data at
// B's address.
func RequireStorageCredential(
	resolver StorageCredentialResolver,
	projects ProjectResolver,
) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			accessKeyID := r.Header.Get(StorageAccessKeyHeader)
			// Reject a malformed id before spending a database lookup on it.
			// This checks shape, not validity; the lookup is what decides.
			if accessKeyID == "" || !bucketkey.LooksLikeAccessKeyID(accessKeyID) {
				writeUnauthorized(w)
				return
			}

			credential, err := resolver.StorageCredentialByAccessKeyID(r.Context(), accessKeyID)
			// A revoked credential comes back with an empty hash, and an empty
			// hash never matches, so revocation needs no separate branch here.
			// Unknown id, revoked id, and wrong secret all answer 401 so the
			// endpoint cannot be used to enumerate valid access key ids.
			if err != nil || credential == nil || credential.SecretKeyHash == "" {
				writeUnauthorized(w)
				return
			}

			presented, ok := bearerToken(r)
			if !ok || !bucketkey.Verify(presented, credential.SecretKeyHash) {
				writeUnauthorized(w)
				return
			}

			// The path must name the same project the credential belongs to.
			pathProjectID, found := ProjectIDFromContext(r.Context())
			if !found || pathProjectID != credential.ProjectID {
				// 404 rather than 403: the credential is real, but its presence
				// says nothing about whether the other project exists.
				httpx.WriteError(w, http.StatusNotFound, "project_not_found", "no such project")
				return
			}

			// Storage follows the project's lifecycle, exactly as SQL does.
			//
			// This check is easy to leave out because it is not about the
			// credential: pausing revokes access without touching any secret.
			// Without it a paused project kept serving storage to applications
			// while refusing SQL, which is the worst possible split -- the owner
			// pauses believing everything stopped, and files keep changing.
			project, err := projects.ProjectByID(r.Context(), credential.ProjectID)
			if err != nil || project == nil {
				writeUnauthorized(w)
				return
			}
			if project.Paused() {
				writeForbidden(w, "project_paused", "project is paused")
				return
			}
			if !project.Ready() {
				writeForbidden(w, "project_not_ready", "project is not ready yet")
				return
			}

			ctx := context.WithValue(r.Context(), ContextKeyClaims, credential)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// StorageCredentialFromContext returns the credential a storage request was
// authorized with, so handlers can record which one was used.
func StorageCredentialFromContext(ctx context.Context) (*dbcontrol.StorageCredential, bool) {
	credential, ok := ctx.Value(ContextKeyClaims).(*dbcontrol.StorageCredential)
	if !ok {
		return nil, false
	}
	return credential, true
}
