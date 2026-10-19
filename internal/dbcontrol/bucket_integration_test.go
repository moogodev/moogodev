package dbcontrol

import (
	"context"
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
			objects, total, err := store.ListObjects(ctx, ObjectQuery{
				BucketID: bucket.ID,
				Prefix:   tc.prefix,
			})
			if err != nil {
				t.Fatalf("list %q: %v", tc.prefix, err)
			}
			if total != tc.want {
				t.Fatalf("prefix %q total = %d, want %d", tc.prefix, total, tc.want)
			}
			if int64(len(objects)) != tc.want {
				t.Fatalf("prefix %q returned %d objects, want %d",
					tc.prefix, len(objects), tc.want)
			}
			for _, object := range objects {
				if !strings.HasPrefix(object.Key, tc.prefix) {
					t.Fatalf("prefix %q returned %q, which does not start with it",
						tc.prefix, object.Key)
				}
			}
		})
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
