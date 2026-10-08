package dbplane

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/moogodev/moogodev/pkg/logger"
)

// TestWriteLockWaitHonorsContext: waiting for the previous writer is a queue
// position, not a statement. A caller whose request ends while queued has to
// be able to walk away with ErrBusy -- a plain mutex keeps them waiting for a
// response nobody will read.
func TestWriteLockWaitHonorsContext(t *testing.T) {
	manager := newTestManager(t, 100*1024*1024)
	projectID := uuid.New()
	ctx := context.Background()
	if err := manager.InitializeProject(ctx, projectID); err != nil {
		t.Fatalf("initialize project: %v", err)
	}

	connection, release, err := manager.acquire(projectID)
	if err != nil {
		t.Fatalf("acquire: %v", err)
	}
	defer release()
	if err := lockWrite(ctx, connection.writeLock); err != nil {
		t.Fatalf("hold write lock: %v", err)
	}
	defer func() { <-connection.writeLock }()

	waitCtx, cancel := context.WithTimeout(ctx, 100*time.Millisecond)
	defer cancel()

	done := make(chan error, 1)
	go func() {
		_, err := manager.Exec(waitCtx, projectID, `CREATE TABLE t (x)`, nil)
		done <- err
	}()

	select {
	case err := <-done:
		if !errors.Is(err, ErrBusy) {
			t.Fatalf("queued write: err = %v, want ErrBusy", err)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("queued write kept waiting after its context ended")
	}
}

// TestStatementBudgetStartsAfterTheWriteLock: the 15 second statement budget
// belongs to the statement. A writer that queued longer than the budget must
// still get the full budget once it holds the lock -- and must not arrive at
// a statement context that expired while it waited.
func TestStatementBudgetStartsAfterTheWriteLock(t *testing.T) {
	manager, err := NewManager(t.TempDir(), 100*1024*1024, 300*time.Millisecond, 512, logger.Nop())
	if err != nil {
		t.Fatalf("create manager: %v", err)
	}
	t.Cleanup(func() { _ = manager.Close() })

	projectID := uuid.New()
	ctx := context.Background()
	if err := manager.InitializeProject(ctx, projectID); err != nil {
		t.Fatalf("initialize project: %v", err)
	}

	connection, release, err := manager.acquire(projectID)
	if err != nil {
		t.Fatalf("acquire: %v", err)
	}
	defer release()
	if err := lockWrite(ctx, connection.writeLock); err != nil {
		t.Fatalf("hold write lock: %v", err)
	}

	released := make(chan struct{})
	go func() {
		time.Sleep(900 * time.Millisecond)
		<-connection.writeLock
		close(released)
	}()

	start := time.Now()
	_, err = manager.Exec(ctx, projectID, `CREATE TABLE t (x)`, nil)
	elapsed := time.Since(start)
	<-released

	if err != nil {
		t.Fatalf("write after a 900ms queue wait: err = %v (elapsed %v); the budget must start once the lock is held", err, elapsed)
	}
	if elapsed < 800*time.Millisecond {
		t.Fatalf("write returned before the lock was released (elapsed %v)", elapsed)
	}
}

// TestBackupHonorsContextWhileWaiting: BackupDatabase takes the same write
// lock, so it has to give up the same way when its request ends while queued.
func TestBackupHonorsContextWhileWaiting(t *testing.T) {
	manager := newTestManager(t, 100*1024*1024)
	projectID := uuid.New()
	ctx := context.Background()
	if err := manager.InitializeProject(ctx, projectID); err != nil {
		t.Fatalf("initialize project: %v", err)
	}

	connection, release, err := manager.acquire(projectID)
	if err != nil {
		t.Fatalf("acquire: %v", err)
	}
	defer release()
	if err := lockWrite(ctx, connection.writeLock); err != nil {
		t.Fatalf("hold write lock: %v", err)
	}
	defer func() { <-connection.writeLock }()

	waitCtx, cancel := context.WithTimeout(ctx, 100*time.Millisecond)
	defer cancel()

	done := make(chan error, 1)
	go func() {
		_, err := manager.BackupDatabase(waitCtx, projectID)
		done <- err
	}()

	select {
	case err := <-done:
		if err == nil {
			t.Fatal("backup reported success while the write lock was held")
		}
		if !errors.Is(err, context.DeadlineExceeded) {
			t.Fatalf("backup: err = %v, want the context deadline", err)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("backup kept waiting after its context ended")
	}
}
