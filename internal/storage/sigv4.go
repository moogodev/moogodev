// Package storage implements the object storage client Moogo uses for project
// backups.
//
// It speaks the small slice of the S3 API that a backup workflow needs (PUT,
// GET, LIST, DELETE) and signs every request with AWS Signature Version 4.
// The client is written by hand rather than pulled from an SDK so the
// dependency surface stays small and the signing path stays auditable.
package storage

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"net/url"
	"sort"
	"strings"
	"time"
)

const (
	// algorithm is the signing algorithm name in the Authorization header.
	algorithm = "AWS4-HMAC-SHA256"
	// serviceName is the SigV4 service scope for object storage.
	serviceName = "s3"

	// EmptySHA256 is the SHA-256 of a zero-length body. Every request that
	// sends no payload must sign with this value.
	EmptySHA256 = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"

	// iso8601 is the timestamp format in the X-Amz-Date header.
	iso8601 = "20060102T150405Z"
	// iso8601Day is the timestamp format in the credential scope.
	iso8601Day = "20060102"
)

// signer holds the long-lived material needed to sign a request.
type signer struct {
	accessKey string
	secretKey string
	region    string
}

// sign mutates req to add the SigV4 headers and the Authorization header.
//
// The caller must have already set X-Amz-Content-Sha256 (or accept the empty
// hash) and any Content-Type it wants signed; payloadHash must be the SHA-256
// of the request body. The timestamp is passed in rather than read from the
// clock so tests are deterministic and so a retry can reuse the same value.
func (s signer) sign(req *http.Request, payloadHash string, now time.Time) {
	amzDate := now.UTC().Format(iso8601)
	dateStamp := now.UTC().Format(iso8601Day)

	req.Header.Set("X-Amz-Date", amzDate)
	req.Header.Set("X-Amz-Content-Sha256", payloadHash)

	canonical, signedHeaders := canonicalRequest(req, payloadHash, s.signedHeaderValues(req))
	scope := credentialScope(dateStamp, s.region)
	toSign := stringToSign(algorithm, amzDate, scope, canonical)

	signature := hex.EncodeToString(hmacSHA256(s.signingKey(dateStamp), toSign))

	req.Header.Set("Authorization", algorithm+
		" Credential="+s.accessKey+"/"+scope+
		", SignedHeaders="+signedHeaders+
		", Signature="+signature)
}

// signedHeaderValues collects the headers that take part in the signature.
//
// The set is fixed and small on purpose: a header only participates if this
// function returns it, which keeps a signed request reproducible across
// attempts. The Host header is not stored in Header by net/http, so it is
// added explicitly from the request.
func (s signer) signedHeaderValues(req *http.Request) map[string]string {
	host := req.Host
	if host == "" {
		host = req.URL.Host
	}

	headers := map[string]string{"host": host}
	for _, name := range []string{"Content-Type", "X-Amz-Content-Sha256", "X-Amz-Date"} {
		value := req.Header.Get(name)
		if value == "" {
			continue
		}
		headers[strings.ToLower(name)] = strings.TrimSpace(value)
	}
	return headers
}

// canonicalRequest builds the canonical request string and the signed-headers
// list from a request and the values that participate in the signature.
//
// The shape matters more than the code: a single stray newline changes the
// signature and every request fails with a 403, so the formatting is asserted
// byte for byte in the tests.
func canonicalRequest(req *http.Request, payloadHash string, headers map[string]string) (string, string) {
	names := make([]string, 0, len(headers))
	for name := range headers {
		names = append(names, name)
	}
	sort.Strings(names)

	var canonicalHeaders strings.Builder
	for _, name := range names {
		canonicalHeaders.WriteString(name)
		canonicalHeaders.WriteByte(':')
		canonicalHeaders.WriteString(headers[name])
		canonicalHeaders.WriteByte('\n')
	}

	signedHeaders := strings.Join(names, ";")

	// The newline join is correct even though it looks doubled: the canonical
	// query string is often empty (yielding a blank line after the URI) and
	// canonicalHeaders already ends in a newline (yielding a blank line before
	// the signed-headers list). Both blank lines are part of the spec.
	canonical := strings.Join([]string{
		req.Method,
		canonicalURI(req.URL),
		canonicalQuery(req.URL),
		canonicalHeaders.String(),
		signedHeaders,
		payloadHash,
	}, "\n")

	return canonical, signedHeaders
}

// canonicalURI returns the URI-encoded path. The value is taken straight from
// net/http's escaped form so it matches exactly what the transport puts on the
// wire, which is what the signature is checked against.
func canonicalURI(u *url.URL) string {
	if u.EscapedPath() == "" {
		return "/"
	}
	return u.EscapedPath()
}

// canonicalQuery returns the sorted, URI-encoded query string.
func canonicalQuery(u *url.URL) string {
	return encodeQuery(u.Query())
}

// encodeQuery renders url.Values into the canonical query form: keys and
// values percent-encoded with '/' escaped, sorted by key then by value.
func encodeQuery(values url.Values) string {
	if len(values) == 0 {
		return ""
	}

	keys := make([]string, 0, len(values))
	for key := range values {
		keys = append(keys, key)
	}
	sort.Strings(keys)

	parts := make([]string, 0, len(values))
	for _, key := range keys {
		items := append([]string(nil), values[key]...)
		sort.Strings(items)
		for _, item := range items {
			parts = append(parts, awsURIEncode(key, true)+"="+awsURIEncode(item, true))
		}
	}
	return strings.Join(parts, "&")
}

// awsURIEncode percent-encodes a string the way SigV4 requires: everything
// except the unreserved set A-Z a-z 0-9 - _ . ~ is escaped, and '/' is escaped
// unless the caller opts out.
func awsURIEncode(value string, encodeSlash bool) string {
	const hexDigits = "0123456789ABCDEF"

	var builder strings.Builder
	for i := 0; i < len(value); i++ {
		c := value[i]
		switch {
		case c >= 'A' && c <= 'Z', c >= 'a' && c <= 'z', c >= '0' && c <= '9',
			c == '-', c == '_', c == '.', c == '~':
			builder.WriteByte(c)
		case c == '/' && !encodeSlash:
			builder.WriteByte(c)
		default:
			builder.WriteByte('%')
			builder.WriteByte(hexDigits[c>>4])
			builder.WriteByte(hexDigits[c&0x0f])
		}
	}
	return builder.String()
}

// credentialScope is the "<date>/<region>/<service>/aws4_request" scope.
func credentialScope(dateStamp, region string) string {
	return strings.Join([]string{dateStamp, region, serviceName, "aws4_request"}, "/")
}

// stringToSign is the second stage of the signing process.
func stringToSign(algorithm, amzDate, scope, canonicalRequest string) string {
	return strings.Join([]string{
		algorithm,
		amzDate,
		scope,
		sha256Hex([]byte(canonicalRequest)),
	}, "\n")
}

// signingKey derives the day-scoped signing key for the configured region.
func (s signer) signingKey(dateStamp string) []byte {
	return deriveSigningKey(s.secretKey, dateStamp, s.region, serviceName)
}

// deriveSigningKey chains the four HMACs that turn the secret into a
// date-, region- and service-scoped key. The service is a parameter so the
// derivation can be checked against the published example, which uses a
// different service than object storage.
func deriveSigningKey(secretKey, dateStamp, region, service string) []byte {
	kDate := hmacSHA256([]byte("AWS4"+secretKey), dateStamp)
	kRegion := hmacSHA256(kDate, region)
	kService := hmacSHA256(kRegion, service)
	return hmacSHA256(kService, "aws4_request")
}

func hmacSHA256(key []byte, data string) []byte {
	mac := hmac.New(sha256.New, key)
	mac.Write([]byte(data))
	return mac.Sum(nil)
}

func sha256Hex(data []byte) string {
	sum := sha256.Sum256(data)
	return hex.EncodeToString(sum[:])
}
