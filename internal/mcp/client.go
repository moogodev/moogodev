package mcp

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/moogodev/moogodev/internal/handler"
	"github.com/moogodev/moogodev/pkg/httpx"
)

// defaultTimeout bounds one data-plane call.
//
// The server cancels a statement after 15 seconds, so this sits just above that
// on purpose: a slow query comes back as the server's own statement_timeout
// error, which the agent can read, instead of the client giving up first and
// leaving the caller unsure whether the statement ran.
const defaultTimeout = 20 * time.Second

// responseBodyLimit caps how much of a response is read into memory. Query
// results are already capped at 1000 rows and the size ceiling is enforced by
// the server, so this is a backstop rather than the primary limit.
const responseBodyLimit = 8 << 20

// Client is a thin HTTP client over one project's data plane.
//
// It holds the secret key for the life of the process. The key is set on the
// request header and nowhere else: it is not stored in an error, not echoed in
// a result and not logged, because the whole point of reading it from the
// environment is that it never appears in the conversation.
type Client struct {
	baseURL string
	secret  string
	http    *http.Client
}

// NewClient builds a client for one project.
//
// A nil httpClient gets a default with a timeout slightly above the server's
// statement timeout. Tests pass their own.
func NewClient(projectURL, secretKey string, httpClient *http.Client) *Client {
	if httpClient == nil {
		httpClient = &http.Client{Timeout: defaultTimeout}
	}
	return &Client{
		baseURL: strings.TrimRight(projectURL, "/"),
		secret:  secretKey,
		http:    httpClient,
	}
}

// Statement is one entry of a transaction.
//
// The wire field on the data plane is "query"; the tool field is "sql", which
// reads better to an agent. The rename happens here so the two names can differ
// without either side having to know about the other.
type Statement struct {
	SQL  string `json:"sql"`
	Args []any  `json:"args"`
}

// APIError is a structured failure returned by the data plane.
//
// It mirrors the {"error":{"code","message","detail"}} envelope so a tool can
// hand the agent a stable code to branch on rather than a pile of prose.
type APIError struct {
	Status  int
	Code    string
	Message string
	Detail  string
}

func (err *APIError) Error() string {
	if err.Detail != "" {
		return fmt.Sprintf("%s: %s (%s)", err.Code, err.Message, err.Detail)
	}
	return fmt.Sprintf("%s: %s", err.Code, err.Message)
}

// Query runs one read statement.
func (client *Client) Query(ctx context.Context, sql string, args []any) (*handler.QueryResponse, error) {
	var response handler.QueryResponse
	if err := client.post(ctx, "/query", handler.SQLRequest{Query: sql, Args: args}, &response); err != nil {
		return nil, err
	}
	return &response, nil
}

// Exec runs one write statement.
func (client *Client) Exec(ctx context.Context, sql string, args []any) (*handler.ExecResponse, error) {
	var response handler.ExecResponse
	if err := client.post(ctx, "/exec", handler.SQLRequest{Query: sql, Args: args}, &response); err != nil {
		return nil, err
	}
	return &response, nil
}

// Transaction runs a batch of writes as one unit.
func (client *Client) Transaction(ctx context.Context, statements []Statement) (*handler.TransactionResponse, error) {
	batch := make([]handler.TransactionStatement, len(statements))
	for index, statement := range statements {
		batch[index] = handler.TransactionStatement{Query: statement.SQL, Args: statement.Args}
	}

	var response handler.TransactionResponse
	request := handler.TransactionRequest{Statements: batch}
	if err := client.post(ctx, "/transaction", request, &response); err != nil {
		return nil, err
	}
	return &response, nil
}

// post sends one JSON request and decodes the response into target.
func (client *Client) post(ctx context.Context, path string, payload any, target any) error {
	encoded, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("encode request: %w", err)
	}

	request, err := http.NewRequestWithContext(ctx, http.MethodPost, client.baseURL+path, bytes.NewReader(encoded))
	if err != nil {
		return fmt.Errorf("build request: %w", err)
	}
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Accept", "application/json")
	// The only place the key is used. It is set and then never touched again,
	// so it cannot be carried into a message by a later fmt or log call.
	request.Header.Set("Authorization", "Bearer "+client.secret)

	response, err := client.http.Do(request)
	if err != nil {
		return fmt.Errorf("call %s: %w", path, err)
	}
	defer func() { _ = response.Body.Close() }()

	body, err := io.ReadAll(io.LimitReader(response.Body, responseBodyLimit))
	if err != nil {
		return fmt.Errorf("read %s response: %w", path, err)
	}

	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return decodeAPIError(response.StatusCode, body)
	}

	if err := json.Unmarshal(body, target); err != nil {
		return fmt.Errorf("decode %s response: %w", path, err)
	}
	return nil
}

// decodeAPIError turns an error body into an APIError.
//
// A body that is not the documented envelope (a proxy's HTML error page, say)
// still produces an APIError, so the caller has one error type to format no
// matter what answered.
func decodeAPIError(status int, body []byte) error {
	var envelope httpx.ErrorBody
	if err := json.Unmarshal(body, &envelope); err == nil && envelope.Error.Code != "" {
		return &APIError{
			Status:  status,
			Code:    envelope.Error.Code,
			Message: envelope.Error.Message,
			Detail:  envelope.Error.Detail,
		}
	}
	return &APIError{
		Status:  status,
		Code:    "http_error",
		Message: fmt.Sprintf("the data plane returned HTTP %d", status),
	}
}
