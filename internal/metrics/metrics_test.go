package metrics

import (
	"context"
	"errors"
	"math"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
	"time"
)

// scrape performs one loopback request against the handler.
func scrape(t *testing.T, providers Providers) string {
	t.Helper()

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/metrics", nil)
	request.RemoteAddr = "127.0.0.1:9999"
	Handler(providers).ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200 from a loopback scrape", recorder.Code)
	}
	return recorder.Body.String()
}

// sumOf reads a *_sum line back out of the exposition so a test can assert
// on the value without pinning the exact decimal rendering of a float.
func sumOf(t *testing.T, body, series string) float64 {
	t.Helper()

	prefix := series + "_sum{"
	for _, line := range strings.Split(body, "\n") {
		if strings.HasPrefix(line, prefix) {
			value := strings.TrimPrefix(line, series+"_sum{")
			value = value[strings.Index(value, "} ")+2:]
			parsed, err := strconv.ParseFloat(value, 64)
			if err != nil {
				t.Fatalf("sum value %q is not a float: %v", value, err)
			}
			return parsed
		}
	}
	t.Fatalf("no %s_sum line in:\n%s", series, body)
	return 0
}

func TestStatementDurationRendersCumulativeBuckets(t *testing.T) {
	resetForTest()

	// 3 ms lands in the first bucket, 200 ms in the 0.25 bucket, and 7 s in
	// the last one: together they exercise every boundary at once.
	ObserveQuery("query", "p1", 3*time.Millisecond)
	ObserveQuery("query", "p1", 200*time.Millisecond)
	ObserveQuery("query", "p1", 7*time.Second)

	body := scrape(t, Providers{})

	wantLines := []string{
		`# TYPE moogo_query_duration_seconds histogram`,
		`moogo_query_duration_seconds_bucket{project="p1",op="query",le="0.005"} 1`,
		`moogo_query_duration_seconds_bucket{project="p1",op="query",le="0.1"} 1`,
		`moogo_query_duration_seconds_bucket{project="p1",op="query",le="0.25"} 2`,
		`moogo_query_duration_seconds_bucket{project="p1",op="query",le="5"} 2`,
		`moogo_query_duration_seconds_bucket{project="p1",op="query",le="10"} 3`,
		`moogo_query_duration_seconds_bucket{project="p1",op="query",le="+Inf"} 3`,
		`moogo_query_duration_seconds_count{project="p1",op="query"} 3`,
	}
	for _, want := range wantLines {
		if !strings.Contains(body, want) {
			t.Errorf("missing line %q in:\n%s", want, body)
		}
	}

	if got := sumOf(t, body, "moogo_query_duration_seconds"); math.Abs(got-7.203) > 1e-9 {
		t.Errorf("sum = %v, want 7.203", got)
	}
}

func TestStatementDurationFoldsPastTheSeriesCap(t *testing.T) {
	resetForTest()

	// More distinct projects than the cap, all on one op: the overflow must
	// stay visible under one folded series instead of growing without bound.
	for index := 0; index < slowQuerySeriesCap+40; index++ {
		ObserveQuery("query", "project-"+strconv.Itoa(index), time.Millisecond)
	}

	body := scrape(t, Providers{})

	if !strings.Contains(body, `project="_other",op="query"`) {
		t.Errorf("expected observations past the cap to fold into %q", otherProject)
	}
	// One count line per series: the cap plus the folded series itself.
	if count := strings.Count(body, "moogo_query_duration_seconds_count{"); count > slowQuerySeriesCap+1 {
		t.Errorf("rendered %d series, want at most %d", count, slowQuerySeriesCap+1)
	}
}

func TestRateLimitedCountsByPlane(t *testing.T) {
	resetForTest()

	IncRateLimited("query")
	IncRateLimited("query")
	IncRateLimited("bucket")

	body := scrape(t, Providers{})

	for _, want := range []string{
		`moogo_rate_limited_total{plane="bucket"} 1`,
		`moogo_rate_limited_total{plane="query"} 2`,
	} {
		if !strings.Contains(body, want) {
			t.Errorf("missing line %q in:\n%s", want, body)
		}
	}
}

func TestQueueDepthGaugeReflectsWaiters(t *testing.T) {
	resetForTest()
	QueueDepthAdd(1)
	QueueDepthAdd(1)

	body := scrape(t, Providers{})
	if !strings.Contains(body, "moogo_query_queue_depth 2") {
		t.Errorf("gauge should read 2 while two statements wait, body:\n%s", body)
	}

	QueueDepthAdd(-2)
	body = scrape(t, Providers{})
	if !strings.Contains(body, "moogo_query_queue_depth 0") {
		t.Errorf("gauge should return to 0, body:\n%s", body)
	}
}

func TestHandlerRefusesNonLoopbackCallers(t *testing.T) {
	resetForTest()

	for _, address := range []string{
		"203.0.113.9:443",
		"[2001:db8::1]:443",
		"not-an-address",
	} {
		recorder := httptest.NewRecorder()
		request := httptest.NewRequest(http.MethodGet, "/metrics", nil)
		request.RemoteAddr = address
		Handler(Providers{}).ServeHTTP(recorder, request)

		if recorder.Code != http.StatusNotFound {
			t.Errorf("RemoteAddr %q: status = %d, want 404", address, recorder.Code)
		}
		if strings.Contains(recorder.Body.String(), "moogo_") {
			t.Errorf("RemoteAddr %q: the body must not reveal that metrics exist", address)
		}
	}
}

func TestHandlerAcceptsLoopbackIPv6(t *testing.T) {
	resetForTest()

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/metrics", nil)
	request.RemoteAddr = "[::1]:9999"
	Handler(Providers{}).ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200 for a scrape from ::1", recorder.Code)
	}
}

func TestProvidersSupplyScrapeTimeValues(t *testing.T) {
	resetForTest()

	providers := Providers{
		OpenConnections: func() map[string]int {
			return map[string]int{"project-a": 3, "project-b": 1}
		},
		ProjectCount: func(context.Context) (int, error) {
			return 42, nil
		},
	}

	body := scrape(t, providers)

	for _, want := range []string{
		`moogo_db_open_connections{project="project-a"} 3`,
		`moogo_db_open_connections{project="project-b"} 1`,
		`moogo_project_count 42`,
	} {
		if !strings.Contains(body, want) {
			t.Errorf("missing line %q in:\n%s", want, body)
		}
	}
}

func TestFailedProjectCountProducesNoSample(t *testing.T) {
	resetForTest()

	body := scrape(t, Providers{
		ProjectCount: func(context.Context) (int, error) {
			return 0, errors.New("connection refused")
		},
	})

	// A wrong count would answer a scaling question with a lie; absence is
	// the honest answer and the gap is visible at the other end.
	if strings.Contains(body, "moogo_project_count") {
		t.Errorf("an erroring provider must produce no sample, body:\n%s", body)
	}
}

func TestLabelValuesAreEscaped(t *testing.T) {
	resetForTest()

	body := scrape(t, Providers{
		OpenConnections: func() map[string]int {
			return map[string]int{`odd"key\line` + `end`: 1}
		},
	})

	want := `moogo_db_open_connections{project="odd\"key\\lineend"} 1`
	if !strings.Contains(body, want) {
		t.Errorf("missing escaped line %q in:\n%s", want, body)
	}
}
