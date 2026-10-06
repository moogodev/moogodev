import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { HomeLink } from "../components/HomeLink";
import { GoogleSignInButton } from "../components/GoogleSignInButton";
import { SiteLayout } from "../components/Layout";
import { PasswordInput } from "../components/PasswordInput";
import { api, ApiError } from "../lib/api";
import { useSession } from "../lib/session";

export default function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The shared session probe, same as the header and the login page use. It
  // carries whether Google is configured, so there is no second request here.
  const session = useSession();
  // False until the server says Google is ready, so a failed probe does not
  // leave a button on screen that cannot work.
  const oauthConfigured = session.oauthConfigured;

  // Set once the account exists and the confirmation link has gone out. The
  // form is replaced rather than disabled: there is nothing left to type, and a
  // filled-in form invites a second submission against an address that is now
  // taken.
  const [sentTo, setSentTo] = useState<string | null>(null);

  // An account that already exists has no use for this page. Redirecting matches
  // the login page, and the full page load is what stops the header from
  // keeping its signed-out button after the redirect.
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
    if (password.length < 8) {
      setError("The password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("The passwords do not match.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      // No session comes back. The account exists but cannot sign in until the
      // link in the inbox is followed.
      const result = await api.register(email.trim(), name.trim(), password);
      setSentTo(result.email);
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : "Could not create the account. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (sentTo) {
    return (
      <SiteLayout>
        <section className="py-16 sm:py-20">
          <div className="mx-auto w-full max-w-[440px] px-6">
            <div className="surface rounded-2xl p-6 sm:p-8">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-accent-strong/12">
                <svg
                  viewBox="0 0 20 20"
                  aria-hidden="true"
                  className="h-5 w-5 stroke-accent-strong"
                  fill="none"
                  strokeWidth="2"
                >
                  <rect x="2.5" y="4.5" width="15" height="11" rx="2" />
                  <path d="m3 6 7 5 7-5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>

              <h1 className="mb-2 text-[clamp(1.6rem,3vw,2rem)] font-semibold tracking-tight">
                Check your email
              </h1>
              <p className="mb-6 text-muted">
                We sent a confirmation link to{" "}
                <strong className="text-foreground">{sentTo}</strong>. Follow it
                and you can sign in — the account cannot be used until you do.
              </p>

              <div className="rounded-lg border border-edge px-4 py-3 text-[0.9rem] text-muted">
                Nothing arrived? Check the spam folder, or request another link
                from the page you land on after signing in.
              </div>

              <Link
                to="/login"
                className="mt-6 inline-flex w-full items-center justify-center rounded-lg bg-accent-strong px-5 py-3 font-semibold text-accent-ink transition-colors hover:bg-accent"
              >
                Go to sign in
              </Link>
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

  return (
    <SiteLayout>
      <section className="py-16 sm:py-20">
        <div className="mx-auto w-full max-w-[440px] px-6">
          <div className="surface rounded-2xl p-6 sm:p-8">
          <h1 className="mb-2 text-[clamp(1.6rem,3vw,2rem)] font-semibold tracking-tight">
            Create your account
          </h1>
          <p className="mb-6 text-muted">
            One email is one Moogo account. Pick a password you can remember.
          </p>

          {error && (
            <div
              role="alert"
              className="mb-5 rounded-lg border border-amber/40 bg-amber/10 px-4 py-3 text-[0.92rem] text-amber"
            >
              {error}
            </div>
          )}

          {/* Shared with the login page so the two buttons stay identical. */}
          <GoogleSignInButton configured={oauthConfigured} />

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-edge" />
            </div>
            <div className="relative flex justify-center text-xs">
              {/* Transparent rather than background-alt: the card behind this is
                  transparent now that surfaces are flat, so a tinted background
                  here would show as a grey chip. */}
              <span className="bg-background px-2 text-faint">or</span>
            </div>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-muted">
                Name <span className="text-faint">(optional)</span>
              </label>
              <input
                type="text"
                id="name"
                name="name"
                autoComplete="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="w-full rounded-lg border border-edge bg-background px-4 py-2.5 text-foreground placeholder:text-faint focus:border-accent-strong focus:outline-none focus:ring-2 focus:ring-accent/20"
                placeholder="Your name"
              />
            </div>
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-muted">
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
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-muted">
                Password
              </label>
              <PasswordInput
                id="password"
                name="new-password"
                autoComplete="new-password"
                value={password}
                onChange={setPassword}
                placeholder="At least 8 characters"
              />
            </div>
            <div>
              <label htmlFor="confirm" className="mb-1.5 block text-sm font-medium text-muted">
                Confirm password
              </label>
              <PasswordInput
                id="confirm"
                name="confirm-password"
                autoComplete="new-password"
                value={confirm}
                onChange={setConfirm}
                placeholder="Repeat the password"
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="inline-flex w-full items-center justify-center rounded-lg bg-accent-strong px-5 py-3 font-semibold text-accent-ink transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? "Creating account…" : "Create account"}
            </button>
          </form>

          <p className="mt-6 text-center text-[0.9rem] text-muted">
            Already have an account?{" "}
            <Link to="/login" className="text-accent hover:text-accent-strong">
              Sign in
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


