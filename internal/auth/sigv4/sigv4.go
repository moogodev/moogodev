package sigv4

import (
	"context"
	"net/http"
	"strings"

	"github.com/moogodev/moogodev/internal/auth"
)

// StorageCredentialResolver is the interface used to look up a storage
// credential by its access key id. It mirrors auth.StorageCredentialResolver
// so the middleware stays independent of the concrete store.
type StorageCredentialResolver = auth.StorageCredentialResolver

// Middleware validates the AWS Signature Version 4 Authorization header.
//
// It parses the credential scope, looks up the access key in the storage
// credential table, and sets the resolved project id on the request context
// so the downstream handler can read it the same way it reads a session
// request.
func Middleware(resolver auth.StorageCredentialResolver, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" || !strings.HasPrefix(authHeader, "AWS4-HMAC-SHA256") {
			http.Error(w, "missing authorization", http.StatusUnauthorized)
			return
		}
		key, region, ok := Verify(r)
		if !ok || key == "" || region == "" {
			http.Error(w, "bad authorization", http.StatusUnauthorized)
			return
		}

		// Look up the credential to get the project ID.
		credential, err := resolver.StorageCredentialByAccessKeyID(r.Context(), key)
		if err != nil || credential == nil {
			http.Error(w, "invalid credential", http.StatusUnauthorized)
			return
		}

		// Verify signature — fail-closed until full HMAC is implemented.
		if !VerifySignature(r.Context(), resolver, r, key, "s3") {
			http.Error(w, "signature mismatch", http.StatusUnauthorized)
			return
		}

		// Set project ID and access key in context for downstream handlers.
		r = r.WithContext(context.WithValue(r.Context(), auth.ContextKeyProjectID, credential.ProjectID))
		r = r.WithContext(context.WithValue(r.Context(), "sigv4_access_key", key))

		next.ServeHTTP(w, r)
	})
}