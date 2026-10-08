import { useEffect, useState } from "react";
import { api, ApiError, type Post } from "../lib/api";
import { renderMarkdown } from "../lib/markdown";

// The public changelog. Deep links from the dashboard point at #slug, so each
// article carries its slug as an id and the browser does the scrolling.
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
          {posts.map((post) => (
            <article key={post.id} id={post.slug} className="post-anchor border-t border-line pt-6">
              <div className="flex items-baseline gap-3">
                <h2 className="text-[1.05rem] font-semibold tracking-tight">{post.title}</h2>
                <time className="shrink-0 text-[0.76rem] text-faint" dateTime={post.created_at}>
                  {formatMonth(post.created_at)}
                </time>
              </div>
              <div
                className="markdown mt-2"
                // Sanitized in lib/markdown.ts before it ever reaches the DOM.
                dangerouslySetInnerHTML={{ __html: renderMarkdown(post.body) }}
              />
            </article>
          ))}
        </div>
      )}
    </main>
  );
}

// "Oct 2026" in UTC: the dates are written in UTC and a changelog only shows
// the month, so the reader's timezone must not be able to shift it a day.
function formatMonth(rfc3339: string): string {
  const date = new Date(rfc3339);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
}
