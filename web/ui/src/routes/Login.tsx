import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { HomeLink } from "../components/HomeLink";
import { GoogleSignInButton } from "../components/GoogleSignInButton";
import { SiteLayout } from "../components/Layout";
import { PasswordInput } from "../components/PasswordInput";
import { api, ApiError } from "../lib/api";
import { useSession } from "../lib/session";

// Only known reasons are shown. Echoing an arbitrary query parameter back into
// the page would be a reflected content injection, even as text.
const reasons: Record<string, string> = {
  denied: "Google sign-in was cancelled. Nothing was changed.",
  invalid_request: "Google sent an incomplete response. Please try again.",
  failed: "Sign-in could not be completed. Please try again.",
};

export default function Login() {
  const [params] = useSearchParams();
  // The same probe the site header uses, so the two cannot disagree about who
  // is signed in. It also carries whether Google is configured, which is why
  // this page no longer asks on its own.
  const session = useSession();
  const checking = session.status === "loading";
  const probeFailed = session.status === "unknown";
  const oauthConfigured = session.oauthConfigured;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Set when the password was right but the address has not been confirmed.
  // The form is replaced by a prompt to resend, because retrying the same
  // password cannot succeed and leaving the form up invites exactly that.
  const [needsVerification, setNeedsVerification] = useState(false);
  const [resent, setResent] = useState(false);

  const reason = params.get("error");
  const message = reason ? (reasons[reason] ?? reasons.failed) : null;
  const notice = needsVerification
    ? null
    : (message ??
      error ??
      (probeFailed
        ? "Cannot reach the server. Check that it is running, then try again."
        : null));

  // Someone who is already signed in has no business on this page. The redirect
  // is a full page load rather than client-side navigation so that the header,
  // which read the session before the sign-in, cannot keep showing the signed
  // out version.
  useEffect(() => {
    if (session.status === "authenticated") {
      window.location.assign("/app");
    }
  }, [session.status]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.login(email.trim(), password);
      window.location.assign("/app");
    } catch (cause) {
      // The password was accepted; only the address is unconfirmed. This is a
      // state to recover from, not a credentials failure, so it gets its own
      // screen rather than an error line above the same form.
      if (cause instanceof ApiError && cause.code === "email_not_verified") {
        setNeedsVerification(true);
        return;
      }
      setError(cause instanceof ApiError ? cause.message : "Could not sign in. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    setResent(true);
    try {
      await api.resendVerification(email.trim());
    } catch {
      // The endpoint answers the same way for every address, so there is no
      // failure to report here beyond the network itself.
    } finally {
      setResent(false);
    }
  }

  if (checking) {
    return (
      <SiteLayout>
        <section className="py-16 sm:py-20">
          <div className="mx-auto w-full max-w-[720px] px-6 text-center">
            <div className="inline-flex items-center justify-center gap-2 text-muted">
              <Spinner />
              <span>Checking session…</span>
            </div>
          </div>
        </section>
      </SiteLayout>
    );
  }

  return (
    <SiteLayout>
      <section className="py-16 sm:py-20">
        <div className="mx-auto w-full max-w-[440px] px-6">
          <div className="surface rounded-2xl p-6 sm:p-8">
          <h1 className="mb-2 text-[clamp(1.6rem,3vw,2rem)] font-semibold tracking-tight">
            {needsVerification ? "Confirm your email" : "Sign in"}
          </h1>
          <p className="mb-6 text-muted">
            {needsVerification
              ? "Your password was right, but this address has not been confirmed yet."
              : "Use Google, or sign in with your email and password."}
          </p>

          {needsVerification && (
            <div className="rounded-lg border border-amber/40 bg-amber/10 px-4 py-3 text-[0.92rem] text-amber">
              We sent a confirmation link to{" "}
              <strong>{email.trim()}</strong>. Follow it and you can sign in.
            </div>
          )}

          {notice && (
            <div
              role="alert"
              className="mb-5 rounded-lg border border-amber/40 bg-amber/10 px-4 py-3 text-[0.92rem] text-amber"
            >
              {notice}
            </div>
          )}

          {!needsVerification && (
            <>
              <GoogleSignInButton configured={oauthConfigured} />

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-edge" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-background px-2 text-faint">or</span>
                </div>
              </div>
            </>
          )}

          {needsVerification ? (
            <div className="mt-6 space-y-4">
              <button
                type="button"
                onClick={resend}
                disabled={resent}
                className="inline-flex w-full items-center justify-center rounded-lg bg-accent-strong px-5 py-3 font-semibold text-accent-ink transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
              >
                {resent ? "Sending…" : "Send a new link"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setNeedsVerification(false);
                  setError(null);
                }}
                className="inline-flex w-full cursor-pointer items-center justify-center rounded-lg border border-edge-strong px-5 py-3 font-semibold transition-colors hover:border-hover-edge hover:bg-hover-bg"
              >
                Use a different account
              </button>
            </div>
          ) : (
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-sm font-medium text-muted"
              >
                Email
              </label>
              <input
                type="email"
                id="email"
                name="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-lg border border-edge bg-background px-4 py-2.5 text-foreground placeholder:text-faint focus:border-accent-strong focus:outline-none focus:ring-2 focus:ring-accent/20"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label htmlFor="password" className="text-sm font-medium text-muted">
                  Password
                </label>
                <Link
                  to="/forgot-password"
                  className="text-[0.82rem] text-accent hover:text-accent-strong"
                >
                  Forgot password?
                </Link>
              </div>
              <PasswordInput
                id="password"
                name="password"
                autoComplete="current-password"
                value={password}
                onChange={setPassword}
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="inline-flex w-full items-center justify-center rounded-lg bg-accent-strong px-5 py-3 font-semibold text-accent-ink transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </form>
          )}

          <p className="mt-6 text-center text-[0.9rem] text-muted">
            Don&apos;t have an account?{" "}
            <Link to="/register" className="text-accent hover:text-accent-strong">
              Create one
            </Link>
          </p>
          </div>

          <p className="mt-6 text-center">
            <HomeLink className="text-[0.9rem] text-faint hover:text-foreground">
              ← Back to the landing page
            </HomeLink>
          </p>
        </div>
      </section>
    </SiteLayout>
  );
}

function Spinner() {
  return (
    <svg
      className="animate-spin h-6 w-6 text-accent-strong"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}


