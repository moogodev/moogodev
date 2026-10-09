import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { Brand } from "./Brand";
import { DashboardLink } from "./DashboardLink";
import { homeHref } from "../lib/origin";
import { ThemeToggle } from "./ThemeToggle";
import { useSession } from "../lib/session";
import { useState } from "react";

// Marketing chrome: sticky header and a small footer. The dashboard uses its own
// shell because it needs the account controls instead of the site nav.
export function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <AnnouncementBar />
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}

// The development notice sits above the header rather than inside it: the
// header tells a visitor where to go, and this tells them how much weight
// whatever they find there can carry. It has to be read first. The amber is
// the same token the auth pages use for notices, so the bar reads as a notice
// in both themes instead of inventing a colour of its own.
//
// It ships in every build, production included: the product is in its
// development phase, and a visitor on the live site needs that sentence more
// than a visitor on localhost does. The bar is the short form; /announcement,
// which it links to, is the long one. Both come out together when the phase
// ends.
function AnnouncementBar() {
  return (
    <div className="border-b border-amber/30 bg-amber/10">
      <div className="mx-auto flex w-full max-w-[1120px] flex-wrap items-center justify-center gap-x-2 gap-y-1 px-6 py-2 text-center text-[0.84rem] text-muted">
        <span>
          moogo.dev is still in development — usable for testing,{" "}
          <span className="font-medium text-foreground">
            not ready for production
          </span>
          .
        </span>
        <Link
          to="/announcement"
          className="font-medium text-amber underline-offset-4 hover:underline"
        >
          Read more
        </Link>
      </div>
    </div>
  );
}

// The navigation is the four things a visitor can actually do with Moogo,
// in the order they would do them: see what it is, reach the database, reach
// the storage, then decide whether to pay for it or read how.
//
// "Limits" used to sit here next to "Docs". It is a constraint, not a feature,
// and it already has a section on the landing page and a page in the docs.
// Keeping it in the header meant the nav was telling a first-time visitor
// about a quota before telling them what they would get.
const navLinks = [
  { label: "Features", to: "/#features" },
  { label: "SQL API", to: "/docs/sql-api" },
  { label: "Storage", to: "/docs/object-storage" },
  // The pricing page rather than the landing section: the plans outlive the
  // current offer, and a nav entry that scrolls halfway down a marketing page
  // cannot grow into more than one card.
  { label: "Pricing", to: "/plan" },
  { label: "Docs", to: "/docs/quickstart" },
];

const authPaths = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
];

function SiteHeader() {
  const location = useLocation();
  const isAuthPage = authPaths.includes(location.pathname);
  const session = useSession();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Only an authenticated visitor is treated as signed in. "unknown" is the
  // server being unreachable, which is not evidence of anything, and treating it
  // as signed out is what the previous hard-coded link did anyway.
  const signedIn = session.status === "authenticated";

  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <header className="sticky top-0 z-50 border-b border-edge bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-[66px] w-full max-w-[1120px] items-center gap-7 px-6">
        <Brand />
        <nav
          aria-label="Main"
          className="ml-auto hidden gap-6 text-[0.92rem] text-muted md:flex"
        >
          {navLinks.map((link) =>
            link.to.startsWith("/#") ? (
              // "Features" anchors onto the landing page, which only exists on
              // the apex. Same reasoning as HomeLink: from a subdomain it has
              // to name moogo.dev, or it would render the landing page under
              // that hostname until the next reload.
              <a
                key={link.label}
                className="hover:text-foreground"
                href={homeHref(link.to)}
              >
                {link.label}
              </a>
            ) : (
              <Link key={link.label} className="hover:text-foreground" to={link.to}>
                {link.label}
              </Link>
            )
          )}
        </nav>

        {/* Mobile menu button. Right-aligned on small screens: with the nav and
            the session button both hidden there, the bar holds only the brand
            and this, and the two belong at opposite ends. On desktop it is
            display:none, so its auto margin costs the layout nothing. */}
        <button
          type="button"
          className="ml-auto inline-flex items-center justify-center rounded-md p-2 text-muted transition-colors hover:bg-hover-bg hover:text-foreground md:hidden"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-expanded={mobileMenuOpen}
          aria-controls="mobile-menu"
          aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
        >
          {mobileMenuOpen ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          )}
        </button>

        {/*
          One button, and which one it is depends on the session. A signed-in
          visitor has no use for "Register / Login": they are already in, and
          the page they want is the one they came from. A signed-out visitor is
          sent to /login rather than /register because one address and one
          password is the shorter path, and the register page is one click away
          from it.

          Nothing is rendered while the answer is unknown or still in flight, so
          the header does not flash "Sign in" at someone who is already signed
          in. The auth pages hide the button entirely: they are the answer to
          this question already.

          Hidden below md on purpose: the mobile menu carries the same buttons,
          and the base class has to be "hidden" rather than "inline-flex" —
          both were listed once, and display utilities resolve by stylesheet
          order, where inline-flex comes after hidden and won. The button then
          showed on a phone, crowded against the hamburger.
        */}
        {isAuthPage || session.status === "loading" || session.status === "unknown" ? null : signedIn ? (
          <DashboardLink className="hidden items-center justify-center rounded-lg bg-accent-strong px-4 py-2 text-[0.88rem] font-semibold text-accent-ink transition-colors hover:bg-accent md:inline-flex">
            Open dashboard
          </DashboardLink>
        ) : (
          <Link
            to="/login"
            className="hidden items-center justify-center rounded-lg bg-accent-strong px-4 py-2 text-[0.88rem] font-semibold text-accent-ink transition-colors hover:bg-accent md:inline-flex"
          >
            Sign in
          </Link>
        )}
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div id="mobile-menu" className="md:hidden fixed inset-0 z-40 bg-background/95 backdrop-blur-sm animate-slide-down" onClick={closeMobileMenu}>
          <div className="flex flex-col items-center justify-center min-h-screen gap-8 px-6 pt-20">
            <nav className="flex flex-col items-center gap-6 text-center" aria-label="Mobile main">
              {navLinks.map((link) =>
                link.to.startsWith("/#") ? (
                  <a
                    key={link.label}
                    className="text-xl font-medium text-foreground hover:text-accent-strong transition-colors"
                    href={link.to}
                    onClick={closeMobileMenu}
                  >
                    {link.label}
                  </a>
                ) : (
                  <Link
                    key={link.label}
                    className="text-xl font-medium text-foreground hover:text-accent-strong transition-colors"
                    to={link.to}
                    onClick={closeMobileMenu}
                  >
                    {link.label}
                  </Link>
                )
              )}

              {!signedIn ? (
                <>
                  <Link
                    to="/login"
                    className="inline-flex items-center justify-center rounded-lg bg-accent-strong px-6 py-3 text-lg font-semibold text-accent-ink transition-colors hover:bg-accent w-64"
                    onClick={closeMobileMenu}
                  >
                    Sign in
                  </Link>
                  <Link
                    to="/register"
                    className="inline-flex items-center justify-center rounded-lg border border-edge-strong px-6 py-3 text-lg font-semibold text-muted hover:border-hover-edge hover:bg-hover-bg hover:text-foreground transition-colors w-64"
                    onClick={closeMobileMenu}
                  >
                    Sign up
                  </Link>
                </>
              ) : (
                <DashboardLink
                  className="inline-flex items-center justify-center rounded-lg bg-accent-strong px-6 py-3 text-lg font-semibold text-accent-ink transition-colors hover:bg-accent w-64"
                  onClick={closeMobileMenu}
                >
                  Open dashboard
                </DashboardLink>
              )}
            </nav>
          </div>
        </div>
      )}
    </header>
  );
}

// The footer groups are data rather than four hand-written lists, because the
// previous version was one row of four links that gave a visitor no way to tell
// documentation from marketing. Grouping by intent is the whole point of a
// footer this size: someone looking for an error code should not have to read
// past a pricing link to find it.
//
// Every destination here is a route this app actually serves. Nothing points at
// a page that would 404, and nothing points at a destination we cannot vouch
// for -- a footer full of dead links is worse than a short one.
const footerGroups: { title: string; links: { label: string; to: string }[] }[] = [
  {
    title: "Product",
    links: [
      { label: "What is Moogo", to: "/docs/what-is-moogo" },
      { label: "Why Moogo", to: "/docs/why-moogo" },
      { label: "Comparison", to: "/docs/comparison" },
      { label: "Pricing", to: "/plan" },
      { label: "Limits", to: "/docs/limits" },
    ],
  },
  {
    title: "Documentation",
    links: [
      { label: "Quickstart", to: "/docs/quickstart" },
      { label: "SQL API", to: "/docs/sql-api" },
      { label: "Object storage", to: "/docs/object-storage" },
      { label: "Dashboard", to: "/docs/dashboard" },
      { label: "All pages", to: "/docs" },
    ],
  },
  {
    title: "Using Moogo",
    links: [
      { label: "Register", to: "/register" },
      { label: "Create a project", to: "/docs/create-project" },
      { label: "Create a bucket", to: "/docs/create-bucket" },
      { label: "Credentials", to: "/docs/credentials" },
      { label: "Sign in", to: "/login" },
    ],
  },
  {
    title: "Reference",
    links: [
      { label: "Security", to: "/docs/security" },
      { label: "Errors", to: "/docs/errors" },
      { label: "Troubleshooting", to: "/docs/errors#common-problems" },
      { label: "Feedback", to: "/docs/feedback" },
      { label: "Terms", to: "/terms" },
      { label: "Privacy", to: "/privacy" },
      { label: "GitHub", to: "https://github.com/moogodev/moogodev" },
    ],
  },
];

function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-edge bg-background-alt">
      <div className="mx-auto w-full max-w-[1120px] px-6">
        {/* The top band answers "what is this" and "what do I do first", which
            is what a footer is read for. The columns below are for someone who
            already knows what Moogo is and wants a specific page. */}
        <div className="grid gap-10 py-14 lg:grid-cols-[1.25fr_2.75fr] lg:gap-16">
          <div>
            <Brand />
            <p className="mt-4 max-w-[34ch] text-[0.9rem] leading-relaxed text-muted">
              A hosted SQLite database and object storage for serverless apps.
              One file per project, SQL over HTTP, no connection string and no
              driver.
            </p>

            <div className="mt-6 flex flex-wrap gap-2">
              <Link
                to="/register"
                className="inline-flex items-center justify-center rounded-lg bg-accent-strong px-4 py-2 text-[0.86rem] font-semibold text-accent-ink transition-colors hover:bg-accent"
              >
                Create a project
              </Link>
              <Link
                to="/docs/quickstart"
                className="inline-flex items-center justify-center rounded-lg border border-edge-strong px-4 py-2 text-[0.86rem] font-semibold transition-colors hover:border-hover-edge hover:bg-hover-bg"
              >
                Read the docs
              </Link>
            </div>

            <ul className="mt-7 flex flex-col gap-2 text-[0.87rem] text-muted">
              <li>
                <span className="text-faint">Database</span> · 100 MB of SQLite
                per project
              </li>
              <li>
                <span className="text-faint">Storage</span> · 256 MB per project
              </li>
              <li>
                <span className="text-faint">Price</span> · free, no card
              </li>
            </ul>
          </div>

          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {footerGroups.map((group) => (
              <div key={group.title}>
                <h2 className="mb-3.5 text-[0.74rem] font-semibold uppercase tracking-[0.12em] text-faint">
                  {group.title}
                </h2>
                <ul className="flex flex-col gap-2.5">
                  {group.links.map((link) => (
                    <li key={link.label}>
                      {link.to.startsWith("http") ? (
                        <a
                          href={link.to}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[0.88rem] text-muted transition-colors hover:text-foreground"
                        >
                          {link.label}
                        </a>
                      ) : (
                        <Link
                          to={link.to}
                          className="text-[0.88rem] text-muted transition-colors hover:text-foreground"
                        >
                          {link.label}
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col-reverse items-start justify-between gap-4 border-t border-edge py-6 sm:flex-row sm:items-center">
          <p className="text-[0.85rem] text-faint">
            Moogo — SQLite over HTTP. Built with Go.
          </p>

          {/* The theme control lives here rather than in the header because it is
              a preference, not a destination. Putting it in the header next to
              the sign-up button gave it the weight of a primary action, and it is
              the one control on the page a visitor may never use. */}
          <ThemeToggle />
        </div>
      </div>
    </footer>
  );
}