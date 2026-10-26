package sigv4

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net/http"
	"net/url"
	"sort"
	"strings"
	"time"

	"github.com/moogodev/moogodev/internal/auth"
	"github.com/moogodev/moogodev/internal/secretbox"
)

// Verify parses the Authorization header for an access key and region.
func Verify(r *http.Request) (accessKey, region string, ok bool) {
	authHeader := r.Header.Get("Authorization")
	if authHeader == "" || !strings.HasPrefix(authHeader, "AWS4-HMAC-SHA256") {
		return "", "", false
	}
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

// authParams holds parsed Authorization header fields.
type authParams struct {
	AccessKey       string
	Date            string // YYYYMMDD
	Region          string
	Service         string
	SignedHeaders   string
	Signature       string
}

func parseAuthHeader(h string) (authParams, bool) {
	p := authParams{}
	if !strings.HasPrefix(h, "AWS4-HMAC-SHA256") {
		return p, false
	}
	// strip prefix
	rest := strings.TrimPrefix(h, "AWS4-HMAC-SHA256")
	rest = strings.TrimSpace(rest)
	for _, part := range strings.Split(rest, ",") {
		part = strings.TrimSpace(part)
		if strings.HasPrefix(part, "Credential=") {
			cred := strings.TrimSpace(part[len("Credential="):])
			slash := strings.Split(cred, "/")
			if len(slash) >= 4 {
				p.AccessKey = slash[0]
				p.Date = slash[1]
				p.Region = slash[2]
				p.Service = slash[3]
			}
		} else if strings.HasPrefix(part, "SignedHeaders=") {
			p.SignedHeaders = strings.TrimSpace(part[len("SignedHeaders="):])
		} else if strings.HasPrefix(part, "Signature=") {
			p.Signature = strings.TrimSpace(part[len("Signature="):])
		}
	}
	if p.AccessKey == "" || p.Signature == "" || p.SignedHeaders == "" {
		return p, false
	}
	return p, true
}

func sha256Hex(b []byte) string {
	sum := sha256.Sum256(b)
	return hex.EncodeToString(sum[:])
}

func hmacSHA256(key []byte, msg string) []byte {
	h := hmac.New(sha256.New, key)
	h.Write([]byte(msg))
	return h.Sum(nil)
}

// VerifySignature performs full AWS Signature Version 4 verification.
func VerifySignature(ctx context.Context, resolver auth.StorageCredentialResolver, r *http.Request, accessKey, signedBy string) bool {
	authHeader := r.Header.Get("Authorization")
	params, ok := parseAuthHeader(authHeader)
	if !ok {
		return false
	}
	if params.Service != "s3" {
		return false
	}
	if params.AccessKey != accessKey {
		// allow lookup by parsed key
	}

	credential, err := resolver.StorageCredentialByAccessKeyID(ctx, params.AccessKey)
	if err != nil || credential == nil || !credential.Active() {
		return false
	}
	secret, err := secretbox.Open(storageKey(), credential.SecretKeyEncrypted)
	if err != nil || secret == "" {
		return false
	}

	// timestamp
	amzDate := r.Header.Get("X-Amz-Date")
	if amzDate == "" {
		// presigned query
		amzDate = r.URL.Query().Get("X-Amz-Date")
	}
	if amzDate == "" {
		return false
	}
	// expiry check for presigned
	if expires := r.URL.Query().Get("X-Amz-Expires"); expires != "" {
		t, err := time.Parse("20060102T150405Z", amzDate)
		if err == nil {
			var exp int
			fmt.Sscanf(expires, "%d", &exp)
			if time.Since(t) > time.Duration(exp)*time.Second {
				return false
			}
		}
	}

	// clock skew check (15 min) for header auth
	if r.URL.Query().Get("X-Amz-Expires") == "" {
		t, err := time.Parse("20060102T150405Z", amzDate)
		if err == nil {
			if time.Since(t).Abs() > 15*time.Minute {
				return false
			}
		}
	}

	// canonical URI
	canonicalURI := r.URL.Path
	if canonicalURI == "" {
		canonicalURI = "/"
	}
	// ensure not double-encoded? keep as is

	// canonical query string
	canonicalQuery := canonicalQueryString(r)

	// payload hash
	payloadHash := r.Header.Get("X-Amz-Content-Sha256")
	if payloadHash == "" {
		payloadHash = r.URL.Query().Get("X-Amz-Content-Sha256")
	}
	if payloadHash == "" {
		// hash body if small? For GET/HEAD/empty, use empty hash
		payloadHash = sha256Hex(nil)
	}

	// canonical headers
	signedHeaderNames := strings.Split(params.SignedHeaders, ";")
	sort.Strings(signedHeaderNames)
	canonicalHeaders := ""
	for _, h := range signedHeaderNames {
		h = strings.ToLower(strings.TrimSpace(h))
		var val string
		if h == "host" {
			val = r.Host
		} else {
			val = r.Header.Get(http.CanonicalHeaderKey(h))
			if val == "" {
				// query presigned? host still header
			}
		}
		// trim spaces
		val = strings.TrimSpace(val)
		canonicalHeaders += h + ":" + val + "\n"
	}

	signedHeadersStr := strings.Join(signedHeaderNames, ";")

	canonicalRequest := strings.Join([]string{
		r.Method,
		canonicalURI,
		canonicalQuery,
		canonicalHeaders,
		signedHeadersStr,
		payloadHash,
	}, "\n")

	hashedCanonical := sha256Hex([]byte(canonicalRequest))

	// string to sign
	credentialScope := params.Date + "/" + params.Region + "/" + params.Service + "/aws4_request"
	stringToSign := "AWS4-HMAC-SHA256\n" + amzDate + "\n" + credentialScope + "\n" + hashedCanonical

	// signing key
	kDate := hmacSHA256([]byte("AWS4"+secret), params.Date)
	kRegion := hmacSHA256(kDate, params.Region)
	kService := hmacSHA256(kRegion, params.Service)
	kSigning := hmacSHA256(kService, "aws4_request")
	sig := hex.EncodeToString(hmacSHA256(kSigning, stringToSign))

	return hmac.Equal([]byte(sig), []byte(params.Signature))
}

func canonicalQueryString(r *http.Request) string {
	values := r.URL.Query()
	// remove signature-related? For presigned, X-Amz-Signature should be excluded from canonical query.
	keys := make([]string, 0, len(values))
	for k := range values {
		if strings.EqualFold(k, "X-Amz-Signature") {
			continue
		}
		keys = append(keys, k)
	}
	sort.Strings(keys)
	parts := []string{}
	for _, k := range keys {
		for _, v := range values[k] {
			parts = append(parts, url.QueryEscape(k)+"="+url.QueryEscape(v))
		}
	}
	return strings.Join(parts, "&")
}

// CanonicalRequest helper kept.
func CanonicalRequest(method, uri, signedHeaders, canonicalHeaders string) string {
	return fmt.Sprintf("%s\n%s\n%s\n%s\n%s\n", method, uri, canonicalHeaders, signedHeaders, "")
}