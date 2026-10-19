package idempotency

import (
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"
)

// countingHandler reports how many times the wrapped handler actually ran, and
// answers with a body that names the run.
func countingHandler(runs *int, mu *sync.Mutex, status int, body string) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		mu.Lock()
		*runs++
		run := *runs
		mu.Unlock()

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(status)
		_, _ = w.Write([]byte(body + string(rune('0'+run))))
	})
}

func requestWithKey(key string) *http.Request {
	request := httptest.NewRequest(http.MethodPost, "/p/x/exec", nil)
	if key != "" {
		request.Header.Set(Header, key)
	}
	return request
}

// The whole point: a retried write with the same key runs the handler once and
// replays the first answer afterwards, so a timeout-and-retry cannot insert
// twice.
func TestReplaysTheFirstAnswerWithoutRunningAgain(t *testing.T) {
	store := New(time.Minute)
	var mu sync.Mutex
	runs := 0
	handler := store.Middleware(countingHandler(&runs, &mu, http.StatusAccepted, "run-"))

	first := httptest.NewRecorder()
	handler.ServeHTTP(first, requestWithKey("key-1"))

	second := httptest.NewRecorder()
	handler.ServeHTTP(second, requestWithKey("key-1"))

	mu.Lock()
	gotRuns := runs
	mu.Unlock()
	if gotRuns != 1 {
		t.Fatalf("handler ran %d times, want 1", gotRuns)
	}
	if first.Body.String() != second.Body.String() {
		t.Errorf("replay body = %q, want the first answer %q",
			second.Body.String(), first.Body.String())
	}
	if second.Header().Get(ReplayHeader) != "true" {
		t.Error("expected the replay to be marked with Idempotent-Replay")
	}
	if second.Code != first.Code {
		t.Errorf("replay status = %d, want %d", second.Code, first.Code)
	}
}

// A caller that sends no key gets the old behaviour: every request runs. The
// header is opt-in, and today's clients must not change at all.
func TestNoKeyMeansEveryRequestRuns(t *testing.T) {
	store := New(time.Minute)
	var mu sync.Mutex
	runs := 0
	handler := store.Middleware(countingHandler(&runs, &mu, http.StatusOK, "run-"))

	for i := 0; i < 3; i++ {
		recorder := httptest.NewRecorder()
		handler.ServeHTTP(recorder, requestWithKey(""))
	}

	mu.Lock()
	gotRuns := runs
	mu.Unlock()
	if gotRuns != 3 {
		t.Errorf("handler ran %d times, want 3", gotRuns)
	}
}

// Two different keys are two different writes, so both run. The key is the
// caller's promise about which retries belong together, not a global lock.
func TestDifferentKeysRunSeparately(t *testing.T) {
	store := New(time.Minute)
	var mu sync.Mutex
	runs := 0
	handler := store.Middleware(countingHandler(&runs, &mu, http.StatusOK, "run-"))

	for _, key := range []string{"key-a", "key-b", "key-c"} {
		recorder := httptest.NewRecorder()
		handler.ServeHTTP(recorder, requestWithKey(key))
	}

	mu.Lock()
	gotRuns := runs
	mu.Unlock()
	if gotRuns != 3 {
		t.Errorf("handler ran %d times, want 3 for three distinct keys", gotRuns)
	}
}

// A colliding duplicate -- the same key arriving while the first is still
// running -- is refused with a 409 instead of executing the write twice. The
// caller's move is to retry the same request, not to change it.
func TestConcurrentDuplicateIsRefusedWithConflict(t *testing.T) {
	store := New(time.Minute)
	started := make(chan struct{})
	release := make(chan struct{})
	var runs int
	var mu sync.Mutex

	slow := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		mu.Lock()
		runs++
		mu.Unlock()
		close(started)
		<-release
		w.WriteHeader(http.StatusCreated)
		_, _ = w.Write([]byte("first"))
	})
	handler := store.Middleware(slow)

	firstDone := make(chan struct{})
	go func() {
		defer close(firstDone)
		recorder := httptest.NewRecorder()
		handler.ServeHTTP(recorder, requestWithKey("key-slow"))
	}()

	<-started

	collide := httptest.NewRecorder()
	handler.ServeHTTP(collide, requestWithKey("key-slow"))

	if collide.Code != http.StatusConflict {
		t.Fatalf("colliding duplicate status = %d, want %d: %s",
			collide.Code, http.StatusConflict, collide.Body.String())
	}

	close(release)
	<-firstDone

	mu.Lock()
	gotRuns := runs
	mu.Unlock()
	if gotRuns != 1 {
		t.Errorf("handler ran %d times, want 1: the duplicate must not execute", gotRuns)
	}
}

// After the in-flight request finishes, the next retry gets the replay -- the
// conflict above is a pause, not a permanent refusal of that key.
func TestKeyBecomesReplayableAfterTheConflictClears(t *testing.T) {
	store := New(time.Minute)
	var mu sync.Mutex
	runs := 0
	handler := store.Middleware(countingHandler(&runs, &mu, http.StatusCreated, "run-"))

	first := httptest.NewRecorder()
	handler.ServeHTTP(first, requestWithKey("key-2"))

	retry := httptest.NewRecorder()
	handler.ServeHTTP(retry, requestWithKey("key-2"))

	mu.Lock()
	gotRuns := runs
	mu.Unlock()
	if gotRuns != 1 {
		t.Fatalf("handler ran %d times, want 1", gotRuns)
	}
	if retry.Header().Get(ReplayHeader) != "true" {
		t.Error("expected the retry after completion to be a replay")
	}
}

// A 5xx is not remembered: a caller retrying after a server error gets a real
// second attempt rather than the same failure handed back, because that is
// usually what a transient failure needs.
func TestServerErrorIsNotReplayed(t *testing.T) {
	store := New(time.Minute)
	var mu sync.Mutex
	runs := 0
	handler := store.Middleware(countingHandler(&runs, &mu, http.StatusInternalServerError, "run-"))

	for i := 0; i < 2; i++ {
		recorder := httptest.NewRecorder()
		handler.ServeHTTP(recorder, requestWithKey("key-5xx"))
	}

	mu.Lock()
	gotRuns := runs
	mu.Unlock()
	if gotRuns != 2 {
		t.Errorf("handler ran %d times, want 2: a 5xx must be retried, not replayed", gotRuns)
	}
	if store.Size() != 0 {
		t.Errorf("store holds %d entries, want 0 after a 5xx", store.Size())
	}
}

// A client error is deterministic and remembered, so a retry of the same bad
// request gets the same answer instead of re-running the work.
func TestClientErrorIsReplayed(t *testing.T) {
	store := New(time.Minute)
	var mu sync.Mutex
	runs := 0
	handler := store.Middleware(countingHandler(&runs, &mu, http.StatusBadRequest, "run-"))

	first := httptest.NewRecorder()
	handler.ServeHTTP(first, requestWithKey("key-4xx"))
	second := httptest.NewRecorder()
	handler.ServeHTTP(second, requestWithKey("key-4xx"))

	mu.Lock()
	gotRuns := runs
	mu.Unlock()
	if gotRuns != 1 {
		t.Errorf("handler ran %d times, want 1", gotRuns)
	}
}

// An oversized key is treated as absent rather than held in memory: it falls
// through to the normal path, which is safe because no answer was ever
// promised under a key that was never accepted.
func TestOversizedKeyIsTreatedAsAbsent(t *testing.T) {
	store := New(time.Minute)
	var mu sync.Mutex
	runs := 0
	handler := store.Middleware(countingHandler(&runs, &mu, http.StatusOK, "run-"))

	oversized := make([]byte, maxKeyLength+1)
	for index := range oversized {
		oversized[index] = 'x'
	}

	for i := 0; i < 2; i++ {
		recorder := httptest.NewRecorder()
		handler.ServeHTTP(recorder, requestWithKey(string(oversized)))
	}

	mu.Lock()
	gotRuns := runs
	mu.Unlock()
	if gotRuns != 2 {
		t.Errorf("handler ran %d times, want 2: an oversized key is ignored, not honoured", gotRuns)
	}
}

// Expired entries are dropped so a process that has been up for days does not
// hold an answer for a key nobody has sent in a long time. A key past its ttl
// runs again rather than replaying stale bytes.
func TestExpiredEntryRunsAgain(t *testing.T) {
	store := New(time.Minute)
	clock := time.Now()
	store.now = func() time.Time { return clock }

	var mu sync.Mutex
	runs := 0
	handler := store.Middleware(countingHandler(&runs, &mu, http.StatusOK, "run-"))

	first := httptest.NewRecorder()
	handler.ServeHTTP(first, requestWithKey("key-exp"))

	// Age the entry past its ttl, then push the sweep clock forward so the
	// next request prunes it.
	clock = clock.Add(2 * time.Minute)

	second := httptest.NewRecorder()
	handler.ServeHTTP(second, requestWithKey("key-exp"))

	mu.Lock()
	gotRuns := runs
	mu.Unlock()
	if gotRuns != 2 {
		t.Errorf("handler ran %d times, want 2 after the entry expired", gotRuns)
	}
	if second.Header().Get(ReplayHeader) == "true" {
		t.Error("an expired entry must not replay")
	}
}

// The key is scoped per endpoint and per caller, so the same key on two routes
// cannot replay an answer across them. A write to /exec and a write to
// /transaction are different promises even under one string.
func TestScopeIsPerEndpoint(t *testing.T) {
	store := New(time.Minute)
	var mu sync.Mutex
	runs := 0
	handler := store.Middleware(countingHandler(&runs, &mu, http.StatusOK, "run-"))

	exec := httptest.NewRequest(http.MethodPost, "/p/x/exec", nil)
	exec.Header.Set(Header, "shared-key")
	execRun := httptest.NewRecorder()
	handler.ServeHTTP(execRun, exec)

	txn := httptest.NewRequest(http.MethodPost, "/p/x/transaction", nil)
	txn.Header.Set(Header, "shared-key")
	txnRun := httptest.NewRecorder()
	handler.ServeHTTP(txnRun, txn)

	mu.Lock()
	gotRuns := runs
	mu.Unlock()
	if gotRuns != 2 {
		t.Errorf("handler ran %d times, want 2: one key must not span two endpoints", gotRuns)
	}
}
