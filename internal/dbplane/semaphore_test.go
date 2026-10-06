package dbplane

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
)

// TestAcquireSlotsBlocksWhenProjectGateIsFull fills one project's gate and
// asserts the next caller gives up with ErrBusy when its context ends.
//
// The gate is filled by hand rather than by holding real slots, so the test
// measures the per-project budget on any host, regardless of how many
// process-wide slots its core count happens to provide.
func TestAcquireSlotsBlocksWhenProjectGateIsFull(t *testing.T) {
	manager := newTestManagerWithCache(t, 512)
	projectID := uuid.New()

	gate, err := manager.projectGate(projectID)
	if err != nil {
		t.Fatalf("project gate: %v", err)
	}
	for len(gate) < cap(gate) {
		gate <- struct{}{}
	}

	ctx, cancel := context.WithTimeout(context.Background(), 50*time.Millisecond)
	defer cancel()
	if _, err := manager.acquireSlots(ctx, projectID); !errors.Is(err, ErrBusy) {
		t.Errorf("acquire with a full gate: got %v, want ErrBusy", err)
	}
}

// TestAcquireSlotsBlocksWhenProcessBudgetIsFull is the same check for the
// process-wide ceiling.
func TestAcquireSlotsBlocksWhenProcessBudgetIsFull(t *testing.T) {
	manager := newTestManagerWithCache(t, 512)
	for len(manager.slots) < cap(manager.slots) {
		manager.slots <- struct{}{}
	}
	defer func() {
		for len(manager.slots) > 0 {
			<-manager.slots
		}
	}()

	ctx, cancel := context.WithTimeout(context.Background(), 50*time.Millisecond)
	defer cancel()
	if _, err := manager.acquireSlots(ctx, uuid.New()); !errors.Is(err, ErrBusy) {
		t.Errorf("acquire with a full process budget: got %v, want ErrBusy", err)
	}
}

// TestAcquireSlotsFailsFastOnCancelledContext asserts a caller whose request
// is already dead does not sit in the queue at all.
func TestAcquireSlotsFailsFastOnCancelledContext(t *testing.T) {
	manager := newTestManagerWithCache(t, 512)

	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	if _, err := manager.acquireSlots(ctx, uuid.New()); !errors.Is(err, ErrBusy) {
		t.Errorf("acquire with a cancelled context: got %v, want ErrBusy", err)
	}
}

// TestAcquireSlotsReturnsBudget asserts a released slot actually frees both
// budgets, and that a double release does not drain a slot twice.
func TestAcquireSlotsReturnsBudget(t *testing.T) {
	manager := newTestManagerWithCache(t, 512)
	projectID := uuid.New()

	gate, err := manager.projectGate(projectID)
	if err != nil {
		t.Fatalf("project gate: %v", err)
	}
	slotCount := len(manager.slots)
	gateCount := len(gate)

	release, err := manager.acquireSlots(context.Background(), projectID)
	if err != nil {
		t.Fatalf("acquire: %v", err)
	}
	if len(manager.slots) != slotCount+1 || len(gate) != gateCount+1 {
		t.Fatalf("slots = %d/%d, gate = %d/%d; want both budgets taken",
			len(manager.slots), cap(manager.slots), len(gate), cap(gate))
	}

	release()
	release()
	if len(manager.slots) != slotCount || len(gate) != gateCount {
		t.Errorf("slots = %d, gate = %d after release; want both budgets returned",
			len(manager.slots), len(gate))
	}
}
