import { Navigate, Route, Routes, Link } from "react-router-dom";
import ThemeToggle from "./components/ThemeToggle";
import Editor from "./pages/Editor";
import Home from "./pages/Home";
import Login from "./pages/Login";
import PostPage from "./pages/Post";

// The same logo files the homepage uses, switching with the theme.
const LOGO_LIGHT = "https://raw.githubusercontent.com/moogodev/moogo-img/refs/heads/main/1.png";
const LOGO_DARK = "https://raw.githubusercontent.com/moogodev/moogo-img/refs/heads/main/2.png";

// One shell for every page: a header that offers the logo back to the index,
// the dark/light toggle, and a small footer that says what this site is.
export default function App() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-line">
        <div className="mx-auto flex w-full max-w-[960px] items-center justify-between gap-4 px-6 py-4">
          <Link to="/" className="flex min-w-0 items-center gap-3">
            <span className="brand-logo-light">
              <img src={LOGO_LIGHT} alt="Moogo" className="h-[26px] w-auto" />
            </span>
            <span className="brand-logo-dark">
              <img src={LOGO_DARK} alt="Moogo" className="h-[26px] w-auto" />
            </span>
            <span className="text-[0.92rem] text-muted">What&apos;s new</span>
          </Link>
          <div className="flex items-center gap-4">
            <a
              href="https://moogo.dev"
              className="hidden text-[0.82rem] text-accent hover:underline sm:block"
            >
              moogo.dev
            </a>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/editor" element={<Editor />} />
        {/* The mini-blog detail page: news.moogo.dev/<slug>. Static routes
            rank above it, so /login and /editor keep their own pages. */}
        <Route path="/:slug" element={<PostPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <footer className="mt-16 border-t border-line">
        <div className="mx-auto flex w-full max-w-[960px] flex-wrap items-center justify-between gap-x-6 gap-y-2 px-6 py-5 text-[0.78rem] text-faint">
          <span>© 2026 Moogo · Under active development, not ready for production.</span>
          <span className="flex items-center gap-4">
            <a href="https://github.com/moogodev/moogodev" className="hover:text-muted">
              GitHub
            </a>
            <a href="https://moogo.dev/docs" className="hover:text-muted">
              Docs
            </a>
            <a href="https://moogo.dev" className="hover:text-muted">
              Homepage
            </a>
          </span>
        </div>
      </footer>
    </div>
  );
}
