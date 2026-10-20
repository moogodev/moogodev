package cli

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// requestTimeout is how long the client waits for an answer.
//
// Long enough for a transaction of a hundred statements, short enough that a
// hung connection does not sit in front of a terminal forever. The server has
// its own timeouts; this is the client's.
const requestTimeout = 90 * time.Second

// responseLimit caps what the client reads back.
//
// An object listing or a transaction summary is small. A listing that is not
// means something is wrong, and reading it all into memory to print a table
// would turn that into the client's problem as well.
const responseLimit = 16 << 20

// credential is what a request is authorised with.
//
// Two kinds exist and they are not interchangeable: a project key in the
// Authorization header, and a storage credential, which adds the access key id
// header so the server knows which secret to check the bearer token against.
type credential struct {
	bearer      string
	accessKeyID string
}

// projectCredential is the key that authorises SQL.
func (config Config) projectCredential() credential {
	return credential{bearer: config.SecretKey}
}

// storageCredential is the key that authorises object storage.
func (config Config) storageCredential() credential {
	return credential{bearer: config.BucketSecretKey, accessKeyID: config.BucketAccessKeyID}
}

// APIError is an answer the API gave for a request it refused.
type APIError struct {
	Status    int
	Code      string
	Message   string
	Detail    string
	RequestID string
}

// Error renders the refusal the way a person in a terminal needs it: what the
// server called the problem, in which words, and which request it was, so the
// id can be found in the logs.
func (err *APIError) Error() string {
	message := err.Message
	if message == "" {
		message = http.StatusText(err.Status)
	}

	text := fmt.Sprintf("%s (%d %s)", message, err.Status, err.Code)
	if err.Detail != "" {
		text += ": " + err.Detail
	}
	if err.RequestID != "" {
		text += " [request " + err.RequestID + "]"
	}
	return text
}

// client is the only place this package performs HTTP.
type client struct {
	config Config
	http   *http.Client
}

func newClient(config Config) *client {
	return &client{config: config, http: &http.Client{Timeout: requestTimeout}}
}

// do performs one request and decodes a successful answer into out, when out
// is not nil.
//
// Errors come back as *APIError with the code the API uses, so a command can
// print "link_expired" as the server named it rather than as a translated
// phrase that no longer matches the documentation.
func (client *client) do(ctx context.Context, method, target string, as credential, payload, out any) error {
	var body io.Reader
	if payload != nil {
		encoded, err := json.Marshal(payload)
		if err != nil {
			return fmt.Errorf("encode request: %w", err)
		}
		body = bytes.NewReader(encoded)
	}

	request, err := http.NewRequestWithContext(ctx, method, target, body)
	if err != nil {
		return err
	}

	request.Header.Set("Authorization", "Bearer "+as.bearer)
	request.Header.Set("Accept", "application/json")
	request.Header.Set("User-Agent", "moogo-cli/"+buildVersion())
	if as.accessKeyID != "" {
		request.Header.Set("X-Moogo-Access-Key-Id", as.accessKeyID)
	}
	if payload != nil {
		request.Header.Set("Content-Type", "application/json")
	}

	response, err := client.http.Do(request)
	if err != nil {
		return fmt.Errorf("%s %s: %w", method, redact(target), err)
	}
	defer response.Body.Close()

	raw, err := io.ReadAll(io.LimitReader(response.Body, responseLimit))
	if err != nil {
		return fmt.Errorf("read response: %w", err)
	}

	if response.StatusCode >= 400 {
		return decodeRefusal(response.StatusCode, raw)
	}

	if out != nil {
		if err := json.Unmarshal(raw, out); err != nil {
			return fmt.Errorf("parse response: %w", err)
		}
	}

	return nil
}

// decodeRefusal turns an error body into an APIError.
//
// Not every refusal is JSON -- a proxy in front of the API can answer in HTML
// -- and an unparsable one still has to name its status rather than disappearing
// into a JSON syntax error.
func decodeRefusal(status int, raw []byte) error {
	var envelope struct {
		Error struct {
			Code      string `json:"code"`
			Message   string `json:"message"`
			Detail    string `json:"detail"`
			RequestID string `json:"request_id"`
		} `json:"error"`
	}

	if err := json.Unmarshal(raw, &envelope); err == nil && envelope.Error.Code != "" {
		return &APIError{
			Status:    status,
			Code:      envelope.Error.Code,
			Message:   envelope.Error.Message,
			Detail:    envelope.Error.Detail,
			RequestID: envelope.Error.RequestID,
		}
	}

	return &APIError{
		Status:  status,
		Message: strings.TrimSpace(string(raw)),
	}
}

// redact keeps a URL out of an error message when it could carry something
// worth keeping out of a terminal recording. A project URL carries no secret,
// but a query string in a future command might.
func redact(target string) string {
	if index := strings.Index(target, "?"); index >= 0 {
		return target[:index] + "?…"
	}
	return target
}
