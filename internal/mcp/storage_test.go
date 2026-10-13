package mcp

import (
	"context"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"
)

// recordedStorageRequest captures what a scripted bucket plane received.
type recordedStorageRequest struct {
	method string
	path   string
	query  url.Values
	header http.Header
	body   []byte
}

// scriptedStoragePlane stands in for one project's bucket routes. It answers
// every request with the same fixed response, and can set a Content-Type for
// the download cases where the response is not JSON.
func scriptedStoragePlane(t *testing.T, status int, response, contentType string) (string, *[]recordedStorageRequest) {
	t.Helper()

	requests := &[]recordedStorageRequest{}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		*requests = append(*requests, recordedStorageRequest{
			method: r.Method,
			path:   r.URL.Path,
			query:  r.URL.Query(),
			header: r.Header.Clone(),
			body:   body,
		})
		if contentType != "" {
			w.Header().Set("Content-Type", contentType)
		}
		w.WriteHeader(status)
		_, _ = io.WriteString(w, response)
	}))
	t.Cleanup(server.Close)

	return server.URL + "/p/1234", requests
}

func TestStorageUpload(t *testing.T) {
	t.Parallel()

	base, requests := scriptedStoragePlane(t, http.StatusCreated,
		`{"success":true,"object":{"key":"avatars/kit.png","size_bytes":3,"content_type":"image/png","etag":"abc"},"storage_used_bytes":3,"quota_bytes":250}`, "")
	client := NewStorageClient(base, "moogo_ak_1", "moogo_sk_1", nil)

	result, err := client.Upload(context.Background(), "images", "avatars/kit.png", "image/png", []byte{1, 2, 3})
	if err != nil {
		t.Fatalf("Upload() error = %v, want nil", err)
	}
	if result.Object.Key != "avatars/kit.png" {
		t.Errorf("Object.Key = %q, want avatars/kit.png", result.Object.Key)
	}
	if result.StorageUsedBytes != 3 {
		t.Errorf("StorageUsedBytes = %d, want 3", result.StorageUsedBytes)
	}

	if len(*requests) != 1 {
		t.Fatalf("bucket plane received %d request(s), want 1", len(*requests))
	}
	request := (*requests)[0]
	if request.method != http.MethodPost {
		t.Errorf("method = %q, want POST", request.method)
	}
	if request.path != "/p/1234/bucket/avatars/kit.png" {
		t.Errorf("path = %q, want the object's key", request.path)
	}
	if got := request.query.Get("bucket"); got != "images" {
		t.Errorf("bucket = %q, want images", got)
	}
	if got := request.header.Get("Content-Type"); got != "image/png" {
		t.Errorf("Content-Type = %q, want image/png", got)
	}
	if got := request.header.Get("X-Moogo-Access-Key-Id"); got != "moogo_ak_1" {
		t.Errorf("X-Moogo-Access-Key-Id = %q, want the access key id", got)
	}
	if got := request.header.Get("Authorization"); got != "Bearer moogo_sk_1" {
		t.Errorf("Authorization = %q, want a bearer token", got)
	}
	if string(request.body) != "\x01\x02\x03" {
		t.Errorf("body = %q, want the raw bytes", request.body)
	}
	// The SQL secret key is not the storage credential and must never be sent.
	if got := request.header.Get("Authorization"); got == "Bearer moogo_secret" {
		t.Error("the storage request carried the SQL secret")
	}
}

func TestStorageDownload(t *testing.T) {
	t.Parallel()

	base, requests := scriptedStoragePlane(t, http.StatusOK, "hello", "text/plain; charset=utf-8")
	client := NewStorageClient(base, "moogo_ak_1", "moogo_sk_1", nil)

	object, err := client.Download(context.Background(), "notes/a.txt", 100)
	if err != nil {
		t.Fatalf("Download() error = %v, want nil", err)
	}
	if string(object.Content) != "hello" {
		t.Errorf("Content = %q, want hello", object.Content)
	}
	if object.ContentType != "text/plain; charset=utf-8" {
		t.Errorf("ContentType = %q, want text/plain", object.ContentType)
	}
	if object.Truncated {
		t.Error("Truncated = true, want false")
	}

	if len(*requests) != 1 {
		t.Fatalf("bucket plane received %d request(s), want 1", len(*requests))
	}
	request := (*requests)[0]
	if request.method != http.MethodGet {
		t.Errorf("method = %q, want GET", request.method)
	}
	if request.path != "/p/1234/bucket/notes/a.txt" {
		t.Errorf("path = %q, want the object's key", request.path)
	}
}

func TestStorageDownloadCapsBody(t *testing.T) {
	t.Parallel()

	base, _ := scriptedStoragePlane(t, http.StatusOK, "0123456789", "application/octet-stream")
	client := NewStorageClient(base, "moogo_ak_1", "moogo_sk_1", nil)

	result, err := client.Download(context.Background(), "blob.bin", 4)
	if err != nil {
		t.Fatalf("Download() error = %v, want nil", err)
	}
	if string(result.Content) != "0123" {
		t.Errorf("Content = %q, want the first 4 bytes", result.Content)
	}
	if !result.Truncated {
		t.Error("Truncated = false, want true for a capped read")
	}
}

func TestStorageListSendsFilters(t *testing.T) {
	t.Parallel()

	base, requests := scriptedStoragePlane(t, http.StatusOK,
		`{"success":true,"objects":[{"key":"a.txt","size_bytes":1}],"total":9,"limit":2,"offset":3,"storage_used_bytes":10,"quota_bytes":250}`, "")
	client := NewStorageClient(base, "moogo_ak_1", "moogo_sk_1", nil)

	result, err := client.List(context.Background(), ObjectQuery{
		Bucket: "images", Prefix: "avatars/", Search: "kit", Order: "size", Dir: "asc", Limit: 2, Offset: 3,
	})
	if err != nil {
		t.Fatalf("List() error = %v, want nil", err)
	}
	if result.Total != 9 {
		t.Errorf("Total = %d, want 9", result.Total)
	}
	if len(result.Objects) != 1 {
		t.Fatalf("Objects = %d, want 1", len(result.Objects))
	}

	if len(*requests) != 1 {
		t.Fatalf("bucket plane received %d request(s), want 1", len(*requests))
	}
	request := (*requests)[0]
	if request.method != http.MethodGet {
		t.Errorf("method = %q, want GET", request.method)
	}
	if request.path != "/p/1234/bucket/" {
		t.Errorf("path = %q, want the bucket root", request.path)
	}
	for name, want := range map[string]string{
		"bucket": "images", "prefix": "avatars/", "search": "kit",
		"order": "size", "dir": "asc", "limit": "2", "offset": "3",
	} {
		if got := request.query.Get(name); got != want {
			t.Errorf("query %s = %q, want %q", name, got, want)
		}
	}
}

func TestStorageDeletePrefix(t *testing.T) {
	t.Parallel()

	base, requests := scriptedStoragePlane(t, http.StatusOK,
		`{"success":true,"deleted":2,"freed_bytes":8,"storage_used_bytes":1,"quota_bytes":250}`, "")
	client := NewStorageClient(base, "moogo_ak_1", "moogo_sk_1", nil)

	result, err := client.Delete(context.Background(), "photos", true)
	if err != nil {
		t.Fatalf("Delete() error = %v, want nil", err)
	}
	if result.Deleted != 2 || result.FreedBytes != 8 {
		t.Errorf("Deleted/Freed = %d/%d, want 2/8", result.Deleted, result.FreedBytes)
	}

	request := (*requests)[0]
	if request.method != http.MethodDelete {
		t.Errorf("method = %q, want DELETE", request.method)
	}
	if request.path != "/p/1234/bucket/photos" {
		t.Errorf("path = %q, want the prefix", request.path)
	}
	if got := request.query.Get("prefix"); got != "true" {
		t.Errorf("prefix = %q, want true", got)
	}
}

func TestStorageErrorEnvelope(t *testing.T) {
	t.Parallel()

	base, _ := scriptedStoragePlane(t, http.StatusUnauthorized,
		`{"error":{"code":"unauthorized","message":"authentication required"}}`, "")
	client := NewStorageClient(base, "moogo_ak_1", "moogo_sk_1", nil)

	_, err := client.List(context.Background(), ObjectQuery{})
	if err == nil {
		t.Fatal("List() error = nil, want the data-plane error")
	}

	var apiError *APIError
	if !errors.As(err, &apiError) {
		t.Fatalf("error = %v (%T), want *APIError", err, err)
	}
	if apiError.Code != "unauthorized" {
		t.Errorf("Code = %q, want unauthorized", apiError.Code)
	}
}

func TestStorageEscapesKey(t *testing.T) {
	t.Parallel()

	base, requests := scriptedStoragePlane(t, http.StatusOK, `{}`, "")
	client := NewStorageClient(base, "moogo_ak_1", "moogo_sk_1", nil)

	_, err := client.Download(context.Background(), "notes/hello world.txt", 10)
	if err != nil {
		t.Fatalf("Download() error = %v, want nil", err)
	}

	// The space is escaped on the wire and decoded by the server back into the
	// same key, so the raw path is what the URL carried.
	if got := (*requests)[0].path; got != "/p/1234/bucket/notes/hello world.txt" {
		t.Errorf("path = %q, want the key's own path", got)
	}
}
