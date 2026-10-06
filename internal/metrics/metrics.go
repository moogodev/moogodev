// Package metrics exposes a handful of operational measurements in the
// Prometheus text exposition format, without depending on a client library.
//
// Recording is process-wide: a single binary serves a single set of
// counters, and the request-path functions are cheap enough to call on every
// statement. Scrape-time values (open connections, project count) are
// supplied by the caller of Handler instead, so a slow or failing lookup
// produces no sample rather than a misleading one.
package metrics

import (
	"context"
	"fmt"
	"io"
	"net"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"
)

// durationBounds are the histogram buckets, in seconds.
//
// They span five milliseconds to ten seconds: SQLite answers most statements
// in single-digit milliseconds, and anything approaching a second already
// deserves a slow-statement log line, so the resolution belongs at the low
// end while the top bucket still catches a statement that ran away.
var durationBounds = []float64{0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10}

// slowQuerySeriesCap bounds how many project/op series the duration
// histogram keeps. Project ids are assigned by the service, not chosen by an
// operator, so without a cap a deployment that creates and deletes projects
// would grow the metric set forever. Past the cap, observations fold into
// project="_other", which stays visible instead of disappearing.
const slowQuerySeriesCap = 256

// otherProject is the folded series for observations past the cap.
const otherProject = "_other"

// seriesKey identifies one duration histogram.
type seriesKey struct {
	project string
	op      string
}

// histogram counts observations into fixed buckets.
//
// raw[i] holds the count in (bounds[i-1], bounds[i]]; rendering turns that
// into the cumulative form the exposition format requires. Observations past
// the last bucket are in total alone, and le="+Inf" always equals total.
type histogram struct {
	mu    sync.Mutex
	raw   []uint64
	sum   float64
	total uint64
}

func newHistogram() *histogram {
	return &histogram{raw: make([]uint64, len(durationBounds))}
}

func (h *histogram) observe(seconds float64) {
	h.mu.Lock()
	defer h.mu.Unlock()

	h.sum += seconds
	h.total++
	for index, bound := range durationBounds {
		if seconds <= bound {
			h.raw[index]++
			return
		}
	}
}

// snapshot copies a histogram's state under its lock so rendering does not
// hold the lock while writing bytes.
type snapshot struct {
	key   seriesKey
	raw   []uint64
	sum   float64
	total uint64
}

// queryDuration holds the per-project statement histograms.
type queryDuration struct {
	mu     sync.Mutex
	series map[seriesKey]*histogram
}

var statementDuration = &queryDuration{series: map[seriesKey]*histogram{}}

func (v *queryDuration) observe(key seriesKey, seconds float64) {
	v.mu.Lock()
	defer v.mu.Unlock()

	h, found := v.series[key]
	if !found && len(v.series) >= slowQuerySeriesCap {
		key = seriesKey{project: otherProject, op: key.op}
		h, found = v.series[key]
	}
	if !found {
		h = newHistogram()
		v.series[key] = h
	}
	h.observe(seconds)
}

func (v *queryDuration) snapshots() []snapshot {
	v.mu.Lock()
	keys := make([]seriesKey, 0, len(v.series))
	for key := range v.series {
		keys = append(keys, key)
	}
	v.mu.Unlock()

	sort.Slice(keys, func(i, j int) bool {
		if keys[i].project != keys[j].project {
			return keys[i].project < keys[j].project
		}
		return keys[i].op < keys[j].op
	})

	snaps := make([]snapshot, 0, len(keys))
	for _, key := range keys {
		v.mu.Lock()
		h := v.series[key]
		v.mu.Unlock()

		h.mu.Lock()
		snaps = append(snaps, snapshot{
			key:   key,
			raw:   append([]uint64(nil), h.raw...),
			sum:   h.sum,
			total: h.total,
		})
		h.mu.Unlock()
	}
	return snaps
}

// planeCounts counts refused requests by the plane that refused them.
type planeCounts struct {
	mu     sync.Mutex
	counts map[string]uint64
}

var rateLimited = &planeCounts{counts: map[string]uint64{}}

func (c *planeCounts) inc(plane string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.counts[plane]++
}

func (c *planeCounts) snapshot() map[string]uint64 {
	c.mu.Lock()
	defer c.mu.Unlock()

	out := make(map[string]uint64, len(c.counts))
	for plane, count := range c.counts {
		out[plane] = count
	}
	return out
}

// queueDepth is how many statements are waiting for a slot right now.
var queueDepth atomic.Int64

// ObserveQuery records how long one statement took.
//
// op is "query" or "exec"; projectID is the project that ran it. The
// statement text and its arguments are deliberately not accepted anywhere in
// this package: a metric label is the wrong place for user data.
func ObserveQuery(op, projectID string, took time.Duration) {
	statementDuration.observe(seriesKey{project: projectID, op: op}, took.Seconds())
}

// IncRateLimited counts one request refused with 429, by the plane that
// refused it: "auth", "query", or "bucket".
func IncRateLimited(plane string) {
	if plane == "" {
		plane = "default"
	}
	rateLimited.inc(plane)
}

// QueueDepthAdd moves the waiting-statements gauge. Waiting code adds 1
// before it blocks and -1 when it stops waiting, on every path out.
func QueueDepthAdd(delta int64) {
	queueDepth.Add(delta)
}

// Providers are the values computed at scrape time rather than accumulated
// on the request path. Every field may be nil; a nil provider, or one that
// returns an error, contributes no sample.
type Providers struct {
	// OpenConnections reports live SQLite connections keyed by project id.
	OpenConnections func() map[string]int
	// ProjectCount reports how many projects this deployment holds. The
	// handler passes a short scrape-time context: a count that cannot be
	// read within it produces no sample.
	ProjectCount func(context.Context) (int, error)
}

// Handler serves the metrics in the Prometheus text format.
//
// Only the loopback interface can read them: they describe internal
// saturation (queue depth, connections, rate limiting), which is useful to
// whoever runs the host and to nobody else. A remote caller gets 404 rather
// than 403 so the endpoint does not advertise that it exists.
func Handler(providers Providers) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !isLoopback(r) {
			http.NotFound(w, r)
			return
		}

		w.Header().Set("Content-Type", "text/plain; version=0.0.4; charset=utf-8")
		w.Header().Set("Cache-Control", "no-store")
		render(w, providers)
	})
}

// isLoopback reports whether the request came from the machine itself.
func isLoopback(r *http.Request) bool {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		host = r.RemoteAddr
	}
	address := net.ParseIP(host)
	return address != nil && address.IsLoopback()
}

// render writes the whole exposition.
func render(w io.Writer, providers Providers) {
	writeStatementDuration(w)
	writeRateLimited(w)

	const queueName = "moogo_query_queue_depth"
	fmt.Fprintf(w, "# HELP %s Statements waiting for a statement slot.\n", queueName)
	fmt.Fprintf(w, "# TYPE %s gauge\n", queueName)
	fmt.Fprintf(w, "%s %d\n", queueName, queueDepth.Load())

	writeOpenConnections(w, providers)
	writeProjectCount(w, providers)
}

// scrapeTimeout bounds the providers that query a database during a scrape.
const scrapeTimeout = 2 * time.Second

func writeStatementDuration(w io.Writer) {
	const name = "moogo_query_duration_seconds"

	fmt.Fprintf(w, "# HELP %s Time spent executing a statement, in seconds.\n", name)
	fmt.Fprintf(w, "# TYPE %s histogram\n", name)

	for _, snap := range statementDuration.snapshots() {
		labels := fmt.Sprintf("project=\"%s\",op=\"%s\"",
			escapeLabelValue(snap.key.project), escapeLabelValue(snap.key.op))

		var cumulative uint64
		for index, bound := range durationBounds {
			cumulative += snap.raw[index]
			fmt.Fprintf(w, "%s_bucket{%s,le=\"%s\"} %d\n",
				name, labels, strconv.FormatFloat(bound, 'g', -1, 64), cumulative)
		}
		fmt.Fprintf(w, "%s_bucket{%s,le=\"+Inf\"} %d\n", name, labels, snap.total)
		fmt.Fprintf(w, "%s_sum{%s} %s\n", name, labels, strconv.FormatFloat(snap.sum, 'g', -1, 64))
		fmt.Fprintf(w, "%s_count{%s} %d\n", name, labels, snap.total)
	}
}

func writeRateLimited(w io.Writer) {
	const name = "moogo_rate_limited_total"

	fmt.Fprintf(w, "# HELP %s Requests refused with 429 by the rate limiter.\n", name)
	fmt.Fprintf(w, "# TYPE %s counter\n", name)

	counts := rateLimited.snapshot()
	planes := make([]string, 0, len(counts))
	for plane := range counts {
		planes = append(planes, plane)
	}
	sort.Strings(planes)

	for _, plane := range planes {
		fmt.Fprintf(w, "%s{plane=\"%s\"} %d\n", name, escapeLabelValue(plane), counts[plane])
	}
}

func writeOpenConnections(w io.Writer, providers Providers) {
	if providers.OpenConnections == nil {
		return
	}

	const name = "moogo_db_open_connections"
	fmt.Fprintf(w, "# HELP %s Live SQLite connections held for a project.\n", name)
	fmt.Fprintf(w, "# TYPE %s gauge\n", name)

	connections := providers.OpenConnections()
	projects := make([]string, 0, len(connections))
	for project := range connections {
		projects = append(projects, project)
	}
	sort.Strings(projects)

	for _, project := range projects {
		fmt.Fprintf(w, "%s{project=\"%s\"} %d\n",
			name, escapeLabelValue(project), connections[project])
	}
}

func writeProjectCount(w io.Writer, providers Providers) {
	if providers.ProjectCount == nil {
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), scrapeTimeout)
	defer cancel()

	count, err := providers.ProjectCount(ctx)
	if err != nil {
		// No sample rather than a wrong one: a stale or zero count would
		// answer a scaling question with a lie.
		return
	}

	const name = "moogo_project_count"
	fmt.Fprintf(w, "# HELP %s Projects registered on this deployment.\n", name)
	fmt.Fprintf(w, "# TYPE %s gauge\n", name)
	fmt.Fprintf(w, "%s %d\n", name, count)
}

// escapeLabelValue applies the three escapes the text format defines for
// label values: backslash, double quote, and newline.
func escapeLabelValue(value string) string {
	return strings.NewReplacer(`\`, `\\`, `"`, `\"`, "\n", `\n`).Replace(value)
}

// resetForTest clears every recorded series. The registry is process-wide,
// so a test that asserts on rendered output calls this first.
func resetForTest() {
	statementDuration.mu.Lock()
	statementDuration.series = map[seriesKey]*histogram{}
	statementDuration.mu.Unlock()

	rateLimited.mu.Lock()
	rateLimited.counts = map[string]uint64{}
	rateLimited.mu.Unlock()

	queueDepth.Store(0)
}
