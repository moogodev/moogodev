// Package signedurl issues and verifies time-limited object URLs.
//
// A signed URL is a capability: whoever holds the link may fetch one object
// until the expiry passes, with no credential in the request. That makes it
// the right tool for handing a file to a script that will not store a secret,
// or to a browser that should read a private object once without ever seeing
// the storage credential.
//
// The security of the scheme rests entirely on the signature, because the URL
// is expected to travel: it lands in logs, chat windows and referrer headers.
// So the signature covers everything the grant is meant to bind — the method,
// the project, the object key and the expiry — and verification recomputes it
// from the request rather than trusting any single field. Tampering with exp,
// swapping the key for a neighbour's, or replaying the link against another
// project all break the HMAC and fail closed.
//
// The signing key is derived from the session secret rather than configured
// separately. A deployment that needs one more environment variable is a
// deployment that forgets it, and an unset secret would mean an open signer.
// The derivation is domain-separated — the raw session secret never signs a
// URL directly — so the two key uses cannot collide even though they share
// one input, and rotating the session secret invalidates outstanding signed
// URLs, which is the desired direction for a rotation.
package signedurl

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"strconv"
	"strings"
	"time"
)

// Errors returned by Verify. They are distinct so a handler can answer
// "expired" honestly to a holder of a genuine link while answering "not found"
// to a forged one.
var (
	// ErrInvalid means the signature does not match the claim, or the claim is
	// not in a shape the signer would ever have produced. It says nothing about
	// whether the object exists.
	ErrInvalid = errors.New("invalid signature")
	// ErrExpired means the signature is genuine and its expiry has passed.
	ErrExpired = errors.New("signed url expired")
)

// TTL bounds, in seconds on the wire.
//
// The default is short enough that a leaked link is a small problem and long
// enough that a human can copy it out of one window and into another. The
// maximum matches what object stores elsewhere accept as a presigned URL
// lifetime: a week, and not more, because a "temporary" grant nobody can
// revoke is a credential with no rotation story.
const (
	DefaultTTL int64 = 900    // 15 minutes
	MinTTL     int64 = 60     // one minute
	MaxTTL     int64 = 604800 // seven days
)

// version prefixes every canonical payload, so a change to the encoding
// produces different signatures instead of silently verifying old ones.
const version = "moogo.signed-url/v1"

// Signer produces and checks signatures for one deployment.
//
// The zero value is not usable; call New. A Signer is immutable after
// construction and safe for concurrent use.
type Signer struct {
	key []byte
}

// New derives a Signer from the deployment's session secret.
//
// The input is the secret itself, not a hash of it: the derivation is an HMAC
// whose output is the only thing this package ever uses as a key, so the
// secret is never exposed as key material beyond the derivation step.
func New(sessionSecret string) *Signer {
	mac := hmac.New(sha256.New, []byte(sessionSecret))
	mac.Write([]byte(version))
	return &Signer{key: mac.Sum(nil)}
}

// Sign returns the signature for one grant.
//
// exp is the moment the grant stops working. bucket is empty for a read of an
// object on the public plane, where the key alone identifies the object; it
// carries the target bucket for an upload grant, which must not be movable to
// a different bucket by editing the URL.
func (signer *Signer) Sign(
	method, projectID, bucket, key string,
	exp time.Time,
) string {
	mac := hmac.New(sha256.New, signer.key)
	mac.Write([]byte(canonical(method, projectID, bucket, key, exp.Unix())))
	return base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
}

// Verify checks a signature presented as the query parameters of a request.
//
// expRaw and sigRaw are the values straight off the URL: parsing is part of
// verification, because a malformed claim is one an honest signer never
// issued. now is injected so the expiry rule is testable without sleeping.
//
// A nil Signer fails closed — a deployment that never constructed a signer
// issues nothing, so it must also accept nothing.
func (signer *Signer) Verify(
	method, projectID, bucket, key, expRaw, sigRaw string,
	now time.Time,
) error {
	if signer == nil {
		return ErrInvalid
	}
	if expRaw == "" || sigRaw == "" {
		return ErrInvalid
	}
	// base64.RawURLEncoding rejects the padded and standard alphabets, so a
	// signature copied from elsewhere in a codebase does not decode.
	sig, err := base64.RawURLEncoding.DecodeString(sigRaw)
	if err != nil {
		return ErrInvalid
	}
	exp, err := strconv.ParseInt(expRaw, 10, 64)
	if err != nil || exp <= 0 {
		return ErrInvalid
	}

	mac := hmac.New(sha256.New, signer.key)
	mac.Write([]byte(canonical(method, projectID, bucket, key, exp)))
	expected := mac.Sum(nil)
	// The signature is checked before the clock: an expired link was still a
	// real link, and reporting it as expired rather than malformed is the
	// courtesy that tells a client to ask for a new one instead of guessing.
	if !hmac.Equal(sig, expected) {
		return ErrInvalid
	}
	if now.Unix() >= exp {
		return ErrExpired
	}
	return nil
}

// canonical is the byte string both Sign and Verify compute over.
//
// Fields are newline-separated with the version first, so no field can shift
// into a neighbour's position by containing a separator: the signature is
// checked before any field is trusted, and the fixed field count means the
// payload cannot be re-parsed into a different tuple.
func canonical(method, projectID, bucket, key string, exp int64) string {
	var builder strings.Builder
	builder.WriteString(version)
	for _, field := range []string{method, projectID, bucket, key, strconv.FormatInt(exp, 10)} {
		builder.WriteByte('\n')
		builder.WriteString(field)
	}
	return builder.String()
}
