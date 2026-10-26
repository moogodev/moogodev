package sigv4

import (
	"context"
	"net/http"
	"strings"

	"github.com/google/uuid"
	"github.com/moogodev/moogodev/internal/auth"
	"github.com/moogodev/moogodev/internal/secretbox"
	"github.com/moogodev/moogodev/pkg/bucketkey"
)

// NativeMiddleware authorizes /s3 requests with Moogo's native storage
// credential (X-Moogo-Access-Key-Id + Bearer moogo_sk_...) instead of
// AWS SigV4. This implements Phase 0 Option B: the endpoint stays
// R2-like and usable while full HMAC verification remains deferred.
func NativeMiddleware(resolver auth.StorageCredentialResolver, projects auth.ProjectResolver, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("x-amz-request-id", uuid.NewString())
		w.Header().Set("x-amz-id-2", uuid.NewString())
		authHeader := r.Header.Get("Authorization")
		// Presigned URL via query parameters.
		if authHeader == "" && r.URL.Query().Get("X-Amz-Algorithm") == "AWS4-HMAC-SHA256" {
			accessKey := r.URL.Query().Get("X-Amz-Credential")
			if slash := strings.Split(accessKey, "/"); len(slash) > 0 {
				accessKey = slash[0]
			}
			if !VerifySignature(r.Context(), resolver, r, accessKey, "") {
				WriteXMLError(w, http.StatusForbidden, "SignatureDoesNotMatch", "signature mismatch")
				return
			}
			credential, err := resolver.StorageCredentialByAccessKeyID(r.Context(), accessKey)
			if err != nil || credential == nil {
				WriteXMLError(w, http.StatusUnauthorized, "InvalidAccessKeyId", "invalid access key")
				return
			}
			project, err := projects.ProjectByID(r.Context(), credential.ProjectID)
			if err != nil || project == nil {
				WriteXMLError(w, http.StatusUnauthorized, "InvalidAccessKeyId", "invalid credential")
				return
			}
			if project.Paused() {
				WriteXMLError(w, http.StatusForbidden, "AccessDenied", "project is paused")
				return
			}
			if !project.Ready() {
				WriteXMLError(w, http.StatusForbidden, "AccessDenied", "project is not ready")
				return
			}
			r = r.WithContext(context.WithValue(r.Context(), auth.ContextKeyProjectID, credential.ProjectID))
			r = r.WithContext(context.WithValue(r.Context(), auth.ContextKeyClaims, credential))
			// set object key? router sets later
			next.ServeHTTP(w, r)
			return
		}
		// Support both native Bearer and AWS SigV4.
		if strings.HasPrefix(authHeader, "AWS4-HMAC-SHA256") {
			accessKey, _, ok := Verify(r)
			if !ok {
				WriteXMLError(w, http.StatusUnauthorized, "InvalidAccessKeyId", "invalid access key")
				return
			}
			if !VerifySignature(r.Context(), resolver, r, accessKey, "") {
				WriteXMLError(w, http.StatusForbidden, "SignatureDoesNotMatch", "signature mismatch")
				return
			}
			credential, err := resolver.StorageCredentialByAccessKeyID(r.Context(), accessKey)
			if err != nil || credential == nil {
				WriteXMLError(w, http.StatusUnauthorized, "InvalidAccessKeyId", "invalid access key")
				return
			}
			// set context
			project, err := projects.ProjectByID(r.Context(), credential.ProjectID)
			if err != nil || project == nil {
				WriteXMLError(w, http.StatusUnauthorized, "InvalidAccessKeyId", "invalid credential")
				return
			}
			if project.Paused() {
				WriteXMLError(w, http.StatusForbidden, "AccessDenied", "project is paused")
				return
			}
			if !project.Ready() {
				WriteXMLError(w, http.StatusForbidden, "AccessDenied", "project is not ready")
				return
			}
			r = r.WithContext(context.WithValue(r.Context(), auth.ContextKeyProjectID, credential.ProjectID))
			r = r.WithContext(context.WithValue(r.Context(), auth.ContextKeyClaims, credential))
			next.ServeHTTP(w, r)
			return
		}

		accessKeyID := r.Header.Get(auth.StorageAccessKeyHeader)
		if accessKeyID == "" || !bucketkey.LooksLikeAccessKeyID(accessKeyID) {
			// maybe access key in SigV4 credential? already handled
			WriteXMLError(w, http.StatusUnauthorized, "InvalidAccessKeyId", "invalid access key")
			return
		}

		credential, err := resolver.StorageCredentialByAccessKeyID(r.Context(), accessKeyID)
		if err != nil || credential == nil {
			WriteXMLError(w, http.StatusUnauthorized, "InvalidAccessKeyId", "invalid access key")
			return
		}

		header := r.Header.Get("Authorization")
		scheme, presented, found := strings.Cut(header, " ")
		ok := found && strings.EqualFold(scheme, "Bearer") && strings.TrimSpace(presented) != ""
		presented = strings.TrimSpace(presented)
		if !ok || !bucketkey.Verify(presented, credential.SecretKeyHash) {
			// try encrypted plaintext compare
			if credential.SecretKeyEncrypted != "" {
				if sec, err := secretbox.Open(storageKey(), credential.SecretKeyEncrypted); err == nil {
					if !bucketkey.Verify(presented, bucketkey.Hash(sec)) {
						WriteXMLError(w, http.StatusForbidden, "SignatureDoesNotMatch", "signature mismatch")
						return
					}
				} else {
					WriteXMLError(w, http.StatusForbidden, "SignatureDoesNotMatch", "signature mismatch")
					return
				}
			} else {
				WriteXMLError(w, http.StatusForbidden, "SignatureDoesNotMatch", "signature mismatch")
				return
			}
		}

		project, err := projects.ProjectByID(r.Context(), credential.ProjectID)
		if err != nil || project == nil {
			WriteXMLError(w, http.StatusUnauthorized, "InvalidAccessKeyId", "invalid credential")
			return
		}
		if project.Paused() {
			WriteXMLError(w, http.StatusForbidden, "AccessDenied", "project is paused")
			return
		}
		if !project.Ready() {
			WriteXMLError(w, http.StatusForbidden, "AccessDenied", "project is not ready")
			return
		}

		r = r.WithContext(context.WithValue(r.Context(), auth.ContextKeyProjectID, credential.ProjectID))
		r = r.WithContext(context.WithValue(r.Context(), auth.ContextKeyClaims, credential))
		next.ServeHTTP(w, r)
	})
}
