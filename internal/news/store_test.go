package news

import (
	"context"
	"errors"
	"path/filepath"
	"testing"
)

func newTestStore(t *testing.T) *Store {
	t.Helper()
	store, err := OpenStore(filepath.Join(t.TempDir(), "news.db"))
	if err != nil {
		t.Fatalf("open store: %v", err)
	}
	t.Cleanup(func() { _ = store.Close() })
	return store
}

func TestSeedIfEmpty(t *testing.T) {
	store := newTestStore(t)
	ctx := context.Background()

	seeded, err := store.SeedIfEmpty(ctx)
	if err != nil {
		t.Fatalf("seed: %v", err)
	}
	if !seeded {
		t.Fatal("first call should seed")
	}

	posts, err := store.ListPublished(ctx)
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if len(posts) != 3 {
		t.Fatalf("got %d seeded posts, want 3", len(posts))
	}
	// Newest first: the 2026-10-05 spreadsheet entry leads.
	if posts[0].Slug != "spreadsheet-table-editor" {
		t.Errorf("newest = %q, want spreadsheet-table-editor", posts[0].Slug)
	}
	if !posts[0].Published {
		t.Error("seeded post must be published")
	}

	// A second run must not duplicate anything.
	if seeded, err := store.SeedIfEmpty(ctx); err != nil || seeded {
		t.Fatalf("second seed = (%v, %v), want (false, nil)", seeded, err)
	}
}

func TestCreateUpdateDelete(t *testing.T) {
	store := newTestStore(t)
	ctx := context.Background()

	post, err := store.Create(ctx, "first-post", "First post", "Body one", false)
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	if post.ID < 1 || post.CreatedAt == "" || post.UpdatedAt == "" {
		t.Fatalf("create returned incomplete post: %+v", post)
	}
	if post.Published {
		t.Error("draft created as published")
	}

	// Drafts stay out of the public list but appear in the editor's.
	public, _ := store.ListPublished(ctx)
	if len(public) != 0 {
		t.Errorf("public list has %d drafts, want 0", len(public))
	}
	all, _ := store.ListAll(ctx)
	if len(all) != 1 {
		t.Errorf("all list has %d posts, want 1", len(all))
	}

	updated, err := store.Update(ctx, post.ID, "first-post", "First post, edited", "Body two", true)
	if err != nil {
		t.Fatalf("update: %v", err)
	}
	if updated.CreatedAt != post.CreatedAt {
		t.Errorf("createdAt changed: %q -> %q", post.CreatedAt, updated.CreatedAt)
	}
	if updated.Title != "First post, edited" || !updated.Published {
		t.Errorf("update not applied: %+v", updated)
	}

	// Same slug on another post must collide on the UNIQUE constraint.
	if _, err := store.Create(ctx, "first-post", "Collision", "", false); err == nil {
		t.Error("duplicate slug created without error")
	}

	if _, err := store.Update(ctx, 9999, "missing", "Missing", "", false); !errors.Is(err, ErrNotFound) {
		t.Errorf("update missing = %v, want ErrNotFound", err)
	}

	if err := store.Delete(ctx, post.ID); err != nil {
		t.Fatalf("delete: %v", err)
	}
	if err := store.Delete(ctx, post.ID); !errors.Is(err, ErrNotFound) {
		t.Errorf("second delete = %v, want ErrNotFound", err)
	}
	if got, err := store.GetByID(ctx, post.ID); !errors.Is(err, ErrNotFound) {
		t.Errorf("get deleted = (%+v, %v), want ErrNotFound", got, err)
	}
}
