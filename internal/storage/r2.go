package storage

import (
	"context"
	"encoding/xml"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/moogodev/moogodev/pkg/logger"
)

// maxAttempts bounds the retry loop for a single request. Object storage is
// usually reliable; a handful of attempts covers a transient blip without
// turning an outage into a long stall.
const maxAttempts = 3

// ErrObjectNotFound is returned by GetObject, ReadMeta and DeleteObjectWhenExists
// when the key does not exist in the bucket.
var ErrObjectNotFound = errors.New("object not found")

// Config describes how to reach the bucket. It is deliberately separate from
// the application's own config type so this package stays usable on its own.
type Config struct {
	// Endpoint is the S3-compatible base URL, for example
	// https://<account>.r2.cloudflarestorage.com (no trailing slash).
	Endpoint string
	// Region is the SigV4 region. Object storage ignores it; "auto" matches
	// Cloudflare R2's own convention.
	Region string
	// Bucket is the bucket name.
	Bucket string
	// AccessKey and SecretKey are the S3 credentials.
	AccessKey string
	SecretKey string
	// Timeout bounds a single attempt. Zero uses a default.
	Timeout time.Duration
}

// Object describes one stored object as reported by LIST.
type Object struct {
	Key          string
	Size         int64
	ETag         string
	LastModified time.Time
}

// Error is a non-2xx response from the storage endpoint.
type Error struct {
	StatusCode int
	Method     string
	Path       string
	Body       string
}

func (e *Error) Error() string {
	body := strings.TrimSpace(e.Body)
	if body == "" {
		body = http.StatusText(e.StatusCode)
	}
	return fmt.Sprintf("storage: %s %s: %d %s", e.Method, e.Path, e.StatusCode, body)
}

// Client is an S3-compatible object storage client with SigV4 signing.
type Client struct {
	base   *url.URL
	bucket string
	signer signer
	http   *http.Client
	log    *logger.Logger
}

// New validates cfg and builds a client. A nil logger is allowed and silences
// the client's own retry logging.
func New(cfg Config, log *logger.Logger) (*Client, error) {
	if cfg.Endpoint == "" {
		return nil, errors.New("storage: endpoint is required")
	}
	if cfg.Bucket == "" {
		return nil, errors.New("storage: bucket is required")
	}
	if cfg.AccessKey == "" || cfg.SecretKey == "" {
		return nil, errors.New("storage: access key and secret key are required")
	}

	base, err := url.Parse(strings.TrimRight(cfg.Endpoint, "/"))
	if err != nil {
		return nil, fmt.Errorf("storage: parse endpoint: %w", err)
	}
	if base.Scheme != "http" && base.Scheme != "https" {
		return nil, fmt.Errorf("storage: endpoint %q must be http or https", cfg.Endpoint)
	}
	if base.Host == "" {
		return nil, fmt.Errorf("storage: endpoint %q has no host", cfg.Endpoint)
	}

	region := cfg.Region
	if region == "" {
		region = "auto"
	}
	timeout := cfg.Timeout
	if timeout <= 0 {
		timeout = 10 * time.Minute
	}

	return &Client{
		base:   base,
		bucket: cfg.Bucket,
		signer: signer{accessKey: cfg.AccessKey, secretKey: cfg.SecretKey, region: region},
		http:   &http.Client{Timeout: timeout},
		log:    log,
	}, nil
}

// Bucket returns the bucket name the client writes to.
func (c *Client) Bucket() string { return c.bucket }

// PutObject uploads body to key.
//
// sha256Hex must be the hex SHA-256 of exactly the size bytes the reader
// yields; it is signed as the payload hash. body must support seeking so a
// retry can rewind to the start instead of uploading a truncated object.
func (c *Client) PutObject(ctx context.Context, key string, body io.ReadSeeker, size int64, sha256Hex, contentType string) error {
	if size < 0 {
		return fmt.Errorf("storage: put %q: negative size", key)
	}
	if sha256Hex == "" {
		return fmt.Errorf("storage: put %q: missing payload hash", key)
	}
	if contentType == "" {
		contentType = "application/octet-stream"
	}

	u := c.objectURL(key)
	upstream := func() (*http.Request, error) {
		if _, err := body.Seek(0, io.SeekStart); err != nil {
			return nil, fmt.Errorf("storage: rewind body: %w", err)
		}
		req, err := http.NewRequestWithContext(ctx, http.MethodPut, u.String(), body)
		if err != nil {
			return nil, err
		}
		// net/http cannot infer the length from an arbitrary ReadSeeker, and an
		// unknown length would make it choose chunked transfer encoding, which
		// some S3 endpoints reject. Setting it also keeps the retry honest.
		req.ContentLength = size
		req.Header.Set("Content-Type", contentType)
		return req, nil
	}

	resp, err := c.execute(ctx, upstream, sha256Hex)
	if err != nil {
		return err
	}
	resp.Body.Close()
	return nil
}

// GetObject fetches key. The caller owns the returned body and must close it.
// A missing key returns ErrObjectNotFound.
func (c *Client) GetObject(ctx context.Context, key string) (io.ReadCloser, Object, error) {
	u := c.objectURL(key)
	upstream := func() (*http.Request, error) {
		return http.NewRequestWithContext(ctx, http.MethodGet, u.String(), nil)
	}

	resp, err := c.execute(ctx, upstream, EmptySHA256)
	if err != nil {
		if isStatus(err, http.StatusNotFound) {
			return nil, Object{}, ErrObjectNotFound
		}
		return nil, Object{}, err
	}

	return resp.Body, metaFromHeaders(key, resp.Header), nil
}

// HeadObject returns metadata for key without downloading it. A missing key
// returns ErrObjectNotFound.
func (c *Client) HeadObject(ctx context.Context, key string) (Object, error) {
	u := c.objectURL(key)
	upstream := func() (*http.Request, error) {
		return http.NewRequestWithContext(ctx, http.MethodHead, u.String(), nil)
	}

	resp, err := c.execute(ctx, upstream, EmptySHA256)
	if err != nil {
		if isStatus(err, http.StatusNotFound) {
			return Object{}, ErrObjectNotFound
		}
		return Object{}, err
	}
	resp.Body.Close()
	return metaFromHeaders(key, resp.Header), nil
}

// ListPrefix returns every object whose key starts with prefix, following
// continuation tokens until the listing is complete.
func (c *Client) ListPrefix(ctx context.Context, prefix string) ([]Object, error) {
	var objects []Object
	token := ""

	for {
		page, next, err := c.listPage(ctx, prefix, token)
		if err != nil {
			return nil, err
		}
		objects = append(objects, page...)
		if next == "" {
			return objects, nil
		}
		token = next
	}
}

func (c *Client) listPage(ctx context.Context, prefix, token string) ([]Object, string, error) {
	u := c.bucketURL()
	values := url.Values{}
	values.Set("list-type", "2")
	if prefix != "" {
		values.Set("prefix", prefix)
	}
	if token != "" {
		values.Set("continuation-token", token)
	}
	// Build RawQuery with the same encoder the signature uses so the wire form
	// and the signed form cannot drift.
	u.RawQuery = encodeQuery(values)

	upstream := func() (*http.Request, error) {
		return http.NewRequestWithContext(ctx, http.MethodGet, u.String(), nil)
	}

	resp, err := c.execute(ctx, upstream, EmptySHA256)
	if err != nil {
		return nil, "", err
	}
	defer resp.Body.Close()

	var result listBucketResult
	if err := xml.NewDecoder(io.LimitReader(resp.Body, 8<<20)).Decode(&result); err != nil {
		return nil, "", fmt.Errorf("storage: list %q: decode response: %w", prefix, err)
	}

	objects := make([]Object, 0, len(result.Contents))
	for _, item := range result.Contents {
		object := Object{
			Key:  item.Key,
			Size: item.Size,
			ETag: strings.Trim(item.ETag, `"`),
		}
		if when, err := time.Parse(time.RFC3339, item.LastModified); err == nil {
			object.LastModified = when
		}
		objects = append(objects, object)
	}

	next := ""
	if result.IsTruncated {
		next = result.NextToken
	}
	return objects, next, nil
}

// DeleteObject removes key. Deleting a key that does not exist succeeds, which
// matches S3 semantics and keeps prune idempotent.
func (c *Client) DeleteObject(ctx context.Context, key string) error {
	u := c.objectURL(key)
	upstream := func() (*http.Request, error) {
		return http.NewRequestWithContext(ctx, http.MethodDelete, u.String(), nil)
	}

	resp, err := c.execute(ctx, upstream, EmptySHA256)
	if err != nil {
		if isStatus(err, http.StatusNotFound) {
			return nil
		}
		return err
	}
	resp.Body.Close()
	return nil
}

// execute signs and sends a request, retrying transient failures. The request
// is rebuilt for every attempt (through upstream) so a PUT can rewind its body
// and so the signature timestamp stays fresh.
func (c *Client) execute(ctx context.Context, upstream func() (*http.Request, error), payloadHash string) (*http.Response, error) {
	var lastErr error

	for attempt := 1; attempt <= maxAttempts; attempt++ {
		if attempt > 1 {
			if err := sleepContext(ctx, backoffFor(attempt)); err != nil {
				return nil, err
			}
		}

		req, err := upstream()
		if err != nil {
			return nil, err
		}
		c.signer.sign(req, payloadHash, time.Now())

		resp, err := c.http.Do(req)
		if err != nil {
			if ctx.Err() != nil {
				return nil, ctx.Err()
			}
			lastErr = err
			c.retryLog(attempt, req, err)
			continue
		}

		if resp.StatusCode >= 200 && resp.StatusCode < 300 {
			return resp, nil
		}

		requestErr := errorFromResponse(req, resp)
		resp.Body.Close()
		lastErr = requestErr

		if !retryableStatus(resp.StatusCode) {
			return nil, requestErr
		}
		c.retryLog(attempt, req, requestErr)
	}

	return nil, lastErr
}

func (c *Client) retryLog(attempt int, req *http.Request, err error) {
	if c.log == nil {
		return
	}
	c.log.Warn("storage request failed, retrying", logger.Fields{
		"method":  req.Method,
		"path":    req.URL.Path,
		"attempt": attempt,
		"error":   err.Error(),
	})
}

// objectURL builds the path-style URL for a single object.
func (c *Client) objectURL(key string) *url.URL {
	u := *c.base
	u.Path = "/" + c.bucket + "/" + key
	u.RawPath = ""
	u.RawQuery = ""
	return &u
}

// bucketURL builds the URL for a bucket-level operation such as LIST.
func (c *Client) bucketURL() *url.URL {
	u := *c.base
	u.Path = "/" + c.bucket
	u.RawPath = ""
	return &u
}

// errorFromResponse reads a bounded amount of the body and turns the response
// into an *Error.
func errorFromResponse(req *http.Request, resp *http.Response) *Error {
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 4<<10))
	return &Error{
		StatusCode: resp.StatusCode,
		Method:     req.Method,
		Path:       req.URL.Path,
		Body:       string(body),
	}
}

// metaFromHeaders builds an Object from response headers (HEAD or GET).
func metaFromHeaders(key string, header http.Header) Object {
	object := Object{
		Key:  key,
		ETag: strings.Trim(header.Get("ETag"), `"`),
	}
	if length := header.Get("Content-Length"); length != "" {
		if size, err := strconv.ParseInt(length, 10, 64); err == nil {
			object.Size = size
		}
	}
	if last := header.Get("Last-Modified"); last != "" {
		if when, err := http.ParseTime(last); err == nil {
			object.LastModified = when
		}
	}
	return object
}

// retryableStatus reports whether a status is worth another attempt. 4xx
// responses other than 429 are permanent: the same request will fail the same
// way, so retrying only wastes time.
func retryableStatus(status int) bool {
	return status >= 500 || status == http.StatusTooManyRequests
}

// isStatus reports whether err is an *Error with the given status.
func isStatus(err error, status int) bool {
	var storageErr *Error
	if errors.As(err, &storageErr) {
		return storageErr.StatusCode == status
	}
	return false
}

// backoffFor returns an exponential backoff for the given attempt number.
func backoffFor(attempt int) time.Duration {
	return time.Duration(1<<uint(attempt-1)) * 250 * time.Millisecond
}

// sleepContext waits for d or until the context is done.
func sleepContext(ctx context.Context, d time.Duration) error {
	timer := time.NewTimer(d)
	defer timer.Stop()
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-timer.C:
		return nil
	}
}

// listBucketResult is the subset of a ListObjectsV2 response we consume.
type listBucketResult struct {
	XMLName     xml.Name `xml:"ListBucketResult"`
	IsTruncated bool     `xml:"IsTruncated"`
	NextToken   string   `xml:"NextContinuationToken"`
	Contents    []struct {
		Key          string `xml:"Key"`
		Size         int64  `xml:"Size"`
		ETag         string `xml:"ETag"`
		LastModified string `xml:"LastModified"`
	} `xml:"Contents"`
}
