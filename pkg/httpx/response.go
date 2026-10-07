// Package httpx holds HTTP response helpers and middleware shared by every
// handler.
//
// It exists so error bodies have exactly one shape across the API. A client
// that has to guess whether an error is {"error": "..."} or {"message": "..."}
// ends up writing try/catch on every call.
package httpx

import (
	"encoding/json"
	"io"
	"mime"
	"net/http"
)

// ErrorBody is the single error shape used by the API.
type ErrorBody struct {
	Error ErrorDetail `json:"error"`
}

// ErrorDetail describes a failure.
type ErrorDetail struct {
	// Code is stable and machine-readable, safe to branch on.
	Code string `json:"code"`
	// Message is human-readable and safe to show a developer.
	Message string `json:"message"`
	// Detail is optional extra context. Never populated from an internal error
	// string, since those can carry connection details or file paths.
	Detail string `json:"detail,omitempty"`
}

// WriteJSON sends a JSON body with the given status.
func WriteJSON(w http.ResponseWriter, status int, payload any) {
	// Encode before writing the header: if encoding fails, the status has not
	// been sent yet and a 500 can still be written instead.
	encoded, err := json.Marshal(payload)
	if err != nil {
		WriteError(w, http.StatusInternalServerError, "encoding_failed", "response could not be encoded")
		return
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_, _ = w.Write(encoded)
}

// WriteError sends a standard error body.
func WriteError(w http.ResponseWriter, status int, code string, message string) {
	WriteJSON(w, status, ErrorBody{
		Error: ErrorDetail{Code: code, Message: message},
	})
}

// WriteErrorWithDetail sends an error body with extra context.
func WriteErrorWithDetail(w http.ResponseWriter, status int, code string, message string, detail string) {
	WriteJSON(w, status, ErrorBody{
		Error: ErrorDetail{Code: code, Message: message, Detail: detail},
	})
}

// NoContent sends an empty successful response.
func NoContent(w http.ResponseWriter) {
	w.WriteHeader(http.StatusNoContent)
}

// maxJSONBody caps a decoded request body.
//
// The body size limit is already enforced by middleware, so this is a second
// line of defence rather than the primary one: a handler mounted somewhere
// without that middleware would otherwise decode an unbounded body into memory.
const maxJSONBody = 1 << 20

// RequireJSON refuses a request whose body is not declared as JSON.
//
// This is the CSRF defence that sits behind the SameSite cookie. An HTML form
// cannot set this header at all, and a cross-origin fetch carrying it would
// have to survive a preflight first, so a page on another origin has no way to
// drive a JSON endpoint that changes state. SameSite=Lax already withholds the
// session cookie from cross-site POSTs in modern browsers; this is the second
// line, covering the browsers that predate SameSite defaults and any sibling
// subdomain, where the cookie is sent but the origin is not this one.
//
// A missing header fails the same way as a wrong one: no working client omits
// it, and a form always sends one.
func RequireJSON(w http.ResponseWriter, r *http.Request) bool {
	mediaType, _, err := mime.ParseMediaType(r.Header.Get("Content-Type"))
	if err != nil || mediaType != "application/json" {
		WriteError(w, http.StatusUnsupportedMediaType, "unsupported_media_type",
			"the Content-Type header must be application/json")
		return false
	}
	return true
}

// ReadJSON decodes a JSON request body into target.
//
// It writes the 400 itself and returns false, so a handler reads as a single
// early return rather than three statements per body. The error message is
// deliberately vague: the decoder's own message can quote part of the payload,
// and reflecting a malformed body back to whoever sent it invites a response
// that repeats more than it should.
func ReadJSON(w http.ResponseWriter, r *http.Request, target any) bool {
	if r.Body == nil {
		WriteError(w, http.StatusBadRequest, "invalid_body", "a JSON body is required")
		return false
	}
	if !RequireJSON(w, r) {
		return false
	}

	decoder := json.NewDecoder(io.LimitReader(r.Body, maxJSONBody))

	// Unknown fields are rejected. Silently ignoring them means a client that
	// sends {"is_pubic": true} gets a success and concludes the object was
	// published, when the flag was never read.
	decoder.DisallowUnknownFields()

	if err := decoder.Decode(target); err != nil {
		WriteError(w, http.StatusBadRequest, "invalid_body",
			"the request body must be a JSON object with the expected fields")
		return false
	}

	// A second value in the stream means the body was not a single JSON document,
	// which usually indicates the client concatenated requests.
	if decoder.More() {
		WriteError(w, http.StatusBadRequest, "invalid_body",
			"the request body must contain exactly one JSON object")
		return false
	}

	return true
}
