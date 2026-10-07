package router

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/google/uuid"

	"github.com/moogodev/moogodev/internal/auth"
)

// TestObjectKeyDerivedFromEveryMountShape pins the object key extraction across
// the three places bucket handlers are mounted.
//
// ObjectKeyContext used to read chi's "*" parameter. Measured on chi v5 that
// parameter is not visible to a Use()-registered middleware, and With() does not
// help inside a Route() subrouter either, so every download and delete failed
// with missing_key while upload worked. Deriving the key from the path in the
// router, which already owns URL shape, is what makes all three mounts work.
func TestObjectKeyDerivedFromEveryMountShape(t *testing.T) {
	projectID := uuid.MustParse("8f3c1a20-1111-4111-8111-111111111111")
	marker := "/" + projectID.String()

	testCases := []struct {
		name string
		path string
		want string
	}{
		{
			name: "project scoped",
			path: "/p" + marker + "/bucket/dir/hello.txt",
			want: "dir/hello.txt",
		},
		{
			name: "dashboard",
			path: "/api/projects" + marker + "/bucket/dir/hello.txt",
			want: "dir/hello.txt",
		},
		{
			name: "legacy without bucket segment",
			path: "/bucket" + marker + "/dir/hello.txt",
			want: "dir/hello.txt",
		},
		{
			name: "single segment key",
			path: "/p" + marker + "/bucket/logo.png",
			want: "logo.png",
		},
		{
			name: "deeply nested key",
			path: "/p" + marker + "/bucket/a/b/c/d.txt",
			want: "a/b/c/d.txt",
		},
		{
			// The listing route addresses the whole bucket, so there is no
			// object key and the handler must be told so rather than being
			// handed the literal string "bucket".
			name: "listing has no key",
			path: "/p" + marker + "/bucket",
			want: "",
		},
		{
			name: "bare project has no key",
			path: "/p" + marker,
			want: "",
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			var got string
			var found bool

			spy := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				got, found = auth.ObjectKeyFromContext(r.Context())
				w.WriteHeader(http.StatusOK)
			})

			request := httptest.NewRequest(http.MethodGet, testCase.path, nil)
			request = request.WithContext(context.WithValue(
				request.Context(), auth.ContextKeyProjectID, projectID.String()))

			ObjectKeyContext(spy).ServeHTTP(httptest.NewRecorder(), request)

			if testCase.want == "" {
				if found {
					t.Errorf("expected no key, got %q", got)
				}
				return
			}
			if !found {
				t.Fatal("expected a key in the context")
			}
			if got != testCase.want {
				t.Errorf("got %q, want %q", got, testCase.want)
			}
		})
	}
}
