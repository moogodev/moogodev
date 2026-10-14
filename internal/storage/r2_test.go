package storage

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/xml"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"sort"
	"strings"
	"sync"
	"testing"

	"github.com/moogodev/moogodev/pkg/logger"
)

// fakeS3 is a minimal in-memory object store that speaks just enough of the
// S3 wire format for the client tests. It records the requests it sees so the
// tests can assert on headers the client is responsible for.
type fakeS3 struct {
	mu       sync.Mutex
	objects  map[string][]byte
	requests []recordedRequest
	// failFirst makes the handler return 503 for the first N calls, to
	// exercise the retry path.
	failFirst int
	calls     int
	pages     int
}

type recordedRequest struct {
	method        string
	path          string
	query         string
	contentLength int64
	contentType   string
	authorization string
	payloadHash   string
}

func newFakeS3() *fakeS3 {
	return &fakeS3{objects: map[string][]byte{}}
}

func (f *fakeS3) record(r *http.Request) {
	f.requests = append(f.requests, recordedRequest{
		method:        r.Method,
		path:          r.URL.Path,
		query:         r.URL.RawQuery,
		contentLength: r.ContentLength,
		contentType:   r.Header.Get("Content-Type"),
		authorization: r.Header.Get("Authorization"),
		payloadHash:   r.Header.Get("X-Amz-Content-Sha256"),
	})
}

func (f *fakeS3) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.calls++
	f.record(r)

	if f.failFirst > 0 {
		f.failFirst--
		http.Error(w, "try again", http.StatusServiceUnavailable)
		return
	}

	// Bucket-level: LIST.
	if r.URL.Path == "/bucket" {
		f.serveList(w, r)
		return
	}

	key := strings.TrimPrefix(r.URL.Path, "/bucket/")
	switch r.Method {
	case http.MethodPut:
		body, _ := io.ReadAll(r.Body)
		f.objects[key] = body
		w.Header().Set("ETag", `"`+hex.EncodeToString(sha256.New().Sum(body))+`"`)
		w.WriteHeader(http.StatusOK)
	case http.MethodGet, http.MethodHead:
		body, ok := f.objects[key]
		if !ok {
			http.Error(w, "no such key", http.StatusNotFound)
			return
		}
		w.Header().Set("Content-Length", fmt.Sprintf("%d", len(body)))
		w.Header().Set("ETag", `"abc"`)
		w.Header().Set("Last-Modified", "Wed, 14 Oct 2026 09:01:25 GMT")
		if r.Method == http.MethodGet {
			w.Write(body)
		}
	case http.MethodDelete:
		delete(f.objects, key)
		w.WriteHeader(http.StatusNoContent)
	default:
		http.Error(w, "bad method", http.StatusMethodNotAllowed)
	}
}

func (f *fakeS3) serveList(w http.ResponseWriter, r *http.Request) {
	prefix := r.URL.Query().Get("prefix")
	token := r.URL.Query().Get("continuation-token")

	keys := make([]string, 0, len(f.objects))
	for key := range f.objects {
		if strings.HasPrefix(key, prefix) {
			keys = append(keys, key)
		}
	}
	sort.Strings(keys)

	// Page size of one so pagination is exercised by the second page test.
	type content struct {
		Key          string `xml:"Key"`
		Size         int64  `xml:"Size"`
		ETag         string `xml:"ETag"`
		LastModified string `xml:"LastModified"`
	}
	result := struct {
		XMLName     xml.Name  `xml:"ListBucketResult"`
		IsTruncated bool      `xml:"IsTruncated"`
		NextToken   string    `xml:"NextContinuationToken"`
		Contents    []content `xml:"Contents"`
	}{}

	start := 0
	if token != "" {
		fmt.Sscanf(token, "%d", &start)
	}
	if start < len(keys) {
		key := keys[start]
		result.Contents = append(result.Contents, content{
			Key:          key,
			Size:         int64(len(f.objects[key])),
			ETag:         `"etag"`,
			LastModified: "2026-10-14T09:01:25Z",
		})
		if start+1 < len(keys) {
			result.IsTruncated = true
			result.NextToken = fmt.Sprintf("%d", start+1)
		}
	}

	w.Header().Set("Content-Type", "application/xml")
	xml.NewEncoder(w).Encode(result)
}

func newTestClient(t *testing.T, endpoint string) *Client {
	t.Helper()
	client, err := New(Config{
		Endpoint:  endpoint,
		Region:    testRegion,
		Bucket:    "bucket",
		AccessKey: testAccessKey,
		SecretKey: testSecretKey,
	}, logger.NewWithWriter(io.Discard, "test"))
	if err != nil {
		t.Fatalf("new client: %v", err)
	}
	return client
}

func TestPutGetRoundTrip(t *testing.T) {
	fake := newFakeS3()
	server := httptest.NewServer(fake)
	defer server.Close()
	client := newTestClient(t, server.URL)

	payload := []byte("sqlite bytes")
	sum := sha256.Sum256(payload)

	if err := client.PutObject(context.Background(), "backups/p1/daily/a.sqlite", bytes.NewReader(payload), int64(len(payload)), hex.EncodeToString(sum[:]), "application/octet-stream"); err != nil {
		t.Fatalf("put: %v", err)
	}

	if got := fake.objects["backups/p1/daily/a.sqlite"]; !bytes.Equal(got, payload) {
		t.Errorf("stored %q, want %q", got, payload)
	}

	// The first recorded request is the PUT; check the headers the client owns.
	put := fake.requests[0]
	if put.method != http.MethodPut || put.path != "/bucket/backups/p1/daily/a.sqlite" {
		t.Errorf("unexpected PUT request: %+v", put)
	}
	if put.contentLength != int64(len(payload)) {
		t.Errorf("Content-Length = %d, want %d", put.contentLength, len(payload))
	}
	if put.contentType != "application/octet-stream" {
		t.Errorf("Content-Type = %q", put.contentType)
	}
	if put.payloadHash != hex.EncodeToString(sum[:]) {
		t.Errorf("payload hash = %q", put.payloadHash)
	}
	if !strings.HasPrefix(put.authorization, "AWS4-HMAC-SHA256 ") {
		t.Errorf("Authorization = %q", put.authorization)
	}

	body, meta, err := client.GetObject(context.Background(), "backups/p1/daily/a.sqlite")
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	defer body.Close()
	got, _ := io.ReadAll(body)
	if !bytes.Equal(got, payload) {
		t.Errorf("get body = %q", got)
	}
	if meta.Size != int64(len(payload)) {
		t.Errorf("get size = %d", meta.Size)
	}
}

func TestGetObjectNotFound(t *testing.T) {
	fake := newFakeS3()
	server := httptest.NewServer(fake)
	defer server.Close()
	client := newTestClient(t, server.URL)

	_, _, err := client.GetObject(context.Background(), "missing.sqlite")
	if err != ErrObjectNotFound {
		t.Fatalf("err = %v, want ErrObjectNotFound", err)
	}
}

func TestHeadObject(t *testing.T) {
	fake := newFakeS3()
	fake.objects["k.sqlite"] = []byte("12345")
	server := httptest.NewServer(fake)
	defer server.Close()
	client := newTestClient(t, server.URL)

	meta, err := client.HeadObject(context.Background(), "k.sqlite")
	if err != nil {
		t.Fatalf("head: %v", err)
	}
	if meta.Size != 5 {
		t.Errorf("size = %d, want 5", meta.Size)
	}

	if _, err := client.HeadObject(context.Background(), "nope"); err != ErrObjectNotFound {
		t.Errorf("missing head err = %v", err)
	}
}

func TestListPrefixPaginates(t *testing.T) {
	fake := newFakeS3()
	fake.objects["p1/a.sqlite"] = []byte("a")
	fake.objects["p1/b.sqlite"] = []byte("bb")
	fake.objects["p2/c.sqlite"] = []byte("ccc")
	server := httptest.NewServer(fake)
	defer server.Close()
	client := newTestClient(t, server.URL)

	objects, err := client.ListPrefix(context.Background(), "p1/")
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if len(objects) != 2 {
		t.Fatalf("listed %d objects, want 2: %+v", len(objects), objects)
	}
	if objects[0].Key != "p1/a.sqlite" || objects[1].Key != "p1/b.sqlite" {
		t.Errorf("unexpected keys: %+v", objects)
	}
	// Two pages means two LIST requests when pagination works.
	if fake.calls < 2 {
		t.Errorf("expected at least 2 list calls, got %d", fake.calls)
	}
}

func TestDeleteIsIdempotent(t *testing.T) {
	fake := newFakeS3()
	fake.objects["gone.sqlite"] = []byte("x")
	server := httptest.NewServer(fake)
	defer server.Close()
	client := newTestClient(t, server.URL)

	if err := client.DeleteObject(context.Background(), "gone.sqlite"); err != nil {
		t.Fatalf("delete existing: %v", err)
	}
	if _, ok := fake.objects["gone.sqlite"]; ok {
		t.Error("object still present after delete")
	}
	if err := client.DeleteObject(context.Background(), "gone.sqlite"); err != nil {
		t.Fatalf("delete missing should be nil, got %v", err)
	}
}

func TestPutRetriesTransientFailure(t *testing.T) {
	fake := newFakeS3()
	fake.failFirst = 1
	server := httptest.NewServer(fake)
	defer server.Close()
	client := newTestClient(t, server.URL)

	payload := []byte("retry me")
	sum := sha256.Sum256(payload)
	err := client.PutObject(context.Background(), "r.sqlite", bytes.NewReader(payload), int64(len(payload)), hex.EncodeToString(sum[:]), "")
	if err != nil {
		t.Fatalf("put with retry: %v", err)
	}
	if got := fake.objects["r.sqlite"]; !bytes.Equal(got, payload) {
		t.Errorf("stored %q after retry, want %q", got, payload)
	}
	if fake.calls < 2 {
		t.Errorf("expected a retry, got %d calls", fake.calls)
	}
	// The retried request must carry the full body again, not a remainder.
	for _, req := range fake.requests {
		if req.method == http.MethodPut && req.contentLength != int64(len(payload)) {
			t.Errorf("retried PUT Content-Length = %d, want %d", req.contentLength, len(payload))
		}
	}
}

func TestNewValidatesConfig(t *testing.T) {
	cases := []Config{
		{Bucket: "b", AccessKey: "a", SecretKey: "s"},           // no endpoint
		{Endpoint: "https://x", AccessKey: "a", SecretKey: "s"}, // no bucket
		{Endpoint: "https://x", Bucket: "b", AccessKey: "a"},    // no secret
		{Endpoint: "ftp://x", Bucket: "b", AccessKey: "a", SecretKey: "s"},
	}
	for i, cfg := range cases {
		if _, err := New(cfg, nil); err == nil {
			t.Errorf("case %d: expected error", i)
		}
	}
}

func TestRetryableStatus(t *testing.T) {
	cases := map[int]bool{
		http.StatusOK:                  false,
		http.StatusBadRequest:          false,
		http.StatusForbidden:           false,
		http.StatusNotFound:            false,
		http.StatusTooManyRequests:     true,
		http.StatusInternalServerError: true,
		http.StatusBadGateway:          true,
		http.StatusServiceUnavailable:  true,
	}
	for status, want := range cases {
		if got := retryableStatus(status); got != want {
			t.Errorf("retryableStatus(%d) = %v, want %v", status, got, want)
		}
	}
}
