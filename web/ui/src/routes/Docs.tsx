import { useEffect, useMemo, useState } from "react";
import type { MouseEvent } from "react";
import {
  Link,
  useNavigate,
  useParams,
  type NavigateFunction,
} from "react-router-dom";
import { SiteLayout } from "../components/Layout";
import { appOrigin } from "../lib/origin";
import {
  allDocs,
  docGroups,
  docsReady,
  ensureDocs,
  findDoc,
  rawDoc,
  renderDoc,
  type DocPage,
} from "../lib/docs";
import "../docs.css";

// Documentation is a normal page: /docs shows the first page, and /docs/:slug
// shows a named one. Rendering the index route as a real page rather than as a
// list means a visitor who lands on /docs reads the quickstart instead of having
// to choose, which is what the rest of the site does.
const DEFAULT_SLUG = "quickstart";

// Anchors are compared against scroll position rather than observed with an
// IntersectionObserver. The observer approach needs the rendered body measured
// after every navigation, and this runs once per scroll frame instead, which is
// cheaper and behaves the same for a page this size.
const ACTIVE_SECTION_MARGIN = 96;

// The one page that is also a downloadable document. Its whole point is to be
// lifted out of the site — into a project as moogo.md, or into an agent's
// context — so it carries the buttons that do that, at the top of the article.
const ADOPTION_PROMPT_SLUG = "ai-adoption-prompt";

export default function Docs() {
  const { slug } = useParams();

  // The page manifest is built from lazy Markdown chunks; until they arrive
  // there is no sidebar to draw and no title to fall back on, so nothing of
  // the docs renders before they do — a sidebar without content is worse than
  // a loader. The state starts ready when a previous visit already loaded the
  // chunks, so navigating back into the docs does not flash the loader.
  const [ready, setReady] = useState(docsReady);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (ready) return undefined;
    let cancelled = false;
    ensureDocs().then(
      () => {
        if (!cancelled) setReady(true);
      },
      () => {
        if (!cancelled) setFailed(true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [ready, attempt]);

  if (failed) {
    return (
      <DocsLoadFailed
        onRetry={() => {
          setFailed(false);
          setAttempt((current) => current + 1);
        }}
      />
    );
  }

  if (!ready) return <DocsLoading />;

  // A slug that matches no document is a missing page, not a second chance
  // at the quickstart. Falling back to the default page made every typo --
  // and every retired document still in an old link -- render plausible,
  // unrelated content under the URL that was asked for, which is the worst
  // way to be wrong: quietly. The check lives above the real page so the
  // hooks below still run in a stable order for every /docs render.
  if (slug && !findDoc(slug)) {
    return <DocsMissing slug={slug} />;
  }
  return <DocsPage />;
}

// DocsLoading is the docs shell while its chunks load: the site chrome, the
// section label, and one honest line. It renders no sidebar, because the
// sidebar is the list of pages and the list is exactly what is not here yet.
function DocsLoading() {
  return (
    <SiteLayout>
      <div
        role="status"
        className="mx-auto flex w-full max-w-[720px] flex-col items-center px-6 py-24 text-center"
      >
        <p className="mb-3 text-[0.76rem] font-semibold uppercase tracking-[0.13em] text-accent-strong">
          Documentation
        </p>
        <p className="text-[0.95rem] text-muted">Loading the documentation…</p>
      </div>
    </SiteLayout>
  );
}

// DocsLoadFailed is what a chunk that did not arrive looks like. Retrying
// re-runs the load from scratch: ensureDocs clears its memoized promise when
// it fails, so the retry is a real attempt rather than the same rejection.
function DocsLoadFailed({ onRetry }: { onRetry: () => void }) {
  return (
    <SiteLayout>
      <div className="mx-auto flex w-full max-w-[720px] flex-col items-center px-6 py-24 text-center">
        <p className="mb-3 text-[0.76rem] font-semibold uppercase tracking-[0.13em] text-accent-strong">
          Documentation
        </p>
        <h1 className="text-[clamp(1.6rem,3.4vw,2.2rem)] font-semibold tracking-tight">
          The documentation could not be loaded
        </h1>
        <p className="mt-3 max-w-[46em] text-muted">
          The pages are part of this deployment, so this is a loading problem
          rather than a missing one. Try again, or start from the home page.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={onRetry}
            className="cursor-pointer rounded-lg bg-accent-strong px-4 py-2 text-sm font-semibold text-accent-ink transition-colors hover:bg-accent"
          >
            Try again
          </button>
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-lg border border-edge-strong px-4 py-2 text-sm font-semibold transition-colors hover:border-hover-edge hover:bg-hover-bg"
          >
            Go to the home page
          </Link>
        </div>
      </div>
    </SiteLayout>
  );
}

// DocsMissing is the docs 404: the same site chrome, an honest message, and
// both ways out. It names the slug that failed so a typo is visible in what
// comes back rather than inferred from a page that does not match.
function DocsMissing({ slug }: { slug: string }) {
  return (
    <SiteLayout>
      <div className="mx-auto flex w-full max-w-[720px] flex-col items-center px-6 py-24 text-center">
        <p className="mb-3 text-[0.76rem] font-semibold uppercase tracking-[0.13em] text-accent-strong">
          Documentation
        </p>
        <h1 className="text-[clamp(1.6rem,3.4vw,2.2rem)] font-semibold tracking-tight">
          Page not found
        </h1>
        <p className="mt-3 max-w-[46em] text-muted">
          No documentation page matches{" "}
          <code className="rounded bg-background-alt px-1.5 py-0.5 text-[0.9em]">
            /docs/{slug}
          </code>
          . Check the address, or start from the index.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Link
            to="/docs"
            className="inline-flex items-center justify-center rounded-lg bg-accent-strong px-4 py-2 text-[0.86rem] font-semibold text-accent-ink transition-colors hover:bg-accent"
          >
            Browse documentation
          </Link>
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-lg border border-edge-strong px-4 py-2 text-[0.86rem] font-semibold transition-colors hover:border-hover-edge hover:bg-hover-bg"
          >
            Go to the home page
          </Link>
        </div>
      </div>
    </SiteLayout>
  );
}

function DocsPage() {
  const { slug } = useParams();
  const navigate = useNavigate();

  const page = findDoc(slug) ?? findDoc(DEFAULT_SLUG)!;

  // The sidebar is hidden behind a toggle on narrow screens. It is a plain
  // boolean rather than a media-query listener because the only thing that
  // changes is whether the panel is in the document flow, and a resize listener
  // would re-render on every pixel of a drag.
  const [navOpen, setNavOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState<string>("");

  // Reading the hash on navigation rather than listening for it keeps the
  // scroll behaviour in one place: when the slug changes, jump to the anchor if
  // there is one, otherwise go to the top.
  const hash = window.location.hash.slice(1);

  // Resetting the sidebar and the search happens in the click handlers that
  // cause the navigation, not in an effect watching the slug. An effect would
  // also have to run on a back button press, where there is no click at all --
  // and setting state there costs a second render pass for something the user
  // already navigated away from.
  const closeNav = () => {
    setNavOpen(false);
    setQuery("");
  };

  useEffect(() => {
    if (hash) {
      // Wait a frame so the injected HTML exists before scrolling to it.
      const frame = requestAnimationFrame(() => {
        document
          .getElementById(hash)
          ?.scrollIntoView({ block: "start" });
      });
      return () => cancelAnimationFrame(frame);
    }

    window.scrollTo({ top: 0 });
    return undefined;
  }, [page.slug, hash]);

  // Highlight the heading nearest the top of the viewport. A heading becomes
  // active once it is above the margin, and stays active until the next one
  // takes over, which is why this keeps the last heading above the line rather
  // than the first one below it.
  useEffect(() => {
    if (page.headings.length === 0) return undefined;

    let frame = 0;

    const update = () => {
      frame = 0;
      let current = page.headings[0].id;
      for (const heading of page.headings) {
        const element = document.getElementById(heading.id);
        if (!element) continue;
        if (element.getBoundingClientRect().top <= ACTIVE_SECTION_MARGIN) {
          current = heading.id;
        } else {
          break;
        }
      }
      setActiveId(current);
    };

    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [page.headings]);

  const html = useMemo(() => renderDoc(page.slug), [page.slug]);

  return (
    <SiteLayout>
      {/* The site header is a sticky 66px bar, so the page needs its own top
          padding or the title sits flush against it. The docs sidebar also
          starts at lg:, where this vertical rhythm matters most because the
          three columns become visible at once. */}
      <div className="mx-auto w-full max-w-[1400px] px-6 pt-10 pb-6 lg:pt-14 lg:pb-8">
        <div className="lg:hidden">
          <button
            type="button"
            onClick={() => setNavOpen((open) => !open)}
            aria-expanded={navOpen}
            className="mb-5 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-edge px-3.5 py-2 text-[0.88rem] font-medium text-muted transition-colors hover:text-foreground"
          >
            <svg
              viewBox="0 0 20 20"
              aria-hidden="true"
              className="h-4 w-4 stroke-current"
              fill="none"
              strokeWidth="1.7"
            >
              <path d="M3 5h14M3 10h14M3 15h14" strokeLinecap="round" />
            </svg>
            {navOpen ? "Hide contents" : "Contents"}
          </button>
        </div>

        <div className="grid gap-10 pb-20 lg:grid-cols-[236px_minmax(0,1fr)] xl:grid-cols-[236px_minmax(0,1fr)_212px]">
          <Sidebar
            open={navOpen}
            query={query}
            onQuery={setQuery}
            onNavigate={closeNav}
            activeSlug={page.slug}
          />

          <main className="min-w-0">
            <article>
              {page.slug === ADOPTION_PROMPT_SLUG && <MoogoMdActions slug={page.slug} />}
              <header className="mb-8">
                <p className="mb-2 text-[0.76rem] font-semibold uppercase tracking-[0.13em] text-accent-strong">
                  {page.group}
                </p>
                <h1 className="mb-4 text-[clamp(1.9rem,3.6vw,2.5rem)] font-semibold tracking-tight">
                  {page.title}
                </h1>
                {page.description && (
                  <p className="max-w-[52em] text-[1.02rem] leading-relaxed text-muted">
                    {page.description}
                  </p>
                )}
              </header>

              {/* The body is sanitized in lib/docs.ts before it reaches this
                  point; see the note there for why. It cannot be React-rendered
                  because it is one HTML string. */}
              <div
                className="docs-prose"
                onClick={(event) => handleBodyClick(event, navigate, closeNav)}
                dangerouslySetInnerHTML={{ __html: html }}
              />
            </article>

            <Pager page={page} onNavigate={closeNav} />
          </main>

          <OnThisPage page={page} activeId={activeId} />
        </div>
      </div>
    </SiteLayout>
  );
}

/**
 * Copy and download this page as moogo.md.
 *
 * The text is the raw Markdown from the bundle, not the rendered HTML: what an
 * agent is fed should be the source document, headings and all. The download is
 * built in the browser from a Blob — there is no server route for a file that
 * is already compiled into the page.
 */
function MoogoMdActions({ slug }: { slug: string }) {
  const [copied, setCopied] = useState(false);
  const raw = rawDoc(slug);

  if (raw === undefined) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(raw);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be denied or unavailable on an insecure origin.
      // The download button is the standing fallback, so this stays silent.
    }
  };

  const handleDownload = () => {
    const url = URL.createObjectURL(new Blob([raw], { type: "text/markdown" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "moogo.md";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-edge bg-background-alt px-4 py-3">
      <p className="text-[0.88rem] font-medium text-muted">
        Take this page with you — as{" "}
        <code className="rounded bg-panel px-1.5 py-0.5 font-mono text-[0.82rem] text-foreground">
          moogo.md
        </code>{" "}
        in your project, for your agent to read.
      </p>
      <div className="flex shrink-0 gap-2">
        <button
          type="button"
          onClick={handleCopy}
          className="cursor-pointer rounded-lg bg-accent-strong px-4 py-2 text-sm font-semibold text-accent-ink transition-colors hover:bg-accent"
        >
          {copied ? "✓ Copied" : "Copy moogo.md"}
        </button>
        <button
          type="button"
          onClick={handleDownload}
          className="cursor-pointer rounded-lg border border-edge-strong px-4 py-2 text-sm font-medium text-muted transition-colors hover:border-hover-edge hover:bg-hover-bg hover:text-foreground"
        >
          Download
        </button>
      </div>
    </div>
  );
}

/**
 * Intercept clicks inside the rendered body.
 *
 * Two cases need handling, and both are easier here than in the Markdown
 * pipeline. A click on a copy button has to reach the DOM because the button
 * lives inside injected HTML that React never rendered. A click on an internal
 * link has to become a router navigation so the docs do not trigger a full
 * page load and lose the scroll position.
 */
function handleBodyClick(
  event: MouseEvent<HTMLDivElement>,
  navigate: NavigateFunction,
  onNavigate: () => void,
) {
  const target = event.target as HTMLElement;

  const copyButton = target.closest<HTMLElement>(".code-copy");
  if (copyButton) {
    event.preventDefault();
    const block = copyButton.closest(".code-block");
    const code = block?.querySelector("code");
    if (code) void copyCode(code.textContent ?? "", copyButton);
    return;
  }

  const link = target.closest("a");
  if (!link) return;

  const href = link.getAttribute("href") ?? "";
  // External links already carry target=_blank and are left to the browser, and
  // an in-page anchor is handled by the browser's own scrolling.
  if (/^https?:/i.test(href) || link.target === "_blank") return;
  if (href.startsWith("#")) return;

  // "/app" is the dashboard, which lives on its own host. Router navigation
  // changes the path, never the origin, so from the apex navigate("/app") would
  // render the dashboard on moogo.dev — the same SPA shell on the wrong domain.
  // Rewrite the href to the dashboard origin and leave the click to the browser
  // (a full load, straight to the right host). On the dashboard host itself —
  // and in local development — there is nothing to cross, so the SPA navigation
  // below still applies.
  if (href === "/app" || href.startsWith("/app/")) {
    if (appOrigin() !== window.location.origin) {
      link.setAttribute("href", appOrigin() + href);
      return;
    }
  }

  // Same-origin routes go through the router. preventDefault keeps the docs from
  // reloading, which would otherwise flash the whole page on every link and
  // throw away the reading position.
  event.preventDefault();
  onNavigate();
  navigate(href);
}

/**
 * Copy text and report it in the button.
 *
 * The label is restored after a delay because the button is injected HTML: React
 * will not re-render it, so the "Copied" state has to be undone imperatively.
 */
async function copyCode(text: string, button: HTMLElement) {
  const label = button.querySelector("span");
  const original = label?.textContent ?? "Copy";

  try {
    await navigator.clipboard.writeText(text);
    if (label) label.textContent = "Copied";
    button.setAttribute("data-copied", "true");
  } catch {
    // Clipboard access can be denied by permissions or an insecure origin.
    // Saying so is better than appearing to succeed.
    if (label) label.textContent = "Failed";
  }

  window.setTimeout(() => {
    if (label) label.textContent = original;
    button.removeAttribute("data-copied");
  }, 1600);
}

function Sidebar({
  open,
  query,
  onQuery,
  onNavigate,
  activeSlug,
}: {
  open: boolean;
  query: string;
  onQuery: (value: string) => void;
  onNavigate: () => void;
  activeSlug: string;
}) {
  const groups = docGroups();

  // Filtering happens here rather than on a pre-built index because fifteen
  // pages is small enough that rebuilding the list per keystroke costs nothing,
  // and it avoids a second copy of the titles that could drift from the real
  // ones.
  const needle = query.trim().toLowerCase();
  const matches = (page: DocPage) =>
    needle === "" ||
    page.title.toLowerCase().includes(needle) ||
    page.description.toLowerCase().includes(needle);

  const visible = groups
    .map((group) => ({
      ...group,
      pages: group.pages.filter(matches),
    }))
    .filter((group) => group.pages.length > 0);

  const noResults = visible.length === 0;

  return (
    <nav
      aria-label="Documentation"
      className={`${open ? "block" : "hidden"} lg:sticky lg:top-[90px] lg:block lg:self-start`}
    >
      <div className="lg:max-h-[calc(100vh-120px)] lg:overflow-y-auto lg:pr-2">
        <div className="relative mb-5">
          <svg
            viewBox="0 0 20 20"
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 stroke-current text-faint"
            fill="none"
            strokeWidth="1.7"
          >
            <circle cx="9" cy="9" r="5.5" />
            <path d="M13.5 13.5 17 17" strokeLinecap="round" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(event) => onQuery(event.target.value)}
            placeholder="Search docs"
            aria-label="Search documentation"
            className="w-full rounded-lg border border-edge bg-background py-2 pr-3 pl-8.5 text-[0.88rem] text-foreground placeholder:text-faint focus:border-accent-strong focus:outline-none focus:ring-2 focus:ring-accent/20"
          />
        </div>

        {noResults ? (
          <p className="px-1 text-[0.85rem] text-faint">
            No page matches “{query}”.
          </p>
        ) : (
          visible.map((group) => (
            <div key={group.group} className="mb-6">
              <p className="mb-2 px-3 text-[0.72rem] font-semibold uppercase tracking-[0.11em] text-faint">
                {group.group}
              </p>
              <ul className="flex flex-col gap-0.5">
                {group.pages.map((page) => {
                  const isActive = page.slug === activeSlug;
                  return (
                    <li key={page.slug}>
                      <Link
                        to={`/docs/${page.slug}`}
                        onClick={onNavigate}
                        aria-current={isActive ? "page" : undefined}
                        className={`block rounded-lg px-3 py-1.5 text-[0.89rem] leading-snug transition-colors ${
                          isActive
                            ? "bg-background-alt font-medium text-foreground"
                            : "text-muted hover:bg-hover-bg hover:text-foreground"
                        }`}
                      >
                        {page.title}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        )}

        <p className="mt-2 px-3 text-[0.78rem] text-faint">
          {allDocs().length} pages
        </p>
      </div>
    </nav>
  );
}

function OnThisPage({
  page,
  activeId,
}: {
  page: DocPage;
  activeId: string;
}) {
  // A page with no H2s would render an empty column, which looks like a broken
  // layout rather than an absent feature.
  if (page.headings.length === 0) return null;

  return (
    <aside className="hidden xl:sticky xl:top-[90px] xl:block xl:self-start">
      <p className="mb-3 text-[0.72rem] font-semibold uppercase tracking-[0.11em] text-faint">
        On this page
      </p>
      <ul className="flex flex-col gap-1 border-l border-edge">
        {page.headings.map((heading) => (
          <li key={heading.id}>
            <a
              href={`#${heading.id}`}
              className={`-ml-px block border-l py-1 text-[0.83rem] leading-snug transition-colors ${
                heading.depth === 3 ? "pl-6" : "pl-3"
              } ${
                activeId === heading.id
                  ? "border-accent-strong font-medium text-foreground"
                  : "border-transparent text-faint hover:border-edge-strong hover:text-muted"
              }`}
            >
              {heading.text}
            </a>
          </li>
        ))}
      </ul>
    </aside>
  );
}

function Pager({ page, onNavigate }: { page: DocPage; onNavigate: () => void }) {
  if (!page.previous && !page.next) return null;

  return (
    <nav
      aria-label="Documentation pages"
      className="docs-pager mt-14 grid gap-3 sm:grid-cols-2"
    >
      {page.previous ? (
        <Link
          to={`/docs/${page.previous.slug}`}
          onClick={onNavigate}
          className="text-left"
        >
          <span className="pager-direction">Previous</span>
          <span className="pager-title">← {page.previous.title}</span>
        </Link>
      ) : (
        <span />
      )}
      {page.next && (
        <Link
          to={`/docs/${page.next.slug}`}
          onClick={onNavigate}
          className="text-right sm:col-start-2"
        >
          <span className="pager-direction">Next</span>
          <span className="pager-title">{page.next.title} →</span>
        </Link>
      )}
    </nav>
  );
}