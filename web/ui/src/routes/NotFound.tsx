import { SiteLayout } from "../components/Layout";
import { HomeLink } from "../components/HomeLink";
import { readServerError } from "../lib/errorpage";

// One notice per status the router can send to a browser. The wording lives
// here rather than in the response so the copy sits in the site's own layout
// and can be changed with the rest of the front end.
const notices: Record<number, { title: string; hint: string }> = {
  400: {
    title: "Bad request",
    hint: "The request could not be understood.",
  },
  401: {
    title: "Sign in required",
    hint: "This page needs an account. Sign in and try again.",
  },
  403: {
    title: "Access denied",
    hint: "You do not have access to this address.",
  },
  404: {
    title: "Page not found",
    hint: "Check the address for a typo, or start over from the home page.",
  },
  405: {
    title: "Method not allowed",
    hint: "This address does not accept that kind of request.",
  },
  500: {
    title: "Something went wrong",
    hint: "The problem has been logged. Try again later.",
  },
  501: {
    title: "Not implemented",
    hint: "This address is not implemented.",
  },
  502: {
    title: "Bad gateway",
    hint: "An upstream service returned an invalid response.",
  },
  503: {
    title: "Service unavailable",
    hint: "The service is starting up or a dependency is unreachable. Try again shortly.",
  },
  504: {
    title: "Gateway timeout",
    hint: "An upstream service took too long to respond.",
  },
};

const fallback = {
  title: "Error",
  hint: "Something did not work. Go back to the home page and try again.",
};

export default function NotFound() {
  const status = readServerError()?.status ?? 404;
  const { title, hint } = notices[status] ?? fallback;

  return (
    <SiteLayout>
      <main className="mx-auto w-full max-w-[720px] px-6 py-14">
        <div
          role="alert"
          className="rounded-lg border border-amber/40 bg-amber/10 px-4 py-3 text-[0.92rem] text-amber"
        >
          {status} — {title}. {hint}
        </div>
        <HomeLink className="mt-4 inline-block text-[0.85rem] text-accent hover:underline">
          Back to the landing page
        </HomeLink>
      </main>
    </SiteLayout>
  );
}
