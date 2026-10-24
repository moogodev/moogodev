package sigv4

import (
	"context"
	"fmt"
	"encoding/hex"
	"net/http"
	"strings"

	"github.com/moogodev/moogodev/internal/auth"
)

// Verify parses the Authorization header, extracts the access key,
// and checks scope (service = s3, region, date). Best practice:
// compare against stored storage keys; full HMAC verification
// is done by the controller layer after parsing.
func Verify(r *http.Request) (accessKey, region string, ok bool) {
	authHeader := r.Header.Get("Authorization")
	if authHeader == "" || !strings.HasPrefix(authHeader, "AWS4-HMAC-SHA256") {
		return "", "", false
	}
	// Search for Credential= anywhere in each comma-separated field.
	parts := strings.Split(authHeader, ",")
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

// VerifySignature performs full AWS Signature Version 4 verification.
//
// Until the underlying storage layer exposes a reversible representation of
// the secret key (the current design bcrypts secrets so they are never
// recoverable after rotation), true HMAC verification against stored keys
// is not possible. Every request returns false here, making /s3/ fail-closed
// by design until that limitation is addressed or the secret is stored
// reversibly.
func VerifySignature(ctx context.Context, resolver auth.StorageCredentialResolver, r *http.Request, accessKey, signedBy string) bool {
	authHeader := r.Header.Get("Authorization")
	if authHeader == "" || !strings.HasPrefix(authHeader, "AWS4-HMAC-SHA256") {
		return false
	}

	// Extract SignedHeaders, Signature, Date, credential scope from header.
	signedHeaders := ""
	signature := ""
	date := ""
	credentialScope := ""

	parts := strings.Split(authHeader, ",")
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if strings.HasPrefix(p, "Credential=") {
			credStr := strings.Split(p[len("Credential="):], ",")[0]
			credStr = strings.TrimSpace(credStr)
			slash := strings.Split(credStr, "/")
			if len(slash) >= 4 {
				date = slash[1]
				credentialScope = slash[0] + "/" + slash[1] + "/" + slash[2] + "/" + slash[3] + "/aws4_request"
			}
		}
		if strings.HasPrefix(p, "SignedHeaders=") {
			signedHeaders = p[len("SignedHeaders="):]
		}
		if strings.HasPrefix(p, "Signature=") {
			signature = p[len("Signature="):]
		}
	}

	if signedHeaders == "" || signature == "" || date == "" || credentialScope == "" {
		return false
	}

	// Validate credential exists.
	credential, err := resolver.StorageCredentialByAccessKeyID(ctx, accessKey)
	if err != nil || credential == nil {
		return false
	}

	// Derive signing key from the stored secret (requires reversible storage).
	secret := credential.SecretKeyHash // bcrypt hash — cannot derive signing key
	_ = secret

	// Full canonical request & signature flow is omitted because SecretKeyHash
	// (bcrypt) cannot be converted back to a usable key for HMAC.
	// Best practice: construct canonical request, HMAC-SHA256 chain through
	// date → region → service → getRegion → signKey, compare result.
	// For now return false (fail-closed) so we do not accept an unverified
	// signature under any valid access key.
	_ = hex.EncodeToString([]byte{})

	// Reject when the signature cannot be verified because the secret is
	// bcrypt-hashed rather than stored reversibly.
	return false
}

// CanonicalRequest is a helper building the canonical request string used by
// later stages of SigV4 computation. Exposed for unit testing and
// documentation purposes; not yet wired to VerifySignature fully.
func CanonicalRequest(method, uri, signedHeaders, canonicalHeaders string) string {
	return fmt.Sprintf("%s\n%s\n%s\n%s\n%s\n", method, uri, canonicalHeaders, signedHeaders, "")
}
