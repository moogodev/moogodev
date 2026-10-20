package cli

import (
	"net/http"
	"strings"
	"testing"
)

// The project key does not belong on an object route, so the listing carries
// the storage credential instead -- both halves of it, or the server has no
// secret to check the bearer token against.
func TestBucketListSendsTheStorageCredential(t *testing.T) {
	api := newFakeAPI(t, func(call apiCall) (int, string) {
		if call.Method != http.MethodGet {
			t.Errorf("method = %s, want GET", call.Method)
		}
		if want := "/p/" + testProjectID + "/bucket/"; call.Path != want {
			t.Errorf("path = %q, want %q", call.Path, want)
		}
		if want := "moogo_access_test"; call.Header.Get("X-Moogo-Access-Key-Id") != want {
			t.Errorf("X-Moogo-Access-Key-Id = %q, want %q", call.Header.Get("X-Moogo-Access-Key-Id"), want)
		}
		if want := "Bearer moogo_bucket_secret_test"; call.Header.Get("Authorization") != want {
			t.Errorf("Authorization = %q, want %q", call.Header.Get("Authorization"), want)
		}
		if got := call.Query.Get("prefix"); got != "avatars/" {
			t.Errorf("prefix = %q, want avatars/", got)
		}
		return 200, objectPageJSON
	})

	code, out, errOut := api.run("bucket", "ls", "avatars/")
	if code != ExitOK {
		t.Fatalf("exit = %d, out=%s err=%s", code, out, errOut)
	}
	if !strings.Contains(out, "avatars/ada.png") {
		t.Errorf("the table is missing the object:\n%s", out)
	}
	if !strings.Contains(out, "1 of 42 objects in avatars") {
		t.Errorf("the summary should say where the page ends:\n%s", out)
	}
	if !strings.Contains(out, "image/png") {
		t.Errorf("the content type should be readable:\n%s", out)
	}
}

// --json exists so a script can read fields this client does not model, which
// means the answer has to arrive as it came, not as the parsed struct would
// re-encode it.
func TestBucketListJSONPrintsWhatTheAPISent(t *testing.T) {
	api := newFakeAPI(t, func(call apiCall) (int, string) {
		return 200, objectPageJSON
	})

	code, out, errOut := api.run("bucket", "ls", "--json")
	if code != ExitOK {
		t.Fatalf("exit = %d, out=%s err=%s", code, out, errOut)
	}
	if !strings.Contains(out, `"quota_bytes": 262144000`) {
		t.Errorf("--json dropped a field the client does not model:\n%s", out)
	}
	if !strings.Contains(out, "\n  \"success\"") {
		t.Errorf("--json should be indented for a person reading it:\n%s", out)
	}
}

func TestBucketListSendsTheCursorAndLimit(t *testing.T) {
	api := newFakeAPI(t, func(call apiCall) (int, string) {
		if got := call.Query.Get("limit"); got != "500" {
			t.Errorf("limit = %q, want 500", got)
		}
		if got := call.Query.Get("cursor"); got != "tok_previous" {
			t.Errorf("cursor = %q, want tok_previous", got)
		}
		if got := call.Query.Get("bucket"); got != "media" {
			t.Errorf("bucket = %q, want media", got)
		}
		return 200, objectPageJSON
	})

	if code, _, errOut := api.run("bucket", "ls", "--bucket", "media",
		"--limit", "500", "--cursor", "tok_previous"); code != ExitOK {
		t.Fatalf("exit = %d, err=%s", code, errOut)
	}
}

// A listing is walked to its end, one cursor at a time, so a bucket of three
// objects listed with no flags at all is three rows in one table -- and the
// second request has to carry the token the first answer issued.
func TestBucketListFollowsTheCursor(t *testing.T) {
	var asked []string
	var limits []string
	api := newFakeAPI(t, func(call apiCall) (int, string) {
		asked = append(asked, call.Query.Get("cursor"))
		limits = append(limits, call.Query.Get("limit"))
		if call.Query.Get("cursor") == "" {
			return 200, `{"success":true,"bucket":{"name":"avatars"},"objects":[
				{"key":"avatars/a.png","size_bytes":1,"content_type":"image/png","updated_at":"2026-10-18T09:12:44Z"},
				{"key":"avatars/b.png","size_bytes":2,"content_type":"image/png","updated_at":"2026-10-18T09:12:45Z"}],
				"total":3,"limit":2,"next_cursor":"tok_2","storage_used_bytes":6,"quota_bytes":262144000}`
		}
		return 200, `{"success":true,"bucket":{"name":"avatars"},"objects":[
			{"key":"avatars/c.png","size_bytes":3,"content_type":"image/png","updated_at":"2026-10-18T09:12:46Z"}],
			"total":3,"limit":2,"next_cursor":"","storage_used_bytes":6,"quota_bytes":262144000}`
	})

	code, out, errOut := api.run("bucket", "ls")
	if code != ExitOK {
		t.Fatalf("exit = %d, out=%s err=%s", code, out, errOut)
	}
	if len(asked) != 2 {
		t.Fatalf("the API was asked %d time(s), want 2 pages: %q", len(asked), asked)
	}
	if asked[1] != "tok_2" {
		t.Errorf("the second page carried cursor %q, want tok_2", asked[1])
	}
	// The largest page the API accepts, so walking a bucket costs a handful of
	// requests rather than one per hundred objects.
	if limits[0] != "1000" {
		t.Errorf("page size = %q, want 1000", limits[0])
	}
	for _, key := range []string{"avatars/a.png", "avatars/b.png", "avatars/c.png"} {
		if !strings.Contains(out, key) {
			t.Errorf("the table is missing %s:\n%s", key, out)
		}
	}
	if !strings.Contains(out, "3 of 3 objects in avatars") {
		t.Errorf("the summary should count every page:\n%s", out)
	}
	if strings.Contains(out, "next page:") {
		t.Errorf("a finished listing should not offer another page:\n%s", out)
	}
}

// --limit is how much to show, not how big to ask for. Stopping on it hands
// back the cursor that continues where the listing stopped.
func TestBucketListStopsAtTheLimitAndNamesTheCursor(t *testing.T) {
	var requests int
	api := newFakeAPI(t, func(call apiCall) (int, string) {
		requests++
		if got := call.Query.Get("limit"); got != "2" {
			t.Errorf("page size = %q, want 2 -- the limit is the cap", got)
		}
		return 200, `{"success":true,"bucket":{"name":"avatars"},"objects":[
			{"key":"avatars/a.png","size_bytes":1,"content_type":"image/png","updated_at":"2026-10-18T09:12:44Z"},
			{"key":"avatars/b.png","size_bytes":2,"content_type":"image/png","updated_at":"2026-10-18T09:12:45Z"}],
			"total":5,"limit":2,"next_cursor":"tok_more","storage_used_bytes":9,"quota_bytes":262144000}`
	})

	code, out, errOut := api.run("bucket", "ls", "--limit", "2")
	if code != ExitOK {
		t.Fatalf("exit = %d, out=%s err=%s", code, out, errOut)
	}
	if requests != 1 {
		t.Fatalf("the API was asked %d time(s), want 1", requests)
	}
	if !strings.Contains(out, "2 of 5 objects in avatars") {
		t.Errorf("the summary should say how much of the bucket was shown:\n%s", out)
	}
	if !strings.Contains(out, "next page: --cursor tok_more") {
		t.Errorf("the continuation should be a flag the user can paste back:\n%s", out)
	}
}

// --json answers with one document whether the bucket took one request or
// three, and the fields this client does not model are still in it.
func TestBucketListJSONFoldsThePagesTogether(t *testing.T) {
	api := newFakeAPI(t, func(call apiCall) (int, string) {
		if call.Query.Get("cursor") == "" {
			return 200, `{"success":true,"bucket":{"name":"avatars"},"objects":[
				{"key":"avatars/a.png","size_bytes":1}],
				"total":3,"limit":2,"next_cursor":"tok_2","storage_used_bytes":6,"quota_bytes":262144000}`
		}
		return 200, `{"success":true,"bucket":{"name":"avatars"},"objects":[
			{"key":"avatars/b.png","size_bytes":2},{"key":"avatars/c.png","size_bytes":3}],
			"total":3,"limit":2,"next_cursor":"","storage_used_bytes":6,"quota_bytes":262144000}`
	})

	code, out, errOut := api.run("bucket", "ls", "--json")
	if code != ExitOK {
		t.Fatalf("exit = %d, out=%s err=%s", code, out, errOut)
	}
	if strings.Count(out, `"key"`) != 3 {
		t.Errorf("--json should carry every page's objects once:\n%s", out)
	}
	if !strings.Contains(out, `"quota_bytes": 262144000`) {
		t.Errorf("--json dropped a field the client does not model:\n%s", out)
	}
	if !strings.Contains(out, `"next_cursor": ""`) {
		t.Errorf("the folded document should end the listing it folded:\n%s", out)
	}
	if !strings.Contains(out, "\n  \"success\"") {
		t.Errorf("--json should be indented for a person reading it:\n%s", out)
	}
}

// The storage credential is not the project key, and a command that cannot
// send it should say which two variables are missing rather than let the API
// answer unauthorized.
func TestBucketListNeedsAStorageCredential(t *testing.T) {
	api := newFakeAPI(t, func(call apiCall) (int, string) {
		t.Errorf("the CLI asked the API without a credential: %s %s", call.Method, call.Path)
		return 401, errorBody(http.StatusUnauthorized, "unauthorized", "authentication required")
	})

	code, _, errOut := api.runEnv(map[string]string{
		EnvBucketAccessKeyID: "",
		EnvBucketSecretKey:   "",
	}, "bucket", "ls")

	if code != ExitUsage {
		t.Fatalf("exit = %d, want %d", code, ExitUsage)
	}
	if !strings.Contains(errOut, EnvBucketAccessKeyID) || !strings.Contains(errOut, EnvBucketSecretKey) {
		t.Errorf("the message should name both variables:\n%s", errOut)
	}
}

func TestBucketListSaysSoWhenABucketIsEmpty(t *testing.T) {
	api := newFakeAPI(t, func(call apiCall) (int, string) {
		return 200, `{"success": true, "bucket": {"name": "avatars"}, "objects": [], "total": 0,
			"limit": 100, "next_cursor": "", "storage_used_bytes": 0, "quota_bytes": 262144000}`
	})

	code, out, errOut := api.run("bucket", "ls")
	if code != ExitOK {
		t.Fatalf("exit = %d, out=%s err=%s", code, out, errOut)
	}
	if !strings.Contains(out, "no objects in bucket avatars") {
		t.Errorf("output = %q", out)
	}
}

// One object at a time, and the separators of a path-like key survive, because
// one object is one URL path.
func TestBucketRemoveDeletesEachKey(t *testing.T) {
	var deleted []string
	api := newFakeAPI(t, func(call apiCall) (int, string) {
		if call.Method != http.MethodDelete {
			t.Errorf("method = %s, want DELETE", call.Method)
		}
		if got := call.Query.Get("prefix"); got != "" {
			t.Errorf("a plain delete should not ask for a prefix, got %q", got)
		}
		deleted = append(deleted, call.Path)
		return 200, `{"success": true, "deleted": 1, "freed_bytes": 1024,
			"storage_used_bytes": 0, "quota_bytes": 262144000}`
	})

	code, out, errOut := api.run("bucket", "rm", "avatars/ada.png", "a b.png")
	if code != ExitOK {
		t.Fatalf("exit = %d, out=%s err=%s", code, out, errOut)
	}

	want := []string{
		"/p/" + testProjectID + "/bucket/avatars/ada.png",
		"/p/" + testProjectID + "/bucket/a%20b.png",
	}
	if len(deleted) != len(want) {
		t.Fatalf("deleted %q, want %q", deleted, want)
	}
	for index := range want {
		if deleted[index] != want[index] {
			t.Errorf("delete %d = %q, want %q", index, deleted[index], want[index])
		}
	}
	if !strings.Contains(out, "deleted 2 objects") {
		t.Errorf("summary = %q", out)
	}
}

// Deleting a folder is a different command from deleting a key, and the API
// makes it opt-in by name. The CLI has to pass that on, or "rm photos" would
// quietly take the directory with it.
func TestBucketRemoveMarksAPrefixDelete(t *testing.T) {
	api := newFakeAPI(t, func(call apiCall) (int, string) {
		if got := call.Query.Get("prefix"); got != "true" {
			t.Errorf("prefix = %q, want true", got)
		}
		return 200, `{"success": true, "deleted_objects": 7, "storage_used_bytes": 0, "quota_bytes": 262144000}`
	})

	code, out, errOut := api.run("bucket", "rm", "--prefix", "photos")
	if code != ExitOK {
		t.Fatalf("exit = %d, out=%s err=%s", code, out, errOut)
	}
	if !strings.Contains(out, "deleted 7 objects") {
		t.Errorf("summary = %q", out)
	}
}

// A refusal on the second key has to say which key, or a script deleting a
// list is left guessing where it stopped.
func TestBucketRemoveNamesTheKeyThatFailed(t *testing.T) {
	api := newFakeAPI(t, func(call apiCall) (int, string) {
		if strings.Contains(call.Path, "missing.png") {
			return 404, errorBody(http.StatusNotFound, "not_found", "object not found")
		}
		return 200, `{"success": true, "deleted": 1, "freed_bytes": 0,
			"storage_used_bytes": 0, "quota_bytes": 262144000}`
	})

	code, _, errOut := api.run("bucket", "rm", "here.png", "missing.png")
	if code != ExitFailure {
		t.Fatalf("exit = %d, want %d", code, ExitFailure)
	}
	if !strings.Contains(errOut, "missing.png") || !strings.Contains(errOut, "not_found") {
		t.Errorf("the message should name the key and the code:\n%s", errOut)
	}
}

// objectPageJSON is a listing with every field the API documents, so a test can
// notice when the client stops reading one of them.
const objectPageJSON = `{
	"success": true,
	"bucket": {"id": "b1", "name": "avatars", "object_count": 42, "size_bytes": 4096, "is_public": false},
	"objects": [
		{"id": "o1", "bucket_id": "b1", "bucket": "avatars", "key": "avatars/ada.png",
		 "size_bytes": 12600, "content_type": "image/png", "is_public": true, "etag": "e1",
		 "url": "/p/x/bucket/avatars/ada.png", "preview_url": "", "public_url": "",
		 "created_at": "2026-10-18T09:12:44Z", "updated_at": "2026-10-18T09:12:44Z",
		 "last_modified": "2026-10-18T09:12:44Z"}
	],
	"total": 42,
	"limit": 100,
	"next_cursor": "",
	"storage_used_bytes": 10905190,
	"quota_bytes": 262144000
}`
