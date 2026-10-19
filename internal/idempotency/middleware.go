package idempotency

import (
	"bytes"
	"net/http"
	"strings"

	"github.com/moogodev/moogodev/internal/auth"
)

// Middleware replays a remembered answer for a repeated write.
//
// It wraps only the endpoints where running a statement twice is a real hazard
// -- /exec and /transaction. A read carries nothing to make idempotent, so
// wrapping one would spend memory remembering an answer that costs nothing to
// compute again.
//
// A request with no Idempotency-Key passes straight through: the header is
// opt-in, and a caller who does not send one gets today's behaviour exactly.
func (store *Store) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		key := trimKey(r.Header.Get(Header))
		if key == "" {
			next.ServeHTTP(w, r)
			return
		}

		// The scope is the caller's identity plus the endpoint, so the same
		// key cannot replay an answer across two projects or two routes. The
		// project id is in the request context, set by the auth middleware
		// that always runs before this one.
		scope := scopeKey(r)

		outcome, item := store.begin(scope, key)
		if outcome.replay {
			serveReplay(w, outcome)
			return
		}
		if outcome.conflict {
			serveConflict(w)
			return
		}

		// This request owns the key. The response is captured rather than
		// streamed, so a duplicate can be answered byte-for-byte the same way.
		// That is safe here because the wrapped endpoints return small JSON;
		// an endpoint that streamed a large body would need a different shape.
		capture := &capturingWriter{ResponseWriter: w}
		next.ServeHTTP(capture, r)

		store.finish(scope, key, item, capture.status, capture.body.Bytes(), capture.header)
	})
}

// outcome is what begin decided for one request.
type outcome struct {
	// replay is true when a remembered answer exists and should be served.
	replay bool
	// conflict is true when the same key is running right now and the caller
	// should retry rather than wait.
	conflict bool
	// status and body are the remembered answer, set when replay is true.
	status int
	body   []byte
	// header carries the remembered Content-Type, set when replay is true.
	header http.Header
}

// begin claims the key for this request, or reports why it should not run.
//
// The returned item is the entry this request now owns; finish must be called
// with it exactly once so the entry is either completed or dropped, never left
// holding the key after its request has gone.
func (store *Store) begin(scope, key string) (outcome, *entry) {
	store.mu.Lock()
	defer store.mu.Unlock()

	now := store.now()
	if now.Sub(store.lastSweep) >= sweepInterval {
		store.sweepLocked(now)
	}

	item, found := store.entries[scope+key]
	if !found {
		fresh := &entry{ready: make(chan struct{}), expires: now.Add(store.ttl)}
		store.entries[scope+key] = fresh
		return outcome{}, fresh
	}

	if !item.done {
		// The same key is in flight. The caller is told to retry instead of
		// waiting: a duplicate usually means a timeout the first request may
		// still be serving, and blocking here would hold a connection open on
		// a request whose answer is not yet known.
		return outcome{conflict: true}, nil
	}

	return outcome{
		replay: true,
		status: item.status,
		body:   item.body,
		header: item.header,
	}, nil
}

// finish records the answer and releases the key.
func (store *Store) finish(scope, key string, item *entry, status int, body []byte, header http.Header) {
	if item == nil {
		return
	}

	store.mu.Lock()
	defer store.mu.Unlock()

	// The owner always closes its own ready channel exactly once, here. No
	// other path can: begin only returns a live item to the request that
	// created it, and a conflicting duplicate gets nil.
	defer close(item.ready)

	// A server error is not remembered. A caller retrying after a 5xx should
	// get a real second attempt rather than the same failure replayed, since
	// 5xx usually means the answer never got as far as being decided.
	if status >= http.StatusInternalServerError {
		delete(store.entries, scope+key)
		return
	}

	item.status = status
	item.body = body
	item.header = header
	item.expires = store.now().Add(store.ttl)
	item.done = true
}

// serveReplay writes a remembered answer, marked as a replay.
func serveReplay(w http.ResponseWriter, outcome outcome) {
	for name, values := range outcome.header {
		for _, value := range values {
			w.Header().Add(name, value)
		}
	}
	w.Header().Set(ReplayHeader, "true")
	w.WriteHeader(outcome.status)
	_, _ = w.Write(outcome.body)
}

// serveConflict refuses a duplicate whose first request is still running.
//
// A 409 rather than a 429: the request was not refused for arriving too fast,
// it collided with another carrying the same key, and the caller's move is to
// retry the same request -- not to change it.
func serveConflict(w http.ResponseWriter) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(http.StatusConflict)
	_, _ = w.Write([]byte(
		`{"error":{"code":"idempotency_conflict","message":"a request with this Idempotency-Key is still in progress; retry it"}}`))
}

// scopeKey builds the per-caller, per-endpoint scope for a key.
//
// The project id comes from the context the auth middleware set. When it is
// absent -- a route mounted without that middleware -- the path stands in, so
// two endpoints can never share a scope even for an unauthenticated caller.
func scopeKey(r *http.Request) string {
	if project, ok := auth.ProjectIDFromContext(r.Context()); ok {
		return r.Method + "|" + project.String() + "|" + r.URL.Path + "|"
	}
	return r.Method + "|" + r.URL.Path + "|"
}

// capturingWriter records a response so it can be remembered and replayed.
//
// It still writes through to the real writer, so the caller who triggered the
// original request sees their answer immediately rather than waiting for the
// capture to be stored.
type capturingWriter struct {
	http.ResponseWriter
	header    http.Header
	status    int
	body      bytes.Buffer
	wroteHead bool
}

func (writer *capturingWriter) WriteHeader(status int) {
	if !writer.wroteHead {
		writer.status = status
		writer.wroteHead = true
	}
	writer.ResponseWriter.WriteHeader(status)
}

func (writer *capturingWriter) Write(payload []byte) (int, error) {
	if !writer.wroteHead {
		writer.status = http.StatusOK
		writer.wroteHead = true
	}
	// The header is snapshotted at the first write, which is the point the
	// response's shape is decided.
	if writer.header == nil {
		writer.header = http.Header{}
		for name, values := range writer.ResponseWriter.Header() {
			writer.header[name] = values
		}
	}
	writer.body.Write(payload)
	return writer.ResponseWriter.Write(payload)
}

// Unwrap exposes the wrapped writer so http.ResponseController still reaches
// the flusher and hijacker underneath.
func (writer *capturingWriter) Unwrap() http.ResponseWriter { return writer.ResponseWriter }

// trimKey bounds and trims a key, treating an oversized one as absent.
func trimKey(raw string) string {
	key := strings.TrimSpace(raw)
	if key == "" || len(key) > maxKeyLength {
		return ""
	}
	return key
}
