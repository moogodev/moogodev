import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { HomeLink } from "../components/HomeLink";
import { SiteLayout } from "../components/Layout";
import { api, ApiError } from "../lib/api";

type State = "checking" | "done" | "failed";

// The page is reached from a link in an email, so the token arrives in the query
// string. It is posted to the server immediately and never rendered, which keeps
// it out of the visible page; the alternative of leaving it in the address bar
// puts a working credential in browser history and in the Referer of any link
// followed afterwards.
export default function VerifyEmail() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";

  // The missing-token case is resolved during the initial render rather than in
  // the effect. It needs no network call, and setting it up front means the
  // page never renders a spinner for a link that was never going to work.
  const [state, setState] = useState<State>(() => (token ? "checking" : "failed"));
  const [message, setMessage] = useState<string | null>(() =>
    token ? null : "This link is missing its confirmation code. Request a new one.",
  );
  const [email, setEmail] = useState("");
  const [resent, setResent] = useState(false);

  // Guards against a second submission. React runs effects twice in development,
  // and consuming a single-use token twice would report the second attempt as an
  // expired link -- correct, but a confusing thing to show with StrictMode on.
  const submitted = useRef(false);

  useEffect(() => {
    if (!token || submitted.current) return;
    submitted.current = true;

    let cancelled = false;
    api
      .verifyEmail(token)
      .then((result) => {
        if (cancelled) return;
        setState("done");
        setMessage(result.message);
      })
      .catch((cause) => {
        if (cancelled) return;
        setState("failed");
        setMessage(
          cause instanceof ApiError
            ? cause.message
            : "Could not confirm the address. Try again, or request a new link.",
        );
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  // The token is dropped from the URL once it has been exchanged, so a refresh
  // does not re-post it and a copied address bar does not carry a spent
  // credential.
  useEffect(() => {
    if (state === "checking") return;
    window.history.replaceState(null, "", "/verify-email");
  }, [state]);

  async function resend(event: FormEvent) {
    event.preventDefault();
    if (!email.trim()) return;
    setResent(true);
    try {
      await api.resendVerification(email.trim());
      // The endpoint answers the same way for every address, so the message is
      // the confirmation rather than proof that this particular one exists.
      setMessage("If that account needs confirming, a new link is on its way.");
    } catch {
      setMessage("Could not send a new link. Try again in a moment.");
    } finally {
      setResent(false);
    }
  }

  return (
    <SiteLayout>
      <section className="py-16 sm:py-20">
        <div className="mx-auto w-full max-w-[440px] px-6">
          <div className="surface rounded-2xl p-6 sm:p-8">
            {state === "checking" ? (
              <>
                <h1 className="mb-2 text-[clamp(1.6rem,3vw,2rem)] font-semibold tracking-tight">
                  Confirming your email
                </h1>
                <div className="mt-5 inline-flex items-center gap-2 text-muted">
                  <Spinner />
                  <span>One moment…</span>
                </div>
              </>
            ) : state === "done" ? (
              <>
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-accent-strong/12">
                  <svg
                    viewBox="0 0 20 20"
                    aria-hidden="true"
                    className="h-5 w-5 stroke-accent-strong"
                    fill="none"
                    strokeWidth="2.2"
                  >
                    <path
                      d="m4 10.5 4 4 8-9"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <h1 className="mb-2 text-[clamp(1.6rem,3vw,2rem)] font-semibold tracking-tight">
                  Email confirmed
                </h1>
                <p className="mb-6 text-muted">
                  {message ?? "Your address is confirmed."}
                </p>
                <Link
                  to="/login"
                  className="inline-flex w-full items-center justify-center rounded-lg bg-accent-strong px-5 py-3 font-semibold text-accent-ink transition-colors hover:bg-accent"
                >
                  Sign in
                </Link>
              </>
            ) : (
              <>
                <h1 className="mb-2 text-[clamp(1.6rem,3vw,2rem)] font-semibold tracking-tight">
                  This link did not work
                </h1>
                <p className="mb-6 text-muted">
                  {message ?? "The confirmation link is invalid or has expired."}
                </p>

                <form onSubmit={resend} className="space-y-4">
                  <div>
                    <label
                      htmlFor="resend-email"
                      className="mb-1.5 block text-sm font-medium text-muted"
                    >
                      Email address
                    </label>
                    <input
                      type="email"
                      id="resend-email"
                      name="resend-email"
                      autoComplete="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="you@example.com"
                      className="w-full rounded-lg border border-edge bg-background px-4 py-2.5 text-foreground placeholder:text-faint focus:border-accent-strong focus:outline-none focus:ring-2 focus:ring-accent/20"
                    />
                    <p className="mt-2 text-[0.85rem] text-faint">
                      We will send a fresh link to the address on the account.
                    </p>
                  </div>
                  <button
                    type="submit"
                    disabled={resent || !email.trim()}
                    className="inline-flex w-full items-center justify-center rounded-lg bg-accent-strong px-5 py-3 font-semibold text-accent-ink transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {resent ? "Sending…" : "Send a new link"}
                  </button>
                </form>

                <p className="mt-6 text-center text-[0.9rem] text-muted">
                  Already confirmed?{" "}
                  <Link to="/login" className="text-accent hover:text-accent-strong">
                    Sign in
                  </Link>
                </p>
              </>
            )}
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
      className="h-4 w-4 animate-spin text-accent-strong"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}