package httpx

import (
	"bytes"
	"encoding/json"
	"html"
	"io/fs"
	"net/http"
	"strconv"
	"strings"
)

// maxErrorPageBuffer caps how much of a response is held in memory while the
// handler is still writing and the outcome is not yet known. A browser
// navigation asks for an HTML document, which is small; anything that grows
// past this is streamed through untouched instead of being rewritten.
const maxErrorPageBuffer = 1 << 20

// wantsHTML reports whether the request is a browser navigation rather than an
// API call.
//
// The Accept header is the negotiation axis: a browser document load always
// lists text/html, the dashboard's fetch calls send application/json, and
// curl and monitoring probes send */*. Only GET and HEAD are treated as
// navigations, so a form post or a state-changing call still receives JSON.
func wantsHTML(r *http.Request) bool {
	if r.Method != http.MethodGet && r.Method != http.MethodHead {
		return false
	}
	return strings.Contains(strings.ToLower(r.Header.Get("Accept")), "text/html")
}

// apiPathPrefixes are the groups that are a machine interface rather than a
// page. They answer JSON for every client, including a browser that happens
// to navigate to one: a probe that checks a status code and a fetch that
// decodes the error envelope must not start receiving an HTML document.
func apiPathPrefixes() []string {
	return []string{"/api/", "/p/", "/db/", "/bucket/", "/auth/", "/static/"}
}

func isAPIPath(path string) bool {
	switch path {
	case "/healthz", "/readyz", "/metrics":
		return true
	}
	for _, prefix := range apiPathPrefixes() {
		if strings.HasPrefix(path, prefix) {
			return true
		}
	}
	return false
}

// ErrorPages answers a failed browser navigation with the front page itself.
//
// The API answers every failure with one JSON error shape, which is right for
// the dashboard's fetch calls and for curl but not for a person who mistyped a
// URL. For a document request to a page address, the response is replaced with
// the served index.html carrying the original status and a small hidden marker
// with that status, so the client router renders the error inside the site's
// own layout -- announcement bar, navigation and footer included -- instead of
// a standalone page that has to imitate the site's chrome and drifts from it.
// A route that does not exist reaches the catch-all error route anyway; the
// marker is what tells it when the failure was something other than 404.
//
// API paths and requests whose Accept header does not include text/html never
// buffer: they pass straight through and keep the JSON body byte for byte.
// The index is read on every error the way spa reads it, so a rebuilt binary
// never assembles a page from an older build.
func ErrorPages(indexFS fs.FS) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// The response now depends on Accept, so any cache must key on it.
			w.Header().Add("Vary", "Accept")

			if !wantsHTML(r) || isAPIPath(r.URL.Path) {
				next.ServeHTTP(w, r)
				return
			}

			capture := &errorPageCapture{w: w}
			next.ServeHTTP(capture, r)

			if capture.passthrough {
				return
			}

			status := capture.status()
			if status >= 400 && !looksLikeHTML(capture.buf) {
				// An error must never be replayed from a cache to the next
				// visitor, and the document is a fresh shell rather than what
				// the handler produced, so its headers are replaced here.
				w.Header().Set("Cache-Control", "no-store")
				code, message := decodeErrorEnvelope(capture.buf)
				serveErrorDocument(w, status, code, message, indexFS)
				return
			}

			if status == 0 && len(capture.buf) == 0 {
				// The handler never responded. net/http answers 200 with an
				// empty body on its own, which is what happens without this
				// middleware.
				return
			}
			w.WriteHeader(status)
			_, _ = w.Write(capture.buf)
		})
	}
}

// serveErrorDocument writes index.html under the failed status, with the
// status embedded for the client route. When the frontend is not part of the
// binary there is no document to serve, so the JSON envelope the handler
// produced is what reaches the client instead.
func serveErrorDocument(w http.ResponseWriter, status int, code string, message string, indexFS fs.FS) {
	if indexFS != nil {
		if contents, err := fs.ReadFile(indexFS, "index.html"); err == nil {
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			// The handler may have declared JSON; the body is a document now.
			// Any Content-Length it set would be wrong for the new body.
			w.Header().Del("Content-Length")
			w.WriteHeader(status)
			_, _ = w.Write(injectErrorStatus(contents, status))
			return
		}
	}

	if code == "" {
		code = "error"
	}
	if message == "" {
		message = http.StatusText(status)
	}
	WriteError(w, status, code, message)
}

// injectErrorStatus embeds the failed status in the document as a hidden data
// block the client reads once at boot. The value is escaped so a message can
// never break out of the markup; textContent decodes the entities back before
// JSON.parse sees them. The block goes ahead of the app root so it is in the
// document before any module runs.
func injectErrorStatus(index []byte, status int) []byte {
	payload := html.EscapeString(`{"status":` + strconv.Itoa(status) + `}`)
	block := []byte(`<div id="moogo-error" hidden>` + payload + `</div>`)

	for _, anchor := range []string{`<div id="root">`, `</body>`} {
		if at := bytes.Index(index, []byte(anchor)); at >= 0 {
			var out []byte
			out = append(out, index[:at]...)
			out = append(out, block...)
			out = append(out, index[at:]...)
			return out
		}
	}
	return append(index, block...)
}

// errorPageCapture holds a response in memory until the handler is done, so a
// JSON error can still be replaced with the document. Headers pass straight
// through on the shared header map; only the status and body are held.
type errorPageCapture struct {
	w           http.ResponseWriter
	buf         []byte
	code        int
	headerSent  bool
	passthrough bool
}

func (capture *errorPageCapture) Header() http.Header {
	return capture.w.Header()
}

func (capture *errorPageCapture) WriteHeader(status int) {
	if capture.code == 0 {
		capture.code = status
	}
}

func (capture *errorPageCapture) Write(payload []byte) (int, error) {
	if capture.code == 0 {
		capture.code = http.StatusOK
	}
	if capture.passthrough {
		return capture.w.Write(payload)
	}
	if len(capture.buf)+len(payload) > maxErrorPageBuffer {
		capture.stream()
		return capture.w.Write(payload)
	}
	capture.buf = append(capture.buf, payload...)
	return len(payload), nil
}

// Flush streams what is buffered and stops buffering, so a handler that
// flushes mid-response keeps working; from that point the body is committed.
func (capture *errorPageCapture) Flush() {
	capture.stream()
	if flusher, ok := capture.w.(http.Flusher); ok {
		flusher.Flush()
	}
}

// Unwrap exposes the underlying writer to http.ResponseController.
func (capture *errorPageCapture) Unwrap() http.ResponseWriter {
	return capture.w
}

// status returns the recorded status, defaulting to 200 the way net/http does.
func (capture *errorPageCapture) status() int {
	if capture.code == 0 {
		return http.StatusOK
	}
	return capture.code
}

// stream sends the buffered response to the real writer and switches the
// capture to pass-through mode.
func (capture *errorPageCapture) stream() {
	if capture.passthrough {
		return
	}
	capture.passthrough = true
	if !capture.headerSent {
		capture.headerSent = true
		capture.w.WriteHeader(capture.status())
	}
	if len(capture.buf) > 0 {
		_, _ = capture.w.Write(capture.buf)
		capture.buf = nil
	}
}

// looksLikeHTML reports whether the body is already a document, which happens
// when a handler renders its own page. Those are left exactly as they are.
func looksLikeHTML(body []byte) bool {
	trimmed := bytes.ToLower(bytes.TrimLeft(body, " \t\r\n"))
	if len(trimmed) > 32 {
		trimmed = trimmed[:32]
	}
	return bytes.HasPrefix(trimmed, []byte("<!doctype html")) ||
		bytes.HasPrefix(trimmed, []byte("<html"))
}

// decodeErrorEnvelope pulls the code and message out of the standard JSON
// error body so the JSON fallback keeps the wording the handler chose. A body
// in any other shape simply yields empty strings.
func decodeErrorEnvelope(body []byte) (code string, message string) {
	var envelope ErrorBody
	if err := json.Unmarshal(body, &envelope); err != nil {
		return "", ""
	}
	return envelope.Error.Code, envelope.Error.Message
}
