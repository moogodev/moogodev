package auth

import (
	"context"
	"net/http"
	"strings"

	"github.com/google/uuid"

	"github.com/moogodev/moogodev/internal/dbcontrol"
	"github.com/moogodev/moogodev/pkg/secretkey"
)

// ProjectResolver looks up a project by ID.
//
// Declared as an interface so this package does not depend on the concrete
// store, which keeps the test fakes trivial.
type ProjectResolver interface {
	ProjectByID(ctx context.Context, projectID uuid.UUID) (*dbcontrol.Project, error)
}

// RequireProjectKey authorizes a data plane request using a project's secret
// key.
//
// The project ID comes from the URL path, not from a header. Two sources of
// truth for "which project" would eventually disagree, and a request
// authorized against one project while reading another is exactly the bug that
// shape invites.
//
// The project is loaded from the control plane on every request rather than
// cached. That is one indexed lookup on a UUID primary key, and it means key
// rotation and project deletion take effect immediately rather than after a
// cache expires.
func RequireProjectKey(resolver ProjectResolver) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// The project ID is set by the router, which validated it as a UUID
			// before dispatch. A missing value means the route was mounted wrong.
			projectID, found := ProjectIDFromContext(r.Context())
			if !found {
				writeUnauthorized(w)
				return
			}

			presented, ok := bearerToken(r)
			if !ok {
				writeUnauthorized(w)
				return
			}

			project, err := resolver.ProjectByID(r.Context(), projectID)
			if err != nil || project == nil {
				// Unknown project and wrong key both produce the same response,
				// so this endpoint cannot be used to test whether a project ID
				// exists.
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

			if !secretkey.Verify(presented, project.SecretKeyHash) {
				writeUnauthorized(w)
				return
			}

			ctx := context.WithValue(r.Context(), ContextKeyClaims, project)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// bearerToken extracts the token from an Authorization header.
//
// Only the Bearer scheme is accepted. Supporting Basic or custom schemes would
// mean accepting credentials in more places than necessary.
func bearerToken(r *http.Request) (string, bool) {
	header := r.Header.Get("Authorization")
	if header == "" {
		return "", false
	}

	scheme, credential, found := strings.Cut(header, " ")
	if !found || !strings.EqualFold(scheme, "Bearer") {
		return "", false
	}

	credential = strings.TrimSpace(credential)
	if credential == "" {
		return "", false
	}
	return credential, true
}

// writeForbidden returns a 403 with a JSON body.
func writeForbidden(w http.ResponseWriter, code string, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusForbidden)
	_, _ = w.Write([]byte(`{"error":{"code":"` + code + `","message":"` + message + `"}}`))
}
