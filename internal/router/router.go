// Package router wires the HTTP routes.
//
// Every route lives here so the whole public surface of the service can be
// read in one place. Route groups carry their own authentication middleware,
// which is what keeps a new endpoint from being added without deciding who may
// call it.
package router

import (
	"bytes"
	"context"
	"errors"
	"html"
	"io/fs"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/moogodev/moogodev/internal/auth"
	"github.com/moogodev/moogodev/internal/dbcontrol"
	"github.com/moogodev/moogodev/internal/ratelimit"
	"github.com/moogodev/moogodev/pkg/httpx"
	"github.com/moogodev/moogodev/pkg/logger"
)

// OAuthHandlers are the sign-in endpoints.
type OAuthHandlers interface {
	GoogleRedirect(http.ResponseWriter, *http.Request)
	GoogleCallback(http.ResponseWriter, *http.Request)
	Logout(http.ResponseWriter, *http.Request)
	Session(http.ResponseWriter, *http.Request)
	Setup(http.ResponseWriter, *http.Request)
}

// CredentialsHandlers are the email/password sign-in endpoints.
type CredentialsHandlers interface {
	Register(http.ResponseWriter, *http.Request)
	Login(http.ResponseWriter, *http.Request)
	ForgotPassword(http.ResponseWriter, *http.Request)
	ResetPassword(http.ResponseWriter, *http.Request)
	VerifyEmail(http.ResponseWriter, *http.Request)
	ResendVerification(http.ResponseWriter, *http.Request)
}

// ControlPlaneHandlers are the dashboard endpoints.
type ControlPlaneHandlers interface {
	Me(http.ResponseWriter, *http.Request)
	ChangePassword(http.ResponseWriter, *http.Request)
	UpdateProfile(http.ResponseWriter, *http.Request)
	ListProjects(http.ResponseWriter, *http.Request)
	CreateProject(http.ResponseWriter, *http.Request)
	GetProject(http.ResponseWriter, *http.Request)
	ListStorageCredentials(http.ResponseWriter, *http.Request)
	CreateStorageCredential(http.ResponseWriter, *http.Request)
	RotateStorageCredential(http.ResponseWriter, *http.Request)
	RevokeStorageCredential(http.ResponseWriter, *http.Request)
	Query(http.ResponseWriter, *http.Request)
	Exec(http.ResponseWriter, *http.Request)
	RotateKey(http.ResponseWriter, *http.Request)
	PauseProject(http.ResponseWriter, *http.Request)
	ResumeProject(http.ResponseWriter, *http.Request)
	DeleteProject(http.ResponseWriter, *http.Request)
	Activity(http.ResponseWriter, *http.Request)
	DownloadDatabase(http.ResponseWriter, *http.Request)
	DeleteAccount(http.ResponseWriter, *http.Request)
}

// DataPlaneHandlers are the SQL endpoints.
type DataPlaneHandlers interface {
	Query(http.ResponseWriter, *http.Request)
	Exec(http.ResponseWriter, *http.Request)
	Transaction(http.ResponseWriter, *http.Request)
}

// HealthHandlers are the liveness and readiness probes.
type HealthHandlers interface {
	Liveness(http.ResponseWriter, *http.Request)
	Readiness(http.ResponseWriter, *http.Request)
}

// BucketHandlers are the object storage endpoints.
type BucketHandlers interface {
	Upload(http.ResponseWriter, *http.Request)
	Download(http.ResponseWriter, *http.Request)
	// PublicDownload serves a published object with no credential in front of it.
	PublicDownload(http.ResponseWriter, *http.Request)
	Update(http.ResponseWriter, *http.Request)
	Delete(http.ResponseWriter, *http.Request)
	List(http.ResponseWriter, *http.Request)
	ListBuckets(http.ResponseWriter, *http.Request)
	CreateBucket(http.ResponseWriter, *http.Request)
	UpdateBucketSettings(http.ResponseWriter, *http.Request)
	DeleteBucket(http.ResponseWriter, *http.Request)
	SetBucketPublic(http.ResponseWriter, *http.Request)
}

// DocsHandlers are the documentation endpoints.
type DocsHandlers interface {
	Doc(http.ResponseWriter, *http.Request)
	DocList(http.ResponseWriter, *http.Request)
}

// UpdatesHandlers is the dashboard's "What's new" list.
type UpdatesHandlers interface {
	Updates(http.ResponseWriter, *http.Request)
}

// MetaHandlers are the crawler endpoints: the sitemap and robots.txt.
//
// They exist on the API binary because that is what serves the marketing
// origin in the single-node deployment -- there is no second web server that
// could answer for them.
type MetaHandlers interface {
	Sitemap(http.ResponseWriter, *http.Request)
	Robots(http.ResponseWriter, *http.Request)
}

// ProjectAuthorizer checks that a project belongs to the signed-in user.
//
// It is the slice of the store the dashboard routes need, declared here so the
// router keeps depending on an interface rather than the concrete store.
type ProjectAuthorizer interface {
	ProjectOwnedBy(
		ctx context.Context,
		projectID uuid.UUID,
		userID uuid.UUID,
	) (*dbcontrol.Project, error)
}

// Deps are the pieces the router needs to build handlers.
type Deps struct {
	Health      HealthHandlers
	OAuth       OAuthHandlers
	Credentials CredentialsHandlers
	Control     ControlPlaneHandlers
	Data        DataPlaneHandlers
	Bucket      BucketHandlers
	Docs        DocsHandlers
	// Updates is the dashboard's "What's new" list, read from the news
	// service. Nil in tests that do not care, and a nil handler leaves the
	// route unregistered rather than failing to build, like Metrics.
	Updates UpdatesHandlers
	// Meta serves /sitemap.xml and /robots.txt. Nil leaves both routes
	// unregistered, the same convention as Metrics and Updates.
	Meta        MetaHandlers
	Sessions    *auth.SessionManager
	ProjectKeys auth.ProjectResolver
	// Projects authorizes the dashboard's per-project routes by ownership.
	Projects ProjectAuthorizer
	// StorageKeys resolves the storage credentials that object storage is
	// authorized with.
	StorageKeys auth.StorageCredentialResolver
	Log         *logger.Logger
	// StaticFS serves /static/* and IndexFS provides index.html for the
	// single-page app. Both point at the same built frontend; they are separate
	// fields because one is a file server and the other is read as a document.
	StaticFS http.FileSystem
	IndexFS  fs.FS
	// PublicURL is the origin the dashboard is served from, without a trailing
	// slash. It is the base of the per-request rel=canonical tag the page
	// routes inject: the SPA serves one shell for every path, so the canonical
	// URL cannot be baked into index.html and has to be composed per request.
	// Empty in tests that do not care, and then no tag is written.
	PublicURL string
	// TrustedProxies lists the addresses allowed to set X-Forwarded-For. Empty
	// means the header is ignored, which is the safe default.
	TrustedProxies []string
	MaxBodyBytes   int64
	// MaxObjectBytes caps one object upload. It is larger than MaxBodyBytes on
	// purpose: the JSON endpoints take a request, the bucket endpoints take a
	// file, and a shared cap would mean a 256 MB project that cannot accept a
	// 2 MB image.
	MaxObjectBytes int64
	RequestTimeout time.Duration
	// Metrics answers GET /metrics with the operational counters. It is nil
	// in tests that do not care, and a nil handler leaves the route
	// unregistered rather than failing to build.
	Metrics http.Handler
}

// New builds the router.
func New(deps Deps) http.Handler {
	// A zero upload cap would reject every byte, which looks like a storage
	// outage rather than a missing setting. Falling back to the JSON cap keeps a
	// partially built Deps usable and keeps the failure mode "no file over 1 MB"
	// instead of "no file at all".
	objectCap := deps.MaxObjectBytes
	if objectCap <= 0 {
		objectCap = deps.MaxBodyBytes
	}
	deps.MaxObjectBytes = objectCap

	root := chi.NewRouter()

	// This was chi's middleware.RealIP, which rewrites RemoteAddr from
	// X-Forwarded-For, X-Real-IP or True-Client-IP for anybody who sends one.
	// The project already had httpx.RealIP for this, which only believes those
	// headers when the deployment declared its proxies in MOOGO_TRUSTED_PROXIES,
	// and it was written but never mounted.
	//
	// The difference is not cosmetic. With chi's version an unauthenticated
	// caller can put any address in RemoteAddr, which is what the access log
	// records and what a per-client rate limit keys on -- so the log could be
	// filled with invented addresses and a limit could be sidestepped by sending
	// a different header value per request. Both are one curl argument away.
	root.Use(httpx.RealIP(deps.TrustedProxies))
	root.Use(httpx.RequestID(deps.Log))
	// Outside Recoverer so a panic's 500 passes through it and reaches the
	// browser as a page rather than a raw error body.
	root.Use(httpx.ErrorPages(deps.IndexFS))
	root.Use(httpx.Recoverer(deps.Log))
	root.Use(httpx.AccessLog(deps.Log))
	root.Use(NoCacheForAPI)

	// Security headers apply to every response, including the landing page. A
	// missing Content-Security-Policy is what allows an injected script to run,
	// so it is set rather than left to a reverse proxy that may not have it.
	root.Use(SecurityHeaders)

	// CSRF line three: the session cookie is SameSite=Lax and the mutating
	// handlers demand application/json, and this refuses a write that names
	// another origin outright so neither of those can be quietly relaxed.
	root.Use(httpx.SameOrigin)

	root.NotFound(func(w http.ResponseWriter, r *http.Request) {
		httpx.WriteError(w, http.StatusNotFound, "not_found", "no such endpoint")
	})

	root.MethodNotAllowed(func(w http.ResponseWriter, r *http.Request) {
		httpx.WriteError(w, http.StatusMethodNotAllowed, "method_not_allowed",
			"that method is not supported here")
	})

	// --- Probes, public so the orchestrator can reach them ---

	root.Get("/healthz", deps.Health.Liveness)
	root.Get("/readyz", deps.Health.Readiness)

	// Operational counters. The handler itself refuses anything that is not
	// from the loopback interface: the numbers describe internal saturation
	// and are useful on the host, not off it.
	if deps.Metrics != nil {
		root.Get("/metrics", deps.Metrics.ServeHTTP)
	}

	// --- Public: sign in and session inspection ---

	root.Get("/auth/setup", deps.OAuth.Setup)
	root.Get("/auth/google", deps.OAuth.GoogleRedirect)
	root.Get("/auth/google/callback", deps.OAuth.GoogleCallback)
	root.Get("/auth/session", deps.OAuth.Session)

	root.Post("/auth/logout", deps.OAuth.Logout)

	// Email/password sign-in. These are public: they either create a session or
	// reject, and none of them reads an existing one.
	//
	// They are rate limited because each one does real work on every call:
	// login runs a bcrypt comparison against a live hash, reset-password
	// hashes the new password the same way before the token is even looked
	// up, and register and resend-verification send an email through a paid
	// provider. Without a ceiling, /auth/login is a password guessing
	// oracle and /auth/register is a way to spend somebody's Resend quota.
	//
	// These six are not the only unauthenticated endpoints that do real
	// work -- GET /api/updates can spend seconds on an outbound fetch --
	// and that one is limited too, with a ceiling of its own below rather
	// than this shared one.
	//
	// The limiter is shared across all six so the allowance cannot be
	// multiplied by moving between endpoints, and the trusted-proxy list is the
	// same one RealIP uses, so the count is per real client rather than per
	// proxy hop.
	credentials := ratelimit.New(ratelimit.DefaultCredentialLimit)
	limited := credentials.Middleware

	// Every write on the credential routes reads a JSON body, so each of them
	// carries the JSON body cap and the request timeout alongside the rate
	// limit. The cap matters most here: without it a single unauthenticated
	// POST could hand the process an arbitrarily large body to buffer before
	// it ever reaches the decoder. The timeout is the same one the data plane
	// uses, sized off the query timeout, and these handlers never run longer
	// than a bcrypt compare or an email provider call.
	//
	// The body cap is a middleware rather than a per-handler read because
	// http.MaxBytesReader stops the read at the limit instead of buffering to
	// the end first, which is the difference between rejecting a 50 MB body
	// and absorbing it.
	credentialWrite := chi.Middlewares{
		limited,
		httpx.MaxBodyBytes(deps.MaxBodyBytes),
		httpx.Timeout(deps.RequestTimeout),
	}

	// The data plane gets two ceilings of its own, both deliberately
	// generous: they exist to stop a runaway client or a stolen key from
	// saturating the host, not to shape ordinary use.
	//
	// The query limiter is keyed on the project rather than the address, so
	// one application's traffic cannot exhaust another's budget no matter
	// where it arrives from, and a stolen project key stops at that
	// project's allowance instead of reaching the whole host. One limiter
	// is shared between the /p and /db prefixes for the same reason the
	// credential limiter is shared across its endpoints: the allowance
	// cannot be multiplied by moving between prefixes.
	//
	// The bucket limiter is keyed on the caller's address, because object
	// routes are hammered by a browser fetching many small files at once,
	// which is a per-client pattern. It covers the catalog, both object
	// prefixes, and the public downloads.
	dataQuery := ratelimit.New(ratelimit.Config{Limit: 300, Window: time.Minute}).Plane("query")
	dataBucket := ratelimit.New(ratelimit.Config{Limit: 300, Window: time.Minute}).Plane("bucket")
	queryLimited := dataQuery.MiddlewareKey(projectRateKey)
	bucketLimited := dataBucket.Middleware

	// The dashboard's update list needs a ceiling of its own. It is the
	// one unauthenticated route that waits on another service: each call
	// can spend up to three seconds on an outbound fetch to the news
	// service and read up to 1 MiB of the answer, and every signed-in
	// reader's browser makes it on each trip back to the dashboard. It
	// cannot join the credential limiter, because a burst here would spend
	// /auth/login's allowance on page views, and it does not fit the
	// data-plane pair: that is either keyed per project (this route has no
	// project) or sized for object fetching. Address-keyed like the bucket
	// plane, deliberately loose -- 60 a minute is one a second, far past
	// a human returning to the dashboard even from one office NAT, while
	// still capping how fast one address can reopen fetches after the
	// handler's minute-long cache expires.
	updatesLimited := ratelimit.New(ratelimit.Config{Limit: 60, Window: time.Minute}).Plane("updates").Middleware

	root.With(credentialWrite...).Post("/auth/register", deps.Credentials.Register)
	root.With(credentialWrite...).Post("/auth/login", deps.Credentials.Login)
	root.With(credentialWrite...).Post("/auth/forgot-password", deps.Credentials.ForgotPassword)
	root.With(credentialWrite...).Post("/auth/reset-password", deps.Credentials.ResetPassword)
	// Address confirmation. POST rather than a GET on the token itself: a token
	// in a query string is recorded in browser history and in the Referer of any
	// link followed from the page, so the frontend reads it and posts it.
	//
	// verify-email is limited as well: it is unauthenticated and takes a token,
	// so without a ceiling it is a free oracle for guessing one.
	root.With(credentialWrite...).Post("/auth/verify-email", deps.Credentials.VerifyEmail)
	root.With(credentialWrite...).Post("/auth/resend-verification", deps.Credentials.ResendVerification)

	// --- Control plane: a signed-in person, session cookie ---

	root.Group(func(private chi.Router) {
		private.Use(auth.RequireSession(deps.Sessions))
		// The control plane takes JSON bodies and nothing else, so the JSON
		// cap applies to the whole group. It is safe under the nested bucket
		// routes below because the innermost cap wins: their own
		// MaxObjectBytes re-wraps the original body, so a 256 MB upload is
		// still a 256 MB upload while every settings body stops at 1 MB.
		private.Use(httpx.MaxBodyBytes(deps.MaxBodyBytes))

		private.Get("/api/me", deps.Control.Me)

		// Account-level, not project-level, so it sits beside /api/me rather
		// than inside the projects route group. POST rather than PATCH because a
		// password is never part of a returned account document.
		private.Post("/api/account/password", deps.Control.ChangePassword)
		private.Patch("/api/account/profile", deps.Control.UpdateProfile)

		// Account deletion, beside the other account routes rather than among
		// the projects: it removes the account, not one thing the account
		// owns. DELETE, because that is what the method is for, with the
		// re-authentication password in the body.
		private.Delete("/api/account", deps.Control.DeleteAccount)

		private.Route("/api/projects", func(projects chi.Router) {
			projects.Get("/", deps.Control.ListProjects)
			projects.Post("/", deps.Control.CreateProject)

			projects.Route("/{project_id}", func(project chi.Router) {
				// Parsed here so a malformed id is a 400 before any ownership
				// lookup runs, and so both planes read the id the same way.
				project.Use(ProjectContext)

				project.Get("/", deps.Control.GetProject)
				project.Delete("/", deps.Control.DeleteProject)
				project.Post("/rotate-key", deps.Control.RotateKey)
				project.Post("/pause", deps.Control.PauseProject)
				project.Post("/resume", deps.Control.ResumeProject)
				project.Get("/activity", deps.Control.Activity)

				// The owner-downloadable backup. It sits behind the session and
				// the same ownership check as the rest of this group, and takes no
				// project key: the dashboard already knows who is asking.
				project.Get("/database-backup", deps.Control.DownloadDatabase)

				// The bucket catalog and its objects. These go through the
				// bucket handlers rather than the control plane's own, so the
				// dashboard and an API client see one implementation and one
				// response shape -- including the per-bucket object counts the
				// bucket list shows.
				project.Route("/buckets", func(buckets chi.Router) {
					buckets.Get("/", deps.Bucket.ListBuckets)
					buckets.Post("/", deps.Bucket.CreateBucket)

					buckets.Route("/{bucket_id}", func(bucket chi.Router) {
						bucket.Patch("/", deps.Bucket.UpdateBucketSettings)
						bucket.Delete("/", deps.Bucket.DeleteBucket)
						bucket.Post("/public", deps.Bucket.SetBucketPublic)
					})
				})

				// Storage credentials, in the shape an R2 user expects: a list,
				// a create that shows the secret once, a rotate that keeps the
				// access key id, and a revoke that leaves everything else alone.
				project.Route("/storage-credentials", func(credentials chi.Router) {
					credentials.Get("/", deps.Control.ListStorageCredentials)
					credentials.Post("/", deps.Control.CreateStorageCredential)

					credentials.Route("/{credential_id}", func(credential chi.Router) {
						credential.Use(CredentialContext)
						credential.Post("/rotate", deps.Control.RotateStorageCredential)
						credential.Delete("/", deps.Control.RevokeStorageCredential)
					})
				})

				// The dashboard's SQL routes. The handler does its own
				// ownership and status check rather than relying on a
				// middleware here, so a statement costs one lookup and the
				// handler stays safe if it is ever mounted elsewhere.
				project.Post("/query", deps.Control.Query)
				project.Post("/exec", deps.Control.Exec)

				// The dashboard's storage routes. These reuse the public
				// bucket handlers unchanged, mounted behind session ownership
				// instead of a project key, so the dashboard never needs a
				// credential of its own.
				project.Group(func(owner chi.Router) {
					owner.Use(RequireOwnedProject(deps.Projects))

					owner.Route("/bucket", func(bucket chi.Router) {
						bucket.Use(httpx.MaxBodyBytes(deps.MaxObjectBytes))
						bucket.Use(ObjectKeyContext)
						bucket.Post("/*", deps.Bucket.Upload)
						bucket.Get("/*", deps.Bucket.Download)
						bucket.Head("/*", deps.Bucket.Download)
						bucket.Patch("/*", deps.Bucket.Update)
						bucket.Delete("/*", deps.Bucket.Delete)
						bucket.Get("/", deps.Bucket.List)
					})
				})
			})
		})
	})

	// --- Public object delivery ---
	//
	// This is the URL a user pastes into their own site: no credential, no
	// session, no cookie. It serves only objects the owner published, and the
	// handler answers 404 for the rest, so a private object is indistinguishable
	// from one that does not exist.
	//
	// It is deliberately not under /bucket/, so nothing here can be reached by
	// accident through a path a client assembles for authenticated access.
	root.Route("/pub/{project_id}", func(publicPlane chi.Router) {
		publicPlane.Use(ProjectContext)
		publicPlane.Use(ObjectKeyContext)
		// Unauthenticated and cacheable, so it gets the address-keyed bucket
		// limit: a page with fifty objects loads from one address without
		// ceremony, and one address cannot pull the host down.
		publicPlane.Use(bucketLimited)
		publicPlane.Get("/*", deps.Bucket.PublicDownload)
		publicPlane.Head("/*", deps.Bucket.PublicDownload)
	})

	// --- Data plane: bucket catalog, on its own credential ---
	//
	// The catalog lives on a separate prefix from the object routes. Folding it
	// into /bucket/{id}/ as a reserved key would mean that key could never be used
	// for an object, which is a silent restriction on what a user can upload.
	root.Route("/buckets/{project_id}", func(catalog chi.Router) {
		catalog.Use(httpx.MaxBodyBytes(deps.MaxBodyBytes))
		catalog.Use(httpx.Timeout(deps.RequestTimeout))
		catalog.Use(ProjectContext)
		catalog.Use(auth.RequireStorageCredential(deps.StorageKeys, deps.ProjectKeys))
		catalog.Use(bucketLimited)

		catalog.Get("/", deps.Bucket.ListBuckets)
		catalog.Post("/", deps.Bucket.CreateBucket)

		catalog.Route("/{bucket_id}", func(bucket chi.Router) {
			bucket.Patch("/", deps.Bucket.UpdateBucketSettings)
			bucket.Delete("/", deps.Bucket.DeleteBucket)
			bucket.Post("/public", deps.Bucket.SetBucketPublic)
		})
	})

	// --- Data plane: project-scoped, for the developer's own application ---
	//
	// This is what MOOGO_PROJECT_URL points at. A client appends "/query" or
	// "/bucket/<key>" to it, instead of assembling "/db/<project_id>/..." itself,
	// so the internal route layout never has to be duplicated across every
	// project that talks to Moogo.
	//
	// The project id is still part of the URL: two projects share a deployment,
	// and a URL plus a key pair has to identify exactly one of them.
	root.Route("/p/{project_id}", func(projectPlane chi.Router) {
		projectPlane.Use(httpx.MaxBodyBytes(deps.MaxBodyBytes))
		projectPlane.Use(httpx.Timeout(deps.RequestTimeout))
		projectPlane.Use(ProjectContext)
		projectPlane.Use(auth.RequireProjectKey(deps.ProjectKeys))
		// After the key check, so the allowance belongs to whoever holds the
		// key: one project's traffic never spends another's budget, and an
		// unauthenticated probe is answered by RequireProjectKey first.
		projectPlane.Use(queryLimited)

		projectPlane.Post("/query", deps.Data.Query)
		projectPlane.Post("/exec", deps.Data.Exec)
		// The transaction endpoint is on the data plane only. The dashboard's
		// console runs one statement at a time by design -- a batch is an
		// application concept, not something the console has anywhere to put.
		projectPlane.Post("/transaction", deps.Data.Transaction)
		// /exec/txn is the same handler under the name a client guessed for it.
		// It is a write path that groups several writes, so it lives beside
		// /exec; keeping both means a client that probed for it reaches an
		// answer instead of a 404.
		projectPlane.Post("/exec/txn", deps.Data.Transaction)
	})

	// --- Data plane: object storage, on its own credential ---
	//
	// Storage does not accept the project's SQL secret key. The two guard
	// different things, and a key scoped to running SELECT should not be able
	// to overwrite every file, nor have rotating it break every application.
	root.Route("/p/{project_id}/bucket", func(bucketPlane chi.Router) {
		bucketPlane.Use(httpx.MaxBodyBytes(deps.MaxObjectBytes))
		bucketPlane.Use(httpx.Timeout(deps.RequestTimeout))
		bucketPlane.Use(ProjectContext)
		bucketPlane.Use(ObjectKeyContext)
		bucketPlane.Use(auth.RequireStorageCredential(deps.StorageKeys, deps.ProjectKeys))
		bucketPlane.Use(bucketLimited)

		bucketPlane.Post("/*", deps.Bucket.Upload)
		bucketPlane.Get("/*", deps.Bucket.Download)
		bucketPlane.Head("/*", deps.Bucket.Download)
		bucketPlane.Patch("/*", deps.Bucket.Update)
		bucketPlane.Delete("/*", deps.Bucket.Delete)
		bucketPlane.Get("/", deps.Bucket.List)
	})

	// --- Data plane: a project key, bearer token ---
	//
	// The /db and /bucket prefixes are the original surface. They keep working
	// so integrations written against them do not break; new clients should use
	// the project-scoped /p prefix above.

	root.Route("/db/{project_id}", func(dataPlane chi.Router) {
		dataPlane.Use(httpx.MaxBodyBytes(deps.MaxBodyBytes))
		dataPlane.Use(httpx.Timeout(deps.RequestTimeout))
		// ProjectContext runs before the key check: the key is verified against
		// the project id in the path, so the id has to be in the context first.
		dataPlane.Use(ProjectContext)
		dataPlane.Use(auth.RequireProjectKey(deps.ProjectKeys))
		// The same limiter as /p, so switching prefixes hands out no second
		// allowance.
		dataPlane.Use(queryLimited)

		dataPlane.Post("/query", deps.Data.Query)
		dataPlane.Post("/exec", deps.Data.Exec)
		dataPlane.Post("/transaction", deps.Data.Transaction)
		dataPlane.Post("/exec/txn", deps.Data.Transaction)
	})

	// --- Data plane: bucket (object storage) ---

	root.Route("/bucket/{project_id}", func(bucketPlane chi.Router) {
		bucketPlane.Use(httpx.MaxBodyBytes(deps.MaxObjectBytes))
		bucketPlane.Use(httpx.Timeout(deps.RequestTimeout))
		bucketPlane.Use(ProjectContext)
		bucketPlane.Use(ObjectKeyContext)
		bucketPlane.Use(auth.RequireProjectKey(deps.ProjectKeys))
		bucketPlane.Use(bucketLimited)

		bucketPlane.Post("/*", deps.Bucket.Upload)
		bucketPlane.Get("/*", deps.Bucket.Download)
		bucketPlane.Head("/*", deps.Bucket.Download)
		bucketPlane.Patch("/*", deps.Bucket.Update)
		bucketPlane.Delete("/*", deps.Bucket.Delete)
		bucketPlane.Get("/", deps.Bucket.List)
	})

	// --- Documentation API (public) ---
	//
	// The `/docs` page routes are client routes: they are served by the SPA
	// below so that a hard refresh on /docs/quickstart renders the same
	// styled page as an in-app navigation. Only the JSON/markdown endpoints
	// live here, and DocsHandler escapes everything it writes.
	if deps.Docs != nil {
		root.Get("/api/docs", deps.Docs.DocList)
		root.Head("/api/docs", deps.Docs.DocList)
		root.Get("/api/docs/*", deps.Docs.Doc)
		root.Head("/api/docs/*", deps.Docs.Doc)
	}

	// --- Changelog updates (public) ---
	//
	// Published titles from the news service, re-served on this origin so
	// the dashboard's update list stays a same-origin request and the news
	// service needs no CORS route of its own. Public because the posts are
	// public on news.<domain> anyway: the widget only renders for a
	// signed-in reader, but the data behind it is not account data. It is
	// not unmetered either: each call can wait up to three seconds on the
	// news service, so the route carries the updatesLimited ceiling above
	// rather than no limiter at all.
	if deps.Updates != nil {
		root.With(updatesLimited).Get("/api/updates", deps.Updates.Updates)
	}

	// --- Crawler endpoints ---
	//
	// The sitemap names every page a crawler should index and robots.txt
	// keeps it off the API and the dashboard, where a session cookie decides
	// what renders and a crawler sees nothing useful anyway.
	if deps.Meta != nil {
		root.Get("/sitemap.xml", deps.Meta.Sitemap)
		root.Get("/robots.txt", deps.Meta.Robots)
	}

	// --- Pages and static files ---

	registerPages(root, deps)

	return root
}

// ProjectContext copies the project id from the route into the request context.
//
// It is what the data plane middleware reads. Doing the copy here means the id
// is parsed and validated exactly once, and a malformed id is reported as a bad
// request before any key comparison happens.
func ProjectContext(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		raw := chi.URLParam(r, "project_id")

		projectID, err := uuid.Parse(raw)
		if err != nil {
			httpx.WriteError(w, http.StatusBadRequest, "invalid_project_id",
				"the project id is not a valid UUID")
			return
		}

		next.ServeHTTP(w, r.WithContext(
			context.WithValue(r.Context(), auth.ContextKeyProjectID, projectID.String())))
	})
}

// projectRateKey identifies a data plane caller by the project their
// credential grants access to, so the allowance follows the project rather
// than the address it arrived from.
//
// It runs after RequireProjectKey, so the id is always present on the routes
// it guards; "unknown" is a defensive fallback that gets its own shared
// bucket rather than panicking.
func projectRateKey(r *http.Request) string {
	projectID, ok := auth.ProjectIDFromContext(r.Context())
	if !ok {
		return "unknown"
	}
	return "project:" + projectID.String()
}

// CredentialContext copies a storage credential id from the route into the
// request context, and validates it as a UUID.
//
// It mirrors ProjectContext for the same reason: parsing lives in the router,
// so handlers never grow a dependency on the router's URL syntax.
func CredentialContext(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		raw := chi.URLParam(r, "credential_id")

		credentialID, err := uuid.Parse(raw)
		if err != nil {
			httpx.WriteError(w, http.StatusBadRequest, "invalid_credential_id",
				"the credential id is not a valid UUID")
			return
		}

		next.ServeHTTP(w, r.WithContext(
			context.WithValue(r.Context(), auth.ContextKeyCredentialID, credentialID.String())))
	})
}

// ObjectKeyContext copies the object key into the request context.
//
// It derives the key from the request path rather than reading chi's "*"
// route parameter. That parameter is not visible to a Use()-registered
// middleware, and With() does not help inside a Route() subrouter either; both
// were measured on chi v5 to hand this middleware an empty string. The symptom
// was uploads working while every download and delete failed with missing_key.
//
// Deriving it here means the router owns URL parsing in one place, and the
// bucket handlers stay identical across all three mounts they are served from:
// the project-scoped /p/{id}/bucket/..., the dashboard's
// /api/projects/{id}/bucket/..., and the legacy /bucket/{id}/...
//
// Everything up to and including the project id is the mount root, so the key is
// whatever follows it, minus a leading "/bucket/" when that segment is present.
func ObjectKeyContext(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		projectID, found := auth.ProjectIDFromContext(r.Context())
		if !found {
			next.ServeHTTP(w, r)
			return
		}

		_, rest, afterMarker := strings.Cut(r.URL.Path, "/"+projectID.String())
		if !afterMarker {
			next.ServeHTTP(w, r)
			return
		}

		remainder := strings.TrimPrefix(rest, "/")
		remainder = strings.TrimPrefix(remainder, "bucket/")

		// The listing route stops at the bucket itself and has no object key.
		// Handing the handler the literal string "bucket" here would turn a
		// listing into a lookup for an object named "bucket".
		if remainder == "" || remainder == "bucket" || remainder == rest {
			next.ServeHTTP(w, r)
			return
		}

		next.ServeHTTP(w, r.WithContext(
			context.WithValue(r.Context(), auth.ContextKeyObjectKey, remainder)))
	})
}

// RequireOwnedProject authorizes a dashboard request against the project in the
// path, by session rather than by project key.
//
// It replaces RequireProjectKey for the dashboard's own routes. The signed-in
// user is the owner, so asking them for a bearer token would only prove they had
// once seen a secret. A project belonging to somebody else answers 404, exactly
// as the control plane does, so an id cannot be probed for existence.
//
// It also applies the same paused and not-ready refusals as the data plane, so
// pausing a project actually stops the dashboard too.
func RequireOwnedProject(store ProjectAuthorizer) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			userID, ok := auth.UserIDFromContext(r.Context())
			if !ok {
				httpx.WriteError(w, http.StatusUnauthorized, "unauthorized", "sign in required")
				return
			}

			projectID, ok := auth.ProjectIDFromContext(r.Context())
			if !ok {
				httpx.WriteError(w, http.StatusBadRequest, "invalid_project_id",
					"the project id is missing or malformed")
				return
			}

			project, err := store.ProjectOwnedBy(r.Context(), projectID, userID)
			if err != nil {
				if errors.Is(err, dbcontrol.ErrProjectNotOwned) ||
					errors.Is(err, dbcontrol.ErrNotFound) {
					httpx.WriteError(w, http.StatusNotFound, "project_not_found", "no such project")
					return
				}
				httpx.WriteError(w, http.StatusInternalServerError, "internal_error",
					"the request could not be completed")
				return
			}

			if project.Paused() {
				httpx.WriteError(w, http.StatusForbidden, "project_paused", "project is paused")
				return
			}
			if !project.Ready() {
				httpx.WriteError(w, http.StatusForbidden, "project_not_ready",
					"project is not ready yet")
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

// SecurityHeaders sets the headers that apply to every response.
func SecurityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		header := w.Header()

		// The API sends JSON and serves nothing else, so nothing needs to be
		// sniffed into a different type.
		header.Set("X-Content-Type-Options", "nosniff")
		header.Set("X-Frame-Options", "DENY")
		header.Set("Referrer-Policy", "strict-origin-when-cross-origin")

		// HSTS only over HTTPS -- either the socket this process holds, or the
		// scheme the proxy in front of it reports. A plain r.TLS check would
		// never fire in production, where nginx terminates TLS and this app
		// always sees cleartext, and nginx sets X-Forwarded-Proto from $scheme,
		// overwriting anything a client sends. On plain HTTP in local
		// development neither signal is present, so a browser never remembers
		// the header and refuses to reach localhost afterwards; a spoofed
		// X-Forwarded-Proto over plain http buys nothing either, because a
		// browser ignores HSTS arriving on a non-secure origin.
		if r.TLS != nil || r.Header.Get("X-Forwarded-Proto") == "https" {
			header.Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
		}

		// The dashboard loads its own scripts and styles and calls this API
		// from the same origin, so nothing outside the origin is needed.
		header.Set("Content-Security-Policy", strings.Join([]string{
			"default-src 'self'",
			"script-src 'self'",
			"style-src 'self' 'unsafe-inline'",
			"img-src 'self' data: https:",
			"connect-src 'self'",
			"font-src 'self'",
			"object-src 'none'",
			"base-uri 'none'",
			"form-action 'self'",
			"frame-ancestors 'none'",
		}, "; "))

		next.ServeHTTP(w, r)
	})
}

// NoCacheForAPI stops intermediaries from caching API responses.
//
// The dashboard shows secret material on project create and rotate, and a
// cached response body would hand that to whoever asks next. The data planes
// are included for the same reason: they carry bearer-key responses for one
// tenant, which an intermediary must never reuse for another.
func NoCacheForAPI(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.URL.Path, "/api/") ||
			strings.HasPrefix(r.URL.Path, "/p/") ||
			strings.HasPrefix(r.URL.Path, "/db/") ||
			strings.HasPrefix(r.URL.Path, "/bucket/") ||
			strings.HasPrefix(r.URL.Path, "/auth/") {
			w.Header().Set("Cache-Control", "no-store")
		}
		next.ServeHTTP(w, r)
	})
}

// hashedAssetPattern matches the names a content-hashed build produces
// (index-4YjdGg86.js): a dash, the hash, a JavaScript or stylesheet
// extension. A changed build ships under a different name, which is what
// makes the name a promise about the bytes behind it.
var hashedAssetPattern = regexp.MustCompile(`-[A-Za-z0-9_-]{8,}\.(?:js|css)$`)

// withStaticCache sets the caching rules those filenames promise.
//
// A hashed asset is immutable for a year: the file that changes comes back
// under a new name, so a cached copy can never be the wrong code, and the
// shell that names it must not be cached — which is why the shell is served
// by spa() on the page routes rather than from /static/, and this handler
// never sees it. Everything else under /static/ is revalidated, so a
// replaced logo or favicon is picked up on the next use instead of waiting
// out a cache.
//
// One header, set here, before the file server runs: nothing else in the
// stack adds Cache-Control for these paths on the origin, and nginx only
// adds one for text/html.
func withStaticCache(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if hashedAssetPattern.MatchString(r.URL.Path) {
			w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
		} else {
			w.Header().Set("Cache-Control", "no-cache")
		}
		next.ServeHTTP(w, r)
	})
}

// registerPages serves the single-page frontend and its static assets.
//
// The frontend is a React app, so every page route returns the same index.html
// and the client router decides what to render. The API groups are registered
// elsewhere and win over the catch-all page routes because chi matches the more
// specific pattern first.
func registerPages(root chi.Router, deps Deps) {
	if deps.StaticFS != nil {
		root.Handle("/static/*", withStaticCache(http.StripPrefix("/static/", http.FileServer(deps.StaticFS))))
	}

	index := deps.spa()
	root.Get("/", index)
	root.Get("/login", index)
	root.Get("/register", index)
	root.Get("/forgot-password", index)
	root.Get("/reset-password", index)
	root.Get("/verify-email", index)
	root.Get("/plan", index)
	root.Get("/announcement", index)
	// The typo is a real published URL: links to it exist, so it answers with
	// a permanent redirect instead of rendering the page a second time. Two
	// URLs serving identical content would make the canonical tag ambiguous —
	// one of them has to lose, and a redirect keeps the old links working
	// while handing every share to /announcement.
	root.Get("/annoucement", func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, "/announcement", http.StatusMovedPermanently)
	})
	// The site's content pages, served like every other client route: a hard
	// refresh on any of them has to render the page rather than fall through
	// to the API's 404, and a crawler following a footer link has to get HTML.
	root.Get("/about", index)
	root.Get("/contact", index)
	root.Get("/terms", index)
	root.Get("/privacy", index)
	root.Get("/app", index)
	root.Get("/app/*", index)

	// Docs is a client route like the rest. Without these two registrations
	// a hard refresh on /docs/quickstart fell through to NotFound, or to the
	// markdown handler, which renders a bare page with no sidebar, no search
	// and none of the site's styling.
	root.Get("/docs", index)
	root.Get("/docs/*", index)
}

// spa returns a handler that serves the built index.html for any page route.
//
// The file is read from the embedded filesystem on every request rather than
// cached at startup. That costs a read from memory, and it means a rebuilt
// binary with changed markup never serves a page assembled from an older build.
func (deps Deps) spa() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if deps.IndexFS == nil {
			httpx.WriteError(w, http.StatusServiceUnavailable, "frontend_unavailable",
				"the frontend has not been built into this binary")
			return
		}

		contents, err := fs.ReadFile(deps.IndexFS, "index.html")
		if err != nil {
			// A missing index at this point is a build mistake, not a client
			// one: the binary was assembled without running the frontend build.
			deps.Log.Error("index.html missing from embedded frontend", logger.Fields{
				"error": err.Error(),
			})
			httpx.WriteError(w, http.StatusInternalServerError, "frontend_missing",
				"the frontend is not available")
			return
		}

		// One shell serves every path, so a canonical URL cannot live in
		// index.html — it would claim every page is the same page. Compose it
		// here instead: the public origin plus the path of this request, with
		// the query string dropped, so /plan?ref=x canonicalizes to /plan.
		// The tag is a hint rather than a directive, and only crawlers that
		// follow it ever see it, so the per-request string work costs nothing
		// a page load would notice.
		if deps.PublicURL != "" {
			canonical := html.EscapeString(deps.PublicURL + r.URL.Path)
			contents = bytes.Replace(contents,
				[]byte("</head>"),
				[]byte(`<link rel="canonical" href="`+canonical+`" />`+"\n  </head>"),
				1)
		}

		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write(contents)
	}
}
