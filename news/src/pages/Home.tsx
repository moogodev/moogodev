import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError, type Post } from "../lib/api";
import { renderMarkdown } from "../lib/markdown";

const EXCERPT_LIMIT = 240;

// The public changelog, listed like a mini-blog: each entry shows its title,
// date, and the first blocks of the body with a Read more link into the
// detail page at /<slug>.
export default function Home() {
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const { posts } = await api.posts();
        if (!cancelled) setPosts(posts);
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof ApiError ? cause.message : "Could not load the changelog.");
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <main className="mx-auto w-full max-w-[720px] px-6 py-14">
        <div role="alert" className="rounded-lg border border-line bg-card px-4 py-3 text-[0.9rem] text-warn">
          {error}
        </div>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-4 cursor-pointer text-[0.85rem] text-accent hover:underline"
        >
          Try again
        </button>
      </main>
    );
  }

  if (posts === null) {
    return (
      <main className="mx-auto w-full max-w-[720px] px-6 py-14">
        <p className="text-[0.9rem] text-faint">Loading…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-[720px] px-6 py-10">
      <h1 className="text-[clamp(1.6rem,3.5vw,2.1rem)] font-semibold tracking-tight">What&apos;s new</h1>
      <p className="mt-1 text-[0.9rem] text-muted">
        Releases, features, and fixes — straight from the team building Moogo.
      </p>

      {posts.length === 0 ? (
        <p className="mt-10 text-[0.9rem] text-faint">Nothing published yet.</p>
      ) : (
        <div className="mt-8 space-y-8">
          {posts.map((post) => {
            const excerpt = excerptMarkdown(post.body, EXCERPT_LIMIT);
            return (
              // The slug as the id keeps old #slug deep links working: they
              // land on the matching entry in this list.
              <article key={post.id} id={post.slug} className="post-anchor border-t border-line pt-6">
                <div className="flex items-baseline gap-3">
                  <h2 className="min-w-0 text-[1.05rem] font-semibold tracking-tight">
                    <Link to={`/${post.slug}`} className="hover:text-accent">
                      {post.title}
                    </Link>
                  </h2>
                  <time className="shrink-0 text-[0.76rem] text-faint" dateTime={post.created_at}>
                    {formatMonth(post.created_at)}
                  </time>
                </div>
                <div
                  className="markdown mt-2"
                  // Sanitized in lib/markdown.ts before it ever reaches the DOM.
                  dangerouslySetInnerHTML={{ __html: excerpt.html }}
                />
                {excerpt.truncated && (
                  <Link
                    to={`/${post.slug}`}
                    className="mt-2 inline-block text-[0.85rem] font-medium text-accent hover:underline"
                  >
                    Read more →
                  </Link>
                )}
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
}

// excerptMarkdown renders the first complete markdown blocks of a body, so a
// long post becomes a teaser instead of the whole article. Blocks stay whole
// (a heading is never sliced from its text) and only a single oversized block
// gets cut, at a word boundary, so the rendered teaser never breaks.
function excerptMarkdown(body: string, limit: number): { html: string; truncated: boolean } {
  if (body.length <= limit) {
    return { html: renderMarkdown(body), truncated: false };
  }

  const blocks = body.split(/\n{2,}/);
  const kept: string[] = [];
  let total = 0;
  for (const block of blocks) {
    if (kept.length > 0 && total + block.length + 2 > limit) break;
    kept.push(block);
    total += block.length + 2;
    if (total >= limit) break;
  }

  let source = kept.join("\n\n");
  let truncated = kept.length < blocks.length;
  if (source.length > limit) {
    const cut = source.lastIndexOf(" ", limit);
    source = `${source.slice(0, cut > 0 ? cut : limit).trimEnd()} …`;
    truncated = true;
  }
  return { html: renderMarkdown(source), truncated };
}

// "Oct 2026" in UTC: the dates are written in UTC and a changelog only shows
// the month, so the reader's timezone must not be able to shift it a day.
function formatMonth(rfc3339: string): string {
  const date = new Date(rfc3339);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
}
