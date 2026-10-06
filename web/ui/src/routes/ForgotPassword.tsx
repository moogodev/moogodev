import { useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { HomeLink } from "../components/HomeLink";
import { SiteLayout } from "../components/Layout";
import { api, ApiError } from "../lib/api";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!email.trim()) {
      setError("Enter the email you signed up with.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await api.forgotPassword(email.trim());
      setSent(result.message);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Could not start the reset. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SiteLayout>
      <section className="py-16 sm:py-20">
        <div className="mx-auto w-full max-w-[440px] px-6">
          <div className="surface rounded-2xl p-6 sm:p-8">
          <h1 className="mb-2 text-[clamp(1.6rem,3vw,2rem)] font-semibold tracking-tight">
            Reset your password
          </h1>

          {sent ? (
            <>
              <p className="mb-5 text-muted">{sent}</p>
              <div className="rounded-lg border border-edge bg-background px-4 py-4 text-[0.9rem] text-muted">
                Check your inbox. The link expires soon and can only be used once.
                If nothing arrives, the email may not be registered.
              </div>
            </>
          ) : (
            <>
              <p className="mb-5 text-muted">
                Enter your email and we&apos;ll send you a link to choose a new
                password.
              </p>

              {error && (
                <div
                  role="alert"
                  className="mb-5 rounded-lg border border-amber/40 bg-amber/10 px-4 py-3 text-[0.92rem] text-amber"
                >
                  {error}
                </div>
              )}

              <form onSubmit={submit} className="space-y-4">
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
                <button
                  type="submit"
                  disabled={busy}
                  className="inline-flex w-full items-center justify-center rounded-lg bg-accent-strong px-5 py-3 font-semibold text-accent-ink transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busy ? "Sending…" : "Send reset link"}
                </button>
              </form>
            </>
          )}

          <p className="mt-6 text-center text-[0.9rem] text-muted">
            Remembered it after all?{" "}
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
