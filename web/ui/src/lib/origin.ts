// Where the dashboard points its own URLs.
//
// The dashboard is served from more than one host: the browser UI lives on
// app.moogo.dev, the data plane that client applications talk to lives on
// api.moogo.dev, and the apex is the marketing site. They are deliberately
// different hosts, so a URL derived from window.location.origin is only
// correct when the page happens to be served from the host that owns it —
// which is true by accident, not by design, and quietly wrong the moment the
// page is opened anywhere else.
//
// Local development has no api.localhost or app.localhost to speak of, so
// anything outside moogo.dev keeps the origin it was served from. That is
// exactly what the Vite dev proxy forwards to the backend, so same-origin
// requests, the session cookie, and the OAuth callback all keep working.

function onMoogo(): boolean {
  return (
    window.location.hostname === "moogo.dev" ||
    window.location.hostname.endsWith(".moogo.dev")
  );
}

// The origin client applications talk to — the data plane. It carries the
// project id so a client app appends "/query" or "/bucket/<key>" directly,
// instead of assembling Moogo's internal route layout and keeping it in sync.
//
// This must never resolve to the dashboard host: a project URL pointing at
// app.moogo.dev hands every new user a link to the wrong product surface, and
// the data plane answers with the dashboard's HTML instead of query results.
export function apiOrigin(): string {
  if (onMoogo()) {
    return `${window.location.protocol}//api.moogo.dev`;
  }

  return window.location.origin;
}

// The origin the browser dashboard itself is served from. This is where the
// Google OAuth redirect URI lives, and it has to match MOOGO_PUBLIC_URL on the
// server exactly — Google rejects a callback registered for a different host.
export function appOrigin(): string {
  if (onMoogo()) {
    return `${window.location.protocol}//app.moogo.dev`;
  }

  return window.location.origin;
}

// Where "Moogo's home" is. The landing page lives on the apex and nowhere else.
//
// The subdomains serve the same SPA, so the client router will happily render
// the Landing component at app.moogo.dev/ — but nginx answers a real load of
// that URL with a 301 back to /app (vhost app.moogo.dev, `location = /`). A link
// that gets there in place therefore shows a page that a reload takes away, and
// duplicates the apex's content on a second host. That is not a layout quirk to
// tolerate: it is the same URL meaning two different things.
//
// So any link meaning "Moogo's home" has to name the apex explicitly whenever
// the page is served from a subdomain. On the apex itself — and anywhere that is
// not moogo.dev at all, where local development has no apex to point at and the
// dev server owns the root — a relative path is still correct, and keeps the
// navigation inside the SPA instead of introducing a full page load.
export function homeHref(pathname = "/"): string {
  if (!onMoogo() || window.location.hostname === "moogo.dev") {
    return pathname;
  }

  return `https://moogo.dev${pathname}`;
}
