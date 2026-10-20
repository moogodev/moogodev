package dbcontrol

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"strings"
	"testing"

	"github.com/google/uuid"
)

// A prefix listing is a prefix match, not an equality test, and only real SQL
// can tell the difference: the handler's fake store filters with
// strings.HasPrefix, so the LIKE pattern this package builds is never exercised
// there. The bug -- a missing trailing % -- made every folder listing answer
// 200 with total 0 while the folder was full, which reads to a client as an
// empty folder rather than an error.
func TestListObjectsTreatsPrefixAsAPrefix(t *testing.T) {
	store := testStore(t)
	ctx := context.Background()

	user := newTestUser(t, store, 1)
	project := newTestProject(t, store, user.ID)
	bucket, err := store.CreateBucket(ctx, project.ID, "default")
	if err != nil {
		t.Fatalf("create bucket: %v", err)
	}

	keys := []string{
		"avatars/kit.png",
		"avatars/loop.png",
		"photos/cat.png",
		// Shares the text "avatars" without sharing the path boundary, so a
		// prefix of "avatars" must include it and "avatars/" must not.
		"avatars-notes.txt",
		// A literal % in the key, so a prefix carrying it has to be escaped.
		"50%/odd.png",
		// Matches an unescaped "50%/%" pattern but is not under "50%/".
		"50abc/skip.png",
	}
	for _, key := range keys {
		if _, _, err := store.PutObject(ctx, project.ID, bucket.ID, key, 10, "image/png", false); err != nil {
			t.Fatalf("put %q: %v", key, err)
		}
	}

	cases := []struct {
		name   string
		prefix string
		want   int64
	}{
		{"folder with trailing slash", "avatars/", 2},
		{"plain text prefix", "photo", 1},
		{"path boundary is not implied", "avatars", 3},
		{"wildcard in the prefix is literal", "50%/", 1},
		{"no match", "missing/", 0},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			page, err := store.ListObjects(ctx, ObjectQuery{
				BucketID: bucket.ID,
				Prefix:   tc.prefix,
			})
			if err != nil {
				t.Fatalf("list %q: %v", tc.prefix, err)
			}
			if page.Total != tc.want {
				t.Fatalf("prefix %q total = %d, want %d", tc.prefix, page.Total, tc.want)
			}
			if int64(len(page.Objects)) != tc.want {
				t.Fatalf("prefix %q returned %d objects, want %d",
					tc.prefix, len(page.Objects), tc.want)
			}
			for _, object := range page.Objects {
				if !strings.HasPrefix(object.Key, tc.prefix) {
					t.Fatalf("prefix %q returned %q, which does not start with it",
						tc.prefix, object.Key)
				}
			}
		})
	}
}

// walkPages follows a listing from its first page to its last, and returns
// every object it passed.
//
// It is the shape of the loop every client has to write, so it doubles as the
// assertion that the loop terminates: a cursor that pointed at its own page
// would walk in place for ever, and a cursor that skipped rows would lose
// objects between two pages.
func walkPages(t *testing.T, store *Store, query ObjectQuery) []BucketObject {
	t.Helper()

	var walked []BucketObject
	wantTotal := int64(-1)
	for pages := 0; ; pages++ {
		if pages > 50 {
			t.Fatal("the listing had not ended after 50 pages")
		}
		page, err := store.ListObjects(context.Background(), query)
		if err != nil {
			t.Fatalf("list page %d: %v", pages+1, err)
		}
		walked = append(walked, page.Objects...)

		// The count belongs to the filter, not to the page the cursor is on:
		// a pager doing page arithmetic from it would otherwise watch the
		// listing shrink by a page every time it moved.
		if wantTotal < 0 {
			wantTotal = page.Total
		}
		if page.Total != wantTotal {
			t.Fatalf("page %d reported total %d, want %d -- the filter never changed",
				pages+1, page.Total, wantTotal)
		}

		if page.NextCursor == "" {
			return walked
		}
		if len(page.Objects) != query.Limit {
			t.Fatalf("page %d held %d of %d objects and still promised a next page",
				pages+1, len(page.Objects), query.Limit)
		}
		query.Cursor = page.NextCursor
	}
}

// A page is reached by the cursor the previous page issued, and only real SQL
// proves the keyset reads the same rows the sort does: the position is a
// comparison in the ORDER BY columns, not a row number to skip.
func TestListObjectsPagesByCursor(t *testing.T) {
	store := testStore(t)
	ctx := context.Background()

	user := newTestUser(t, store, 1)
	project := newTestProject(t, store, user.ID)
	bucket, err := store.CreateBucket(ctx, project.ID, "default")
	if err != nil {
		t.Fatalf("create bucket: %v", err)
	}

	keys := []string{"a.txt", "b.txt", "c.txt", "d.txt", "e.txt"}
	for _, key := range keys {
		if _, _, err := store.PutObject(ctx, project.ID, bucket.ID, key, 10, "text/plain", false); err != nil {
			t.Fatalf("put %q: %v", key, err)
		}
	}

	query := ObjectQuery{BucketID: bucket.ID, OrderBy: "key", OrderDir: "asc", Limit: 2}
	first, err := store.ListObjects(ctx, query)
	if err != nil {
		t.Fatalf("first page: %v", err)
	}
	if len(first.Objects) != 2 || first.NextCursor == "" {
		t.Fatalf("first page = %d objects with cursor %q, want 2 and a cursor",
			len(first.Objects), first.NextCursor)
	}
	if first.Total != int64(len(keys)) {
		t.Errorf("total = %d, want %d -- the filter's count, not the page's",
			first.Total, len(keys))
	}

	walked := walkPages(t, store, query)
	if len(walked) != len(keys) {
		t.Fatalf("walked %d objects, want %d", len(walked), len(keys))
	}
	for index := range keys {
		if walked[index].Key != keys[index] {
			t.Fatalf("object %d = %q, want %q", index, walked[index].Key, keys[index])
		}
	}
}

// Rows that tie on the sort column are where a cursor earns its keep: the id
// breaks the tie, and a page boundary sitting inside a run of equal values has
// to land between two rows rather than in the middle of one.
func TestListObjectsPagesThroughTies(t *testing.T) {
	store := testStore(t)
	ctx := context.Background()

	user := newTestUser(t, store, 1)
	project := newTestProject(t, store, user.ID)
	bucket, err := store.CreateBucket(ctx, project.ID, "default")
	if err != nil {
		t.Fatalf("create bucket: %v", err)
	}

	// Three equal sizes, so the boundary between page one and page two falls
	// inside the run of them.
	for index, size := range []int64{10, 5, 10, 10, 5} {
		key := fmt.Sprintf("object-%d.bin", index)
		if _, _, err := store.PutObject(ctx, project.ID, bucket.ID, key, size, "application/octet-stream", false); err != nil {
			t.Fatalf("put %q: %v", key, err)
		}
	}

	walked := walkPages(t, store, ObjectQuery{
		BucketID: bucket.ID, OrderBy: "size", OrderDir: "asc", Limit: 2,
	})
	if len(walked) != 5 {
		t.Fatalf("walked %d objects, want 5", len(walked))
	}

	seen := map[string]bool{}
	for _, object := range walked {
		if seen[object.Key] {
			t.Fatalf("%q was returned by two pages", object.Key)
		}
		seen[object.Key] = true
	}
	for index, object := range walked {
		if index == 0 {
			continue
		}
		previous := walked[index-1]
		if object.SizeBytes < previous.SizeBytes {
			t.Fatalf("object %d is %d bytes after one of %d: the walk left its sort order",
				index, object.SizeBytes, previous.SizeBytes)
		}
		if object.SizeBytes == previous.SizeBytes {
			// Equal sizes keep a fixed order between them, which is what makes
			// the boundary between two pages a position rather than a guess.
			if bytes.Compare(object.ID[:], previous.ID[:]) < 0 {
				t.Fatalf("two objects of %d bytes came back in the wrong order: %s before %s",
					object.SizeBytes, previous.ID, object.ID)
			}
		}
	}
}

// A cursor belongs to the listing that issued it. Presenting it anywhere else
// is refused, because applying it would return rows from a position in a
// different order and read as objects skipped or repeated.
func TestListObjectsRefusesACursorFromAnotherListing(t *testing.T) {
	store := testStore(t)
	ctx := context.Background()

	user := newTestUser(t, store, 1)
	project := newTestProject(t, store, user.ID)
	mine, err := store.CreateBucket(ctx, project.ID, "mine")
	if err != nil {
		t.Fatalf("create bucket: %v", err)
	}
	other, err := store.CreateBucket(ctx, project.ID, "other")
	if err != nil {
		t.Fatalf("create second bucket: %v", err)
	}
	// Keys are unique per project rather than per bucket, so the two buckets
	// need names of their own: putting "a.txt" in the second one would replace
	// the first, which is how an upload to an existing key behaves.
	for _, put := range []struct {
		bucket uuid.UUID
		keys   []string
	}{
		{mine.ID, []string{"a.txt", "b.txt"}},
		{other.ID, []string{"c.txt", "d.txt"}},
	} {
		for _, key := range put.keys {
			if _, _, err := store.PutObject(ctx, project.ID, put.bucket, key, 1, "text/plain", false); err != nil {
				t.Fatalf("put %q: %v", key, err)
			}
		}
	}

	first, err := store.ListObjects(ctx, ObjectQuery{
		BucketID: mine.ID, OrderBy: "key", OrderDir: "asc", Limit: 1,
	})
	if err != nil {
		t.Fatalf("first page: %v", err)
	}
	if first.NextCursor == "" {
		t.Fatal("a full page of two objects should promise another page")
	}

	cases := []struct {
		name  string
		query ObjectQuery
	}{
		{"another bucket", ObjectQuery{
			BucketID: other.ID, OrderBy: "key", OrderDir: "asc", Limit: 1,
			Cursor: first.NextCursor,
		}},
		{"another filter", ObjectQuery{
			BucketID: mine.ID, Prefix: "notes/", OrderBy: "key", OrderDir: "asc", Limit: 1,
			Cursor: first.NextCursor,
		}},
		{"another sort", ObjectQuery{
			BucketID: mine.ID, OrderBy: "created", OrderDir: "asc", Limit: 1,
			Cursor: first.NextCursor,
		}},
		{"the other direction", ObjectQuery{
			BucketID: mine.ID, OrderBy: "key", OrderDir: "desc", Limit: 1,
			Cursor: first.NextCursor,
		}},
		{"not a cursor at all", ObjectQuery{
			BucketID: mine.ID, OrderBy: "key", OrderDir: "asc", Limit: 1, Cursor: "nonsense",
		}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			_, err := store.ListObjects(ctx, tc.query)
			if err == nil {
				t.Fatal("the cursor was accepted where it does not belong")
			}
			if !errors.Is(err, ErrInvalidCursor) {
				t.Fatalf("error = %v, want ErrInvalidCursor", err)
			}
		})
	}

	// The same cursor, with the listing it came from, still works -- so the
	// refusals above are about the listing and not about the token.
	same, err := store.ListObjects(ctx, ObjectQuery{
		BucketID: mine.ID, OrderBy: "key", OrderDir: "asc", Limit: 1,
		Cursor: first.NextCursor,
	})
	if err != nil {
		t.Fatalf("the issuing listing refused its own cursor: %v", err)
	}
	if len(same.Objects) != 1 || same.Objects[0].Key != "b.txt" {
		t.Fatalf("page two = %+v, want b.txt", same.Objects)
	}
}

// BucketStats backs the bucket summary in an object listing. It counts the
// whole bucket, not the filtered page that sits under it, so it is pinned
// separately from the listing it is attached to.
func TestBucketStatsCountsTheWholeBucket(t *testing.T) {
	store := testStore(t)
	ctx := context.Background()

	user := newTestUser(t, store, 1)
	project := newTestProject(t, store, user.ID)
	bucket, err := store.CreateBucket(ctx, project.ID, "images")
	if err != nil {
		t.Fatalf("create bucket: %v", err)
	}
	other, err := store.CreateBucket(ctx, project.ID, "other")
	if err != nil {
		t.Fatalf("create second bucket: %v", err)
	}

	puts := []struct {
		bucketID uuid.UUID
		key      string
		size     int64
	}{
		{bucket.ID, "a.png", 100},
		{bucket.ID, "b.png", 50},
		{other.ID, "c.png", 7},
	}
	for _, put := range puts {
		if _, _, err := store.PutObject(ctx, project.ID, put.bucketID, put.key, put.size,
			"image/png", false); err != nil {
			t.Fatalf("put %q: %v", put.key, err)
		}
	}

	count, size, err := store.BucketStats(ctx, project.ID, bucket.ID)
	if err != nil {
		t.Fatalf("bucket stats: %v", err)
	}
	if count != 2 || size != 150 {
		t.Fatalf("stats = %d objects / %d bytes, want 2 / 150", count, size)
	}

	// A bucket with nothing in it reports zeroes rather than an error, which is
	// what lets the listing show an empty bucket instead of failing.
	empty, err := store.CreateBucket(ctx, project.ID, "empty")
	if err != nil {
		t.Fatalf("create empty bucket: %v", err)
	}
	count, size, err = store.BucketStats(ctx, project.ID, empty.ID)
	if err != nil {
		t.Fatalf("empty bucket stats: %v", err)
	}
	if count != 0 || size != 0 {
		t.Fatalf("empty stats = %d / %d, want 0 / 0", count, size)
	}
}
