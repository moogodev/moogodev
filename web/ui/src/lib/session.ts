import { useEffect, useState } from "react";
import { api, type SessionInfo } from "./api";

// The one place the browser session is looked up.
//
// The header needs to know whether to offer "Sign in" or "Open dashboard", and
// the login page needs the same answer to decide whether to bounce straight to
// the app. Both were probing independently, which meant two requests per page
// and two chances to disagree about who is signed in.
//
// The request is cached at module scope for the life of the document. A session
// does not change while a tab is open: signing in and out both end in a full
// page load, because the responses are redirects and cookie changes that this
// app has no reason to observe from JavaScript.
let pending: Promise<SessionInfo> | null = null;
let resolved: SessionInfo | null = null;

function probe(): Promise<SessionInfo> {
  if (!pending) {
    pending = api.session().catch((cause) => {
      // A failed probe is not cached. The server being unreachable at one
      // moment says nothing about the next request, and keeping the rejection
      // would pin the whole tab to "signed out" for good.
      pending = null;
      throw cause;
    });
  }
  return pending;
}

// SessionState is what the UI actually branches on. "loading" and "unknown" are
// kept apart from "anonymous" on purpose: not knowing yet is not the same as
// knowing the answer is no, and a header that says "Sign in" before the answer
// arrives flashes the wrong button at people who are already signed in.
export type SessionState =
  | { status: "loading"; oauthConfigured: false }
  // The server could not be reached. Distinct from anonymous: the visitor may
  // well be signed in, we just cannot tell, and saying so is better than
  // guessing.
  | { status: "unknown"; error: string; oauthConfigured: false }
  | { status: "anonymous"; oauthConfigured: boolean }
  | { status: "authenticated"; email: string; oauthConfigured: boolean };

// Before the answer arrives, or when there is no answer, Google is treated as
// not configured. A Google button shown on a guess is a button that fails, and
// the auth pages have an email form either way.

function toState(session: SessionInfo): SessionState {
  if (session.authenticated) {
    return {
      status: "authenticated",
      email: session.email ?? "",
      oauthConfigured: session.oauth_configured,
    };
  }
  return { status: "anonymous", oauthConfigured: session.oauth_configured };
}

export function useSession(): SessionState {
  const [state, setState] = useState<SessionState>(() =>
    resolved ? toState(resolved) : { status: "loading", oauthConfigured: false },
  );

  useEffect(() => {
    let cancelled = false;
    probe()
      .then((session) => {
        resolved = session;
        if (!cancelled) setState(toState(session));
      })
      .catch((cause) => {
        if (!cancelled) {
          setState({
            status: "unknown",
            error: cause instanceof Error ? cause.message : "",
            oauthConfigured: false,
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}