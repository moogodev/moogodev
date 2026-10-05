// Package logger provides a structured JSON logger for the whole application.
//
// Output goes to stdout as one JSON object per line, so a log collector can
// ingest it without any parsing step.
package logger

import (
	"context"
	"io"
	stdlog "log"
	"log/slog"
	"os"
	"strings"
)

// Level is a log severity level.
type Level = slog.Level

// Severity levels used across the application.
const (
	LevelDebug = slog.LevelDebug
	LevelInfo  = slog.LevelInfo
	LevelWarn  = slog.LevelWarn
	LevelError = slog.LevelError
)

// Fields is a set of key-value pairs attached to a log entry.
type Fields map[string]any

// Logger is a thin wrapper over slog.Logger.
//
// It is deliberately thin so callers stay decoupled from the output format and
// so tests can swap in a buffer-backed logger without special casing.
type Logger struct {
	*slog.Logger
}

// New creates a logger writing to stdout. The environment picks the default
// level: production logs at info, everything else at debug.
func New(environment string) *Logger {
	return NewWithWriter(os.Stdout, environment)
}

// NewWithWriter creates a logger writing to the given writer, which is useful
// for tests and for redirecting output to a file.
func NewWithWriter(writer io.Writer, environment string) *Logger {
	level := LevelDebug
	if environment == "production" {
		level = LevelInfo
	}

	handler := slog.NewJSONHandler(writer, &slog.HandlerOptions{
		Level: level,
		ReplaceAttr: func(_ []string, attribute slog.Attr) slog.Attr {
			// Rename the timestamp key to match the other services on the host.
			if attribute.Key == slog.TimeKey {
				attribute.Key = "ts"
			}
			return attribute
		},
	})

	return &Logger{Logger: slog.New(handler)}
}

// Standard returns a *log.Logger writing through this logger.
//
// http.Server wants one for its own messages, and routing those through the
// same JSON handler keeps one log format across the whole service.
func (log *Logger) Standard() *stdlog.Logger {
	return slog.NewLogLogger(log.Handler(), LevelInfo)
}

// With returns a child logger carrying the given fields permanently.
func (log *Logger) With(fields Fields) *Logger {
	if log == nil || log.Logger == nil || len(fields) == 0 {
		return log
	}

	arguments := fieldsToArgs(fields)
	if len(arguments) == 0 {
		return log
	}
	return &Logger{Logger: log.Logger.With(arguments...)}
}

// WithError returns a child logger carrying an error field.
func (log *Logger) WithError(err error) *Logger {
	if err == nil {
		return log
	}
	return log.With(Fields{"error": err.Error()})
}

// Info logs at info level with structured fields.
//
// The embedded slog.Logger only understands variadic key-value pairs, which
// makes the call sites both verbose and unchecked by the compiler. These
// wrappers take a Fields map instead, so a malformed entry becomes a type
// error instead of a garbled log line.
func (log *Logger) Info(message string, fields Fields) {
	log.log(slog.LevelInfo, message, fields)
}

// Debug logs at debug level with structured fields.
func (log *Logger) Debug(message string, fields Fields) {
	log.log(slog.LevelDebug, message, fields)
}

// Warn logs at warn level with structured fields.
func (log *Logger) Warn(message string, fields Fields) {
	log.log(slog.LevelWarn, message, fields)
}

// Error logs at error level with structured fields.
func (log *Logger) Error(message string, fields Fields) {
	log.log(slog.LevelError, message, fields)
}

// ErrorWithError logs at error level together with the error that caused it,
// which is the common case for the call sites in this codebase.
func (log *Logger) ErrorWithError(message string, err error, fields Fields) {
	if err == nil {
		log.Error(message, fields)
		return
	}
	merged := make(Fields, len(fields)+1)
	for key, value := range fields {
		merged[key] = value
	}
	merged["error"] = err.Error()
	log.Error(message, merged)
}

func (log *Logger) log(level Level, message string, fields Fields) {
	if log == nil || log.Logger == nil {
		return
	}
	if !log.Logger.Enabled(context.Background(), level) {
		return
	}
	log.Logger.Log(context.Background(), level, message, fieldsToArgs(fields)...)
}

// fieldsToArgs flattens a Fields map into slog's variadic key-value form. Keys
// are emitted in sorted order by slog's handler, so map iteration order does
// not make output unstable.
func fieldsToArgs(fields Fields) []any {
	if len(fields) == 0 {
		return nil
	}
	args := make([]any, 0, len(fields)*2)
	for key, value := range fields {
		args = append(args, key, value)
	}
	return args
}

// ParseLevel converts a level name into a Level. Unrecognized values fall back
// to info rather than failing.
func ParseLevel(name string) Level {
	switch strings.ToLower(strings.TrimSpace(name)) {
	case "debug":
		return LevelDebug
	case "warn", "warning":
		return LevelWarn
	case "error":
		return LevelError
	default:
		return LevelInfo
	}
}

// Nop returns a logger that discards everything, for use in tests.
func Nop() *Logger {
	return &Logger{Logger: slog.New(slog.NewJSONHandler(io.Discard, nil))}
}
