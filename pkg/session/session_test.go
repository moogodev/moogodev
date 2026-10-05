package session

import (
	"errors"
	"strings"
	"testing"
	"time"
)

const testSecret = "this-is-a-test-secret-that-is-long-enough-32"

func newTestSigner(t *testing.T, ttl time.Duration) *Signer {
	t.Helper()
	signer, err := NewSigner(testSecret, ttl)
	if err != nil {
		t.Fatalf("create signer: %v", err)
	}
	return signer
}

func TestIssueAndVerifyRoundTrip(t *testing.T) {
	signer := newTestSigner(t, time.Hour)
	now := time.Now()

	token, err := signer.Issue("user-123", "ketut@example.com", now)
	if err != nil {
		t.Fatalf("issue: %v", err)
	}

	claims, err := signer.Verify(token, now)
	if err != nil {
		t.Fatalf("verify: %v", err)
	}
	if claims.UserID != "user-123" {
		t.Errorf("expected user-123, got %q", claims.UserID)
	}
	if claims.Email != "ketut@example.com" {
		t.Errorf("expected ketut@example.com, got %q", claims.Email)
	}
}

func TestVerifyRejectsTamperedPayload(t *testing.T) {
	signer := newTestSigner(t, time.Hour)
	now := time.Now()

	token, err := signer.Issue("user-123", "ketut@example.com", now)
	if err != nil {
		t.Fatalf("issue: %v", err)
	}

	payload, signature, _ := strings.Cut(token, ".")

	// Swapping the payload while keeping the signature is the forgery attempt
	// the signature exists to stop.
	_, err = signer.Verify(payload+signature[:len(signature)-2]+"xy."+signature, now)
	if err == nil {
		t.Error("expected tampered payload to be rejected")
	}
}

func TestVerifyRejectsWrongSecret(t *testing.T) {
	signer := newTestSigner(t, time.Hour)
	now := time.Now()

	token, err := signer.Issue("user-123", "ketut@example.com", now)
	if err != nil {
		t.Fatalf("issue: %v", err)
	}

	// A signer holding a different secret must reject a token signed by the
	// first one. This is the "cookie replayed after a key rotation" case.
	otherSigner, err := NewSigner("a-completely-different-secret-of-sufficient-length", time.Hour)
	if err != nil {
		t.Fatalf("create other signer: %v", err)
	}

	if _, err := otherSigner.Verify(token, now); !errors.Is(err, ErrInvalidSignature) {
		t.Errorf("expected ErrInvalidSignature, got %v", err)
	}
}

func TestVerifyRejectsExpiredToken(t *testing.T) {
	signer := newTestSigner(t, time.Hour)
	issuedAt := time.Now()

	token, err := signer.Issue("user-123", "ketut@example.com", issuedAt)
	if err != nil {
		t.Fatalf("issue: %v", err)
	}

	// Past the expiry, the same token must be refused.
	_, err = signer.Verify(token, issuedAt.Add(2*time.Hour))
	if !errors.Is(err, ErrExpired) {
		t.Errorf("expected ErrExpired, got %v", err)
	}
}

func TestVerifyRejectsMalformedTokens(t *testing.T) {
	signer := newTestSigner(t, time.Hour)
	now := time.Now()

	testCases := []struct {
		name  string
		token string
	}{
		{"empty", ""},
		{"no separator", "just-a-string"},
		{"missing signature", "cGF5bG9hZA"},
		{"empty payload", ".signature"},
		{"empty signature", "payload."},
		{"garbage payload", "!!!not-base64!!!.signature"},
		{"two separators", "a.b.c"},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			if _, err := signer.Verify(testCase.token, now); err == nil {
				t.Errorf("expected malformed token to be rejected: %q", testCase.token)
			}
		})
	}
}

func TestTokensAreUniquePerIssue(t *testing.T) {
	signer := newTestSigner(t, time.Hour)
	now := time.Now()

	// Without a nonce, two tokens for the same user in the same second would be
	// byte-identical, which reveals that two sessions were issued together.
	first, err := signer.Issue("user-123", "ketut@example.com", now)
	if err != nil {
		t.Fatalf("issue first: %v", err)
	}
	second, err := signer.Issue("user-123", "ketut@example.com", now)
	if err != nil {
		t.Fatalf("issue second: %v", err)
	}

	if first == second {
		t.Error("two tokens issued at the same time should differ")
	}
}

func TestNewSignerRejectsShortSecret(t *testing.T) {
	if _, err := NewSigner("too-short", time.Hour); err == nil {
		t.Error("expected an error for a secret under 32 characters")
	}
}

func TestNewSignerRejectsZeroTTL(t *testing.T) {
	if _, err := NewSigner(testSecret, 0); err == nil {
		t.Error("expected an error for a zero ttl")
	}
}

func TestIssueRejectsEmptyUserID(t *testing.T) {
	signer := newTestSigner(t, time.Hour)
	if _, err := signer.Issue("  ", "ketut@example.com", time.Now()); err == nil {
		t.Error("expected an error for a blank user id")
	}
}
