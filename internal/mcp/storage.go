package mcp

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"

	"github.com/moogodev/moogodev/internal/handler"
)

// StorageClient is a thin HTTP client over one project's bucket routes.
//
// It is a separate client from the SQL one because object storage is guarded
// by a separate credential: the project's secret key opens /query, /exec and
// /transaction, and a storage key pair opens /bucket. Keeping them in two
// types means a header cannot be attached to the wrong request by accident.
type StorageClient struct {
	// base is the bucket root, so one parsed URL can be copied per request
	// and have its path extended with an escaped key. Building the URL from
	// strings instead would alias a key that contains "?" or "#".
	base        *url.URL
	accessKeyID string
	secretKey   string
	http        *http.Client
}

// NewStorageClient builds a client over one project's bucket routes.
//
// A nil httpClient gets the same default as the SQL client. Tests pass their
// own.
func NewStorageClient(projectURL, accessKeyID, secretKey string, httpClient *http.Client) *StorageClient {
	if httpClient == nil {
		httpClient = &http.Client{Timeout: defaultTimeout}
	}
	base, err := url.Parse(strings.TrimRight(projectURL, "/") + "/bucket")
	if err != nil || base == nil {
		base = &url.URL{}
	}
	return &StorageClient{
		base:        base,
		accessKeyID: accessKeyID,
		secretKey:   secretKey,
		http:        httpClient,
	}
}

// Object is a downloaded payload.
type Object struct {
	// Content holds at most the caller's max bytes. Truncated is true when the
	// object was larger, so the caller can tell it is missing a tail rather
	// than having received a short file.
	Content []byte
	// ContentType is the object's own type, as stored.
	ContentType string
	// ETag identifies the stored version.
	ETag string
	// Truncated is true when the object exceeded the byte cap, so Content is
	// only its beginning.
	Truncated bool
}

// uploadResponse is what POST /bucket/<key> answers.
type uploadResponse struct {
	Object           handler.ObjectResponse `json:"object"`
	StorageUsedBytes int64                  `json:"storage_used_bytes"`
	QuotaBytes       int64                  `json:"quota_bytes"`
}

// listResponse is what GET /bucket/answers.
type listResponse struct {
	Objects          []handler.ObjectResponse `json:"objects"`
	Total            int64                    `json:"total"`
	Limit            int                      `json:"limit"`
	Offset           int                      `json:"offset"`
	StorageUsedBytes int64                    `json:"storage_used_bytes"`
	QuotaBytes       int64                    `json:"quota_bytes"`
}

// deleteResponse is what DELETE /bucket/<key> answers.
type deleteResponse struct {
	Deleted          int   `json:"deleted"`
	FreedBytes       int64 `json:"freed_bytes"`
	StorageUsedBytes int64 `json:"storage_used_bytes"`
	QuotaBytes       int64 `json:"quota_bytes"`
}

// ObjectQuery is the object listing's inputs.
type ObjectQuery struct {
	Bucket string
	Prefix string
	Search string
	Order  string
	Dir    string
	Limit  int
	Offset int
}

// Upload stores one object under key.
//
// The body is the file itself, not JSON: contentType is sent as the request's
// Content-Type and the bytes are streamed as-is. An empty bucket name selects
// the project's default bucket, exactly as the raw API does.
func (client *StorageClient) Upload(ctx context.Context, bucket, key, contentType string, content []byte) (*uploadResponse, error) {
	response, err := client.do(ctx, http.MethodPost, key, contentType, bucketValues(bucket), bytes.NewReader(content))
	if err != nil {
		return nil, err
	}
	defer response.Body.Close()

	var decoded uploadResponse
	if err := json.NewDecoder(response.Body).Decode(&decoded); err != nil {
		return nil, fmt.Errorf("decode upload response: %w", err)
	}
	return &decoded, nil
}

// Download fetches one object, reading at most maxBytes of it.
//
// The cap exists because an object can be 250 MB and a tool result is a JSON
// string in a transcript; a download that cannot fit is reported as truncated
// rather than silently serialised whole.
func (client *StorageClient) Download(ctx context.Context, key string, maxBytes int64) (*Object, error) {
	response, err := client.do(ctx, http.MethodGet, key, "", nil, nil)
	if err != nil {
		return nil, err
	}
	defer response.Body.Close()

	object := &Object{
		ContentType: response.Header.Get("Content-Type"),
		ETag:        response.Header.Get("ETag"),
	}
	if object.ContentType == "" {
		object.ContentType = "application/octet-stream"
	}

	content, err := io.ReadAll(io.LimitReader(response.Body, maxBytes+1))
	if err != nil {
		return nil, fmt.Errorf("read object: %w", err)
	}
	if int64(len(content)) > maxBytes {
		content = content[:maxBytes]
		object.Truncated = true
	}
	object.Content = content
	return object, nil
}

// List returns one page of objects from one bucket.
func (client *StorageClient) List(ctx context.Context, query ObjectQuery) (*listResponse, error) {
	values := url.Values{}
	setIfNotEmpty(values, "bucket", query.Bucket)
	setIfNotEmpty(values, "prefix", query.Prefix)
	setIfNotEmpty(values, "search", query.Search)
	setIfNotEmpty(values, "order", query.Order)
	setIfNotEmpty(values, "dir", query.Dir)
	if query.Limit > 0 {
		values.Set("limit", strconv.Itoa(query.Limit))
	}
	if query.Offset > 0 {
		values.Set("offset", strconv.Itoa(query.Offset))
	}

	response, err := client.do(ctx, http.MethodGet, "", "", values, nil)
	if err != nil {
		return nil, err
	}
	defer response.Body.Close()

	var decoded listResponse
	if err := json.NewDecoder(response.Body).Decode(&decoded); err != nil {
		return nil, fmt.Errorf("decode list response: %w", err)
	}
	return &decoded, nil
}

// Delete removes one object, or every object under its prefix when prefix is
// true. Deleting a prefix has to be asked for by name, matching the API.
func (client *StorageClient) Delete(ctx context.Context, key string, prefix bool) (*deleteResponse, error) {
	values := url.Values{}
	if prefix {
		values.Set("prefix", "true")
	}

	response, err := client.do(ctx, http.MethodDelete, key, "", values, nil)
	if err != nil {
		return nil, err
	}
	defer response.Body.Close()

	var decoded deleteResponse
	if err := json.NewDecoder(response.Body).Decode(&decoded); err != nil {
		return nil, fmt.Errorf("decode delete response: %w", err)
	}
	return &decoded, nil
}

// do sends one bucket request and decodes a failure into APIError.
//
// The non-2xx branch is the same envelope every other endpoint uses, so it
// reuses the SQL client's decoder and the caller has one error type to format.
func (client *StorageClient) do(
	ctx context.Context,
	method string,
	key string,
	contentType string,
	query url.Values,
	body io.Reader,
) (*http.Response, error) {
	request, err := http.NewRequestWithContext(ctx, method, client.endpoint(key, query), body)
	if err != nil {
		return nil, fmt.Errorf("build request: %w", err)
	}
	if contentType != "" {
		request.Header.Set("Content-Type", contentType)
	}
	// No Accept header: a GET answers with the object's own bytes and type,
	// and declaring we only want JSON would be a lie about a download.
	//
	// The credential pair is the only place either half is used. Storage does
	// not accept the SQL secret key, so this client cannot carry it.
	request.Header.Set("X-Moogo-Access-Key-Id", client.accessKeyID)
	request.Header.Set("Authorization", "Bearer "+client.secretKey)

	response, err := client.http.Do(request)
	if err != nil {
		return nil, err
	}
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		defer response.Body.Close()
		body, _ := io.ReadAll(io.LimitReader(response.Body, responseBodyLimit))
		return nil, decodeAPIError(response.StatusCode, body)
	}
	return response, nil
}

// endpoint returns the request URL for key, or for the bucket root when key is
// empty.
func (client *StorageClient) endpoint(key string, query url.Values) string {
	parsed := *client.base
	parsed.RawPath = ""

	trimmed := strings.TrimSuffix(parsed.Path, "/")
	if key == "" {
		parsed.Path = trimmed + "/"
	} else {
		parsed.Path = trimmed + "/" + key
	}
	if query != nil {
		parsed.RawQuery = query.Encode()
	}
	// String escapes the path segment by segment, so a key with spaces or
	// non-ASCII bytes survives while its "/" separators stay separators.
	return parsed.String()
}

// bucketValues is the query a single object carries: just the bucket, and only
// when one was named.
func bucketValues(bucket string) url.Values {
	if bucket == "" {
		return nil
	}
	values := url.Values{}
	values.Set("bucket", bucket)
	return values
}

// setIfNotEmpty sets one query parameter, skipping empty ones so the data
// plane's own defaults apply instead of an empty string.
func setIfNotEmpty(values url.Values, name, value string) {
	if value != "" {
		values.Set(name, value)
	}
}
