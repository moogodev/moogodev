package httpx

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

// forwardedClientIP runs one request through RealIP and reports the address
// the handler saw, without the port.
func forwardedClientIP(t *testing.T, trusted []string, peer, forwarded string) string {
	t.Helper()

	request := httptest.NewRequest(http.MethodGet, "/", nil)
	request.RemoteAddr = peer
	if forwarded != "" {
		request.Header.Set("X-Forwarded-For", forwarded)
	}

	var seen string
	handler := RealIP(trusted)(http.HandlerFunc(func(_ http.ResponseWriter, r *http.Request) {
		seen = ClientIP(r)
	}))
	handler.ServeHTTP(httptest.NewRecorder(), request)
	return seen
}

// TestRealIPIgnoresForwardedHeaderFromAnUntrustedPeer is MG-04's core: the
// trusted list gated only on its being non-empty, so a caller reaching the
// app directly -- with any trusted proxies configured -- could send
// X-Forwarded-For and become any address it liked: a fresh rate-limit
// identity per request and whatever the access log should record.
func TestRealIPIgnoresForwardedHeaderFromAnUntrustedPeer(t *testing.T) {
	got := forwardedClientIP(t, []string{"10.0.0.1"}, "203.0.113.9:5555", "1.2.3.4")
	if got != "203.0.113.9" {
		t.Errorf("client = %q, want the peer 203.0.113.9; a header from an untrusted peer must be ignored", got)
	}
}

// TestRealIPTakesTheRightmostUntrustedForwardedAddress pins the chain walk:
// a trusted proxy appends the real client after whatever the client sent, so
// believing the leftmost entry lets a caller spoof by pre-filling the header.
func TestRealIPTakesTheRightmostUntrustedForwardedAddress(t *testing.T) {
	got := forwardedClientIP(t, []string{"10.0.0.1"}, "10.0.0.1:5555", "1.2.3.4, 198.51.100.7")
	if got != "198.51.100.7" {
		t.Errorf("client = %q, want 198.51.100.7 (the entry the trusted proxy appended)", got)
	}
}

// TestRealIPWithoutTrustedProxiesIgnoresHeader keeps the empty list meaning
// what it always meant: the header is never believed.
func TestRealIPWithoutTrustedProxiesIgnoresHeader(t *testing.T) {
	got := forwardedClientIP(t, nil, "203.0.113.9:5555", "1.2.3.4")
	if got != "203.0.113.9" {
		t.Errorf("client = %q, want the peer; the header must be ignored with no trusted list", got)
	}
}

// TestRealIPMatchesCIDRTrustedProxies covers the documented entry form: the
// deployment guide configures 127.0.0.1/32,::1/128, and an address inside
// the range must count as the proxy while one outside it must not.
func TestRealIPMatchesCIDRTrustedProxies(t *testing.T) {
	inside := forwardedClientIP(t, []string{"10.0.0.0/24"}, "10.0.0.7:5555", "1.2.3.4, 198.51.100.7")
	if inside != "198.51.100.7" {
		t.Errorf("peer inside the CIDR: client = %q, want 198.51.100.7", inside)
	}

	outside := forwardedClientIP(t, []string{"10.0.0.0/24"}, "11.0.0.7:5555", "1.2.3.4")
	if outside != "11.0.0.7" {
		t.Errorf("peer outside the CIDR: client = %q, want the peer 11.0.0.7", outside)
	}
}

// TestRealIPHandlesIPv6 pins the rewrite for IPv6: a naive "address:port"
// concatenation produces an unparseable RemoteAddr, and every consumer keyed
// on ClientIP would then see the broken string as the caller's identity.
func TestRealIPHandlesIPv6(t *testing.T) {
	got := forwardedClientIP(t, []string{"::1"}, "[::1]:8080", "2001:db8::1")
	if got != "2001:db8::1" {
		t.Errorf("client = %q, want 2001:db8::1", got)
	}
}

// TestRealIPKeepsLeftmostWhenTheWholeChainIsTrusted covers a loop of
// declared proxies: every hop is one of ours, so the far end is the client.
func TestRealIPKeepsLeftmostWhenTheWholeChainIsTrusted(t *testing.T) {
	got := forwardedClientIP(t, []string{"10.0.0.0/24"}, "10.0.0.1:5555", "10.0.0.9, 10.0.0.2")
	if got != "10.0.0.9" {
		t.Errorf("client = %q, want the leftmost entry 10.0.0.9", got)
	}
}
