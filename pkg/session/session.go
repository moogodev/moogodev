// Package session issues and verifies stateless session cookies.
//
// The token is a signed payload with no server-side session table, so verifying
// a session costs no database round trip. That matters because the session is
// checked on every control plane request.
//
// The trade-off is deliberate: revoking a session before it expires is not
// possible without a server-side record. Phase 1 has no need for it, since a
// user can be signed out by rotating the session secret if it ever does.
package session

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"
)

// Errors returned when a token cannot be trusted.
var (
	// ErrMalformed means the token is not in the expected shape.
	ErrMalformed = errors.New("malformed session token")
	// ErrInvalidSignature means the signature does not match the payload, which
	// means the token was forged or signed with a different secret.
	ErrInvalidSignature = errors.New("invalid session signature")
	// ErrExpired means the token is well formed but past its expiry.
	ErrExpired = errors.New("session expired")
)

// Claims is the session payload.
type Claims struct {
	// UserID identifies the signed-in user.
	UserID string `json:"uid"`
	// Email is carried for display and logging. The session is still authorized
	// against UserID, so a later email change does not silently reassign data.
	Email string `json:"email"`
	// ExpiresAt is a Unix timestamp. Stored in the token, so expiry needs no
	// lookup.
	ExpiresAt int64 `json:"exp"`
	// IssuedAt is a Unix timestamp, useful for debugging and for rotating
	// sessions without invalidating every user at once.
	IssuedAt int64 `json:"iat"`
}

// Token is the signed session payload.
//
// The nonce lives beside the claims in the JSON rather than being concatenated
// onto it. Appending raw bytes after the JSON and trimming them off later would
// work only as long as the JSON body length is predictable, which is exactly
// the kind of cleverness that turns into a parse bug.
type Token struct {
	Claims Claims `json:"claims"`
	// Nonce makes two tokens issued in the same second differ, so holding two
	// of someone's tokens does not reveal that they were issued together.
	Nonce string `json:"n"`
}

// Expired reports whether the claims are past their expiry at the given time.
func (claims Claims) Expired(now time.Time) bool {
	return now.Unix() >= claims.ExpiresAt
}

// Signer issues and verifies session tokens.
type Signer struct {
	secret []byte
	ttl    time.Duration
}

// NewSigner creates a Signer.
//
// The secret must be at least 32 bytes. A shorter HMAC key weakens the
// signature, and the caller has already been required to supply one via
// environment variable, so rejecting it here is the last line of defence.
func NewSigner(secret string, ttl time.Duration) (*Signer, error) {
	if len(secret) < 32 {
		return nil, fmt.Errorf("session secret must be at least 32 characters")
	}
	if ttl <= 0 {
		return nil, fmt.Errorf("session ttl must be greater than zero")
	}
	return &Signer{secret: []byte(secret), ttl: ttl}, nil
}

// TTL returns the configured session lifetime.
func (signer *Signer) TTL() time.Duration {
	return signer.ttl
}

// Issue creates a signed token for a user.
//
// The nonce is random rather than derived from the user ID or the current time.
// Without it, two sessions for the same user within the same second would be
// byte-identical, which leaks that fact to anyone holding two tokens.
func (signer *Signer) Issue(userID string, email string, now time.Time) (string, error) {
	if strings.TrimSpace(userID) == "" {
		return "", fmt.Errorf("user id is required")
	}

	nonce, err := randomNonce()
	if err != nil {
		return "", err
	}

	token := Token{
		Claims: Claims{
			UserID:    userID,
			Email:     email,
			ExpiresAt: now.Add(signer.ttl).Unix(),
			IssuedAt:  now.Unix(),
		},
		Nonce: nonce,
	}

	payload, err := json.Marshal(token)
	if err != nil {
		return "", fmt.Errorf("marshal session token: %w", err)
	}

	encodedPayload := base64.RawURLEncoding.EncodeToString(payload)
	return encodedPayload + "." + signer.sign(encodedPayload), nil
}

// Verify checks a token's signature and expiry, returning its claims.
//
// The signature is compared before the payload is decoded. Decoding first would
// let an attacker feed arbitrary JSON and have it parsed by the server before
// anything proves it was issued here.
func (signer *Signer) Verify(token string, now time.Time) (*Claims, error) {
	encodedPayload, providedSignature, found := strings.Cut(token, ".")
	if !found {
		return nil, ErrMalformed
	}
	if encodedPayload == "" || providedSignature == "" {
		return nil, ErrMalformed
	}

	expectedSignature := signer.sign(encodedPayload)
	if !hmac.Equal([]byte(expectedSignature), []byte(providedSignature)) {
		return nil, ErrInvalidSignature
	}

	// Signature is verified before the payload is decoded. Decoding first would
	// let an attacker feed arbitrary JSON and have the server parse it before
	// anything proves the token was issued here.
	payloadBytes, err := base64.RawURLEncoding.DecodeString(encodedPayload)
	if err != nil {
		return nil, ErrMalformed
	}

	var decoded Token
	if err := json.Unmarshal(payloadBytes, &decoded); err != nil {
		return nil, ErrMalformed
	}

	claims := decoded.Claims
	if claims.UserID == "" {
		return nil, ErrMalformed
	}
	if claims.Expired(now) {
		return nil, ErrExpired
	}
	return &claims, nil
}

// sign returns the base64url HMAC-SHA256 of an encoded payload.
func (signer *Signer) sign(encodedPayload string) string {
	mac := hmac.New(sha256.New, signer.secret)
	mac.Write([]byte(encodedPayload))
	return base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
}

// nonceLength is the number of random bytes in a session nonce.
const nonceLength = 16

// randomNonce returns a hex-encoded random nonce.
//
// Hex rather than base64 so the value is always safe inside a JSON string
// without escaping.
func randomNonce() (string, error) {
	buffer := make([]byte, nonceLength)
	if _, err := rand.Read(buffer); err != nil {
		return "", fmt.Errorf("generate session nonce: %w", err)
	}
	return fmt.Sprintf("%x", buffer), nil
}
