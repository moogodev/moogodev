// Package handler implements the HTTP endpoints.
package handler

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/moogodev/moogodev/pkg/httpx"
	"github.com/moogodev/moogodev/pkg/logger"
)

// UpdatesHandler serves GET /api/updates: the dashboard's "What's new" list.
//
// The list is read from the news service over loopback and re-served on this
// origin, so the dashboard makes one same-origin request and the news service
// needs no CORS route of its own. It also keeps the widget honest: the titles
// and slugs are whatever is published there right now, so deleting or renaming
// a post changes this list with no redeploy — a literal array in the frontend
// goes stale the moment the news database changes and hands readers links to
// posts that no longer exist.
//
// A failure never surfaces as an error: with a previous answer in hand the
// widget keeps showing it, stale by at most a window, and with nothing cached
// it gets an empty list. The widget is decoration on top of a working
// dashboard: a news outage, or a deployment that runs no news service at all,
// must not surface as a dashboard failure. The answer is also kept for
// updatesCacheTTL, so a busy dashboard spends one outbound fetch a minute
// rather than one per visit.
type UpdatesHandler struct {
	newsURL string
	client  *http.Client
	log     *logger.Logger

	// The last answer and when it was taken, guarded because every open
	// dashboard hits this handler. The lock is held across the fetch on
	// purpose: one caller refreshes while the others wait and then share
	// the result, instead of several callers spending several outbound
	// fetches on the same minute-old list. The rate limit in front is per
	// address, not per process, so it cannot keep two goroutines here
	// from asking at once.
	mu       sync.Mutex
	cached   []updateItem
	cachedAt time.Time
}

// maxUpdates bounds the payload. The widget shows the newest few and the news
// front page holds the rest; the news service returns posts newest first, so
// the first maxUpdates kept are the newest.
const maxUpdates = 5

// maxNewsBody bounds how much of the news service's answer is read. The list
// is a few kilobytes; a body near this limit is not the list this handler
// asked for, and reading more of a response than that is only a way to spend
// memory on a body that gets discarded anyway.
const maxNewsBody = 1 << 20

// updatesCacheTTL is how long one answer is served before the news service is
// asked again. The window was specified as 30-60 seconds; a changelog post
// appearing on the dashboard within a minute of publishing is plenty, and the
// bound holds however many dashboards are open: the news service sees at most
// one outbound fetch a minute no matter the traffic.
const updatesCacheTTL = time.Minute

// NewUpdatesHandler creates an UpdatesHandler that reads from newsURL.
func NewUpdatesHandler(newsURL string, log *logger.Logger) *UpdatesHandler {
	return &UpdatesHandler{
		newsURL: strings.TrimRight(newsURL, "/"),
		client:  &http.Client{Timeout: 3 * time.Second},
		log:     log,
	}
}

// updateItem is one row of the dashboard's update list.
type updateItem struct {
	Slug      string `json:"slug"`
	Title     string `json:"title"`
	CreatedAt string `json:"created_at"`
}

// Updates serves GET /api/updates.
func (handler *UpdatesHandler) Updates(w http.ResponseWriter, r *http.Request) {
	updates := handler.list(r.Context())
	// make() rather than a possibly-nil slice, so a failed fetch answers
	// {"updates":[]} instead of {"updates":null}. Both are valid JSON, but
	// only one is an array, and a client that maps over the result without a
	// null guard gets a TypeError on the response that claims to be a list.
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"updates": updates})
}

// list returns the cached answer while it is still fresh, and otherwise
// fetches a new one and remembers it. A failed refresh keeps the previous
// answer -- stale-on-error -- when there is one, and caches the empty list
// when there is not, so a news outage costs one outbound attempt per minute
// rather than one per visitor and never blanks a widget that was working. A
// request that arrives while the refresh is in flight waits for it instead of
// starting a second. The fetch runs on a context detached from the caller: a
// visitor who navigates away mid-fetch must not abort the work the others are
// waiting on, nor poison the cache with the cancellation that would report.
func (handler *UpdatesHandler) list(ctx context.Context) []updateItem {
	handler.mu.Lock()
	defer handler.mu.Unlock()

	if handler.cached != nil && time.Since(handler.cachedAt) < updatesCacheTTL {
		return handler.cached
	}

	updates, ok := handler.fetch(context.WithoutCancel(ctx))
	handler.cachedAt = time.Now()
	if !ok && handler.cached != nil {
		// Stale beats empty: a list from a minute ago still links to real
		// posts, while an empty one blinks the widget away. cachedAt moves
		// anyway, so the retry is a minute out instead of every visitor
		// paying for another failed fetch.
		return handler.cached
	}
	handler.cached = updates
	return handler.cached
}

// fetch reads the published posts from the news service. It returns a
// non-nil, possibly short slice in every case, including every failure; ok
// reports whether what it holds is the news service's actual answer, so a
// caller with a previous answer can prefer it over an empty refresh.
func (handler *UpdatesHandler) fetch(ctx context.Context) (updates []updateItem, ok bool) {
	updates = make([]updateItem, 0, maxUpdates)
	if handler.newsURL == "" {
		// Nothing configured to ask: an empty list is the real answer,
		// not a failure to cache around.
		return updates, true
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, handler.newsURL+"/api/posts", nil)
	if err != nil {
		handler.log.Warn("updates: news request could not be built",
			logger.Fields{"error": err.Error()})
		return updates, false
	}
	resp, err := handler.client.Do(req)
	if err != nil {
		handler.log.Warn("updates: news service unreachable",
			logger.Fields{"error": err.Error()})
		return updates, false
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		handler.log.Warn("updates: news service answered an error",
			logger.Fields{"status": resp.Status})
		return updates, false
	}

	var payload struct {
		Posts []struct {
			Slug      string `json:"slug"`
			Title     string `json:"title"`
			Published bool   `json:"published"`
			CreatedAt string `json:"created_at"`
		} `json:"posts"`
	}
	if err := json.NewDecoder(io.LimitReader(resp.Body, maxNewsBody)).Decode(&payload); err != nil {
		handler.log.Warn("updates: news response not understood",
			logger.Fields{"error": err.Error()})
		return updates, false
	}

	for _, post := range payload.Posts {
		// The news endpoint only lists published posts; the check is here
		// anyway because the widget links straight to them, and a draft
		// leaking in would render on the news site as "Post not found".
		if !post.Published || post.Slug == "" || post.Title == "" {
			continue
		}
		updates = append(updates, updateItem{
			Slug:      post.Slug,
			Title:     post.Title,
			CreatedAt: post.CreatedAt,
		})
		if len(updates) == maxUpdates {
			break
		}
	}
	return updates, true
}
