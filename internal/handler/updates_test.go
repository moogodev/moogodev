package handler

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/moogodev/moogodev/pkg/logger"
)

// newsPayload is the shape the news service's public GET /api/posts answers
// with, newest first.
func newsPayload(posts ...map[string]any) string {
	body, err := json.Marshal(map[string]any{"posts": posts})
	if err != nil {
		panic(err)
	}
	return string(body)
}

func post(slug, title string, published bool, createdAt string) map[string]any {
	return map[string]any{
		"slug":       slug,
		"title":      title,
		"published":  published,
		"created_at": createdAt,
	}
}

func serveUpdates(t *testing.T, newsURL string) []updateItem {
	t.Helper()
	return callUpdates(t, NewUpdatesHandler(newsURL, logger.Nop()))
}

// callUpdates performs one request against an existing handler, so a test can
// ask the same handler twice -- the only way to observe the cache.
func callUpdates(t *testing.T, handler *UpdatesHandler) []updateItem {
	t.Helper()

	recorder := httptest.NewRecorder()
	handler.Updates(recorder, httptest.NewRequest(http.MethodGet, "/api/updates", nil))

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200 even when the news service fails, got %d (%s)",
			recorder.Code, recorder.Body.String())
	}

	var decoded struct {
		Updates []updateItem `json:"updates"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &decoded); err != nil {
		t.Fatalf("response is not JSON: %v (%s)", err, recorder.Body.String())
	}
	// A null updates field decodes as nil, which is the exact bug this
	// endpoint must not have: a client mapping over null throws.
	if decoded.Updates == nil {
		t.Fatalf("expected an updates array, got null (%s)", recorder.Body.String())
	}
	return decoded.Updates
}

// TestUpdatesServesPublishedPostsNewestFirst is the happy path: what the news
// service published is what the dashboard shows, in the order the news
// service returned it, with drafts left out.
func TestUpdatesServesPublishedPostsNewestFirst(t *testing.T) {
	news := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/posts" {
			t.Errorf("expected news path /api/posts, got %s", r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(newsPayload(
			post("newest", "Newest post", true, "2026-10-05T00:00:00Z"),
			post("draft", "Unpublished draft", false, "2026-10-04T00:00:00Z"),
			post("", "Slugless", true, "2026-10-03T00:00:00Z"),
			post("older", "Older post", true, "2026-10-02T00:00:00Z"),
		)))
	}))
	defer news.Close()

	updates := serveUpdates(t, news.URL)

	if len(updates) != 2 {
		t.Fatalf("expected 2 published posts, got %d: %+v", len(updates), updates)
	}
	if updates[0].Slug != "newest" || updates[1].Slug != "older" {
		t.Errorf("expected newest-first order, got %q then %q",
			updates[0].Slug, updates[1].Slug)
	}
	if updates[0].Title != "Newest post" || updates[0].CreatedAt != "2026-10-05T00:00:00Z" {
		t.Errorf("expected title and date to pass through, got %+v", updates[0])
	}
}

// TestUpdatesCapsTheList keeps one deployment with a hundred posts from
// answering a payload the widget will never render.
func TestUpdatesCapsTheList(t *testing.T) {
	posts := make([]map[string]any, 0, 10)
	for i := 10; i > 0; i-- {
		posts = append(posts, post("post-"+string(rune('a'+i)), "Post", true, "2026-10-01T00:00:00Z"))
	}
	news := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(newsPayload(posts...)))
	}))
	defer news.Close()

	updates := serveUpdates(t, news.URL)
	if len(updates) != maxUpdates {
		t.Errorf("expected %d updates, got %d", maxUpdates, len(updates))
	}
}

// TestUpdatesStaysEmptyWhenNewsFails pins the silent-empty contract: an
// unreachable, erroring, or gibberish-speaking news service answers 200 with
// an empty list, so the widget disappears instead of raising an error on a
// dashboard that is otherwise fine.
func TestUpdatesStaysEmptyWhenNewsFails(t *testing.T) {
	closed := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {}))
	closed.Close()

	failing := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "boom", http.StatusInternalServerError)
	}))
	defer failing.Close()

	garbage := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte("<html>not json</html>"))
	}))
	defer garbage.Close()

	for name, newsURL := range map[string]string{
		"unreachable": closed.URL,
		"500":         failing.URL,
		"not json":    garbage.URL,
		"blank":       "",
	} {
		t.Run(name, func(t *testing.T) {
			if updates := serveUpdates(t, newsURL); len(updates) != 0 {
				t.Errorf("expected an empty list, got %+v", updates)
			}
		})
	}
}

// TestUpdatesUsesLoopbackPostsEndpoint documents the one route it calls: the
// news service's public list endpoint, not something that needs a session.
func TestUpdatesUsesLoopbackPostsEndpoint(t *testing.T) {
	var gotPath string
	news := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotPath = r.URL.Path
		_, _ = w.Write([]byte(newsPayload()))
	}))
	defer news.Close()

	NewUpdatesHandler(news.URL+"/", logger.Nop()).Updates(
		httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "/api/updates", nil))

	if gotPath != "/api/posts" {
		t.Errorf("expected news path /api/posts, got %q", gotPath)
	}
}

// TestUpdatesTrailingSlashIsTrimmed keeps MOOGO_NEWS_URL=http://host:8081/ and
// http://host:8081 from producing a doubled slash in the request path.
func TestUpdatesTrailingSlashIsTrimmed(t *testing.T) {
	var gotPath string
	news := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotPath = r.URL.Path
		_, _ = w.Write([]byte(newsPayload()))
	}))
	defer news.Close()

	handler := NewUpdatesHandler(news.URL+"//", logger.Nop())
	handler.Updates(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "/api/updates", nil))

	if strings.Contains(gotPath, "//") {
		t.Errorf("expected no doubled slash, got %q", gotPath)
	}
}

// TestUpdatesServesTheCachedAnswer: a second request inside the cache window
// must not reach the news service, and must answer the same list.
func TestUpdatesServesTheCachedAnswer(t *testing.T) {
	var calls atomic.Int32
	news := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		_, _ = w.Write([]byte(newsPayload(post("s1", "Shipped", true, "2026-10-01T00:00:00Z"))))
	}))
	defer news.Close()

	handler := NewUpdatesHandler(news.URL, logger.Nop())
	first := callUpdates(t, handler)
	second := callUpdates(t, handler)

	if got := calls.Load(); got != 1 {
		t.Errorf("expected one fetch to the news service, got %d", got)
	}
	if len(first) != 1 || len(second) != 1 || first[0] != second[0] {
		t.Errorf("expected the same cached list twice, got %v then %v", first, second)
	}
}

// TestUpdatesCachesTheEmptyAnswerAfterAFailure: a news outage must not turn
// every dashboard visit into a new outbound fetch. The failed answer is
// cached like any other, still a 200 with an array.
func TestUpdatesCachesTheEmptyAnswerAfterAFailure(t *testing.T) {
	var calls atomic.Int32
	news := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer news.Close()

	handler := NewUpdatesHandler(news.URL, logger.Nop())
	first := callUpdates(t, handler)
	second := callUpdates(t, handler)

	if got := calls.Load(); got != 1 {
		t.Errorf("expected the failure to be cached after one attempt, got %d attempts", got)
	}
	if len(first) != 0 || len(second) != 0 {
		t.Errorf("expected two empty lists, got %v then %v", first, second)
	}
}

// TestUpdatesRefetchesAfterTheCacheExpires: the cache is a bound, not a
// snapshot; once the window has passed the news service is asked again.
func TestUpdatesRefetchesAfterTheCacheExpires(t *testing.T) {
	var calls atomic.Int32
	news := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		_, _ = w.Write([]byte(newsPayload(post("s1", "Shipped", true, "2026-10-01T00:00:00Z"))))
	}))
	defer news.Close()

	handler := NewUpdatesHandler(news.URL, logger.Nop())
	callUpdates(t, handler)

	handler.mu.Lock()
	handler.cachedAt = time.Now().Add(-updatesCacheTTL - time.Second)
	handler.mu.Unlock()

	callUpdates(t, handler)
	if got := calls.Load(); got != 2 {
		t.Errorf("expected a second fetch once the cache expired, got %d fetches", got)
	}
}
