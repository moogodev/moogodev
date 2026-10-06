package dbplane

import (
	"context"
	"errors"
	"runtime"
	"sync"

	"github.com/google/uuid"

	"github.com/moogo/moogo/internal/metrics"
)

// ErrBusy means the project already had as many statements running as the
// manager allows and the caller's context ended while waiting for a slot.
//
// It is a distinct sentinel because the fix is to retry, not to change the
// request: handlers answer it with 503 and a Retry-After header.
var ErrBusy = errors.New("database is busy")

// perProjectSlots caps how many statements run at once for one project.
//
// The pool holds eight connections per project, so this matches it: a ninth
// statement waits for a slot instead of piling up behind the pool's own
// queue, where a cancelled request would leave an open connection waiting
// for a result nobody wants.
const perProjectSlots = 8

// acquireSlots takes one statement slot for this process and one for this
// project, in that order.
//
// Every caller takes them in the same order, so there is no cycle to
// deadlock on. Both waits honor ctx: a caller whose request is cancelled or
// times out while queued gets ErrBusy instead of running a statement for a
// response that will never be read.
//
// The returned release function must be called exactly once when the
// statement is finished, normally with defer.
func (manager *Manager) acquireSlots(ctx context.Context, projectID uuid.UUID) (func(), error) {
	// A context that is already done must not win the select below by
	// chance: with a free slot available, Go picks between the two ready
	// cases uniformly, so the wait would silently succeed for a request
	// nobody is listening for any more.
	if ctx.Err() != nil {
		return nil, ErrBusy
	}

	if err := takeSlot(ctx, manager.slots); err != nil {
		return nil, ErrBusy
	}

	gate, err := manager.projectGate(projectID)
	if err != nil {
		<-manager.slots
		return nil, err
	}
	if ctx.Err() != nil {
		<-manager.slots
		return nil, ErrBusy
	}

	if err := takeSlot(ctx, gate); err != nil {
		<-manager.slots
		return nil, ErrBusy
	}

	var once sync.Once
	release := func() {
		once.Do(func() {
			<-gate
			<-manager.slots
		})
	}
	return release, nil
}

// takeSlot fills ch with one slot, counting the wait in the queue-depth
// gauge while it blocks.
//
// The gauge only moves for a caller that actually had to wait: a free slot
// is taken on the non-blocking path, so moogo_query_queue_depth reports
// statements queued behind the ceiling rather than statements that ran.
func takeSlot(ctx context.Context, ch chan struct{}) error {
	select {
	case ch <- struct{}{}:
		return nil
	default:
	}

	metrics.QueueDepthAdd(1)
	defer metrics.QueueDepthAdd(-1)

	select {
	case ch <- struct{}{}:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}

// projectGate returns the per-project slot channel, creating it on first
// use. Gates live as long as the project entry, like the write locks, so a
// handle eviction never hands out a second gate and doubles the budget.
func (manager *Manager) projectGate(projectID uuid.UUID) (chan struct{}, error) {
	manager.mu.Lock()
	defer manager.mu.Unlock()

	if manager.closed {
		return nil, ErrClosed
	}
	gate, found := manager.gates[projectID]
	if !found {
		gate = make(chan struct{}, perProjectSlots)
		manager.gates[projectID] = gate
	}
	return gate, nil
}

// newSlotChannel returns the process-wide statement ceiling.
//
// Two slots per core is small on purpose: this is a protection against a
// herd of statements monopolizing a 2 GB host, not a throughput target. A
// project that needs more parallelism gets it from its own gate until this
// ceiling is reached.
func newSlotChannel() chan struct{} {
	return make(chan struct{}, 2*runtime.NumCPU())
}
