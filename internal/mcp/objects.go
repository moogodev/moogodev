package mcp

import (
	"bytes"
	"context"
	"encoding/base64"
	"fmt"
	"net/url"
	"strings"
	"unicode/utf8"

	mcplib "github.com/mark3labs/mcp-go/mcp"

	"github.com/moogodev/moogodev/internal/handler"
)

// object fields are carried with the same names the storage API uses, so a
// value read here can be used in an HTTP call without a rename in between.
const (
	textDefault = "text/plain; charset=utf-8"
	binDefault  = "application/octet-stream"
)

// Encoding names accepted by upload_object.
const (
	encodingText   = "utf-8"
	encodingBase64 = "base64"
)

// objects returns the storage client, or the reason there is none.
//
// The object tools are registered only when the credential pair is present, so
// a nil here is a programming error rather than a configuration one; the
// message still names the variables so a test that builds Server by hand gets
// a useful answer.
func (handlers *Server) objects() (*StorageClient, error) {
	if handlers.storage == nil {
		return nil, fmt.Errorf("this server has no bucket credentials: set MOOGO_STORAGE_ACCESS_KEY_ID and MOOGO_STORAGE_SECRET_KEY")
	}
	return handlers.storage, nil
}

// objectSummary is the metadata a tool shows for one object: enough to address
// it again, and nothing the caller cannot act on.
func objectSummary(object handler.ObjectResponse) map[string]any {
	summary := map[string]any{
		"key":          object.Key,
		"size_bytes":   object.SizeBytes,
		"content_type": object.ContentType,
		"etag":         object.ETag,
		"is_public":    object.IsPublic,
		"updated_at":   object.UpdatedAt,
	}
	if object.Bucket != "" {
		summary["bucket"] = object.Bucket
	}
	if object.PublicURL != "" {
		summary["public_url"] = object.PublicURL
	}
	return summary
}

// listObjectsArgs is the input of the list_objects tool.
type listObjectsArgs struct {
	Bucket string `json:"bucket"`
	Prefix string `json:"prefix"`
	Search string `json:"search"`
	Order  string `json:"order"`
	Dir    string `json:"dir"`
	Limit  int    `json:"limit"`
	// Cursor is the previous answer's next_cursor, passed back to reach the
	// page after it. Omitting it starts at the first page.
	Cursor string `json:"cursor"`
}

// listObjects answers with one page of a bucket's objects.
func (handlers *Server) listObjects(ctx context.Context, request mcplib.CallToolRequest) (*mcplib.CallToolResult, error) {
	storage, err := handlers.objects()
	if err != nil {
		return mcplib.NewToolResultError(err.Error()), nil
	}

	var input listObjectsArgs
	if err := request.BindArguments(&input); err != nil {
		return mcplib.NewToolResultError("list_objects: " + err.Error()), nil
	}

	limit := input.Limit
	if limit <= 0 {
		limit = defaultObjectLimit
	}
	if limit > maxObjectLimit {
		limit = maxObjectLimit
	}

	response, err := storage.List(ctx, ObjectQuery{
		Bucket: input.Bucket,
		Prefix: input.Prefix,
		Search: input.Search,
		Order:  input.Order,
		Dir:    input.Dir,
		Limit:  limit,
		Cursor: input.Cursor,
	})
	if err != nil {
		return toolError(err), nil
	}

	objects := make([]map[string]any, len(response.Objects))
	for index, object := range response.Objects {
		objects[index] = objectSummary(object)
	}

	text := fmt.Sprintf("Returned %d object(s) of %d.", len(objects), response.Total)
	if response.NextCursor != "" {
		text += " Page on with the cursor this answer carries."
	}

	return mcplib.NewToolResultStructured(map[string]any{
		"objects":            objects,
		"total":              response.Total,
		"limit":              response.Limit,
		"next_cursor":        response.NextCursor,
		"storage_used_bytes": response.StorageUsedBytes,
		"quota_bytes":        response.QuotaBytes,
	}, text), nil
}

// uploadObjectArgs is the input of the upload_object tool.
type uploadObjectArgs struct {
	Key         string `json:"key"`
	Content     string `json:"content"`
	ContentType string `json:"content_type"`
	Encoding    string `json:"encoding"`
	Bucket      string `json:"bucket"`
}

// uploadObject stores one object and answers with its metadata.
func (handlers *Server) uploadObject(ctx context.Context, request mcplib.CallToolRequest) (*mcplib.CallToolResult, error) {
	storage, err := handlers.objects()
	if err != nil {
		return mcplib.NewToolResultError(err.Error()), nil
	}

	var input uploadObjectArgs
	if err := request.BindArguments(&input); err != nil {
		return mcplib.NewToolResultError("upload_object: " + err.Error()), nil
	}
	if strings.TrimSpace(input.Key) == "" {
		return mcplib.NewToolResultError("upload_object: key is required"), nil
	}

	encoding, err := parseUploadEncoding(input.Encoding)
	if err != nil {
		return mcplib.NewToolResultError("upload_object: " + err.Error()), nil
	}
	content, err := decodeUploadContent(input.Content, encoding)
	if err != nil {
		return mcplib.NewToolResultError("upload_object: " + err.Error()), nil
	}

	// The type is what gets stored and served, so it is the one thing an agent
	// must be able to state. Deriving it from the bytes rather than asking is
	// the fallback, not the rule.
	contentType := strings.TrimSpace(input.ContentType)
	if contentType == "" {
		if encoding == encodingBase64 {
			contentType = binDefault
		} else {
			contentType = textDefault
		}
	}

	response, err := storage.Upload(ctx, input.Bucket, input.Key, contentType, content)
	if err != nil {
		return toolError(err), nil
	}

	return mcplib.NewToolResultStructured(map[string]any{
		"object":             objectSummary(response.Object),
		"storage_used_bytes": response.StorageUsedBytes,
		"quota_bytes":        response.QuotaBytes,
	}, fmt.Sprintf("Stored %q: %d byte(s) of %s.",
		response.Object.Key, response.Object.SizeBytes, response.Object.ContentType)), nil
}

// downloadObjectArgs is the input of the download_object tool.
type downloadObjectArgs struct {
	Key      string `json:"key"`
	MaxBytes int64  `json:"max_bytes"`
}

// downloadObject reads an object and returns it as an embedded resource.
//
// The payload is a resource rather than a field because it can be binary; MCP
// has a resource form for both text and a base64 blob, and a JSON string field
// cannot carry the second unambiguously.
func (handlers *Server) downloadObject(ctx context.Context, request mcplib.CallToolRequest) (*mcplib.CallToolResult, error) {
	storage, err := handlers.objects()
	if err != nil {
		return mcplib.NewToolResultError(err.Error()), nil
	}

	var input downloadObjectArgs
	if err := request.BindArguments(&input); err != nil {
		return mcplib.NewToolResultError("download_object: " + err.Error()), nil
	}
	if strings.TrimSpace(input.Key) == "" {
		return mcplib.NewToolResultError("download_object: key is required"), nil
	}

	maxBytes := input.MaxBytes
	if maxBytes <= 0 {
		maxBytes = defaultDownloadBytes
	}
	if maxBytes > maxDownloadBytes {
		maxBytes = maxDownloadBytes
	}

	object, err := storage.Download(ctx, input.Key, maxBytes)
	if err != nil {
		return toolError(err), nil
	}

	text := fmt.Sprintf("Read %q: %d byte(s) of %s.", input.Key, len(object.Content), object.ContentType)
	if object.Truncated {
		text += fmt.Sprintf(" The object is larger; this is the first %d bytes only.", len(object.Content))
	}

	if objectReadsAsText(object.ContentType, object.Content) {
		return mcplib.NewToolResultResource(text, mcplib.TextResourceContents{
			URI:      objectURI(input.Key),
			MIMEType: object.ContentType,
			Text:     string(object.Content),
		}), nil
	}
	return mcplib.NewToolResultResource(text, mcplib.BlobResourceContents{
		URI:      objectURI(input.Key),
		MIMEType: object.ContentType,
		Blob:     base64.StdEncoding.EncodeToString(object.Content),
	}), nil
}

// deleteObjectArgs is the input of the delete_object tool.
type deleteObjectArgs struct {
	Key    string `json:"key"`
	Prefix bool   `json:"prefix"`
}

// deleteObject removes one object, or every object under a prefix.
func (handlers *Server) deleteObject(ctx context.Context, request mcplib.CallToolRequest) (*mcplib.CallToolResult, error) {
	storage, err := handlers.objects()
	if err != nil {
		return mcplib.NewToolResultError(err.Error()), nil
	}

	var input deleteObjectArgs
	if err := request.BindArguments(&input); err != nil {
		return mcplib.NewToolResultError("delete_object: " + err.Error()), nil
	}
	if strings.TrimSpace(input.Key) == "" {
		return mcplib.NewToolResultError("delete_object: key is required"), nil
	}

	response, err := storage.Delete(ctx, input.Key, input.Prefix)
	if err != nil {
		return toolError(err), nil
	}

	return mcplib.NewToolResultStructured(map[string]any{
		"deleted":            response.Deleted,
		"freed_bytes":        response.FreedBytes,
		"storage_used_bytes": response.StorageUsedBytes,
		"quota_bytes":        response.QuotaBytes,
	}, fmt.Sprintf("Deleted %d object(s), freeing %d byte(s).", response.Deleted, response.FreedBytes)), nil
}

// parseUploadEncoding maps the tool's encoding argument to one of two values,
// tolerating the spellings an agent is likely to reach for.
func parseUploadEncoding(raw string) (string, error) {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "", "utf-8", "utf8", "text":
		return encodingText, nil
	case "base64":
		return encodingBase64, nil
	default:
		return "", fmt.Errorf("encoding must be %q or %q, got %q", encodingText, encodingBase64, raw)
	}
}

// decodeUploadContent turns the carried bytes into the bytes to store.
//
// A malformed base64 string is refused rather than written as its character
// data: storing the encoding of a file is never what the caller meant.
func decodeUploadContent(content, encoding string) ([]byte, error) {
	if encoding != encodingBase64 {
		return []byte(content), nil
	}
	decoded, err := base64.StdEncoding.DecodeString(content)
	if err != nil {
		return nil, fmt.Errorf("content is not valid base64: %w", err)
	}
	return decoded, nil
}

// objectReadsAsText reports whether an object should be handed to the client as
// text rather than as an encoded blob.
func objectReadsAsText(contentType string, content []byte) bool {
	mediaType, _, _ := strings.Cut(contentType, ";")
	mediaType = strings.ToLower(strings.TrimSpace(mediaType))
	if strings.HasPrefix(mediaType, "text/") {
		return true
	}
	switch mediaType {
	case "application/json",
		"application/xml",
		"application/xhtml+xml",
		"application/xml-dtd",
		"application/javascript",
		"application/ecmascript",
		"application/yaml",
		"application/x-yaml",
		"image/svg+xml":
		return true
	}
	// Everything else is text only when the bytes really are text. The NUL
	// check matters because a UTF-8 validator accepts a NUL byte as valid
	// text, and a file beginning with one is almost never text.
	return utf8.Valid(content) && bytes.IndexByte(content, 0) < 0
}

// objectURI addresses one object inside its bucket. It is for display and for
// the embedded resource's identity, not a fetchable URL: the object routes
// need a credential in a header.
func objectURI(key string) string {
	return (&url.URL{Scheme: "moogo", Host: "bucket", Path: "/" + strings.TrimPrefix(key, "/")}).String()
}
