// Package idempotency makes a retried write safe to run once.
//
// A client that times out mid-request cannot tell whether the write landed. The
// fix is a key the client retries with: the first request runs the handler and
// remembers the answer, and a repeat with the same key returns that answer
// instead of writing a second time.
//
// The store is in memory and deliberately so. A response remembered on disk
// would outlive the process that could replay it, so a restart would turn a
// guarantee into a guess; keeping it here means the answer lives exactly as
// long as the process that can still serve it, and a restart errs toward
// re-running rather than toward dropping a write. That is the safe direction:
// a duplicate the store forgot re-executes, and the caller's own key choice
// still decides whether that is a problem for them.
package idempotency

import (
	"net/http"
	"sync"
	"time"
)

// Header is the key a client sends, and the one a replay is marked with.
//
// The spelling follows the de-facto standard (Stripe, Shopify, the HTTP
// working group's draft) so a client that already speaks it elsewhere needs no
// special case here.
const Header = "Idempotency-Key"

// ReplayHeader marks a response that was served from a remembered answer
// rather than run again, so a caller can tell the two apart when debugging.
const ReplayHeader = "Idempotent-Replay"

// maxKeyLength bounds the key a client may send.
//
// The key is held in memory and echoed into a map, so an unbounded value would
// be a way to spend memory per request. 255 is far past any sane key and turns
// an oversized one into a 400 rather than a allocation.
const maxKeyLength = 255

// sweepInterval is how often expired entries are dropped.
const sweepInterval = time.Minute

// entry is one remembered answer.
type entry struct {
	// done is false while the first request is still running, which is what
	// lets a concurrent duplicate be refused instead of double-executed.
	done bool
	// status, header and body are the remembered response, valid once done
	// is set. The header is kept because Content-Type decides how a client
	// decodes the replayed body; dropping it would hand back bytes with no
	// label.
	status int
	header http.Header
	body   []byte
	// expires is when the entry stops being replayable.
	expires time.Time
	// ready is closed once the first request finishes, so a concurrent
	// duplicate can wait for the answer instead of racing it.
	ready chan struct{}
}

// Store remembers responses by key for a bounded time.
type Store struct {
	// ttl is how long a remembered answer stays replayable.
	ttl time.Duration
	// now is injectable so tests can age an entry without sleeping.
	now func() time.Time

	mu      sync.Mutex
	entries map[string]*entry

	// lastSweep is when entries were last pruned, so expired keys do not
	// accumulate for callers who have stopped using them.
	lastSweep time.Time
}

// New creates a Store that remembers an answer for ttl.
//
// A ttl of zero or less falls back to a sane default rather than making every
// entry immediately expired, which would silently disable the package.
func New(ttl time.Duration) *Store {
	if ttl <= 0 {
		ttl = 10 * time.Minute
	}
	now := time.Now
	return &Store{
		ttl:       ttl,
		now:       now,
		entries:   make(map[string]*entry),
		lastSweep: now(),
	}
}

// Size reports how many entries are held. Used by tests that pin the memory
// behaviour; not part of any request path.
func (store *Store) Size() int {
	store.mu.Lock()
	defer store.mu.Unlock()
	return len(store.entries)
}

// sweepLocked drops entries whose ttl has passed. Caller must hold store.mu.
func (store *Store) sweepLocked(now time.Time) {
	store.lastSweep = now
	for key, item := range store.entries {
		if now.Sub(item.expires) >= 0 {
			// A still-running entry is never swept, even past its ttl: it has
			// no answer yet, and dropping it would let a duplicate run the
			// handler a second time, which is the exact bug this exists to
			// prevent.
			if item.done {
				delete(store.entries, key)
			}
		}
	}
}
