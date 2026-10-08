package ratelimit

import (
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"
)

// newTestLimiter builds a limiter whose clock the test controls.
func newTestLimiter(config Config) (*Limiter, *time.Time) {
	limiter := New(config)
	now := time.Now()
	limiter.now = func() time.Time { return now }
	return limiter, &now
}

func TestBurstIsAllowedThenRefused(t *testing.T) {
	limiter, _ := newTestLimiter(Config{Limit: 3, Window: time.Minute})

	for attempt := 1; attempt <= 3; attempt++ {
		if allowed, _ := limiter.allow("1.2.3.4"); !allowed {
			t.Fatalf("attempt %d should have been allowed", attempt)
		}
	}

	allowed, wait := limiter.allow("1.2.3.4")
	if allowed {
		t.Fatal("the fourth attempt should have been refused")
	}
	if wait <= 0 {
		t.Error("expected a positive wait so the caller knows when to return")
	}
}

// One caller exhausting their allowance must not affect anybody else.
func TestLimitIsPerCaller(t *testing.T) {
	limiter, _ := newTestLimiter(Config{Limit: 2, Window: time.Minute})

	for attempt := 0; attempt < 2; attempt++ {
		limiter.allow("1.2.3.4")
	}
	if allowed, _ := limiter.allow("1.2.3.4"); allowed {
		t.Fatal("expected the first caller to be refused")
	}

	if allowed, _ := limiter.allow("5.6.7.8"); !allowed {
		t.Error("a different caller must not inherit the first one's penalty")
	}
}

// The whole point of the limiter: guessing slows down, and then resumes.
func TestAllowanceRefillsOverTime(t *testing.T) {
	limiter, now := newTestLimiter(Config{Limit: 2, Window: time.Minute})

	limiter.allow("1.2.3.4")
	limiter.allow("1.2.3.4")
	if allowed, _ := limiter.allow("1.2.3.4"); allowed {
		t.Fatal("expected to be refused before the window elapses")
	}

	*now = now.Add(time.Minute)
	if allowed, _ := limiter.allow("1.2.3.4"); !allowed {
		t.Error("expected the bucket to refill after a full window")
	}
}

// The refill is proportional, so a caller who waits half a window gets half the
// allowance back rather than none of it.
func TestRefillIsProportional(t *testing.T) {
	limiter, now := newTestLimiter(Config{Limit: 4, Window: time.Minute})

	for attempt := 0; attempt < 4; attempt++ {
		limiter.allow("1.2.3.4")
	}
	if allowed, _ := limiter.allow("1.2.3.4"); allowed {
		t.Fatal("expected the bucket to be empty")
	}

	// Half a window refills two of the four tokens.
	*now = now.Add(30 * time.Second)
	allowed := 0
	for attempt := 0; attempt < 4; attempt++ {
		if ok, _ := limiter.allow("1.2.3.4"); ok {
			allowed++
		}
	}
	if allowed != 2 {
		t.Errorf("expected 2 tokens after half a window, got %d", allowed)
	}
}

// A caller must never be able to drive the map up without bound.
func TestIdleBucketsAreSwept(t *testing.T) {
	limiter, now := newTestLimiter(Config{Limit: 5, Window: time.Minute})

	for index := 0; index < 500; index++ {
		limiter.allow(net4(index))
	}
	if limiter.Size() != 500 {
		t.Fatalf("expected 500 buckets, got %d", limiter.Size())
	}

	// Past a sweep interval, an idle bucket is dropped. The bucket for the last
	// caller is the only one touched, so it is kept and the rest go.
	*now = now.Add(2 * sweepInterval)
	limiter.allow(net4(0))

	if size := limiter.Size(); size > 2 {
		t.Errorf("expected idle buckets to be swept, %d remain", size)
	}
}

// net4 builds a distinct address per index without allocating an IPv6 range.
func net4(index int) string {
	return "10.0." + itoa(index/256) + "." + itoa(index%256)
}

func itoa(value int) string {
	if value == 0 {
		return "0"
	}
	digits := ""
	for value > 0 {
		digits = string(rune('0'+value%10)) + digits
		value /= 10
	}
	return digits
}

// The limiter is shared across concurrent requests, so its bookkeeping has to
// be safe under -race.
func TestConcurrentUseIsRaceFree(t *testing.T) {
	limiter := New(Config{Limit: 1000, Window: time.Minute})

	var group sync.WaitGroup
	for worker := 0; worker < 20; worker++ {
		group.Add(1)
		go func(worker int) {
			defer group.Done()
			for attempt := 0; attempt < 50; attempt++ {
				limiter.allow(net4(worker))
				limiter.Size()
			}
		}(worker)
	}
	group.Wait()
}

// Over the limit, the response is a 429 carrying Retry-After, so a client can
// back off on its own.
func TestMiddlewareAnswers429WithRetryAfter(t *testing.T) {
	limiter := New(Config{Limit: 1, Window: time.Minute})

	handler := limiter.Middleware(http.HandlerFunc(
		func(w http.ResponseWriter, _ *http.Request) {
			w.WriteHeader(http.StatusOK)
		}))

	// The same caller address on both requests, so the second is over the limit.
	newRequest := func() *http.Request {
		request := httptest.NewRequest(http.MethodPost, "/auth/login", nil)
		request.RemoteAddr = "203.0.113.7:5555"
		return request
	}

	first := httptest.NewRecorder()
	handler.ServeHTTP(first, newRequest())
	if first.Code != http.StatusOK {
		t.Fatalf("first request should pass, got %d", first.Code)
	}

	second := httptest.NewRecorder()
	handler.ServeHTTP(second, newRequest())

	if second.Code != http.StatusTooManyRequests {
		t.Fatalf("expected 429, got %d", second.Code)
	}
	if second.Header().Get("Retry-After") == "" {
		t.Error("expected a Retry-After header so a client knows when to retry")
	}
}

// The limiter must not be defeatable by a header the client controls. This is
// the bypass that matters: without it, one extra argument per request gives an
// attacker an unlimited supply of attempts. The header never changes the key
// -- httpx.RealIP is the one place it is interpreted, ahead of this middleware
// and only from a declared proxy.
func TestForwardedForIsIgnored(t *testing.T) {
	limiter := New(Config{Limit: 2, Window: time.Minute})

	handler := limiter.Middleware(http.HandlerFunc(
		func(w http.ResponseWriter, _ *http.Request) {
			w.WriteHeader(http.StatusOK)
		}))

	send := func(forwarded string) int {
		request := httptest.NewRequest(http.MethodPost, "/auth/login", nil)
		request.RemoteAddr = "203.0.113.9:5555"
		if forwarded != "" {
			request.Header.Set("X-Forwarded-For", forwarded)
		}
		recorder := httptest.NewRecorder()
		handler.ServeHTTP(recorder, request)
		return recorder.Code
	}

	if code := send(""); code != http.StatusOK {
		t.Fatalf("first request: expected 200, got %d", code)
	}
	if code := send(""); code != http.StatusOK {
		t.Fatalf("second request: expected 200, got %d", code)
	}

	// A third attempt from the same real address must be refused even though
	// each of these claims a different forwarded address.
	if code := send("1.2.3.4"); code != http.StatusTooManyRequests {
		t.Errorf("expected 429 despite a spoofed X-Forwarded-For, got %d", code)
	}
}

// Two peer addresses are two callers, which is the property RealIP's rewrite
// feeds this middleware: behind a declared proxy every real client arrives
// with its own address in RemoteAddr, and each gets its own allowance.
func TestDifferentPeerAddressesGetSeparateAllowances(t *testing.T) {
	limiter := New(Config{Limit: 1, Window: time.Minute})

	send := func(peer string) int {
		request := httptest.NewRequest(http.MethodPost, "/auth/login", nil)
		request.RemoteAddr = peer
		recorder := httptest.NewRecorder()
		limiter.Middleware(http.HandlerFunc(
			func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusOK) },
		)).ServeHTTP(recorder, request)
		return recorder.Code
	}

	if code := send("203.0.113.1:5555"); code != http.StatusOK {
		t.Fatalf("first caller: expected 200, got %d", code)
	}
	if code := send("203.0.113.1:5555"); code != http.StatusTooManyRequests {
		t.Errorf("expected the same caller to be limited, got %d", code)
	}
	if code := send("203.0.113.2:5555"); code != http.StatusOK {
		t.Errorf("a different peer should have its own allowance, got %d", code)
	}
}

// MiddlewareKey spends the allowance against whatever identity the caller
// supplies instead of the address, and the identities are as separate as
// addresses would be. The data plane leans on this: one project's budget is
// never another project's, wherever the requests arrive from.
func TestMiddlewareKeySeparatesIdentities(t *testing.T) {
	limiter := New(Config{Limit: 1, Window: time.Minute})

	handler := limiter.MiddlewareKey(func(r *http.Request) string {
		return "project:" + r.Header.Get("X-Project")
	})(http.HandlerFunc(
		func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusOK) }))

	send := func(project string) int {
		request := httptest.NewRequest(http.MethodPost, "/p/x/query", nil)
		// A different address every time: the address must play no part in
		// what this limiter counts.
		request.RemoteAddr = "203.0.113.50:5555"
		request.Header.Set("X-Project", project)
		recorder := httptest.NewRecorder()
		handler.ServeHTTP(recorder, request)
		return recorder.Code
	}

	if code := send("alpha"); code != http.StatusOK {
		t.Fatalf("first request for alpha: expected 200, got %d", code)
	}
	if code := send("alpha"); code != http.StatusTooManyRequests {
		t.Errorf("alpha over its limit: expected 429, got %d", code)
	}
	if code := send("beta"); code != http.StatusOK {
		t.Errorf("beta must not spend alpha's allowance, got %d", code)
	}
}

// Middleware delegates to MiddlewareKey on the address, so the two stay
// behaviourally identical: the same 429 contract from both entry points.
func TestMiddlewareIsKeyedByAddress(t *testing.T) {
	limiter := New(Config{Limit: 1, Window: time.Minute})

	handler := limiter.Middleware(http.HandlerFunc(
		func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusOK) }))

	send := func(remote string) int {
		request := httptest.NewRequest(http.MethodPost, "/auth/login", nil)
		request.RemoteAddr = remote
		recorder := httptest.NewRecorder()
		handler.ServeHTTP(recorder, request)
		return recorder.Code
	}

	if code := send("203.0.113.60:5555"); code != http.StatusOK {
		t.Fatalf("first caller: expected 200, got %d", code)
	}
	if code := send("203.0.113.60:5555"); code != http.StatusTooManyRequests {
		t.Errorf("same caller over limit: expected 429, got %d", code)
	}
	if code := send("203.0.113.61:5555"); code != http.StatusOK {
		t.Errorf("a different caller should have its own allowance, got %d", code)
	}
}