import { useEffect, useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { api, ApiError } from "../lib/api";

// The only sign-in page there is: one admin, no sign-up, no reset. A wrong
// password and a wrong email answer the same error, so the form never tells
// a caller which half was off.
export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .me()
      .then(() => {
        if (!cancelled) setSignedIn(true);
      })
      .catch(() => {
        if (!cancelled) setSignedIn(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.login(email, password);
      navigate("/editor", { replace: true });
    } catch (cause) {
      const message =
        cause instanceof ApiError
          ? cause.code === "rate_limited"
            ? "Too many attempts. Wait a moment and try again."
            : cause.message
          : "Could not reach the server.";
      setError(message);
      setBusy(false);
    }
  }

  if (signedIn === true) {
    return <Navigate to="/editor" replace />;
  }

  return (
    <main className="mx-auto w-full max-w-[420px] px-6 py-14">
      <h1 className="text-[1.4rem] font-semibold tracking-tight">Sign in</h1>
      <p className="mt-1 text-[0.86rem] text-muted">Editor access to the changelog.</p>

      {error && (
        <div role="alert" className="mt-4 rounded-lg border border-line bg-card px-4 py-3 text-[0.86rem] text-warn">
          {error}
        </div>
      )}

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <label className="block">
          <span className="text-[0.78rem] font-semibold uppercase tracking-wider text-faint">Email</span>
          <input
            type="email"
            required
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-1 w-full rounded-lg border border-line bg-card px-3 py-2 text-[0.9rem] focus:border-accent focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="text-[0.78rem] font-semibold uppercase tracking-wider text-faint">Password</span>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-1 w-full rounded-lg border border-line bg-card px-3 py-2 text-[0.9rem] focus:border-accent focus:outline-none"
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="w-full cursor-pointer rounded-lg bg-accent px-4 py-2.5 text-[0.9rem] font-semibold text-accent-ink transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}
