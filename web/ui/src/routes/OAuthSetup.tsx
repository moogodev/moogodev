import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SiteLayout } from "../components/Layout";
import { api } from "../lib/api";

export default function OAuthSetup() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [configured, setConfigured] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .oauthSetup()
      .then((res) => {
        if (!cancelled) {
          setConfigured(res.configured);
          setChecking(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setConfigured(false);
          setChecking(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Redirect once we know OAuth is configured. Kept in its own unconditional
  // effect so the hook order is stable regardless of which branch renders.
  useEffect(() => {
    if (!checking && configured) {
      navigate("/login", { replace: true });
    }
  }, [checking, configured, navigate]);

  if (checking) {
    return (
      <SiteLayout>
        <section className="py-16 sm:py-20">
          <div className="mx-auto w-full max-w-[720px] px-6 text-center">
            <div className="inline-flex items-center justify-center gap-2 text-muted">
              <svg
                className="animate-spin h-6 w-6 text-accent-strong"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
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
              <span>Checking OAuth configuration…</span>
            </div>
          </div>
        </section>
      </SiteLayout>
    );
  }

  if (configured) {
    // The redirect effect above handles navigation; render nothing meanwhile.
    return null;
  }

  return (
    <SiteLayout>
      <section className="py-16 sm:py-20">
        <div className="mx-auto w-full max-w-[720px] px-6">
          <div className="mb-8 text-center">
            <h1 className="mb-3 text-[clamp(2rem,4vw,2.6rem)] font-semibold tracking-tight">
              Google OAuth Not Configured
            </h1>
            <p className="max-w-[46em] mx-auto text-muted">
              Moogo requires Google OAuth credentials to sign in. Please configure
              the following environment variables on the server:
            </p>
          </div>

          <div className="surface rounded-xl p-6 space-y-6">
            <div>
              <h3 className="mb-3 text-lg font-semibold">Required Environment Variables</h3>
              <dl className="space-y-4 font-mono text-sm">
                <div className="rounded-lg border border-edge bg-background p-4">
                  <dt className="text-faint">MOOGO_GOOGLE_CLIENT_ID</dt>
                  <dd className="mt-1 text-foreground">
                    Your Google OAuth 2.0 Client ID from the Google Cloud Console.
                  </dd>
                </div>
                <div className="rounded-lg border border-edge bg-background p-4">
                  <dt className="text-faint">MOOGO_GOOGLE_CLIENT_SECRET</dt>
                  <dd className="mt-1 text-foreground">
                    Your Google OAuth 2.0 Client Secret from the Google Cloud Console.
                  </dd>
                </div>
              </dl>
            </div>

            <div className="border-t border-edge pt-6">
              <h3 className="mb-3 text-lg font-semibold">How to Create Credentials</h3>
              <ol className="space-y-3 text-sm text-muted list-decimal list-inside">
                <li>
                  Go to the <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" className="text-accent-strong hover:underline">Google Cloud Console → APIs & Services → Credentials</a>.
                </li>
                <li>
                  Click <strong>Create Credentials</strong> → <strong>OAuth client ID</strong>.
                </li>
                <li>
                  Select <strong>Web application</strong> as the application type.
                </li>
                <li>
                  Under <strong>Authorized redirect URIs</strong>, add:
                  <code className="rounded bg-panel-raised px-1.5 font-mono text-[0.87em] text-accent block mt-1">
                    {`${window.location.origin}/auth/google/callback`}
                  </code>
                </li>
                <li>
                  Click <strong>Create</strong>. Copy the Client ID and Client Secret.
                </li>
                <li>
                  Set them as environment variables on your server and restart Moogo.
                </li>
              </ol>
            </div>

            <div className="border-t border-edge pt-6">
              <h3 className="mb-3 text-lg font-semibold">Other Required Variables</h3>
              <dl className="space-y-2 font-mono text-sm">
                <div className="rounded-lg border border-edge bg-background p-3 flex justify-between">
                  <dt className="text-faint">MOOGO_SESSION_SECRET</dt>
                  <dd className="text-foreground">
                    A random string (min 32 chars) for signing session cookies.
                    <br />
                    <code className="text-[0.8em] text-muted">
                      {`openssl rand -base64 32`}
                    </code>
                  </dd>
                </div>
                <div className="rounded-lg border border-edge bg-background p-3 flex justify-between">
                  <dt className="text-faint">MOOGO_DATABASE_URL</dt>
                  <dd className="text-foreground">
                    PostgreSQL connection string for the control plane.
                  </dd>
                </div>
              </dl>
            </div>

            <p className="mt-6 text-sm text-faint">
              After setting all variables, restart the server. This page will
              automatically redirect to the sign-in page.
            </p>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}