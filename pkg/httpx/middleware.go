package httpx

import (
	"context"
	"net"
	"net/http"
	"runtime/debug"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/moogodev/moogodev/pkg/logger"
)

// ContextKey is the type for values this package stores in a request context.
type ContextKey string

// ContextKeyRequestID holds the correlation id for the current request.
const ContextKeyRequestID ContextKey = "moogo.request_id"

// contextWithRequestID stores a correlation id in a context.
func contextWithRequestID(ctx context.Context, requestID string) context.Context {
	return context.WithValue(ctx, ContextKeyRequestID, requestID)
}

// RequestIDFromContext returns the correlation id, or an empty string.
func RequestIDFromContext(ctx context.Context) string {
	requestID, _ := ctx.Value(ContextKeyRequestID).(string)
	return requestID
}

// RequestIDHeader carries the correlation id in and out.
const RequestIDHeader = "X-Request-ID"

// statusRecorder captures the response status and size for logging.
//
// A wrapper is needed because http.ResponseWriter does not expose either, and
// without them the access log cannot report what actually happened.
type statusRecorder struct {
	http.ResponseWriter
	status int
	bytes  int
}

func (recorder *statusRecorder) WriteHeader(status int) {
	recorder.status = status
	recorder.ResponseWriter.WriteHeader(status)
}

func (recorder *statusRecorder) Write(payload []byte) (int, error) {
	if recorder.status == 0 {
		recorder.status = http.StatusOK
	}
	written, err := recorder.ResponseWriter.Write(payload)
	recorder.bytes += written
	return written, err
}

// Unwrap exposes the underlying writer to http.ResponseController, which the
// server needs for flushing and for hijacking.
func (recorder *statusRecorder) Unwrap() http.ResponseWriter {
	return recorder.ResponseWriter
}

// RequestID assigns a correlation id to each request.
//
// An inbound id is trusted so a trace started at the edge continues through
// this service. It is length-limited because an unbounded header value would
// land in every log line downstream.
func RequestID(log *logger.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			requestID := strings.TrimSpace(r.Header.Get(RequestIDHeader))
			if requestID == "" || len(requestID) > 128 {
				requestID = uuid.NewString()
			}

			w.Header().Set(RequestIDHeader, requestID)
			ctx := contextWithRequestID(r.Context(), requestID)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// Recoverer turns a panic into a 500 instead of a dropped connection.
//
// The stack is logged but never returned to the client: it can reveal file
// paths and internal package structure.
func Recoverer(log *logger.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			recorder := &statusRecorder{ResponseWriter: w}

			defer func() {
				recovered := recover()
				if recovered == nil {
					return
				}

				// http.ErrAbortHandler is the documented way to abandon a
				// response, so it is re-panicked rather than converted.
				if recovered == http.ErrAbortHandler {
					panic(recovered)
				}

				log.Error("panic recovered", logger.Fields{
					"panic":  recovered,
					"method": r.Method,
					"path":   r.URL.Path,
					"stack":  string(debug.Stack()),
				})

				if recorder.status == 0 {
					WriteError(recorder, http.StatusInternalServerError,
						"internal_error", "the request could not be completed")
				}
			}()

			next.ServeHTTP(recorder, r)
		})
	}
}

// AccessLog records one line per request.
func AccessLog(log *logger.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()
			recorder := &statusRecorder{ResponseWriter: w}

			next.ServeHTTP(recorder, r)

			if recorder.status == 0 {
				recorder.status = http.StatusOK
			}

			// Query strings are excluded: they can contain object keys and
			// tokens that do not belong in a log file.
			log.Info("request", logger.Fields{
				"method":      r.Method,
				"path":        r.URL.Path,
				"status":      recorder.status,
				"duration_ms": time.Since(start).Milliseconds(),
				"bytes":       recorder.bytes,
				"request_id":  RequestIDFromContext(r.Context()),
				"remote_ip":   ClientIP(r),
			})
		})
	}
}

// MaxBodyBytes caps the request body size.
//
// http.MaxBytesReader stops the read at the limit rather than after it, which
// is the difference between rejecting a 10 MB upload and buffering it first.
func MaxBodyBytes(limit int64) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Body != nil {
				r.Body = http.MaxBytesReader(w, r.Body, limit)
			}
			next.ServeHTTP(w, r)
		})
	}
}

// RealIP makes RemoteAddr and ClientIP report the real client address.
//
// The service sits behind a reverse proxy (nginx in deployment), so RemoteAddr
// is the proxy's address and any rate limiting keyed on it would treat every
// user as one caller.
//
// The forwarded headers are believed only when the deployment named its proxies.
// Empty means they are ignored, which is the safe direction: a caller that can
// set X-Forwarded-For to any address can otherwise give itself a fresh identity
// per request and walk straight through a per-client rate limit, and the access
// log records whatever they chose.
//
// chi's middleware.RealIP does the opposite -- it trusts those headers from
// anybody -- which is why this exists and why the router mounts this one.
func RealIP(trustedProxies []string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			forwarded := r.Header.Get("X-Forwarded-For")
			if forwarded != "" && len(trustedProxies) > 0 {
				// The leftmost entry is the original client; the rest were
				// appended by each proxy in the chain.
				first := strings.TrimSpace(strings.Split(forwarded, ",")[0])
				if first != "" {
					r.RemoteAddr = first + ":0"
				}
			}
			next.ServeHTTP(w, r)
		})
	}
}

// ClientIP extracts the client address without the port.
//
// It reads RemoteAddr and nothing else. The forwarded headers are already
// resolved by the RealIP middleware, and only when the deployment declared its
// proxies, so re-reading them here would undo that decision: the caller has no
// way to pass the trusted list, so any header believed here is believed from
// anybody. The access log would then record an address the caller chose.
func ClientIP(r *http.Request) string {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

// Timeout bounds handler execution.
//
// The standard library's TimeoutHandler is used rather than a hand-rolled
// goroutine. A hand-rolled version races with the handler: the timeout branch
// may write a response body while the handler is still writing its own, which
// produces interleaved output and a confusing client error.
//
// The timeout error body is JSON so a client parsing errors consistently sees
// the same shape here as everywhere else.
func Timeout(timeout time.Duration) func(http.Handler) http.Handler {
	// The status is 503 rather than 504 because the standard library emits that
	// and its status cannot be overridden. It is not wrong here: the request
	// never got an answer from the database, which is the same situation as a
	// service that cannot serve the request right now. A statement the engine
	// itself timed out returns 504, and the body of both carries the same
	// "timeout" code.
	//
	// The body is replaced with JSON because the dashboard parses errors as JSON
	// everywhere else.
	return func(next http.Handler) http.Handler {
		return http.TimeoutHandler(next, timeout,
			`{"error":{"code":"timeout","message":"the request took too long"}}`)
	}
}
