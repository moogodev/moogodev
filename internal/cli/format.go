package cli

import (
	"fmt"
	"math"
	"net/url"
	"strings"
	"time"
)

// humanBytes renders a byte count the way a person reads one.
func humanBytes(count int64) string {
	const kilobyte = 1024

	switch {
	case count < 0:
		return "0 B"
	case count < kilobyte:
		return fmt.Sprintf("%d B", count)
	case count < kilobyte*kilobyte:
		return unit(float64(count)/kilobyte, "KB")
	case count < kilobyte*kilobyte*kilobyte:
		return unit(float64(count)/(kilobyte*kilobyte), "MB")
	default:
		return unit(float64(count)/(kilobyte*kilobyte*kilobyte), "GB")
	}
}

// unit renders a measured value without the decimal it does not need: a quota
// of 250 is read as 250, and only a partial one earns a second digit.
func unit(value float64, name string) string {
	if value == math.Trunc(value) {
		return fmt.Sprintf("%.0f %s", value, name)
	}
	return fmt.Sprintf("%.1f %s", value, name)
}

// plural renders a count with its noun, because "1 tables" in a summary line
// is the kind of detail that makes a person distrust the count beside it.
func plural(count int, noun string) string {
	if count == 1 {
		return fmt.Sprintf("%d %s", count, noun)
	}
	return fmt.Sprintf("%d %ss", count, noun)
}

// shortHash is the front of a content hash, which is all anyone compares.
func shortHash(hash string) string {
	const shown = 12
	if len(hash) > shown {
		return hash[:shown]
	}
	return hash
}

// shortTime renders a timestamp for a table: readable, and no longer than a
// column of them can be.
//
// In the reader's own time zone, because "yesterday, 23:10" only means
// yesterday if the terminal is where the person is. The raw answer -- with its
// offset, and unchanged -- is what --json prints.
func shortTime(value string) string {
	parsed, err := time.Parse(time.RFC3339, value)
	if err != nil {
		return value
	}
	return parsed.Local().Format("2006-01-02 15:04")
}

// escapeKey keeps the slashes in an object key while escaping everything else.
//
// A key is path-like and one object is one URL path, so the separators have to
// survive: escaping the whole key would send %2F where the API expects a
// slash, and the request would name an object nobody has.
func escapeKey(key string) string {
	segments := strings.Split(key, "/")
	for index, segment := range segments {
		segments[index] = url.PathEscape(segment)
	}
	return strings.Join(segments, "/")
}
