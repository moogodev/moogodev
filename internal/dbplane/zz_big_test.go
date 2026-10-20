package dbplane

import (
	"context"
	"testing"

	"github.com/google/uuid"
)

func TestVacuumOversizeError(t *testing.T) {
	manager := newTestManager(t, 16<<20)
	ctx := context.Background()
	projectID := uuid.New()
	if err := manager.InitializeProject(ctx, projectID); err != nil {
		t.Fatalf("initialize: %v", err)
	}
	fillAndFree(t, manager, projectID, 1400)

	conn, release, err := manager.acquire(projectID)
	if err != nil {
		t.Fatalf("acquire: %v", err)
	}
	defer release()

	var maxPages, pageCount int64
	_ = conn.db.QueryRowContext(ctx, "PRAGMA max_page_count").Scan(&maxPages)
	_ = conn.db.QueryRowContext(ctx, "SELECT page_count FROM pragma_page_count()").Scan(&pageCount)

	// Push the file near its ceiling with rows that stay live.
	var x string
	for pageCount < maxPages-40 {
		if _, err := manager.Exec(ctx, projectID, "CREATE TABLE IF NOT EXISTS keep (x TEXT)", nil); err != nil {
			t.Fatalf("create keep: %v", err)
		}
		if _, err := manager.Exec(ctx, projectID, "INSERT INTO keep (x) VALUES (?)", []any{make([]byte, 8000)}); err != nil {
			t.Fatalf("insert keep: %v", err)
		}
		_ = conn.db.QueryRowContext(ctx, "SELECT page_count FROM pragma_page_count()").Scan(&pageCount)
	}
	t.Logf("maxPages=%d pageCount=%d", maxPages, pageCount)
	_ = x

	before, _ := DatabaseSizeBytes(manager.databasePath(projectID))
	_, err = conn.db.ExecContext(ctx, "VACUUM")
	t.Logf("vacuum error: %v (%T)", err, err)
	after, _ := DatabaseSizeBytes(manager.databasePath(projectID))
	t.Logf("size before=%d after=%d", before, after)
}
