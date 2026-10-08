package news

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	_ "modernc.org/sqlite"
)

// Post is one What's-new entry.
//
// CreatedAt and UpdatedAt travel as RFC3339 UTC strings: the changelog only
// ever displays them, and a string that sorts lexicographically is the same
// order SQLite keeps.
type Post struct {
	ID        int64  `json:"id"`
	Slug      string `json:"slug"`
	Title     string `json:"title"`
	Body      string `json:"body"`
	Published bool   `json:"published"`
	CreatedAt string `json:"created_at"`
	UpdatedAt string `json:"updated_at"`
}

// Store is the posts table and nothing else.
type Store struct {
	db *sql.DB
}

// OpenStore opens (creating if needed) the SQLite database at path.
//
// ":memory:" works too, which is what the tests use.
func OpenStore(path string) (*Store, error) {
	db, err := sql.Open("sqlite", path)
	if err != nil {
		return nil, fmt.Errorf("news: open database: %w", err)
	}
	// One connection: the service is an admin writing posts and a page
	// reading them. Serialising is simpler than reasoning about WAL and
	// writer contention, and nothing here is on a hot path.
	db.SetMaxOpenConns(1)

	for _, pragma := range []string{
		"PRAGMA busy_timeout = 5000",
		"PRAGMA journal_mode = WAL",
		"PRAGMA foreign_keys = ON",
	} {
		if _, err := db.Exec(pragma); err != nil {
			db.Close()
			return nil, fmt.Errorf("news: %s: %w", pragma, err)
		}
	}

	const schema = `
CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  published INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_posts_published_created ON posts(published, created_at DESC);
`
	if _, err := db.Exec(schema); err != nil {
		db.Close()
		return nil, fmt.Errorf("news: create schema: %w", err)
	}
	return &Store{db: db}, nil
}

// Close releases the database.
func (store *Store) Close() error {
	return store.db.Close()
}

// ListPublished returns published posts, newest first — the public changelog.
func (store *Store) ListPublished(ctx context.Context) ([]Post, error) {
	return store.list(ctx, `SELECT id, slug, title, body, published, created_at, updated_at
FROM posts WHERE published = 1 ORDER BY created_at DESC, id DESC`)
}

// ListAll returns every post, newest first — the editor's list.
func (store *Store) ListAll(ctx context.Context) ([]Post, error) {
	return store.list(ctx, `SELECT id, slug, title, body, published, created_at, updated_at
FROM posts ORDER BY created_at DESC, id DESC`)
}

func (store *Store) list(ctx context.Context, query string) ([]Post, error) {
	rows, err := store.db.QueryContext(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("news: list posts: %w", err)
	}
	defer rows.Close()

	posts := []Post{}
	for rows.Next() {
		var post Post
		var published int
		if err := rows.Scan(&post.ID, &post.Slug, &post.Title, &post.Body, &published, &post.CreatedAt, &post.UpdatedAt); err != nil {
			return nil, fmt.Errorf("news: scan post: %w", err)
		}
		post.Published = published == 1
		posts = append(posts, post)
	}
	return posts, rows.Err()
}

// GetByID returns one post.
func (store *Store) GetByID(ctx context.Context, id int64) (Post, error) {
	var post Post
	var published int
	err := store.db.QueryRowContext(ctx, `SELECT id, slug, title, body, published, created_at, updated_at
FROM posts WHERE id = ?`, id).Scan(&post.ID, &post.Slug, &post.Title, &post.Body, &published, &post.CreatedAt, &post.UpdatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return Post{}, ErrNotFound
	}
	if err != nil {
		return Post{}, fmt.Errorf("news: get post: %w", err)
	}
	post.Published = published == 1
	return post, nil
}

// GetBySlug returns one published post by its URL form — the detail page of
// the mini-blog. Drafts answer as if they do not exist, because this is the
// public read path and the editor has its own.
func (store *Store) GetBySlug(ctx context.Context, slug string) (Post, error) {
	var post Post
	var published int
	err := store.db.QueryRowContext(ctx, `SELECT id, slug, title, body, published, created_at, updated_at
FROM posts WHERE slug = ? AND published = 1`, slug).Scan(&post.ID, &post.Slug, &post.Title, &post.Body, &published, &post.CreatedAt, &post.UpdatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return Post{}, ErrNotFound
	}
	if err != nil {
		return Post{}, fmt.Errorf("news: get post by slug: %w", err)
	}
	post.Published = published == 1
	return post, nil
}

// Create inserts a post and returns it with its assigned id and timestamps.
func (store *Store) Create(ctx context.Context, slug, title, body string, published bool) (Post, error) {
	now := time.Now().UTC().Format(time.RFC3339)
	result, err := store.db.ExecContext(ctx, `INSERT INTO posts (slug, title, body, published, created_at, updated_at)
VALUES (?, ?, ?, ?, ?, ?)`, slug, title, body, boolInt(published), now, now)
	if err != nil {
		return Post{}, fmt.Errorf("news: create post: %w", err)
	}
	id, err := result.LastInsertId()
	if err != nil {
		return Post{}, fmt.Errorf("news: create post id: %w", err)
	}
	return store.GetByID(ctx, id)
}

// Update replaces a post's content. CreatedAt is preserved.
func (store *Store) Update(ctx context.Context, id int64, slug, title, body string, published bool) (Post, error) {
	now := time.Now().UTC().Format(time.RFC3339)
	result, err := store.db.ExecContext(ctx, `UPDATE posts
SET slug = ?, title = ?, body = ?, published = ?, updated_at = ?
WHERE id = ?`, slug, title, body, boolInt(published), now, id)
	if err != nil {
		return Post{}, fmt.Errorf("news: update post: %w", err)
	}
	changed, err := result.RowsAffected()
	if err != nil {
		return Post{}, fmt.Errorf("news: update post: %w", err)
	}
	if changed == 0 {
		return Post{}, ErrNotFound
	}
	return store.GetByID(ctx, id)
}

// Delete removes a post.
func (store *Store) Delete(ctx context.Context, id int64) error {
	result, err := store.db.ExecContext(ctx, `DELETE FROM posts WHERE id = ?`, id)
	if err != nil {
		return fmt.Errorf("news: delete post: %w", err)
	}
	changed, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("news: delete post: %w", err)
	}
	if changed == 0 {
		return ErrNotFound
	}
	return nil
}

// SeedIfEmpty inserts the first three entries when the table is empty, so a
// fresh deployment's changelog is not blank and the dashboard's links have
// somewhere to land. It reports whether it seeded.
func (store *Store) SeedIfEmpty(ctx context.Context) (bool, error) {
	var count int
	if err := store.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM posts`).Scan(&count); err != nil {
		return false, fmt.Errorf("news: count posts: %w", err)
	}
	if count > 0 {
		return false, nil
	}

	seed := []Post{
		{
			Slug: "email-password-signin", Title: "Email and password sign-in with password reset",
			Body:      "Accounts can now be created with an email and password, verified by mail, and recovered through a reset link when the password is forgotten.",
			Published: true, CreatedAt: "2026-09-15T09:00:00Z", UpdatedAt: "2026-09-15T09:00:00Z",
		},
		{
			Slug: "per-project-buckets", Title: "Per-project buckets with a 256 MB quota",
			Body:      "Every project gets its own buckets with a 256 MB quota, a browser for objects, public/private toggles, and scoped storage credentials.",
			Published: true, CreatedAt: "2026-10-01T09:00:00Z", UpdatedAt: "2026-10-01T09:00:00Z",
		},
		{
			Slug: "spreadsheet-table-editor", Title: "Spreadsheet-style table editor with inline editing",
			Body:      "Tables can be edited inline like a spreadsheet: change a cell, move to the next, and the write goes through the same SQL API your application uses.",
			Published: true, CreatedAt: "2026-10-05T09:00:00Z", UpdatedAt: "2026-10-05T09:00:00Z",
		},
	}
	for _, post := range seed {
		if _, err := store.db.ExecContext(ctx, `INSERT INTO posts (slug, title, body, published, created_at, updated_at)
VALUES (?, ?, ?, ?, ?, ?)`, post.Slug, post.Title, post.Body, boolInt(post.Published), post.CreatedAt, post.UpdatedAt); err != nil {
			return false, fmt.Errorf("news: seed %q: %w", post.Slug, err)
		}
	}
	return true, nil
}

// ErrNotFound means no post has the requested id.
var ErrNotFound = errors.New("news: post not found")

func boolInt(value bool) int {
	if value {
		return 1
	}
	return 0
}
