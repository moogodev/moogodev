package router

import (
	"bytes"
	"context"
	"crypto/tls"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"testing/fstest"
	"time"

	"github.com/google/uuid"

	"github.com/moogodev/moogodev/internal/auth"
	"github.com/moogodev/moogodev/internal/dbcontrol"
	"github.com/moogodev/moogodev/internal/metrics"
	"github.com/moogodev/moogodev/pkg/bucketkey"
	"github.com/moogodev/moogodev/pkg/httpx"
	"github.com/moogodev/moogodev/pkg/logger"
	"github.com/moogodev/moogodev/pkg/secretkey"
	"github.com/moogodev/moogodev/pkg/session"
)

// stubHealth answers the probes.
type stubHealth struct{ called string }

func (stub *stubHealth) Liveness(w http.ResponseWriter, r *http.Request) {
	stub.called = "Liveness"
	w.WriteHeader(http.StatusOK)
}
func (stub *stubHealth) Readiness(w http.ResponseWriter, r *http.Request) {
	stub.called = "Readiness"
	w.WriteHeader(http.StatusOK)
}

// stubOAuth records which OAuth route ran.
type stubOAuth struct {
	called string
}

func (stub *stubOAuth) GoogleRedirect(w http.ResponseWriter, r *http.Request) {
	stub.mark(w, "GoogleRedirect")
}
func (stub *stubOAuth) GoogleCallback(w http.ResponseWriter, r *http.Request) {
	stub.mark(w, "GoogleCallback")
}
func (stub *stubOAuth) Logout(w http.ResponseWriter, r *http.Request) {
	stub.mark(w, "Logout")
}
func (stub *stubOAuth) Session(w http.ResponseWriter, r *http.Request) {
	stub.mark(w, "Session")
}
func (stub *stubOAuth) Setup(w http.ResponseWriter, r *http.Request) {
	stub.mark(w, "Setup")
}

func (stub *stubOAuth) mark(w http.ResponseWriter, name string) {
	stub.called = name
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(name))
}

// stubCredentials records which credential route ran.
type stubCredentials struct{ called string }

func (stub *stubCredentials) mark(w http.ResponseWriter, name string) {
	stub.called = name
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(name))
}

// readBody drains the request so a body cap becomes visible: a limit only
// rejects a request once something reads past it, and the real handlers all
// decode JSON. The two credential writes the tests send oversized bodies to
// use it; the rest answer without reading.
func (stub *stubCredentials) readBody(w http.ResponseWriter, r *http.Request) bool {
	if r.Body != nil {
		if _, err := io.Copy(io.Discard, r.Body); err != nil {
			var maxBytesError *http.MaxBytesError
			if errors.As(err, &maxBytesError) {
				w.WriteHeader(http.StatusRequestEntityTooLarge)
				_, _ = w.Write([]byte("body too large"))
				return false
			}
			w.WriteHeader(http.StatusBadRequest)
			_, _ = w.Write([]byte("bad body"))
			return false
		}
	}
	return true
}

func (stub *stubCredentials) Register(w http.ResponseWriter, r *http.Request) {
	if stub.readBody(w, r) {
		stub.mark(w, "Register")
	}
}
func (stub *stubCredentials) Login(w http.ResponseWriter, r *http.Request) {
	if stub.readBody(w, r) {
		stub.mark(w, "Login")
	}
}
func (stub *stubCredentials) ForgotPassword(w http.ResponseWriter, r *http.Request) {
	stub.mark(w, "ForgotPassword")
}
func (stub *stubCredentials) ResetPassword(w http.ResponseWriter, r *http.Request) {
	stub.mark(w, "ResetPassword")
}
func (stub *stubCredentials) VerifyEmail(w http.ResponseWriter, r *http.Request) {
	stub.mark(w, "VerifyEmail")
}
func (stub *stubCredentials) ResendVerification(w http.ResponseWriter, r *http.Request) {
	stub.mark(w, "ResendVerification")
}

// stubMeta stands in for the sitemap and robots handlers.
type stubMeta struct{}

func (stub *stubMeta) Sitemap(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte("Sitemap"))
}

func (stub *stubMeta) Robots(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte("Robots"))
}

// stubControl records which control plane route ran.
type stubControl struct{ called string }

func (stub *stubControl) mark(w http.ResponseWriter, name string) {
	stub.called = name
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(name))
}

func (stub *stubControl) Me(w http.ResponseWriter, r *http.Request) { stub.mark(w, "Me") }
func (stub *stubControl) ChangePassword(w http.ResponseWriter, r *http.Request) {
	stub.mark(w, "ChangePassword")
}
func (stub *stubControl) UpdateProfile(w http.ResponseWriter, r *http.Request) {
	stub.mark(w, "UpdateProfile")
}
func (stub *stubControl) ListProjects(w http.ResponseWriter, r *http.Request) {
	stub.mark(w, "ListProjects")
}
func (stub *stubControl) CreateProject(w http.ResponseWriter, r *http.Request) {
	stub.mark(w, "CreateProject")
}
func (stub *stubControl) GetProject(w http.ResponseWriter, r *http.Request) {
	stub.mark(w, "GetProject")
}
func (stub *stubControl) ListStorageCredentials(w http.ResponseWriter, r *http.Request) {
	stub.mark(w, "ListStorageCredentials")
}
func (stub *stubControl) CreateStorageCredential(w http.ResponseWriter, r *http.Request) {
	stub.mark(w, "CreateStorageCredential")
}
func (stub *stubControl) RotateStorageCredential(w http.ResponseWriter, r *http.Request) {
	stub.mark(w, "RotateStorageCredential")
}
func (stub *stubControl) RevokeStorageCredential(w http.ResponseWriter, r *http.Request) {
	stub.mark(w, "RevokeStorageCredential")
}
func (stub *stubControl) Query(w http.ResponseWriter, r *http.Request) {
	stub.mark(w, "Query")
}
func (stub *stubControl) Exec(w http.ResponseWriter, r *http.Request) {
	stub.mark(w, "Exec")
}
func (stub *stubControl) RotateKey(w http.ResponseWriter, r *http.Request) {
	stub.mark(w, "RotateKey")
}
func (stub *stubControl) PauseProject(w http.ResponseWriter, r *http.Request) {
	stub.mark(w, "PauseProject")
}
func (stub *stubControl) ResumeProject(w http.ResponseWriter, r *http.Request) {
	stub.mark(w, "ResumeProject")
}
func (stub *stubControl) DeleteProject(w http.ResponseWriter, r *http.Request) {
	stub.mark(w, "DeleteProject")
}
func (stub *stubControl) Activity(w http.ResponseWriter, r *http.Request) { stub.mark(w, "Activity") }
func (stub *stubControl) DownloadDatabase(w http.ResponseWriter, r *http.Request) {
	stub.mark(w, "DownloadDatabase")
}
func (stub *stubControl) DeleteAccount(w http.ResponseWriter, r *http.Request) {
	stub.mark(w, "DeleteAccount")
}
func (stub *stubControl) ListBuckets(w http.ResponseWriter, r *http.Request) {
	stub.mark(w, "ListBuckets")
}
func (stub *stubControl) CreateBucket(w http.ResponseWriter, r *http.Request) {
	stub.mark(w, "CreateBucket")
}

// stubData records which data plane route ran.
type stubData struct{ called string }

func (stub *stubData) Query(w http.ResponseWriter, r *http.Request) {
	stub.called = "Query"
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte("Query"))
}

func (stub *stubData) Exec(w http.ResponseWriter, r *http.Request) {
	stub.called = "Exec"
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte("Exec"))
}

func (stub *stubData) Transaction(w http.ResponseWriter, r *http.Request) {
	stub.called = "Transaction"
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte("Transaction"))
}

// stubBucket is a minimal bucket handler for tests.
type stubBucket struct{ called string }

func (stub *stubBucket) mark(w http.ResponseWriter, name string) {
	stub.called = name
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(name))
}

// Upload drains the body instead of ignoring it, because that is where a body
// cap becomes visible: a limit only rejects a request once something reads.
func (stub *stubBucket) Upload(w http.ResponseWriter, r *http.Request) {
	stub.called = "Upload"

	if r.Body != nil {
		if _, err := io.Copy(io.Discard, r.Body); err != nil {
			var maxBytesError *http.MaxBytesError
			if errors.As(err, &maxBytesError) {
				w.WriteHeader(http.StatusRequestEntityTooLarge)
				_, _ = w.Write([]byte("upload too large"))
				return
			}
			w.WriteHeader(http.StatusBadRequest)
			_, _ = w.Write([]byte("bad body"))
			return
		}
	}

	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte("Upload"))
}
func (stub *stubBucket) Download(w http.ResponseWriter, r *http.Request) {
	stub.mark(w, "Download")
}
func (stub *stubBucket) PublicDownload(w http.ResponseWriter, r *http.Request) {
	stub.mark(w, "PublicDownload")
}
func (stub *stubBucket) Update(w http.ResponseWriter, r *http.Request) { stub.mark(w, "Update") }
func (stub *stubBucket) Delete(w http.ResponseWriter, r *http.Request) { stub.mark(w, "Delete") }
func (stub *stubBucket) List(w http.ResponseWriter, r *http.Request)   { stub.mark(w, "List") }

func (stub *stubBucket) ListBuckets(w http.ResponseWriter, r *http.Request) {
	stub.mark(w, "ListBuckets")
}
func (stub *stubBucket) CreateBucket(w http.ResponseWriter, r *http.Request) {
	stub.mark(w, "CreateBucket")
}
func (stub *stubBucket) UpdateBucketSettings(w http.ResponseWriter, r *http.Request) {
	stub.mark(w, "UpdateBucketSettings")
}
func (stub *stubBucket) DeleteBucket(w http.ResponseWriter, r *http.Request) {
	stub.mark(w, "DeleteBucket")
}
func (stub *stubBucket) SetBucketPublic(w http.ResponseWriter, r *http.Request) {
	stub.mark(w, "SetBucketPublic")
}

// stubDocs is a minimal docs handler for tests.
type stubDocs struct{ called string }

func (stub *stubDocs) mark(w http.ResponseWriter, name string) {
	stub.called = name
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(name))
}

func (stub *stubDocs) Doc(w http.ResponseWriter, r *http.Request)     { stub.mark(w, "Doc") }
func (stub *stubDocs) DocList(w http.ResponseWriter, r *http.Request) { stub.mark(w, "DocList") }

// stubResolver returns a fixed project for any id.
type stubResolver struct {
	project *dbcontrol.Project
	err     error
}

func (stub stubResolver) ProjectByID(
	context.Context, uuid.UUID,
) (*dbcontrol.Project, error) {
	return stub.project, stub.err
}

// stubAuthorizer answers ownership for the dashboard's session routes.
type stubAuthorizer struct {
	project *dbcontrol.Project
	err     error
	// owner is the single user id this authorizer recognizes, so a mismatch
	// exercises the not-owned path the way a real store would.
	owner uuid.UUID
}

func (stub stubAuthorizer) ProjectOwnedBy(
	_ context.Context, projectID uuid.UUID, userID uuid.UUID,
) (*dbcontrol.Project, error) {
	if stub.err != nil {
		return nil, stub.err
	}
	if stub.project == nil || projectID != stub.project.ID || userID != stub.owner {
		return nil, dbcontrol.ErrProjectNotOwned
	}
	return stub.project, nil
}

// testFrontend stands in for the built single-page app: one index.html that
// every page route returns, plus hashed assets under assets/.
var testFrontend = fstest.MapFS{
	"index.html":               {Data: []byte("<!doctype html><html><head><title>home</title></head><body></body></html>")},
	"assets/app.css":           {Data: []byte("body{color:#fff}")},
	"assets/index-Ab12Cd34.js": {Data: []byte("console.log(0)")},
	"img/favicon.svg":          {Data: []byte("<svg/>")},
}

// testProjectKey is the plaintext key the test project accepts.
const testProjectKey = "moogo_3Qb7xKp2mNvR9sTd4LfWy6HzA1"

// testStorageAccessKeyID and testStorageSecret are the storage credential the
// test project accepts. They are deliberately a different shape from the SQL
// key, because storage is authorized by a separate credential now.
const (
	testStorageAccessKeyID = "moogo_ak_testAccessKeyId00"
	testStorageSecret      = "moogo_sk_testSecretKeyValue00"
)

// stubStorageResolver answers storage credential lookups.
type stubStorageResolver struct {
	credential *dbcontrol.StorageCredential
}

func (stub stubStorageResolver) StorageCredentialByAccessKeyID(
	_ context.Context, accessKeyID string,
) (*dbcontrol.StorageCredential, error) {
	if stub.credential == nil || stub.credential.AccessKeyID != accessKeyID {
		return nil, dbcontrol.ErrNotFound
	}
	return stub.credential, nil
}

// withStorageCredential adds the two headers a storage request carries.
func withStorageCredential(request *http.Request) *http.Request {
	request.Header.Set(auth.StorageAccessKeyHeader, testStorageAccessKeyID)
	request.Header.Set("Authorization", "Bearer "+testStorageSecret)
	return request
}

// testRouterOwner is the user id the test router's authorizer recognizes.
var testRouterOwner = uuid.MustParse("33333333-3333-4333-8333-333333333333")

// testRouter builds a router over stub handlers plus a real session signer and
// the real project key middleware, so routing and authentication are exercised
// together rather than in isolation.
func testRouter(t *testing.T, projectID uuid.UUID) (
	http.Handler, *stubOAuth, *stubControl, *stubData,
) {
	t.Helper()

	signer := mustSigner(t)

	oauthStub := &stubOAuth{}
	credentialsStub := &stubCredentials{}
	controlStub := &stubControl{}
	dataStub := &stubData{}
	bucketStub := &stubBucket{}
	docsStub := &stubDocs{}

	ready := &dbcontrol.Project{
		ID:              projectID,
		Name:            "test",
		Status:          dbcontrol.ProjectReady,
		SecretKeyHash:   secretkey.Hash(testProjectKey),
		SecretKeyPrefix: secretkey.Prefix(testProjectKey),
	}

	built := New(Deps{
		Health:      &stubHealth{},
		OAuth:       oauthStub,
		Credentials: credentialsStub,
		Control:     controlStub,
		Data:        dataStub,
		Bucket:      bucketStub,
		Docs:        docsStub,
		Meta:        &stubMeta{},
		Sessions:    auth.NewSessionManager(signer, false),
		ProjectKeys: stubResolver{project: ready},
		Projects:    stubAuthorizer{project: ready, owner: testRouterOwner},
		StorageKeys: stubStorageResolver{credential: &dbcontrol.StorageCredential{
			ID:            uuid.New(),
			ProjectID:     projectID,
			AccessKeyID:   testStorageAccessKeyID,
			SecretKeyHash: bucketkey.Hash(testStorageSecret),
		}},
		Log:            logger.Nop(),
		StaticFS:       http.FS(testFrontend),
		IndexFS:        testFrontend,
		PublicURL:      "https://moogo.dev",
		MaxBodyBytes:   64 * 1024,
		MaxObjectBytes: 8 * 1024 * 1024,
		RequestTimeout: 5 * time.Second,
		Metrics:        metrics.Handler(metrics.Providers{}),
	})

	return built, oauthStub, controlStub, dataStub
}

// withProjectKey adds a valid bearer token to a request.
func withProjectKey(request *http.Request) *http.Request {
	request.Header.Set("Authorization", "Bearer "+testProjectKey)
	return request
}

func TestPublicRoutesAreReachableWithoutSession(t *testing.T) {
	built, oauthStub, _, _ := testRouter(t, uuid.New())

	testCases := []struct {
		name     string
		method   string
		path     string
		wantCall string
	}{
		{"google redirect", http.MethodGet, "/auth/google", "GoogleRedirect"},
		{"google callback", http.MethodGet, "/auth/google/callback", "GoogleCallback"},
		{"session probe", http.MethodGet, "/auth/session", "Session"},
		{"logout", http.MethodPost, "/auth/logout", "Logout"},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			oauthStub.called = ""

			recorder := httptest.NewRecorder()
			built.ServeHTTP(recorder, httptest.NewRequest(testCase.method, testCase.path, nil))

			if recorder.Code != http.StatusOK {
				t.Fatalf("expected 200, got %d", recorder.Code)
			}
			if oauthStub.called != testCase.wantCall {
				t.Errorf("expected %s to run, got %q", testCase.wantCall, oauthStub.called)
			}
		})
	}
}

func TestControlPlaneRoutesRequireSession(t *testing.T) {
	built, _, controlStub, _ := testRouter(t, uuid.New())
	projectID := uuid.New()

	testCases := []struct {
		name   string
		method string
		path   string
	}{
		{"me", http.MethodGet, "/api/me"},
		{"list", http.MethodGet, "/api/projects"},
		{"create", http.MethodPost, "/api/projects"},
		{"get", http.MethodGet, "/api/projects/" + projectID.String()},
		{"console query", http.MethodPost, "/api/projects/" + projectID.String() + "/query"},
		{"console exec", http.MethodPost, "/api/projects/" + projectID.String() + "/exec"},
		{"rotate", http.MethodPost, "/api/projects/" + projectID.String() + "/rotate-key"},
		{"pause", http.MethodPost, "/api/projects/" + projectID.String() + "/pause"},
		{"resume", http.MethodPost, "/api/projects/" + projectID.String() + "/resume"},
		{"delete", http.MethodDelete, "/api/projects/" + projectID.String()},
		{"activity", http.MethodGet, "/api/projects/" + projectID.String() + "/activity"},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			controlStub.called = ""

			recorder := httptest.NewRecorder()
			built.ServeHTTP(recorder, httptest.NewRequest(testCase.method, testCase.path, nil))

			if recorder.Code != http.StatusUnauthorized {
				t.Errorf("expected 401 without a session, got %d", recorder.Code)
			}
			// Reaching a handler at all would mean the gate let a stranger in.
			if controlStub.called != "" {
				t.Errorf("handler %s should not have run", controlStub.called)
			}
		})
	}
}

func TestControlPlaneRoutesAcceptSession(t *testing.T) {
	built, _, controlStub, _ := testRouter(t, uuid.New())

	signer := mustSigner(t)
	token, err := signer.Issue(uuid.NewString(), "ketut@example.com", 0, time.Now())
	if err != nil {
		t.Fatalf("issue token: %v", err)
	}

	request := httptest.NewRequest(http.MethodGet, "/api/me", nil)
	request.AddCookie(&http.Cookie{Name: auth.SessionCookieName, Value: token})

	recorder := httptest.NewRecorder()
	built.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200 with a valid session, got %d", recorder.Code)
	}
	if controlStub.called != "Me" {
		t.Errorf("expected Me to run, got %q", controlStub.called)
	}
}

func TestProjectScopedRoutesRequireProjectKey(t *testing.T) {
	projectID := uuid.New()
	built, _, _, dataStub := testRouter(t, projectID)

	// /p is the surface an application calls, so a browser session must not be
	// enough and the key is still required.
	for _, path := range []string{
		"/p/" + projectID.String() + "/query",
		"/p/" + projectID.String() + "/exec",
		"/p/" + projectID.String() + "/transaction",
		"/p/" + projectID.String() + "/exec/txn",
	} {
		t.Run(path, func(t *testing.T) {
			dataStub.called = ""
			recorder := httptest.NewRecorder()
			built.ServeHTTP(recorder, httptest.NewRequest(http.MethodPost, path, strings.NewReader("{}")))

			if recorder.Code != http.StatusUnauthorized {
				t.Errorf("expected 401 without a key, got %d", recorder.Code)
			}
			if dataStub.called != "" {
				t.Errorf("handler %s should not have run", dataStub.called)
			}
		})
	}
}

func TestProjectScopedRoutesDispatch(t *testing.T) {
	projectID := uuid.New()
	built, _, _, dataStub := testRouter(t, projectID)

	testCases := []struct {
		path      string
		wantRoute string
	}{
		{"/p/" + projectID.String() + "/query", "Query"},
		{"/p/" + projectID.String() + "/exec", "Exec"},
		{"/p/" + projectID.String() + "/transaction", "Transaction"},
		// A client that probed for /exec/txn reaches the transaction handler
		// rather than a 404, so it never has to fall back.
		{"/p/" + projectID.String() + "/exec/txn", "Transaction"},
	}

	for _, testCase := range testCases {
		t.Run(testCase.wantRoute, func(t *testing.T) {
			dataStub.called = ""
			request := withProjectKey(
				httptest.NewRequest(http.MethodPost, testCase.path, strings.NewReader("{}")))
			recorder := httptest.NewRecorder()
			built.ServeHTTP(recorder, request)

			if dataStub.called != testCase.wantRoute {
				t.Errorf("expected %s to run, got %q", testCase.wantRoute, dataStub.called)
			}
		})
	}
}

func TestProjectScopedBucketRequiresStorageCredential(t *testing.T) {
	projectID := uuid.New()
	built, _, _, _ := testRouter(t, projectID)

	// The SQL secret key must no longer open storage. That separation is the
	// whole point of storage credentials, so it is asserted rather than assumed.
	request := withProjectKey(httptest.NewRequest(http.MethodGet,
		"/p/"+projectID.String()+"/bucket/some/key.png", nil))

	recorder := httptest.NewRecorder()
	built.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 for the SQL key on storage, got %d", recorder.Code)
	}
}

func TestProjectScopedBucketRejectsMissingAccessKeyHeader(t *testing.T) {
	projectID := uuid.New()
	built, _, _, _ := testRouter(t, projectID)

	// The secret alone is not enough: without an access key id there is nothing
	// to check the secret against.
	request := httptest.NewRequest(http.MethodGet,
		"/p/"+projectID.String()+"/bucket/logo.png", nil)
	request.Header.Set("Authorization", "Bearer "+testStorageSecret)

	recorder := httptest.NewRecorder()
	built.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 without an access key id, got %d", recorder.Code)
	}
}

func TestProjectScopedBucketDispatchesWithStorageCredential(t *testing.T) {
	projectID := uuid.New()
	built, _, _, _ := testRouter(t, projectID)

	request := withStorageCredential(httptest.NewRequest(http.MethodGet,
		"/p/"+projectID.String()+"/bucket/logo.png", nil))

	recorder := httptest.NewRecorder()
	built.ServeHTTP(recorder, request)

	// The stub answers 200 with its own name, which is enough to prove the
	// download handler ran through the new mount.
	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", recorder.Code)
	}
}

func TestProjectScopedBucketRejectsCredentialForAnotherProject(t *testing.T) {
	projectID := uuid.New()
	signer := mustSigner(t)

	// A real credential, but it belongs to a different project. Presenting it
	// with this project's URL must not serve that other project's storage.
	other := &dbcontrol.Project{ID: uuid.New(), Status: dbcontrol.ProjectReady}
	foreignCredential := &dbcontrol.StorageCredential{
		ID:            uuid.New(),
		ProjectID:     other.ID,
		AccessKeyID:   testStorageAccessKeyID,
		SecretKeyHash: bucketkey.Hash(testStorageSecret),
	}

	built := New(Deps{
		Health:      &stubHealth{},
		OAuth:       &stubOAuth{},
		Credentials: &stubCredentials{},
		Control:     &stubControl{},
		Data:        &stubData{},
		Bucket:      &stubBucket{},
		Docs:        &stubDocs{},
		Sessions:    auth.NewSessionManager(signer, false),
		ProjectKeys: stubResolver{project: &dbcontrol.Project{ID: projectID, Status: dbcontrol.ProjectReady}},
		Projects:    stubAuthorizer{project: &dbcontrol.Project{ID: projectID, Status: dbcontrol.ProjectReady}, owner: testRouterOwner}, StorageKeys: stubStorageResolver{credential: foreignCredential},
		Log:          logger.Nop(),
		MaxBodyBytes: 1024,

		RequestTimeout: time.Second,
	})

	request := withStorageCredential(httptest.NewRequest(http.MethodGet,
		"/p/"+projectID.String()+"/bucket/logo.png", nil))

	recorder := httptest.NewRecorder()
	built.ServeHTTP(recorder, request)

	// 404 rather than 403: the credential is genuine, so a 403 would leak that
	// the other project id exists.
	if recorder.Code != http.StatusNotFound {
		t.Errorf("expected 404 for a cross-project credential, got %d", recorder.Code)
	}
}

func TestProjectScopedSetsNoStore(t *testing.T) {
	projectID := uuid.New()
	built, _, _, _ := testRouter(t, projectID)

	request := withStorageCredential(httptest.NewRequest(http.MethodGet,
		"/p/"+projectID.String()+"/bucket", nil))

	recorder := httptest.NewRecorder()
	built.ServeHTTP(recorder, request)

	// A cached bucket listing would be served to the next caller who is not the
	// credential holder, so the no-store rule has to cover this prefix too.
	if got := recorder.Header().Get("Cache-Control"); got != "no-store" {
		t.Errorf("expected no-store on the project-scoped plane, got %q", got)
	}
}

func TestDashboardBucketRoutesRequireSession(t *testing.T) {
	projectID := uuid.New()
	built, _, controlStub, _ := testRouter(t, projectID)

	// The dashboard's storage routes run on the session cookie, so a bearer
	// token alone must not open them.
	recorder := httptest.NewRecorder()
	built.ServeHTTP(recorder, withProjectKey(
		httptest.NewRequest(http.MethodGet, "/api/projects/"+projectID.String()+"/bucket", nil)))

	if recorder.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 without a session, got %d", recorder.Code)
	}
	if controlStub.called != "" {
		t.Errorf("handler %s should not have run", controlStub.called)
	}
}

func TestDashboardBucketRoutesAcceptOwnerSession(t *testing.T) {
	projectID := uuid.New()
	built, _, _, _ := testRouter(t, projectID)

	token := issueTestToken(t, testRouterOwner)

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/api/projects/"+projectID.String()+"/bucket", nil)
	request.AddCookie(&http.Cookie{Name: auth.SessionCookieName, Value: token})
	built.ServeHTTP(recorder, request)

	// The point of these routes: no Authorization header anywhere, and the
	// bucket handler still runs.
	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", recorder.Code)
	}
}

func TestDashboardBucketRoutesRejectOtherUsersSession(t *testing.T) {
	projectID := uuid.New()
	built, _, _, _ := testRouter(t, projectID)

	// A valid session for a different account must not reach the project.
	token := issueTestToken(t, uuid.MustParse("44444444-4444-4444-8444-444444444444"))

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/api/projects/"+projectID.String()+"/bucket", nil)
	request.AddCookie(&http.Cookie{Name: auth.SessionCookieName, Value: token})
	built.ServeHTTP(recorder, request)

	// 404 rather than 403, so the id cannot be probed for existence.
	if recorder.Code != http.StatusNotFound {
		t.Errorf("expected 404 for another user's project, got %d", recorder.Code)
	}
}

func TestDashboardBucketRefusesPausedProject(t *testing.T) {
	projectID := uuid.New()
	signer := mustSigner(t)

	paused := &dbcontrol.Project{ID: projectID, Status: dbcontrol.ProjectPaused}
	built := New(Deps{
		Health:      &stubHealth{},
		OAuth:       &stubOAuth{},
		Credentials: &stubCredentials{},
		Control:     &stubControl{},
		Data:        &stubData{},
		Bucket:      &stubBucket{},
		Docs:        &stubDocs{},
		Sessions:    auth.NewSessionManager(signer, false),
		ProjectKeys: stubResolver{project: paused}, Projects: stubAuthorizer{project: paused, owner: testRouterOwner},
		StorageKeys: stubStorageResolver{credential: &dbcontrol.StorageCredential{
			ID:            uuid.New(),
			ProjectID:     projectID,
			AccessKeyID:   testStorageAccessKeyID,
			SecretKeyHash: bucketkey.Hash(testStorageSecret),
		}},
		Log:          logger.Nop(),
		MaxBodyBytes: 1024,

		RequestTimeout: time.Second,
	})

	token := issueTestToken(t, testRouterOwner)

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/api/projects/"+projectID.String()+"/bucket", nil)
	request.AddCookie(&http.Cookie{Name: auth.SessionCookieName, Value: token})
	built.ServeHTTP(recorder, request)

	// Without this, pausing a project would only stop external clients while
	// the dashboard carried on reading and writing it.
	if recorder.Code != http.StatusForbidden {
		t.Errorf("expected 403 for a paused project, got %d", recorder.Code)
	}
}

// issueTestToken mints a session cookie value for a user.
func issueTestToken(t *testing.T, userID uuid.UUID) string {
	t.Helper()

	token, err := mustSigner(t).Issue(userID.String(), "ketut@example.com", 0, time.Now())
	if err != nil {
		t.Fatalf("issue token: %v", err)
	}
	return token
}

func TestDataPlaneRoutesRequireProjectKey(t *testing.T) {
	projectID := uuid.New()
	built, _, _, dataStub := testRouter(t, projectID)

	for _, path := range []string{
		"/db/" + projectID.String() + "/query",
		"/db/" + projectID.String() + "/exec",
		"/db/" + projectID.String() + "/transaction",
		"/db/" + projectID.String() + "/exec/txn",
	} {
		t.Run(path, func(t *testing.T) {
			dataStub.called = ""

			recorder := httptest.NewRecorder()
			built.ServeHTTP(recorder, httptest.NewRequest(http.MethodPost, path, nil))

			if recorder.Code != http.StatusUnauthorized {
				t.Errorf("expected 401 without a key, got %d", recorder.Code)
			}
			if dataStub.called != "" {
				t.Errorf("handler %s should not have run", dataStub.called)
			}
		})
	}
}

func TestDataPlaneRejectsNonUUIDProjectID(t *testing.T) {
	built, _, _, _ := testRouter(t, uuid.New())

	// A key is supplied so the failure cannot be blamed on missing auth: the
	// path itself is invalid.
	request := withProjectKey(httptest.NewRequest(http.MethodPost, "/db/not-a-uuid/query", nil))

	recorder := httptest.NewRecorder()
	built.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for a malformed project id, got %d", recorder.Code)
	}

	var body struct {
		Error struct {
			Code string `json:"code"`
		} `json:"error"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode body: %v", err)
	}
	if body.Error.Code != "invalid_project_id" {
		t.Errorf("expected invalid_project_id, got %q", body.Error.Code)
	}
}

func TestDataPlaneRoutesDispatch(t *testing.T) {
	projectID := uuid.New()
	built, _, _, dataStub := testRouter(t, projectID)

	testCases := []struct {
		path      string
		wantRoute string
	}{
		{"/db/" + projectID.String() + "/query", "Query"},
		{"/db/" + projectID.String() + "/exec", "Exec"},
		{"/db/" + projectID.String() + "/transaction", "Transaction"},
		{"/db/" + projectID.String() + "/exec/txn", "Transaction"},
	}

	for _, testCase := range testCases {
		t.Run(testCase.wantRoute, func(t *testing.T) {
			dataStub.called = ""

			request := withProjectKey(
				httptest.NewRequest(http.MethodPost, testCase.path, strings.NewReader("{}")))

			recorder := httptest.NewRecorder()
			built.ServeHTTP(recorder, request)

			if dataStub.called != testCase.wantRoute {
				t.Errorf("expected %s to run, got %q", testCase.wantRoute, dataStub.called)
			}
		})
	}
}

func TestDataPlaneRejectsGetMethod(t *testing.T) {
	projectID := uuid.New()
	built, _, _, _ := testRouter(t, projectID)

	request := withProjectKey(httptest.NewRequest(http.MethodGet, "/db/"+projectID.String()+"/query", nil))

	recorder := httptest.NewRecorder()
	built.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusMethodNotAllowed {
		t.Errorf("expected 405 for GET on the SQL endpoints, got %d", recorder.Code)
	}
}

func TestProbesAreReachableWithoutSession(t *testing.T) {
	built, _, _, _ := testRouter(t, uuid.New())

	for _, path := range []string{"/healthz", "/readyz"} {
		t.Run(path, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			built.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, path, nil))

			// A probe behind the session gate would report every instance as
			// unhealthy, because the probe carries no cookie.
			if recorder.Code != http.StatusOK {
				t.Errorf("expected 200 for %s, got %d", path, recorder.Code)
			}
		})
	}
}

func TestPagesAreServed(t *testing.T) {
	built, _, _, _ := testRouter(t, uuid.New())

	// /docs and /docs/... are client routes too: registerPages serves the
	// app shell for them so a hard refresh matches in-app navigation. The
	// split with the /api/docs document endpoints is asserted in the docs
	// tests instead.
	for _, path := range []string{"/", "/app", "/login", "/register", "/plan", "/announcement", "/about", "/contact", "/app/settings/profile", "/docs", "/docs/quickstart"} {
		t.Run(path, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			built.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, path, nil))

			if recorder.Code != http.StatusOK {
				t.Fatalf("expected 200, got %d", recorder.Code)
			}
			if contentType := recorder.Header().Get("Content-Type"); !strings.HasPrefix(contentType, "text/html") {
				t.Errorf("expected HTML, got %q", contentType)
			}
		})
	}
}

func TestStaticAssetsAreServed(t *testing.T) {
	built, _, _, _ := testRouter(t, uuid.New())

	recorder := httptest.NewRecorder()
	built.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/static/assets/app.css", nil))

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", recorder.Code)
	}
	if !strings.Contains(recorder.Body.String(), "color:#fff") {
		t.Errorf("expected the asset body, got %q", recorder.Body.String())
	}
}

func TestMissingPageIsAServerError(t *testing.T) {
	// A router built without pages must say so rather than answer 200 with an
	// empty body, which is what a frontend that fetches HTML would choke on.
	built := New(Deps{
		Health:         &stubHealth{},
		OAuth:          &stubOAuth{},
		Credentials:    &stubCredentials{},
		Control:        &stubControl{},
		Data:           &stubData{},
		Bucket:         &stubBucket{},
		Docs:           &stubDocs{},
		Sessions:       auth.NewSessionManager(mustSigner(t), false),
		ProjectKeys:    stubResolver{project: &dbcontrol.Project{ID: uuid.New(), Status: dbcontrol.ProjectReady}},
		Log:            logger.Nop(),
		MaxBodyBytes:   1024,
		RequestTimeout: time.Second,
	})

	recorder := httptest.NewRecorder()
	built.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/", nil))

	if recorder.Code != http.StatusServiceUnavailable {
		t.Errorf("expected 503 when pages are absent, got %d", recorder.Code)
	}
}

// mustSigner builds a session signer for a test.
func mustSigner(t *testing.T) *session.Signer {
	t.Helper()
	signer, err := session.NewSigner("a-test-secret-that-is-definitely-long-enough", time.Hour)
	if err != nil {
		t.Fatalf("new signer: %v", err)
	}
	return signer
}

func TestUnknownRouteReturnsJSON404(t *testing.T) {
	built, _, _, _ := testRouter(t, uuid.New())

	recorder := httptest.NewRecorder()
	built.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/does-not-exist", nil))

	if recorder.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", recorder.Code)
	}
	if contentType := recorder.Header().Get("Content-Type"); !strings.HasPrefix(contentType, "application/json") {
		t.Errorf("expected a JSON error, got %q", contentType)
	}
}

func TestSecurityHeadersApplied(t *testing.T) {
	built, _, _, _ := testRouter(t, uuid.New())

	recorder := httptest.NewRecorder()
	built.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/", nil))

	expected := map[string]string{
		"X-Content-Type-Options": "nosniff",
		"X-Frame-Options":        "DENY",
		"Referrer-Policy":        "strict-origin-when-cross-origin",
	}
	for header, want := range expected {
		if got := recorder.Header().Get(header); got != want {
			t.Errorf("%s: expected %q, got %q", header, want, got)
		}
	}

	csp := recorder.Header().Get("Content-Security-Policy")
	// frame-ancestors is what modern browsers act on; X-Frame-Options is the
	// legacy fallback.
	if !strings.Contains(csp, "frame-ancestors 'none'") {
		t.Errorf("expected frame-ancestors none, got %q", csp)
	}
	if !strings.Contains(csp, "object-src 'none'") {
		t.Errorf("expected object-src none, got %q", csp)
	}
}

func TestHSTSSkippedOnPlainHTTP(t *testing.T) {
	built, _, _, _ := testRouter(t, uuid.New())

	recorder := httptest.NewRecorder()
	built.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/", nil))

	// HSTS over plain HTTP would make a browser refuse localhost for a year.
	if got := recorder.Header().Get("Strict-Transport-Security"); got != "" {
		t.Errorf("expected no HSTS on plain HTTP, got %q", got)
	}
}

func TestHSTSSetOnTLS(t *testing.T) {
	built, _, _, _ := testRouter(t, uuid.New())

	request := httptest.NewRequest(http.MethodGet, "/", nil)
	request.TLS = &tls.ConnectionState{}

	recorder := httptest.NewRecorder()
	built.ServeHTTP(recorder, request)

	if got := recorder.Header().Get("Strict-Transport-Security"); got == "" {
		t.Error("expected HSTS on a TLS request")
	}
}

func TestHSTSSetOnForwardedHTTPS(t *testing.T) {
	built, _, _, _ := testRouter(t, uuid.New())

	// The production shape: nginx holds the certificate, r.TLS is nil, and
	// the only evidence of HTTPS is the header the proxy sets from $scheme.
	request := httptest.NewRequest(http.MethodGet, "/", nil)
	request.Header.Set("X-Forwarded-Proto", "https")

	recorder := httptest.NewRecorder()
	built.ServeHTTP(recorder, request)

	if got := recorder.Header().Get("Strict-Transport-Security"); got == "" {
		t.Error("expected HSTS when the proxy reports https")
	}
}

func TestAPISetsNoStore(t *testing.T) {
	built, _, _, _ := testRouter(t, uuid.New())

	// A cached copy of a create or rotate response would hand the secret key to
	// whoever asks next.
	recorder := httptest.NewRecorder()
	built.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/auth/session", nil))

	if got := recorder.Header().Get("Cache-Control"); got != "no-store" {
		t.Errorf("expected no-store on the API, got %q", got)
	}
}

// The credential routes are the only public endpoints that do real work per
// call: login runs a bcrypt comparison against a live hash and register sends
// an email through a paid provider. They are rate limited in the router rather
// than in the handlers, so this checks the limiter is actually mounted rather
// than merely existing as a package.
func TestCredentialRoutesAreRateLimited(t *testing.T) {
	built, _, _, _ := testRouter(t, uuid.New())

	post := func(path string) *httptest.ResponseRecorder {
		recorder := httptest.NewRecorder()
		request := httptest.NewRequest(http.MethodPost, path, nil)
		// One caller address, so the allowance is spent in a single bucket.
		request.RemoteAddr = "198.51.100.4:1234"
		built.ServeHTTP(recorder, request)
		return recorder
	}

	// The first request must reach the handler: a limiter that refused
	// everything would pass a "is it limited" check while breaking sign-in.
	first := post("/auth/login")
	if first.Code != http.StatusOK {
		t.Fatalf("first login should reach the handler, got %d", first.Code)
	}

	// Keep going well past the default allowance.
	limited := false
	for attempt := 0; attempt < 30; attempt++ {
		recorder := post("/auth/login")
		if recorder.Code == http.StatusTooManyRequests {
			limited = true
			if recorder.Header().Get("Retry-After") == "" {
				t.Error("expected a Retry-After header on the 429")
			}
			break
		}
	}
	if !limited {
		t.Error("expected /auth/login to start refusing with 429")
	}
}

// The limit is shared across the credential endpoints, so moving from login to
// register does not hand the caller a second allowance.
func TestRateLimitIsSharedAcrossCredentialRoutes(t *testing.T) {
	built, _, _, _ := testRouter(t, uuid.New())

	post := func(path string) int {
		recorder := httptest.NewRecorder()
		request := httptest.NewRequest(http.MethodPost, path, nil)
		request.RemoteAddr = "198.51.100.9:1234"
		built.ServeHTTP(recorder, request)
		return recorder.Code
	}

	for attempt := 0; attempt < 20; attempt++ {
		post("/auth/login")
	}
	// Having spent the allowance on login, register must not start fresh.
	if code := post("/auth/register"); code != http.StatusTooManyRequests {
		t.Errorf("expected register to share the login limit, got %d", code)
	}

	// reset-password joins the same bucket. It was once mounted without the
	// limiter, which left one credential route an unauthenticated caller could
	// hammer for the bcrypt cost of every attempt.
	if code := post("/auth/reset-password"); code != http.StatusTooManyRequests {
		t.Errorf("expected reset-password to share the login limit, got %d", code)
	}
}

// The limiter must not be defeatable by a header the caller sets.
func TestRateLimitIgnoresSpoofedForwardedFor(t *testing.T) {
	built, _, _, _ := testRouter(t, uuid.New())

	post := func(forwarded string) int {
		recorder := httptest.NewRecorder()
		request := httptest.NewRequest(http.MethodPost, "/auth/login", nil)
		request.RemoteAddr = "198.51.100.11:1234"
		if forwarded != "" {
			request.Header.Set("X-Forwarded-For", forwarded)
		}
		built.ServeHTTP(recorder, request)
		return recorder.Code
	}

	for attempt := 0; attempt < 20; attempt++ {
		post(fmt.Sprintf("10.0.0.%d", attempt))
	}
	if code := post("1.2.3.4"); code != http.StatusTooManyRequests {
		t.Errorf("a spoofed X-Forwarded-For must not reset the limit, got %d", code)
	}
}

func TestEveryPageRouteServesTheApp(t *testing.T) {
	built, _, _, _ := testRouter(t, uuid.New())

	// Each of these is a client route, so the server has to hand it index.html
	// or the page 404s on a hard refresh. The list is here rather than in the
	// router because a route added in one place and forgotten in the other is
	// exactly the bug this catches.
	for _, path := range []string{
		"/",
		"/login",
		"/register",
		"/forgot-password",
		"/reset-password",
		"/verify-email",
		"/plan",
		"/announcement",
		"/about",
		"/contact",
		"/app",
		"/docs",
		"/docs/quickstart",
	} {
		recorder := httptest.NewRecorder()
		built.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, path, nil))

		if recorder.Code != http.StatusOK {
			t.Errorf("%s: expected 200, got %d", path, recorder.Code)
		}
		if !strings.Contains(recorder.Body.String(), "<title>home</title>") {
			t.Errorf("%s: expected the app shell, got %q", path, recorder.Body.String())
		}
	}
}

// The shell is identical for every path, so a canonical tag baked into
// index.html would claim every page is the same page. The tag is composed per
// request instead: PublicURL plus the path, query string dropped.
func TestCanonicalTagFollowsTheRequestPath(t *testing.T) {
	built, _, _, _ := testRouter(t, uuid.New())

	for _, path := range []string{"/", "/terms", "/privacy", "/plan", "/docs/quickstart"} {
		recorder := httptest.NewRecorder()
		built.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, path, nil))

		want := `rel="canonical" href="https://moogo.dev` + path + `"`
		if !strings.Contains(recorder.Body.String(), want) {
			t.Errorf("%s: canonical tag missing, body %q", path, recorder.Body.String())
		}
	}

	t.Run("query string is not part of the canonical URL", func(t *testing.T) {
		recorder := httptest.NewRecorder()
		built.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/plan?ref=newsletter", nil))

		body := recorder.Body.String()
		if !strings.Contains(body, `rel="canonical" href="https://moogo.dev/plan"`) {
			t.Errorf("expected /plan canonicalized without the query, body %q", body)
		}
		if strings.Contains(body, "newsletter") {
			t.Errorf("query string leaked into the canonical tag, body %q", body)
		}
	})
}

// /annoucement is a published typo: links to it exist, so it keeps answering,
// but with a permanent redirect rather than a second copy of the page that
// would make the canonical tag ambiguous.
func TestLegacyAnnoucementRedirectsToTheCorrectSpelling(t *testing.T) {
	built, _, _, _ := testRouter(t, uuid.New())

	recorder := httptest.NewRecorder()
	built.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/annoucement", nil))

	if recorder.Code != http.StatusMovedPermanently {
		t.Errorf("expected %d, got %d", http.StatusMovedPermanently, recorder.Code)
	}
	if location := recorder.Header().Get("Location"); location != "/announcement" {
		t.Errorf("expected Location /announcement, got %q", location)
	}
}

func TestPagesAreNotNoStore(t *testing.T) {
	built, _, _, _ := testRouter(t, uuid.New())

	// The HTML shell is not secret, and a cacheable page makes repeat loads fast.
	recorder := httptest.NewRecorder()
	built.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/app", nil))

	if got := recorder.Header().Get("Cache-Control"); got == "no-store" {
		t.Error("pages should stay cacheable")
	}
}

func TestRequestIDIsEchoed(t *testing.T) {
	built, _, _, _ := testRouter(t, uuid.New())

	request := httptest.NewRequest(http.MethodGet, "/", nil)
	request.Header.Set(httpx.RequestIDHeader, "abc-123")

	recorder := httptest.NewRecorder()
	built.ServeHTTP(recorder, request)

	if got := recorder.Header().Get(httpx.RequestIDHeader); got != "abc-123" {
		t.Errorf("expected the inbound request id to be echoed, got %q", got)
	}
}

func TestRequestIDGeneratedWhenMissing(t *testing.T) {
	built, _, _, _ := testRouter(t, uuid.New())

	recorder := httptest.NewRecorder()
	built.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/", nil))

	got := recorder.Header().Get(httpx.RequestIDHeader)
	if got == "" {
		t.Fatal("expected a generated request id")
	}
	if _, err := uuid.Parse(got); err != nil {
		t.Errorf("expected the generated request id to be a UUID, got %q", got)
	}
}

// testUploadProjectID routes an authenticated upload through the real middleware
// stack, so the body cap in front of the handler is the one under test.
func uploadThroughRouter(t *testing.T, projectID uuid.UUID, body []byte) *httptest.ResponseRecorder {
	t.Helper()

	built, _, _, _ := testRouter(t, projectID)
	request := httptest.NewRequest(
		http.MethodPost, "/p/"+projectID.String()+"/bucket/logo.png", bytes.NewReader(body))
	request.Header.Set("Content-Type", "image/png")
	request = withStorageCredential(request)

	recorder := httptest.NewRecorder()
	built.ServeHTTP(recorder, request)
	return recorder
}

func TestBucketUploadIsNotCappedByTheJSONBodyLimit(t *testing.T) {
	// The JSON cap is 64 KiB and the object cap is 8 MiB. An upload shares a
	// route group with JSON endpoints, so when both were capped at the JSON
	// limit a 250 MB project could not accept a file bigger than a statement.
	recorder := uploadThroughRouter(t, uuid.New(), make([]byte, 1024*1024))

	if recorder.Code != http.StatusOK {
		t.Fatalf("a 1 MiB upload was rejected with %d: a project cannot store a "+
			"250 MB quota if the body limit is smaller than one file", recorder.Code)
	}
}

func TestBucketUploadIsCappedByTheObjectLimit(t *testing.T) {
	// The other direction still has to hold: past the object cap the request is
	// refused before the bytes are written, not after.
	recorder := uploadThroughRouter(t, uuid.New(), make([]byte, 9*1024*1024))

	if recorder.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("status = %d, want 413 for an upload over the object cap", recorder.Code)
	}
}

// The data plane's query allowance is spent per project, not per address: an
// application whose users arrive from a thousand addresses still gets one
// budget, and once it is spent the refusal arrives with a Retry-After.
func TestDataPlaneQueryIsRateLimitedPerProject(t *testing.T) {
	projectID := uuid.New()
	built, _, _, _ := testRouter(t, projectID)

	post := func(path, address string) int {
		recorder := httptest.NewRecorder()
		request := withProjectKey(httptest.NewRequest(http.MethodPost, path, nil))
		request.RemoteAddr = address
		built.ServeHTTP(recorder, request)
		return recorder.Code
	}
	queryPath := "/p/" + projectID.String() + "/query"

	// The first request must reach the handler: a limiter that refused
	// everything would pass this check while breaking the data plane.
	if code := post(queryPath, "203.0.113.10:1000"); code != http.StatusOK {
		t.Fatalf("first query should reach the handler, got %d", code)
	}

	// A fresh address on every attempt: if the address were the key, this
	// sequence would never hit the limit.
	limited := false
	for attempt := 0; attempt < 305; attempt++ {
		address := fmt.Sprintf("203.0.113.%d:%d", attempt%256, attempt)
		if code := post(queryPath, address); code == http.StatusTooManyRequests {
			limited = true
			break
		}
	}
	if !limited {
		t.Fatal("expected /p/{id}/query to start refusing with 429")
	}

	// Another project on the same host has its own allowance: one project
	// running out must not freeze its neighbours.
	otherPath := "/p/" + uuid.New().String() + "/query"
	if code := post(otherPath, "203.0.113.10:1000"); code != http.StatusOK {
		t.Errorf("a second project should have its own allowance, got %d", code)
	}
}

// Spending the allowance on the /p prefix must also empty the /db bucket: the
// allowance cannot be multiplied by moving between endpoints.
func TestQueryRateLimitIsSharedAcrossPrefixes(t *testing.T) {
	projectID := uuid.New()
	built, _, _, _ := testRouter(t, projectID)

	post := func(path string) int {
		recorder := httptest.NewRecorder()
		request := withProjectKey(httptest.NewRequest(http.MethodPost, path, nil))
		request.RemoteAddr = "203.0.113.20:2000"
		built.ServeHTTP(recorder, request)
		return recorder.Code
	}

	for attempt := 0; attempt < 305; attempt++ {
		post("/p/" + projectID.String() + "/query")
	}
	if code := post("/db/" + projectID.String() + "/query"); code != http.StatusTooManyRequests {
		t.Errorf("expected /db to share the /p allowance, got %d", code)
	}
}

// Bucket routes are limited per caller address instead: object traffic is
// usually one browser fetching many small files, which is a per-client
// pattern, and the budget should follow the client.
func TestBucketRoutesAreRateLimitedPerAddress(t *testing.T) {
	projectID := uuid.New()
	built, _, _, _ := testRouter(t, projectID)

	get := func(address string) int {
		recorder := httptest.NewRecorder()
		request := withStorageCredential(httptest.NewRequest(http.MethodGet,
			"/p/"+projectID.String()+"/bucket/logo.png", nil))
		request.RemoteAddr = address
		built.ServeHTTP(recorder, request)
		return recorder.Code
	}

	if code := get("198.51.100.30:3000"); code != http.StatusOK {
		t.Fatalf("first download should reach the handler, got %d", code)
	}

	limited := false
	for attempt := 0; attempt < 305; attempt++ {
		if code := get("198.51.100.30:3000"); code == http.StatusTooManyRequests {
			limited = true
			break
		}
	}
	if !limited {
		t.Fatal("expected /p/{id}/bucket/{key} to start refusing with 429")
	}

	// A different client keeps downloading: the refusal belongs to the
	// address that exhausted its budget, not to the route.
	if code := get("198.51.100.31:3000"); code != http.StatusOK {
		t.Errorf("another address should have its own allowance, got %d", code)
	}
}

// /metrics answers from the machine itself and disappears for everybody
// else: the counters describe internal saturation, which is useful on the
// host and to nobody else.
func TestMetricsEndpointIsLoopbackOnly(t *testing.T) {
	built, _, _, _ := testRouter(t, uuid.New())

	local := httptest.NewRecorder()
	localRequest := httptest.NewRequest(http.MethodGet, "/metrics", nil)
	localRequest.RemoteAddr = "127.0.0.1:7777"
	built.ServeHTTP(local, localRequest)

	if local.Code != http.StatusOK {
		t.Fatalf("loopback status = %d, want 200", local.Code)
	}
	if !strings.Contains(local.Body.String(), "moogo_query_queue_depth") {
		t.Errorf("loopback scrape is missing the counters:\n%s", local.Body.String())
	}

	remote := httptest.NewRecorder()
	remoteRequest := httptest.NewRequest(http.MethodGet, "/metrics", nil)
	remoteRequest.RemoteAddr = "203.0.113.44:443"
	built.ServeHTTP(remote, remoteRequest)

	if remote.Code != http.StatusNotFound {
		t.Errorf("remote status = %d, want 404", remote.Code)
	}
	if strings.Contains(remote.Body.String(), "moogo_") {
		t.Error("the remote body must not reveal that metrics exist")
	}
}

func TestUnknownPathServesErrorPageToBrowsers(t *testing.T) {
	built, _, _, _ := testRouter(t, uuid.New())

	t.Run("browser navigation", func(t *testing.T) {
		request := httptest.NewRequest(http.MethodGet, "/askdans", nil)
		request.Header.Set("Accept", "text/html,application/xhtml+xml,*/*;q=0.8")

		recorder := httptest.NewRecorder()
		built.ServeHTTP(recorder, request)

		if recorder.Code != http.StatusNotFound {
			t.Errorf("expected 404, got %d", recorder.Code)
		}
		if contentType := recorder.Header().Get("Content-Type"); !strings.Contains(contentType, "text/html") {
			t.Errorf("expected an html document, got %q", contentType)
		}
		// The front page itself, carrying the failed status for the client
		// route to render inside the site's own layout.
		body := recorder.Body.String()
		for _, want := range []string{"<title>home</title>", `id="moogo-error"`, `&#34;status&#34;:404`} {
			if !strings.Contains(body, want) {
				t.Errorf("document missing %q", want)
			}
		}
	})

	t.Run("api client keeps json", func(t *testing.T) {
		request := httptest.NewRequest(http.MethodGet, "/askdans", nil)

		recorder := httptest.NewRecorder()
		built.ServeHTTP(recorder, request)

		if recorder.Code != http.StatusNotFound {
			t.Errorf("expected 404, got %d", recorder.Code)
		}
		if contentType := recorder.Header().Get("Content-Type"); !strings.Contains(contentType, "application/json") {
			t.Errorf("expected json, got %q", contentType)
		}
		if body := recorder.Body.String(); !strings.Contains(body, `"code":"not_found"`) {
			t.Errorf("expected the json error body, got %q", body)
		}
	})
}

// The credential writes have to carry the JSON body cap themselves: without
// it, one unauthenticated POST hands the process an arbitrarily large body to
// buffer before the decoder ever sees a byte. testRouter caps at 64 KB, so an
// oversized login is 413 only if the route actually applies that cap.
func TestCredentialWritesAreBodyCapped(t *testing.T) {
	built, _, _, _ := testRouter(t, uuid.New())

	t.Run("oversized", func(t *testing.T) {
		body := strings.Repeat("x", 70*1024)
		request := httptest.NewRequest(http.MethodPost, "/auth/login",
			strings.NewReader(body))
		request.Header.Set("Content-Type", "application/json")

		recorder := httptest.NewRecorder()
		built.ServeHTTP(recorder, request)

		if recorder.Code != http.StatusRequestEntityTooLarge {
			t.Errorf("expected 413, got %d", recorder.Code)
		}
	})

	t.Run("within the cap", func(t *testing.T) {
		request := httptest.NewRequest(http.MethodPost, "/auth/login",
			strings.NewReader(`{"email":"a@b.c","password":"secret123"}`))
		request.Header.Set("Content-Type", "application/json")

		recorder := httptest.NewRecorder()
		built.ServeHTTP(recorder, request)

		if recorder.Code != http.StatusOK {
			t.Errorf("expected 200, got %d: %s", recorder.Code, recorder.Body.String())
		}
	})
}

// The legal pages and the crawler endpoints are routes like any other. The
// SPA catch-all would answer 200 HTML for a missing path, so the assertions
// check what came back, not only the status.
func TestLegalAndCrawlerRoutesAreRegistered(t *testing.T) {
	built, _, _, _ := testRouter(t, uuid.New())

	htmlPages := []string{"/terms", "/privacy"}
	for _, path := range htmlPages {
		recorder := httptest.NewRecorder()
		built.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, path, nil))

		if recorder.Code != http.StatusOK {
			t.Errorf("%s: expected 200, got %d", path, recorder.Code)
		}
		if contentType := recorder.Header().Get("Content-Type"); !strings.Contains(contentType, "text/html") {
			t.Errorf("%s: content type = %q, want text/html", path, contentType)
		}
	}

	crawler := []struct {
		path string
		want string
	}{
		{"/sitemap.xml", "Sitemap"},
		{"/robots.txt", "Robots"},
	}
	for _, testCase := range crawler {
		recorder := httptest.NewRecorder()
		built.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, testCase.path, nil))

		if recorder.Code != http.StatusOK {
			t.Errorf("%s: expected 200, got %d", testCase.path, recorder.Code)
		}
		if recorder.Body.String() != testCase.want {
			t.Errorf("%s: body = %q, want the stub handler's answer %q",
				testCase.path, recorder.Body.String(), testCase.want)
		}
	}
}
