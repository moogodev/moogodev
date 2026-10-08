// Package handler implements the HTTP endpoints.
package handler

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"strings"
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
// Every failure answers an empty list rather than an error. The widget is
// decoration on top of a working dashboard: a news outage, or a deployment
// that runs no news service at all, must not surface as a dashboard failure.
type UpdatesHandler struct {
	newsURL string
	client  *http.Client
	log     *logger.Logger
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
	updates := handler.fetch(r.Context())
	// make() rather than a possibly-nil slice, so a failed fetch answers
	// {"updates":[]} instead of {"updates":null}. Both are valid JSON, but
	// only one is an array, and a client that maps over the result without a
	// null guard gets a TypeError on the response that claims to be a list.
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"updates": updates})
}

// fetch reads the published posts from the news service. It returns a
// non-nil, possibly short slice in every case, including every failure.
func (handler *UpdatesHandler) fetch(ctx context.Context) []updateItem {
	updates := make([]updateItem, 0, maxUpdates)
	if handler.newsURL == "" {
		return updates
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, handler.newsURL+"/api/posts", nil)
	if err != nil {
		handler.log.Warn("updates: news request could not be built",
			logger.Fields{"error": err.Error()})
		return updates
	}
	resp, err := handler.client.Do(req)
	if err != nil {
		handler.log.Warn("updates: news service unreachable",
			logger.Fields{"error": err.Error()})
		return updates
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		handler.log.Warn("updates: news service answered an error",
			logger.Fields{"status": resp.Status})
		return updates
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
		return updates
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
	return updates
}
