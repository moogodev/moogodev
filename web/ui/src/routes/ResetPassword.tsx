import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { SiteLayout } from "../components/Layout";
import { PasswordInput } from "../components/PasswordInput";
import { api, ApiError } from "../lib/api";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
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
      await api.resetPassword(token, password);
      setDone(true);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Could not update the password. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  // No token means the link is malformed or was opened without one.
  if (!token) {
    return (
      <SiteLayout>
        <section className="py-16 sm:py-20">
          <div className="mx-auto w-full max-w-[440px] px-6">
            <div className="surface rounded-2xl p-6 text-center sm:p-8">
              <h1 className="mb-2 text-[clamp(1.6rem,3vw,2rem)] font-semibold tracking-tight">
                Link missing
              </h1>
              <p className="mb-6 text-muted">
                This reset link is incomplete. Request a new one from the sign-in
                page.
              </p>
              <Link
                to="/forgot-password"
                className="inline-flex items-center justify-center rounded-lg bg-accent-strong px-5 py-3 font-semibold text-accent-ink transition-colors hover:bg-accent"
              >
                Request a new link
              </Link>
            </div>
          </div>
        </section>
      </SiteLayout>
    );
  }

  if (done) {
    return (
      <SiteLayout>
        <section className="py-16 sm:py-20">
          <div className="mx-auto w-full max-w-[440px] px-6">
            <div className="surface rounded-2xl p-6 text-center sm:p-8">
              <h1 className="mb-2 text-[clamp(1.6rem,3vw,2rem)] font-semibold tracking-tight">
                Password updated
              </h1>
              <p className="mb-6 text-muted">
                Your password has been changed. Sign in with your new password.
              </p>
              <Link
                to="/login"
                className="inline-flex items-center justify-center rounded-lg bg-accent-strong px-5 py-3 font-semibold text-accent-ink transition-colors hover:bg-accent"
              >
                Go to sign in
              </Link>
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
            Choose a new password
          </h1>
          <p className="mb-5 text-muted">
            Enter a new password. It must be at least 8 characters.
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
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-muted">
                New password
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
                Confirm new password
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
              {busy ? "Updating…" : "Update password"}
            </button>
          </form>
          </div>

          <p className="mt-6 text-center">
            <Link to="/" className="text-[0.9rem] text-faint hover:text-foreground">
              ← Back to the landing page
            </Link>
          </p>
        </div>
      </section>
    </SiteLayout>
  );
}
