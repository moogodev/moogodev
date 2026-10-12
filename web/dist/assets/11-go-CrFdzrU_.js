var e=`# Go

Native HTTP client, zero dependencies, compiles to single binary.

## Setup

\`\`\`bash
# Go 1.21+ (stdlib only)
go mod init myapp
\`\`\`

**Environment variables:**

\`\`\`bash
export MOOGO_PROJECT_URL="https://api.moogo.dev/p/<project-id>"
export MOOGO_SECRET_KEY="moogo_..."
export MOOGO_BUCKET_ENDPOINT="https://api.moogo.dev/p/<project-id>/bucket"
# Optional: origin public objects are served from; empty falls back to the bucket endpoint origin.
export MOOGO_CDN_URL="https://cdn.moogo.dev"
export MOOGO_BUCKET_ACCESS_KEY_ID="moogo_ak_..."
export MOOGO_BUCKET_SECRET_KEY="moogo_sk_..."
\`\`\`

## Client (\`moogo/moogo.go\`)

\`\`\`go
// moogo/moogo.go
package moogo

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/url"
	"os"
	"regexp"
	"strings"
	"time"
)

var (
	projectURL        = os.Getenv("MOOGO_PROJECT_URL")
	secretKey         = os.Getenv("MOOGO_SECRET_KEY")
	bucketEndpoint    = os.Getenv("MOOGO_BUCKET_ENDPOINT")
	cdnURL            = strings.TrimRight(os.Getenv("MOOGO_CDN_URL"), "/")
	bucketAccessKeyID = os.Getenv("MOOGO_BUCKET_ACCESS_KEY_ID")
	bucketSecretKey   = os.Getenv("MOOGO_BUCKET_SECRET_KEY")

	// \`with\` covers CTE reads (WITH ... SELECT); a CTE that writes
	// (WITH ... INSERT) must be sent to /exec directly.
	readRe     = regexp.MustCompile(\`^\\s*(?i:SELECT|VALUES|PRAGMA|EXPLAIN|WITH)\\b\`)
	httpClient = &http.Client{Timeout: 30 * time.Second}
)

type Error struct {
	Code    string \`json:"code"\`
	Message string \`json:"message"\`
	Detail  string \`json:"detail"\`
	Status  int
}

func (e *Error) Error() string { return e.Message }

// do sends one request. The body arrives already encoded -- JSON for the SQL
// endpoints, raw bytes for an upload -- because JSON-encoding a reader here would
// send "{}": bytes.Reader has no exported fields, so the file would never leave
// the process, and forcing Content-Type would lie about what was sent.
func do(method, url string, headers map[string]string, body []byte) (map[string]any, error) {
	var reader io.Reader
	if body != nil {
		reader = bytes.NewReader(body)
	}

	req, err := http.NewRequest(method, url, reader)
	if err != nil {
		return nil, err
	}
	for k, v := range headers {
		req.Header.Set(k, v)
	}

	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result map[string]any
	json.NewDecoder(resp.Body).Decode(&result)

	if resp.StatusCode >= 400 {
		// The status is the fallback: a body that is not the documented envelope
		// still has to raise something a caller can branch on.
		apiErr := &Error{Status: resp.StatusCode, Code: "http_error"}
		if e, ok := result["error"].(map[string]any); ok {
			if code, ok := e["code"].(string); ok {
				apiErr.Code = code
			}
			if message, ok := e["message"].(string); ok {
				apiErr.Message = message
			}
			if detail, ok := e["detail"].(string); ok {
				apiErr.Detail = detail
			}
		}
		return nil, apiErr
	}
	return result, nil
}

// postSQL encodes the body for /query and /exec, which take the same shape.
func postSQL(path, sql string, args []any) (map[string]any, error) {
	payload, err := json.Marshal(map[string]any{"query": sql, "args": args})
	if err != nil {
		return nil, err
	}
	return do("POST", projectURL+path, map[string]string{
		"Authorization": "Bearer " + secretKey,
		"Content-Type":  "application/json",
	}, payload)
}

// ── SQL ──────────────────────────────────────────────────────────────
func Query(sql string, args ...any) (map[string]any, error) {
	return postSQL("/query", sql, args)
}

func Exec(sql string, args ...any) (map[string]any, error) {
	return postSQL("/exec", sql, args)
}

func SQL(sql string, args ...any) (map[string]any, error) {
	if readRe.MatchString(sql) {
		return Query(sql, args...)
	}
	return Exec(sql, args...)
}

func ToObjects(result map[string]any) []map[string]any {
	cols := result["columns"].([]any)
	rows := result["rows"].([]any)
	out := make([]map[string]any, len(rows))
	for i, row := range rows {
		rowArr := row.([]any)
		m := make(map[string]any, len(cols))
		for j, col := range cols {
			m[col.(string)] = rowArr[j]
		}
		out[i] = m
	}
	return out
}

// ── Bucket ───────────────────────────────────────────────────────────
// keyPath escapes each key segment but keeps the slashes between them, since a
// slash is a real separator in a key.
func keyPath(key string) string {
	parts := strings.Split(key, "/")
	for i, part := range parts {
		parts[i] = url.PathEscape(part)
	}
	return strings.Join(parts, "/")
}

func BucketUpload(key string, content []byte, contentType string) (map[string]any, error) {
	return do("POST", bucketEndpoint+"/"+keyPath(key), map[string]string{
		"X-Moogo-Access-Key-Id": bucketAccessKeyID,
		"Authorization":         "Bearer " + bucketSecretKey,
		"Content-Type":          contentType,
	}, content)
}

func BucketDownload(key string) ([]byte, error) {
	req, _ := http.NewRequest("GET", bucketEndpoint+"/"+key, nil)
	req.Header.Set("X-Moogo-Access-Key-Id", bucketAccessKeyID)
	req.Header.Set("Authorization", "Bearer "+bucketSecretKey)
	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	return io.ReadAll(resp.Body)
}

func BucketDelete(key string) (map[string]any, error) {
	return do("DELETE", bucketEndpoint+"/"+key, map[string]string{
		"X-Moogo-Access-Key-Id": bucketAccessKeyID,
		"Authorization":         "Bearer " + bucketSecretKey,
	}, nil)
}

func BucketList(prefix string) (map[string]any, error) {
	url := bucketEndpoint
	if prefix != "" {
		url += "?prefix=" + prefix
	}
	return do("GET", url, map[string]string{
		"X-Moogo-Access-Key-Id": bucketAccessKeyID,
		"Authorization":         "Bearer " + bucketSecretKey,
	}, nil)
}

func BucketPublish(key string) (map[string]any, error) {
	payload, err := json.Marshal(map[string]any{"is_public": true})
	if err != nil {
		return nil, err
	}
	return do("PATCH", bucketEndpoint+"/"+keyPath(key), map[string]string{
		"X-Moogo-Access-Key-Id": bucketAccessKeyID,
		"Authorization":         "Bearer " + bucketSecretKey,
		"Content-Type":          "application/json",
	}, payload)
}

func BucketPublicUrl(key string) string {
	// /pub/<id>/<key> is the route that needs no credential. The bucket endpoint
	// is not it -- /p/<id>/bucket/<key> is the authenticated URL, and an <img>
	// pointed at one breaks for every private object. This serves published
	// objects only: a fresh upload is private, so publish it with BucketPublish
	// first. Until then, public_url in the response is an empty string. When
	// MOOGO_CDN_URL is set, public objects are served from that CDN host instead
	// of the bucket endpoint.
	base := strings.TrimSuffix(strings.Replace(bucketEndpoint, "/p/", "/pub/", 1), "/bucket")
	if cdnURL != "" {
		// Keep the /pub/<id> path, swap only the scheme and host.
		if u, err := url.Parse(base); err == nil {
			if c, err := url.Parse(cdnURL); err == nil {
				u.Scheme = c.Scheme
				u.Host = c.Host
				base = u.String()
			}
		}
	}
	return base + "/" + keyPath(key)
}
\`\`\`

## Usage

\`\`\`go
// main.go
package main

import (
	"errors"
	"fmt"
	"os"

	"your/module/moogo"
)

func main() {
	// Create table
	Must(moogo.SQL(\`
		CREATE TABLE IF NOT EXISTS users (
			id TEXT PRIMARY KEY,
			email TEXT NOT NULL,
			plan TEXT DEFAULT 'free'
		)
	\`))

	// Insert
	Must(moogo.SQL("INSERT INTO users (id, email, plan) VALUES (?, ?, ?)",
		"u1", "ketut@example.com", "pro"))

	// Query
	users := moogo.ToObjects(Must(moogo.SQL("SELECT id, email, plan FROM users WHERE plan = ?", "pro")))
	fmt.Println(users)

	// Bucket upload
	content, _ := os.ReadFile("avatar.png")
	key := "avatars/kit.png"
	Must(moogo.BucketUpload(key, content, "image/png"))
	Must(moogo.BucketPublish(key))

	// Public URL (the object was published above)
	fmt.Println(moogo.BucketPublicUrl(key))
}

// Helper for examples
func Must[T any](v T, err error) T {
	if err != nil {
		var e *moogo.Error
		if errors.As(err, &e) {
			fmt.Fprintf(os.Stderr, "Moogo error [%s]: %s\\n", e.Code, e.Message)
		} else {
			fmt.Fprintf(os.Stderr, "Error: %v\\n", err)
		}
		os.Exit(1)
	}
	return v
}
\`\`\`

## HTTP Server (stdlib)

\`\`\`go
// server.go
package main

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"io"
	"net/http"

	"your/module/moogo"
)

func main() {
	http.HandleFunc("/api/users", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			users := moogo.ToObjects(Must(moogo.SQL("SELECT id, email, plan FROM users")))
			json.NewEncoder(w).Encode(users)
		case http.MethodPost:
			var in struct{ Email, Plan string }
			json.NewDecoder(r.Body).Decode(&in)
			id := "u_" + randomID()
			Must(moogo.SQL("INSERT INTO users (id, email, plan) VALUES (?, ?, ?)", id, in.Email, in.Plan))
			json.NewEncoder(w).Encode(map[string]string{"id": id})
		}
	})

	http.HandleFunc("/api/upload", func(w http.ResponseWriter, r *http.Request) {
		file, _, _ := r.FormFile("file")
		defer file.Close()
		content, _ := io.ReadAll(file)
		key := "uploads/" + file.Filename
		Must(moogo.BucketUpload(key, content, r.Header.Get("Content-Type")))
		Must(moogo.BucketPublish(key))
		json.NewEncoder(w).Encode(map[string]string{"url": moogo.BucketPublicUrl(key)})
	})

	http.ListenAndServe(":8080", nil)
}

func randomID() string {
	b := make([]byte, 8)
	rand.Read(b)
	return hex.EncodeToString(b)
}
\`\`\`

## Gin / Echo / Chi

\`\`\`go
// Gin example
import "github.com/gin-gonic/gin"

func main() {
	r := gin.Default()
	r.GET("/users", func(c *gin.Context) {
		users := moogo.ToObjects(Must(moogo.SQL("SELECT id, email, plan FROM users")))
		c.JSON(200, users)
	})
	r.Run()
}
\`\`\`

## Error handling

\`\`\`go
result, err := moogo.SQL("SELECT * FROM nonexistent")
var e *moogo.Error
if errors.As(err, &e) {
	switch e.Code {
	case "sql_error":
		log.Printf("SQLite: %s", e.Detail)
	case "database_too_large":
		log.Println("Quota exceeded")
	case "statement_timeout":
		log.Println("Query too slow")
	}
}
\`\`\`

## Testing

\`\`\`go
// moogo_test.go
func TestSQL(t *testing.T) {
	// Use httptest.Server to mock Moogo API
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(200)
		json.NewEncoder(w).Encode(map[string]any{
			"success": true, "columns": []string{"id"}, "rows": [][]any{{"u1"}}, "row_count": 1,
		})
	}))
	defer server.Close()

	os.Setenv("MOOGO_PROJECT_URL", server.URL)
	os.Setenv("MOOGO_SECRET_KEY", "test")

	users := moogo.ToObjects(Must(moogo.SQL("SELECT id FROM users")))
	assert.Equal(t, []map[string]any{{"id": "u1"}}, users)
}
\`\`\`

## Cross-compile

\`\`\`bash
GOOS=linux GOARCH=amd64 go build -o myapp-linux
GOOS=windows GOARCH=amd64 go build -o myapp.exe
\`\`\`

## Production Readiness ⚠️

- **SQL transactions**: Max 100 statements per \`/transaction\` and 15-second budget. Do not combine large DDL with intensive data manipulation in a single transaction.
- **Database size limit**: 250 MB per project. Database does not auto-shrink — delete rows progressively if approaching the limit, and monitor daily usage.
- **Sensitive column names**: Certain names (\`readfile\`, \`writefile\`, \`delete\`, \`vacuum\`, \`attach\`, \`detach\`, \`reindex\`, \`analyze\`, \`pragma\`) are blocked as column names in SQL queries.
- **Public object URLs**: \`public_url\` is a bearer token — cannot be revoked without rotating the key or unpublishing the object. Perform \`PATCH is_public: true\` after upload if you want to share without credentials.
- **Error handling**: Use \`error.code\` rather than \`error.message\` for safe branching (retryable vs non-retryable).

## Next

- [Python guide](/docs/guides/python-vanilla)
- [Java/Kotlin guide](/docs/guides/java-kotlin)
- [SQL API reference](/docs/sql-api)
- [Schema & migrations](/docs/schema-best-practices) — transactions, batch inserts, paging, indexes
- [Object storage](/docs/object-storage)`;export{e as default};