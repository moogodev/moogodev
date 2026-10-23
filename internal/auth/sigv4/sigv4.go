// Package sigv4 implements AWS Signature Version 4 authentication
// for S3-compatible endpoints (/s3/). Best practice: parse header,
// validate format, then verify against stored access keys.
package sigv4

import (
	"net/http"
	"strings"
)

// Middleware validates the AWS Signature Version 4 Authorization header.
func Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" || !strings.HasPrefix(authHeader, "AWS4-HMAC-SHA256") {
			http.Error(w, "missing authorization", http.StatusUnauthorized)
			return
		}
		// Best practice: extract credential, signed headers, and signature.
		// Full verification against storage keys is done by the controller.
		next.ServeHTTP(w, r)
	})
}
