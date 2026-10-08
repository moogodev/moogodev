import { Navigate, Route, Routes, Link } from "react-router-dom";
import Editor from "./pages/Editor";
import Home from "./pages/Home";
import Login from "./pages/Login";

// One shell for every page: a header that always offers a way back to the
// product, and a footer that says what this site is.
export default function App() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-line">
        <div className="mx-auto flex w-full max-w-[720px] items-center justify-between px-6 py-4">
          <Link to="/" className="text-[0.95rem] font-semibold tracking-tight">
            Moogo <span className="font-normal text-muted">What&apos;s new</span>
          </Link>
          <a
            href="https://moogo.dev"
            className="text-[0.82rem] text-accent hover:underline"
          >
            moogo.dev
          </a>
        </div>
      </header>

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/editor" element={<Editor />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <footer className="mt-16 border-t border-line">
        <div className="mx-auto flex w-full max-w-[720px] flex-wrap items-center justify-between gap-2 px-6 py-5 text-[0.78rem] text-faint">
          <span>Moogo is under active development. Not ready for production.</span>
          <span>
            <a href="https://github.com/moogodev/moogodev" className="hover:text-muted">
              GitHub
            </a>{" "}
            ·{" "}
            <a href="https://moogo.dev/docs" className="hover:text-muted">
              Docs
            </a>
          </span>
        </div>
      </footer>
    </div>
  );
}
