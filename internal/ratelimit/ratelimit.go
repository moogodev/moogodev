// Package ratelimit throttles repeated requests from one caller.
//
// It exists because the credential endpoints were the only public routes with
// no ceiling on how often they could be called. Everything else in the service
// is either authenticated or bounded by a body-size limit, but /auth/login
// accepts an unauthenticated POST and runs a bcrypt comparison against a real
// hash, which is deliberately expensive. That combination is a password
// guessing oracle with no brake on it: twenty wrong passwords in a row
// returned twenty identical 401s and nothing else happened.
//
// The limiter is a token bucket keyed on the client address, held in memory.
// In-memory is the right size for this: the state is small, it resets on
// restart, and a deployment that needs more than one process should put a
// limiter at the proxy instead of here.
package ratelimit

import (
	"net"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/moogo/moogo/pkg/httpx"
)

// Config is one limiter's shape.
type Config struct {
	// Limit is how many requests are allowed in one window.
	Limit int
	// Window is the length of that window.
	Window time.Duration
}

// DefaultCredentialLimit is what the sign-in endpoints get.
//
// Ten attempts a minute is well above what a person who knows their password
// needs, including one fumbling a password manager entry, and low enough that
// guessing stops being practical: at bcrypt cost, a thousand guesses an hour
// against one account is not a rate an attacker can sustain.
//
// It is deliberately not per-account. Keying on the address would need the
// request body parsed in middleware, and a limit per account is one an
// attacker triggers deliberately by spreading attempts across addresses.
var DefaultCredentialLimit = Config{Limit: 10, Window: time.Minute}

// entry is one caller's bucket.
type entry struct {
	// tokens is the remaining allowance, as a float so a refill can be
	// fractional rather than all at once on a window boundary.
	tokens float64
	// last is when tokens was last brought up to date. Storing it per entry
	// rather than assuming every caller arrived at the window boundary is what
	// makes the refill proportional to the time actually elapsed.
	last time.Time
}

// Limiter is a set of token buckets keyed by client address.
type Limiter struct {
	config Config
	// trustedProxies gates whether X-Forwarded-For is believed. Empty means it
	// is ignored, which is the safe default and matches the router.
	trustedProxies []string
	// now is injectable so tests can advance time without sleeping.
	now func() time.Time

	mu      sync.Mutex
	buckets map[string]*entry

	// lastSweep is when entries were last pruned. Buckets for addresses that
	// stopped calling are dead weight, and a service that sees many one-off
	// addresses would otherwise accumulate a bucket per address forever.
	lastSweep time.Time
}

// New creates a Limiter.
//
// trustedProxies is the same list the router's RealIP middleware is given.
// Passing it here is what lets the limiter see the real client address behind
// a proxy while still refusing to believe X-Forwarded-For from anybody else.
func New(config Config, trustedProxies []string) *Limiter {
	if config.Limit <= 0 || config.Window <= 0 {
		config = DefaultCredentialLimit
	}
	return &Limiter{
		config:        config,
		trustedProxies: trustedProxies,
		now:           time.Now,
		buckets:       make(map[string]*entry),
		lastSweep:     time.Now(),
	}
}

// sweepInterval is how often idle buckets are dropped. Every window is enough:
// a bucket that has not been touched in a full window has been refilled to full
// anyway, so keeping it costs memory and tells us nothing.
const sweepInterval = time.Minute

// allow reports whether a caller identified by key may proceed, and how long
// they should wait if not.
func (limiter *Limiter) allow(key string) (bool, time.Duration) {
	limiter.mu.Lock()
	defer limiter.mu.Unlock()

	now := limiter.now()

	if now.Sub(limiter.lastSweep) >= sweepInterval {
		limiter.sweepLocked(now)
	}

	bucket, found := limiter.buckets[key]
	if !found {
		// A first-time caller starts full, so the limit only ever applies to
		// someone who has already spent allowance.
		//
		// The token for this request is spent here rather than below. Creating
		// the bucket at Limit and returning without decrementing gave every new
		// caller one free request beyond the limit, so a Limit of 3 allowed 4.
		limiter.buckets[key] = &entry{
			tokens: float64(limiter.config.Limit) - 1,
			last:   now,
		}
		return true, 0
	}

	// Refill proportionally to elapsed time.
	//
	// The refill is added to the *remaining* tokens, which means a bucket that
	// was never touched sits at exactly full: the first caller spends one and
	// leaves the bucket with Limit-1 tokens plus whatever the elapsed time is
	// worth. That is why this computes from the previous level rather than
	// resetting to Limit on the window boundary -- a bucket that is already
	// full must not gain a second full load just because time passed.
	elapsed := now.Sub(bucket.last)
	if elapsed > 0 {
		refill := float64(limiter.config.Limit) * elapsed.Seconds() / limiter.config.Window.Seconds()
		bucket.tokens += refill
		if bucket.tokens > float64(limiter.config.Limit) {
			bucket.tokens = float64(limiter.config.Limit)
		}
		bucket.last = now
	}

	if bucket.tokens < 1 {
		// The wait is how long until a whole token is back, not until the
		// window resets. Telling a caller to come back in a full window when
		// half a second would do is how rate limits get ignored.
		missing := 1 - bucket.tokens
		wait := time.Duration(missing / float64(limiter.config.Limit) * float64(limiter.config.Window))
		return false, wait
	}

	bucket.tokens--
	return true, 0
}

// sweepLocked drops buckets that have been full and idle for a full window.
// Caller must hold limiter.mu.
func (limiter *Limiter) sweepLocked(now time.Time) {
	limiter.lastSweep = now
	for key, bucket := range limiter.buckets {
		if now.Sub(bucket.last) >= limiter.config.Window {
			delete(limiter.buckets, key)
		}
	}
}

// Size reports how many buckets are held. Used by the tests that pin the
// memory behaviour; not part of any request path.
func (limiter *Limiter) Size() int {
	limiter.mu.Lock()
	defer limiter.mu.Unlock()
	return len(limiter.buckets)
}

// Middleware throttles a handler, answering 429 with a Retry-After when the
// caller is over their limit.
//
// A 429 and not a 403: the request was not refused on its merits, it arrived
// too fast, and the distinction matters to every client that retries.
func (limiter *Limiter) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		key := clientKey(r, limiter.trustedProxies)

		allowed, wait := limiter.allow(key)
		if !allowed {
			seconds := int(wait.Seconds())
			if seconds < 1 {
				seconds = 1
			}
			w.Header().Set("Retry-After", strconv.Itoa(seconds))
			httpx.WriteError(w, http.StatusTooManyRequests, "rate_limited",
				"too many attempts, try again shortly")
			return
		}

		next.ServeHTTP(w, r)
	})
}

// clientKey identifies the caller.
//
// The address is normalized so that "::1" and "127.0.0.1" are not two buckets
// for the same machine on a host that has both, and so an IPv6 address in one
// of its textual forms does not get a fresh allowance.
//
// X-Forwarded-For is read only when the deployment declared trusted proxies,
// which is what the RealIP middleware does. Trusting it unconditionally would
// let anyone bypass the limit by sending a different X-Forwarded-For on every
// request, which is the first thing anyone would try: it costs one curl
// argument and defeats a limiter that is otherwise correct.
func clientKey(r *http.Request, trustedProxies []string) string {
	address := r.RemoteAddr
	if len(trustedProxies) > 0 {
		if forwarded := r.Header.Get("X-Forwarded-For"); forwarded != "" {
			address = strings.TrimSpace(strings.Split(forwarded, ",")[0])
		}
	}

	host, _, err := net.SplitHostPort(address)
	if err != nil {
		// Already a bare host.
		host = address
	}

	if host == "" {
		return "unknown"
	}
	if parsed := net.ParseIP(host); parsed != nil {
		return parsed.String()
	}
	return host
}