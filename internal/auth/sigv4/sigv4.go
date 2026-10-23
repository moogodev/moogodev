// Package sigv4 implements AWS Signature Version 4 authentication
// for S3-compatible endpoints (/s3/). Best practice: parse header,
// validate format, then verify against stored access keys.
package sigv4

import (
	"context"
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
		key, region, ok := Verify(r)
		if !ok || key == "" || region == "" {
			http.Error(w, "bad authorization", http.StatusUnauthorized)
			return
		}
		r = r.WithContext(context.WithValue(r.Context(), "sigv4_access_key", key))
		next.ServeHTTP(w, r)
	})
}
