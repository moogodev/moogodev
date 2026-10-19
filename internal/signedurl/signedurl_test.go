package signedurl

import (
	"encoding/base64"
	"strings"
	"testing"
	"time"
)

func TestSignAndVerifyRoundTrip(t *testing.T) {
	signer := New("a session secret that is long enough to matter")
	exp := time.Unix(1_800_000_000, 0)
	sig := signer.Sign("GET", "11111111-1111-1111-1111-111111111111", "", "images/cat.png", exp)

	if err := signer.Verify(
		"GET", "11111111-1111-1111-1111-111111111111", "", "images/cat.png",
		"1800000000", sig, exp.Add(-time.Second),
	); err != nil {
		t.Fatalf("verify: %v", err)
	}
}

func TestVerifyRejectsTamperedFields(t *testing.T) {
	// Every field of the grant is covered. Changing any one of them after the
	// fact must fail, or the URL would be editable into a broader grant than
	// the signer issued.
	signer := New("a session secret that is long enough to matter")
	exp := time.Unix(1_800_000_000, 0)
	sig := signer.Sign("GET", "11111111-1111-1111-1111-111111111111", "", "images/cat.png", exp)
	expRaw := "1800000000"
	now := exp.Add(-time.Second)

	cases := []struct {
		name      string
		method    string
		projectID string
		bucket    string
		key       string
		exp       string
	}{
		{"other method", "PUT", "11111111-1111-1111-1111-111111111111", "", "images/cat.png", expRaw},
		{"other project", "GET", "22222222-2222-2222-2222-222222222222", "", "images/cat.png", expRaw},
		{"other bucket", "GET", "11111111-1111-1111-1111-111111111111", "other", "images/cat.png", expRaw},
		{"other key", "GET", "11111111-1111-1111-1111-111111111111", "", "images/dog.png", expRaw},
		{"extended expiry", "GET", "11111111-1111-1111-1111-111111111111", "", "images/cat.png", "1900000000"},
	}

	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			err := signer.Verify(
				testCase.method, testCase.projectID, testCase.bucket, testCase.key,
				testCase.exp, sig, now,
			)
			if err != ErrInvalid {
				t.Fatalf("verify = %v, want ErrInvalid", err)
			}
		})
	}
}

func TestVerifyReportsExpiryOnlyForAGenuineSignature(t *testing.T) {
	// The distinction is the whole error model: a holder of a real link is
	// told it expired and can ask for a new one, while a forged claim gets
	// nothing — not even the confirmation that it was parsed.
	signer := New("a session secret that is long enough to matter")
	exp := time.Unix(1_800_000_000, 0)
	sig := signer.Sign("GET", "11111111-1111-1111-1111-111111111111", "", "images/cat.png", exp)

	genuine := signer.Verify(
		"GET", "11111111-1111-1111-1111-111111111111", "", "images/cat.png",
		"1800000000", sig, exp,
	)
	if genuine != ErrExpired {
		t.Fatalf("verify at the expiry moment = %v, want ErrExpired", genuine)
	}

	forged := signer.Verify(
		"GET", "11111111-1111-1111-1111-111111111111", "", "images/cat.png",
		"1800000000", "not-a-real-signature", exp,
	)
	if forged != ErrInvalid {
		t.Fatalf("verify of a forged claim = %v, want ErrInvalid", forged)
	}
}

func TestVerifyRejectsMalformedClaims(t *testing.T) {
	// Anything a signer would not have issued is rejected as invalid rather
	// than rescued: a claim that only needs a missing piece filled in is a
	// claim an attacker gets to complete.
	signer := New("a session secret that is long enough to matter")
	exp := time.Unix(1_800_000_000, 0)
	sig := signer.Sign("GET", "11111111-1111-1111-1111-111111111111", "", "images/cat.png", exp)

	cases := map[string][2]string{
		"missing exp":      {"", sig},
		"missing sig":      {"1800000000", ""},
		"exp not a number": {"soon", sig},
		"exp negative":     {"-1800000000", sig},
		"padded signature": {"1800000000", sig + "="},
		"wrong alphabet":   {"1800000000", strings.ReplaceAll(sig, "-", "_x")},
	}

	for name, claim := range cases {
		t.Run(name, func(t *testing.T) {
			err := signer.Verify(
				"GET", "11111111-1111-1111-1111-111111111111", "", "images/cat.png",
				claim[0], claim[1], exp.Add(-time.Second),
			)
			if err != ErrInvalid {
				t.Fatalf("verify = %v, want ErrInvalid", err)
			}
		})
	}
}

func TestVerifyFailsClosedWithoutASigner(t *testing.T) {
	// A nil Signer means the deployment never configured signing. Accepting a
	// signature it cannot check would be worse than rejecting it.
	var signer *Signer
	if err := signer.Verify(
		"GET", "11111111-1111-1111-1111-111111111111", "", "images/cat.png",
		"1800000000", "anything", time.Unix(1_700_000_000, 0),
	); err != ErrInvalid {
		t.Fatalf("verify on a nil signer = %v, want ErrInvalid", err)
	}
}

func TestDifferentSecretsProduceDifferentSignatures(t *testing.T) {
	// Two deployments with different session secrets must not accept each
	// other's links. Without domain separation from the session key this
	// would still hold, but the derivation is what keeps it holding when one
	// secret is reused across roles by mistake.
	first := New("secret one, long enough to be treated as one")
	second := New("secret two, a different value entirely")

	exp := time.Unix(1_800_000_000, 0)
	sig := first.Sign("GET", "11111111-1111-1111-1111-111111111111", "", "images/cat.png", exp)

	if err := second.Verify(
		"GET", "11111111-1111-1111-1111-111111111111", "", "images/cat.png",
		"1800000000", sig, exp.Add(-time.Second),
	); err != ErrInvalid {
		t.Fatalf("verify under a different secret = %v, want ErrInvalid", err)
	}
}

func TestSignaturesAreURLSafe(t *testing.T) {
	// The signature rides in a query string. It must need no escaping, or a
	// client that builds the URL naively sends something that does not verify.
	signer := New("a session secret that is long enough to matter")
	sig := signer.Sign("GET", "11111111-1111-1111-1111-111111111111", "", "images/cat.png", time.Unix(1_800_000_000, 0))

	if _, err := base64.RawURLEncoding.DecodeString(sig); err != nil {
		t.Fatalf("signature is not raw URL base64: %v", err)
	}
	if strings.ContainsAny(sig, "+/=&?# ") {
		t.Fatalf("signature %q contains characters that need escaping", sig)
	}
}

func TestTTLBoundsAreOrdered(t *testing.T) {
	// The handler validates expires_in against these; the ordering is what
	// makes "default inside the range" true.
	if MinTTL > DefaultTTL || DefaultTTL > MaxTTL {
		t.Fatalf("bounds out of order: min %d, default %d, max %d", MinTTL, DefaultTTL, MaxTTL)
	}
}
