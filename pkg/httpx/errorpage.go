package httpx

import (
	"bytes"
	"encoding/json"
	"html/template"
	"net/http"
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

// errorPageCopy is the user-facing wording for one status code.
type errorPageCopy struct {
	title string
	hint  string
}

// errorPageCopyByStatus gives each status its own page rather than a generic
// wall of text. Anything not listed falls back to http.StatusText.
var errorPageCopyByStatus = map[int]errorPageCopy{
	http.StatusBadRequest:            {"Bad request", "The request could not be understood. Check it and try again."},
	http.StatusUnauthorized:          {"Sign in required", "This page needs an account. Sign in and try again."},
	http.StatusForbidden:             {"Access denied", "You do not have access to this address."},
	http.StatusNotFound:              {"Page not found", "Check the address for a typo, or start over from the home page."},
	http.StatusMethodNotAllowed:      {"Method not allowed", "This address does not accept that kind of request."},
	http.StatusNotAcceptable:         {"Not acceptable", "The response format requested is not available here."},
	http.StatusRequestTimeout:        {"Request timed out", "The request took too long. Try again."},
	http.StatusConflict:              {"Conflict", "The request conflicts with the current state of this resource."},
	http.StatusGone:                  {"Gone", "This address no longer exists."},
	http.StatusRequestEntityTooLarge: {"Payload too large", "The body sent is bigger than this endpoint accepts."},
	http.StatusRequestURITooLong:     {"URI too long", "The address is longer than this server accepts."},
	http.StatusUnsupportedMediaType:  {"Unsupported media type", "Send the body as application/json."},
	http.StatusUnprocessableEntity:   {"Unprocessable request", "The request was understood but could not be processed."},
	http.StatusTooManyRequests:       {"Too many requests", "You have hit a rate limit. Wait a moment and try again."},
	http.StatusInternalServerError:   {"Something went wrong", "The problem has been logged. Include the request id below when you report it."},
	http.StatusNotImplemented:        {"Not implemented", "This endpoint is not implemented."},
	http.StatusBadGateway:            {"Bad gateway", "An upstream service returned an invalid response."},
	http.StatusServiceUnavailable:    {"Service unavailable", "The service is starting up or a dependency is unreachable. Try again shortly."},
	http.StatusGatewayTimeout:        {"Gateway timeout", "An upstream service took too long to respond."},
}

// copyFor returns the wording for a status, falling back to the standard
// reason phrase so an unusual code still gets a sensible page.
func copyFor(status int) errorPageCopy {
	if copy, ok := errorPageCopyByStatus[status]; ok {
		return copy
	}
	if text := http.StatusText(status); text != "" {
		return errorPageCopy{title: text, hint: "Something did not work. Go back to the home page and try again."}
	}
	return errorPageCopy{title: "Error", hint: "Something did not work. Go back to the home page and try again."}
}

// errorPageData feeds the page template.
type errorPageData struct {
	Status    int
	Title     string
	Hint      string
	Message   string
	Code      string
	Path      string
	RequestID string
}

// errorPageTemplate is parsed once. Inline styles are allowed by the
// Content-Security-Policy the router sets (style-src includes 'unsafe-inline'),
// and the page needs no scripts at all.
var errorPageTemplate = template.Must(template.New("error").Parse(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>{{.Status}} {{.Title}} — moogo</title>
<style>
:root{color-scheme:light dark;--accent:#16a34a;--accent-strong:#15803d}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;
font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",sans-serif;
background:#fafafa;color:#111827}
.card{width:100%;max-width:34rem;background:#fff;border:1px solid #e5e7eb;border-radius:16px;
padding:2.5rem 2rem;text-align:center;box-shadow:0 1px 2px rgba(0,0,0,.04)}
.brand{font-size:.85rem;font-weight:600;letter-spacing:.08em;text-transform:uppercase;
color:var(--accent);text-decoration:none}
.status{margin-top:1.25rem;font-size:4rem;font-weight:700;line-height:1;
letter-spacing:-.03em;color:var(--accent)}
h1{margin:.75rem 0 0;font-size:1.4rem;font-weight:650}
.lead{margin:.75rem 0 0;color:#4b5563;line-height:1.55}
.detail{margin:1rem 0 0;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.8rem;
color:#9ca3af;word-break:break-all}
.pills{margin-top:1rem;display:flex;gap:.5rem;justify-content:center;flex-wrap:wrap}
.pill{max-width:100%;overflow-wrap:anywhere;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;
font-size:.72rem;color:#6b7280;background:#f3f4f6;border:1px solid #e5e7eb;
border-radius:999px;padding:.2rem .6rem}
nav{margin-top:1.75rem;display:flex;gap:.6rem;justify-content:center;flex-wrap:wrap}
.btn{display:inline-block;padding:.55rem 1.2rem;border-radius:999px;font-size:.92rem;
font-weight:550;text-decoration:none;border:1px solid #d1d5db;color:#111827}
.btn:hover{background:#f9fafb}
.btn.primary{background:var(--accent);border-color:var(--accent);color:#fff}
.btn.primary:hover{background:var(--accent-strong);border-color:var(--accent-strong)}
@media (prefers-color-scheme:dark){
body{background:#0b0f0d;color:#e5e7eb}
.card{background:#111815;border-color:#1f2a24;box-shadow:none}
.lead{color:#d1d5db}
.detail{color:#6b7280}
.pill{color:#9ca3af;background:#0f1512;border-color:#1f2a24}
.btn{border-color:#374151;color:#e5e7eb}
.btn:hover{background:#111815}
}
</style>
</head>
<body>
<main class="card">
<a class="brand" href="/">moogo</a>
<div class="status">{{.Status}}</div>
<h1>{{.Title}}</h1>
<p class="lead">{{.Hint}}</p>
{{if .Message}}<p class="detail">{{.Message}}</p>{{end}}
<div class="pills">
<span class="pill">{{.Path}}</span>
{{if .Code}}<span class="pill">{{.Code}}</span>{{end}}
{{if .RequestID}}<span class="pill">{{.RequestID}}</span>{{end}}
</div>
<nav>
{{if eq .Status 401}}<a class="btn primary" href="/login">Sign in</a><a class="btn" href="/">Go home</a>
{{else}}<a class="btn primary" href="/">Go home</a><a class="btn" href="/docs">Docs</a>{{end}}
</nav>
</main>
</body>
</html>`))

// ErrorPages rewrites failed responses into a server-rendered HTML page when
// the client asked for a document, and leaves every other response alone.
//
// The whole API answers with one JSON error shape, which is right for the
// dashboard's fetch calls and for curl, but a person who mistypes a URL should
// not be shown a JSON blob in the browser. The handler runs on every response
// so a page appears for any failing status from any layer -- a missing route,
// a rejected method, an authorisation check, a rate limit, a panic turned into
// a 500 -- without each call site having to know who is asking.
//
// Requests whose Accept header does not include text/html never buffer: they
// pass straight through and keep the JSON body byte for byte.
func ErrorPages(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// The response now depends on Accept, so any cache must key on it.
		w.Header().Add("Vary", "Accept")

		if !wantsHTML(r) {
			next.ServeHTTP(w, r)
			return
		}

		capture := &errorPageCapture{w: w}
		next.ServeHTTP(capture, r)

		if capture.passthrough {
			return
		}

		if capture.status() >= 400 {
			// An error must never be replayed from a cache to the next visitor.
			w.Header().Set("Cache-Control", "no-store")

			if !looksLikeHTML(capture.buf) {
				code, message := decodeErrorEnvelope(capture.buf)
				renderErrorPage(w, r, capture.status(), code, message)
				return
			}
		}

		status := capture.status()
		if status == 0 && len(capture.buf) == 0 {
			// The handler never responded. net/http answers 200 with an empty
			// body on its own, which is what happens without this middleware.
			return
		}
		w.WriteHeader(status)
		_, _ = w.Write(capture.buf)
	})
}

// errorPageCapture holds a response in memory until the handler is done, so a
// JSON error can still be replaced with an HTML page. Headers pass straight
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
// error body so the page can show what actually failed. A body in any other
// shape simply yields empty strings and the page relies on the status copy.
func decodeErrorEnvelope(body []byte) (code string, message string) {
	var envelope ErrorBody
	if err := json.Unmarshal(body, &envelope); err != nil {
		return "", ""
	}
	return envelope.Error.Code, envelope.Error.Message
}

// renderErrorPage writes the HTML page for one failed response.
func renderErrorPage(w http.ResponseWriter, r *http.Request, status int, code string, message string) {
	copy := copyFor(status)
	data := errorPageData{
		Status:    status,
		Title:     copy.title,
		Hint:      copy.hint,
		Message:   message,
		Code:      code,
		Path:      r.URL.Path,
		RequestID: RequestIDFromContext(r.Context()),
	}

	var page bytes.Buffer
	if err := errorPageTemplate.Execute(&page, data); err != nil {
		// The template is compiled at init, so a failure here is a build
		// problem rather than a request one. Fall back to the JSON shape,
		// which needs no rendering.
		WriteError(w, status, code, message)
		return
	}

	// The handler may have declared JSON; the body is a document now. Any
	// Content-Length it set would be wrong for the new body.
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Del("Content-Length")
	w.WriteHeader(status)
	_, _ = w.Write(page.Bytes())
}
