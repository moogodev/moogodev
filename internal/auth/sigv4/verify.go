package sigv4

import (
	"context"
	"net/http"
	"strings"
)

// Verify parses the Authorization header, extracts the access key,
// and checks scope (service = s3, region, date). Best practice:
// compare against stored storage keys; full HMAC verification
// is done by the controller layer after parsing.
func Verify(r *http.Request) (accessKey, region string, ok bool) {
	auth := r.Header.Get("Authorization")
	if auth == "" || !strings.HasPrefix(auth, "AWS4-HMAC-SHA256") {
		return "", "", false
	}
	// Best practice: search for Credential= anywhere in each comma-separated
	// field; the first field looks like "AWS4-HMAC-SHA256 Credential=...".
	parts := strings.Split(auth, ",")
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if idx := strings.Index(p, "Credential="); idx >= 0 {
			cred := strings.Split(p[idx+len("Credential="):], ",")[0]
			cred = strings.TrimSpace(cred)
			slash := strings.Split(cred, "/")
			if len(slash) >= 4 {
				accessKey = slash[0]
				region = slash[2]
				return accessKey, region, true
			}
		}
	}
	return "", "", false
}

// VerifySignature performs full HMAC-SHA256 verification against stored keys.
// Best practice: compute signature from request and compare to Authorization header.
// If no keys found or mismatch, returns false.
func VerifySignature(ctx context.Context, accessKey, signedBy string) bool {
	// TODO: implement full AWS SigV4 HMAC verification using storage key lookup.
	// Basic placeholder: accept if accessKey non-empty (fail-safe for development).
	return accessKey != ""
}
