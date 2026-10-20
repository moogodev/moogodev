package mcp

import (
	"context"
	"encoding/base64"
	"net/http"
	"strings"
	"testing"

	mcplib "github.com/mark3labs/mcp-go/mcp"
)

// storageHandlers wires the object tool handlers to a scripted bucket plane.
func storageHandlers(t *testing.T, status int, response, contentType string) (*Server, *[]recordedStorageRequest) {
	t.Helper()

	base, requests := scriptedStoragePlane(t, status, response, contentType)
	return &Server{storage: NewStorageClient(base, "moogo_ak_1", "moogo_sk_1", nil)}, requests
}

func TestListObjectsTool(t *testing.T) {
	t.Parallel()

	handlers, requests := storageHandlers(t, http.StatusOK,
		`{"success":true,"objects":[{"key":"a.txt","size_bytes":1,"content_type":"text/plain","is_public":false}],"total":7,"limit":1,"next_cursor":"cur_page_two","storage_used_bytes":1,"quota_bytes":250}`, "")

	result, err := handlers.listObjects(context.Background(), toolRequest(t, "list_objects", map[string]any{
		"prefix": "notes/", "limit": 1,
	}))
	if err != nil {
		t.Fatalf("listObjects handler = %v, want nil", err)
	}

	body := structuredBody(t, result)
	if body["total"] != int64(7) {
		t.Errorf("total = %v, want 7", body["total"])
	}
	// The cursor is the whole paging protocol of this tool: whatever the
	// answer carries has to reach the caller intact, or the next page cannot
	// be asked for.
	if body["next_cursor"] != "cur_page_two" {
		t.Errorf("next_cursor = %v, want the one the API sent", body["next_cursor"])
	}
	if !strings.Contains(resultText(t, result), "cursor") {
		t.Errorf("the summary should point at the cursor:\n%s", resultText(t, result))
	}
	objects, ok := body["objects"].([]map[string]any)
	if !ok || len(objects) != 1 {
		t.Fatalf("objects = %#v, want one entry", body["objects"])
	}
	if objects[0]["key"] != "a.txt" {
		t.Errorf("objects[0][key] = %v, want a.txt", objects[0]["key"])
	}

	if got := (*requests)[0].query.Get("prefix"); got != "notes/" {
		t.Errorf("prefix = %q, want notes/", got)
	}
}

func TestUploadObjectTextDefaultsType(t *testing.T) {
	t.Parallel()

	handlers, requests := storageHandlers(t, http.StatusCreated,
		`{"success":true,"object":{"key":"notes/a.txt","size_bytes":5,"content_type":"text/plain; charset=utf-8"},"storage_used_bytes":5,"quota_bytes":250}`, "")

	result, err := handlers.uploadObject(context.Background(), toolRequest(t, "upload_object", map[string]any{
		"key": "notes/a.txt", "content": "hello",
	}))
	if err != nil {
		t.Fatalf("uploadObject handler = %v, want nil", err)
	}
	if result.IsError {
		t.Fatalf("uploadObject result is an error: %s", resultText(t, result))
	}

	request := (*requests)[0]
	if got := request.header.Get("Content-Type"); got != "text/plain; charset=utf-8" {
		t.Errorf("Content-Type = %q, want the text default", got)
	}
	if string(request.body) != "hello" {
		t.Errorf("body = %q, want hello", request.body)
	}
}

func TestUploadObjectDecodesBase64(t *testing.T) {
	t.Parallel()

	handlers, requests := storageHandlers(t, http.StatusCreated,
		`{"success":true,"object":{"key":"img/kit.png","size_bytes":2,"content_type":"application/octet-stream"},"storage_used_bytes":2,"quota_bytes":250}`, "")

	want := []byte{0xff, 0x00}
	result, err := handlers.uploadObject(context.Background(), toolRequest(t, "upload_object", map[string]any{
		"key":          "img/kit.png",
		"content":      base64.StdEncoding.EncodeToString(want),
		"encoding":     "base64",
		"content_type": "",
	}))
	if err != nil {
		t.Fatalf("uploadObject handler = %v, want nil", err)
	}
	if result.IsError {
		t.Fatalf("uploadObject result is an error: %s", resultText(t, result))
	}

	request := (*requests)[0]
	if string(request.body) != string(want) {
		t.Errorf("body = %v, want the decoded bytes", request.body)
	}
	if got := request.header.Get("Content-Type"); got != "application/octet-stream" {
		t.Errorf("Content-Type = %q, want the binary default", got)
	}
}

func TestUploadObjectRejectsBadBase64(t *testing.T) {
	t.Parallel()

	handlers, requests := storageHandlers(t, http.StatusCreated, `{}`, "")

	result, err := handlers.uploadObject(context.Background(), toolRequest(t, "upload_object", map[string]any{
		"key": "img/kit.png", "content": "not base64!", "encoding": "base64",
	}))
	if err != nil {
		t.Fatalf("uploadObject handler = %v, want nil", err)
	}
	if !result.IsError {
		t.Fatal("IsError = false, want a tool error for malformed base64")
	}
	if len(*requests) != 0 {
		t.Error("the bucket plane was called despite the malformed content")
	}
}

func TestDownloadObjectTextResource(t *testing.T) {
	t.Parallel()

	handlers, _ := storageHandlers(t, http.StatusOK, "hello world", "text/plain; charset=utf-8")

	result, err := handlers.downloadObject(context.Background(),
		toolRequest(t, "download_object", map[string]any{"key": "notes/a.txt"}))
	if err != nil {
		t.Fatalf("downloadObject handler = %v, want nil", err)
	}
	if result.IsError {
		t.Fatalf("IsError = true, want a resource: %s", resultText(t, result))
	}

	embedded, ok := result.Content[1].(mcplib.EmbeddedResource)
	if !ok {
		t.Fatalf("content[1] = %T, want mcplib.EmbeddedResource", result.Content[1])
	}
	text, ok := embedded.Resource.(mcplib.TextResourceContents)
	if !ok {
		t.Fatalf("resource = %T, want text contents", embedded.Resource)
	}
	if text.Text != "hello world" {
		t.Errorf("Text = %q, want hello world", text.Text)
	}
	if !strings.HasPrefix(text.URI, "moogo://bucket/") {
		t.Errorf("URI = %q, want a moogo bucket address", text.URI)
	}
}

func TestDownloadObjectBlobResource(t *testing.T) {
	t.Parallel()

	handlers, _ := storageHandlers(t, http.StatusOK, "\xff\x00\x01", "application/octet-stream")

	result, err := handlers.downloadObject(context.Background(),
		toolRequest(t, "download_object", map[string]any{"key": "img/kit.png"}))
	if err != nil {
		t.Fatalf("downloadObject handler = %v, want nil", err)
	}

	embedded, ok := result.Content[1].(mcplib.EmbeddedResource)
	if !ok {
		t.Fatalf("content[1] = %T, want mcplib.EmbeddedResource", result.Content[1])
	}
	blob, ok := embedded.Resource.(mcplib.BlobResourceContents)
	if !ok {
		t.Fatalf("resource = %T, want blob contents", embedded.Resource)
	}
	decoded, err := base64.StdEncoding.DecodeString(blob.Blob)
	if err != nil {
		t.Fatalf("Blob is not valid base64: %v", err)
	}
	if string(decoded) != "\xff\x00\x01" {
		t.Errorf("Blob = %q, want the object's bytes", decoded)
	}
}

func TestDownloadObjectCapsMaxBytes(t *testing.T) {
	t.Parallel()

	handlers, _ := storageHandlers(t, http.StatusOK, "0123456789", "text/plain")

	result, err := handlers.downloadObject(context.Background(),
		toolRequest(t, "download_object", map[string]any{"key": "a.txt", "max_bytes": 4}))
	if err != nil {
		t.Fatalf("downloadObject handler = %v, want nil", err)
	}

	embedded, ok := result.Content[1].(mcplib.EmbeddedResource)
	if !ok {
		t.Fatalf("content[1] = %T, want mcplib.EmbeddedResource", result.Content[1])
	}
	text, ok := embedded.Resource.(mcplib.TextResourceContents)
	if !ok {
		t.Fatalf("resource = %T, want text contents", embedded.Resource)
	}
	if text.Text != "0123" {
		t.Errorf("Text = %q, want the first 4 bytes", text.Text)
	}
	if note := resultText(t, result); !strings.Contains(note, "bytes only") {
		t.Errorf("text = %q, want it to warn about the cap", note)
	}
}

func TestDeleteObjectTool(t *testing.T) {
	t.Parallel()

	handlers, requests := storageHandlers(t, http.StatusOK,
		`{"success":true,"deleted":1,"freed_bytes":4,"storage_used_bytes":0,"quota_bytes":250}`, "")

	result, err := handlers.deleteObject(context.Background(),
		toolRequest(t, "delete_object", map[string]any{"key": "notes/a.txt"}))
	if err != nil {
		t.Fatalf("deleteObject handler = %v, want nil", err)
	}

	body := structuredBody(t, result)
	if body["deleted"] != 1 {
		t.Errorf("deleted = %v, want 1", body["deleted"])
	}
	if got := (*requests)[0].path; got != "/p/1234/bucket/notes/a.txt" {
		t.Errorf("path = %q, want the object's key", got)
	}
}

func TestObjectToolWithoutCredential(t *testing.T) {
	t.Parallel()

	handlers := &Server{}

	result, err := handlers.listObjects(context.Background(), toolRequest(t, "list_objects", map[string]any{}))
	if err != nil {
		t.Fatalf("listObjects handler = %v, want nil", err)
	}
	if !result.IsError {
		t.Fatal("IsError = false, want a tool error when storage is unset")
	}
}
