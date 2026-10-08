package news

import (
	"crypto/subtle"
	"errors"
	"io/fs"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/go-chi/chi/v5"
	"golang.org/x/crypto/bcrypt"

	"github.com/moogodev/moogodev/internal/ratelimit"
	"github.com/moogodev/moogodev/pkg/httpx"
	"github.com/moogodev/moogodev/pkg/logger"
)

// slugPattern is the URL form of a post: lowercase words joined by single
// dashes. It is checked rather than generated so the editor controls the URL
// and a typo cannot produce one that SQLite would accept but nginx would
// normalise differently.
var slugPattern = regexp.MustCompile(`^[a-z0-9]+(?:-[a-z0-9]+)*$`)

// Server is the HTTP surface: the public changelog API, the admin API, and
// the embedded frontend.
type Server struct {
	cfg      Config
	store    *Store
	sessions *Sessions
	static   fs.FS
}

// NewServer builds the handler. static is the built frontend; it may be nil
// when the checkout has never run the frontend build, in which case the API
// still serves and the pages answer 404.
func NewServer(cfg Config, store *Store, static fs.FS) http.Handler {
	sessions, err := NewSessions(cfg.SessionSecret, cfg.CookieSecure)
	if err != nil {
		// Config validated the secret already; this can only be a programming
		// error, and failing loudly at construction beats failing per request.
		panic("news: session signer: " + err.Error())
	}
	server := &Server{cfg: cfg, store: store, sessions: sessions, static: static}

	log := logger.New(cfg.Environment)

	// Ten attempts a minute, the same budget the main app gives its sign-in
	// routes: above what a person fumbling a password needs, below what a
	// guessing loop wants.
	loginLimiter := ratelimit.New(
		ratelimit.Config{Limit: 10, Window: time.Minute},
		cfg.TrustedProxies,
	)

	mux := chi.NewRouter()
	mux.Use(httpx.RequestID(log))
	mux.Use(httpx.Recoverer(log))
	mux.Use(httpx.AccessLog(log))
	mux.Use(httpx.RealIP(cfg.TrustedProxies))
	mux.Use(securityHeaders)

	mux.Get("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		httpx.WriteJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})

	mux.Route("/api", func(api chi.Router) {
		api.Use(httpx.MaxBodyBytes(1 << 20))

		api.Get("/posts", server.listPublished)
		api.Post("/login", loginLimiter.Middleware(http.HandlerFunc(server.login)).ServeHTTP)
		api.Post("/logout", server.logout)
		api.Get("/me", server.me)

		api.Route("/admin", func(admin chi.Router) {
			admin.Use(server.requireSession)
			admin.Get("/posts", server.listAll)
			admin.Post("/posts", server.createPost)
			admin.Put("/posts/{id}", server.updatePost)
			admin.Delete("/posts/{id}", server.deletePost)
		})
	})

	mux.NotFound(server.serveStatic)
	return mux
}

// --- handlers ---------------------------------------------------------------

func (server *Server) listPublished(w http.ResponseWriter, r *http.Request) {
	posts, err := server.store.ListPublished(r.Context())
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "internal", "could not read posts")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"posts": posts})
}

func (server *Server) listAll(w http.ResponseWriter, r *http.Request) {
	posts, err := server.store.ListAll(r.Context())
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "internal", "could not read posts")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"posts": posts})
}

type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

func (server *Server) login(w http.ResponseWriter, r *http.Request) {
	var req loginRequest
	if !httpx.ReadJSON(w, r, &req) {
		return
	}

	// Both checks always run: comparing email and password in two different
	// places would leak which half was wrong from timing alone.
	emailOK := subtle.ConstantTimeCompare(
		[]byte(strings.ToLower(strings.TrimSpace(req.Email))),
		[]byte(server.cfg.AdminEmail),
	) == 1
	passwordOK := bcrypt.CompareHashAndPassword(
		[]byte(server.cfg.AdminPasswordHash),
		[]byte(req.Password),
	) == nil

	if !emailOK || !passwordOK {
		httpx.WriteError(w, http.StatusUnauthorized, "invalid_credentials", "email or password is wrong")
		return
	}

	if err := server.sessions.Issue(w, server.cfg.AdminEmail); err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "internal", "could not start a session")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]string{"email": server.cfg.AdminEmail})
}

func (server *Server) logout(w http.ResponseWriter, _ *http.Request) {
	server.sessions.Clear(w)
	httpx.NoContent(w)
}

func (server *Server) me(w http.ResponseWriter, r *http.Request) {
	claims, err := server.sessions.Claims(r)
	if err != nil {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthorized", "not signed in")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]string{"email": claims.Email})
}

// requireSession gates every /api/admin route. The static file fallback never
// reaches it: an editor page without a valid cookie renders, but its API calls
// answer 401 and the app sends the browser to /login.
func (server *Server) requireSession(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if _, err := server.sessions.Claims(r); err != nil {
			httpx.WriteError(w, http.StatusUnauthorized, "unauthorized", "sign in required")
			return
		}
		next.ServeHTTP(w, r)
	})
}

type postRequest struct {
	Slug      string `json:"slug"`
	Title     string `json:"title"`
	Body      string `json:"body"`
	Published bool   `json:"published"`
}

func (req postRequest) validate() string {
	slug := strings.TrimSpace(req.Slug)
	title := strings.TrimSpace(req.Title)
	switch {
	case !slugPattern.MatchString(slug) || utf8.RuneCountInString(slug) > 80:
		return "slug must be lowercase words joined by dashes (a-z, 0-9, -), at most 80 characters"
	case title == "":
		return "title is required"
	case utf8.RuneCountInString(title) > 200:
		return "title must be at most 200 characters"
	case len(req.Body) > 200_000:
		return "body must be at most 200 KB"
	case !utf8.ValidString(req.Body):
		return "body must be valid UTF-8"
	}
	return ""
}

func (server *Server) createPost(w http.ResponseWriter, r *http.Request) {
	var req postRequest
	if !httpx.ReadJSON(w, r, &req) {
		return
	}
	if problem := req.validate(); problem != "" {
		httpx.WriteError(w, http.StatusBadRequest, "invalid_input", problem)
		return
	}
	post, err := server.store.Create(r.Context(), strings.TrimSpace(req.Slug), strings.TrimSpace(req.Title), req.Body, req.Published)
	if err != nil {
		httpx.WriteError(w, http.StatusConflict, "slug_taken", "that slug already exists")
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, map[string]any{"post": post})
}

func (server *Server) updatePost(w http.ResponseWriter, r *http.Request) {
	id, ok := postID(w, r)
	if !ok {
		return
	}
	var req postRequest
	if !httpx.ReadJSON(w, r, &req) {
		return
	}
	if problem := req.validate(); problem != "" {
		httpx.WriteError(w, http.StatusBadRequest, "invalid_input", problem)
		return
	}
	post, err := server.store.Update(r.Context(), id, strings.TrimSpace(req.Slug), strings.TrimSpace(req.Title), req.Body, req.Published)
	if errors.Is(err, ErrNotFound) {
		httpx.WriteError(w, http.StatusNotFound, "not_found", "no post with that id")
		return
	}
	if err != nil {
		httpx.WriteError(w, http.StatusConflict, "slug_taken", "that slug already exists")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"post": post})
}

func (server *Server) deletePost(w http.ResponseWriter, r *http.Request) {
	id, ok := postID(w, r)
	if !ok {
		return
	}
	if err := server.store.Delete(r.Context(), id); errors.Is(err, ErrNotFound) {
		httpx.WriteError(w, http.StatusNotFound, "not_found", "no post with that id")
		return
	} else if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "internal", "could not delete the post")
		return
	}
	httpx.NoContent(w)
}

func postID(w http.ResponseWriter, r *http.Request) (int64, bool) {
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil || id < 1 {
		httpx.WriteError(w, http.StatusBadRequest, "invalid_input", "id must be a number")
		return 0, false
	}
	return id, true
}

// --- static frontend --------------------------------------------------------

// serveStatic answers every non-API path with the built frontend, falling back
// to index.html so a deep link like /editor loads the app instead of 404ing.
func (server *Server) serveStatic(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet && r.Method != http.MethodHead {
		httpx.WriteError(w, http.StatusMethodNotAllowed, "method_not_allowed", "that method is not supported here")
		return
	}
	if server.static == nil {
		httpx.WriteError(w, http.StatusNotFound, "not_found", "the frontend has not been built")
		return
	}

	path := strings.TrimPrefix(r.URL.Path, "/")
	if path == "" {
		path = "index.html"
	}
	if info, err := fs.Stat(server.static, path); err == nil && !info.IsDir() {
		http.ServeFileFS(w, r, server.static, path)
		return
	}
	// Anything the filesystem does not have is a client-side route.
	http.ServeFileFS(w, r, server.static, "index.html")
}

// securityHeaders is one place for the headers the pages need. CSP first:
// the app ships no inline scripts, so 'self' for scripts costs nothing and
// rules out injected markup running even if a sanitizer were bypassed.
func securityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Referrer-Policy", "same-origin")
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("Content-Security-Policy",
			"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: https:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'")
		next.ServeHTTP(w, r)
	})
}
