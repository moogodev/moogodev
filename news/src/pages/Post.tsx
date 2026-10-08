import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, ApiError, type Post } from "../lib/api";
import { renderMarkdown } from "../lib/markdown";

// One post in full — the page every "Read more" link on the index points to.
// The URL is news.moogo.dev/<slug>, so the dashboard can link straight here.
// Layout: the article on the left, the rest of the changelog as a short list
// on the right, so reading one post never becomes a dead end.
export default function PostPage() {
  const { slug } = useParams<{ slug: string }>();
  const [post, setPost] = useState<Post | null>(null);
  const [siblings, setSiblings] = useState<Post[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!slug) {
      setMissing(true);
      return;
    }
    // The sidebar list is loaded alongside the post but never blocks it: if
    // it fails, the article still reads.
    void api
      .posts()
      .then(({ posts }) => {
        if (!cancelled) setSiblings(posts);
      })
      .catch(() => {});
    api
      .post(slug)
      .then(({ post }) => {
        if (!cancelled) setPost(post);
      })
      .catch((cause) => {
        if (cancelled) return;
        if (cause instanceof ApiError && cause.code === "not_found") {
          setMissing(true);
        } else {
          setError(cause instanceof ApiError ? cause.message : "Could not load the post.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (missing) {
    return (
      <main className="mx-auto w-full max-w-[960px] px-6 py-14">
        <p className="text-[1.05rem] font-semibold">Post not found</p>
        <p className="mt-1 text-[0.9rem] text-muted">
          It may have been unpublished or deleted.
        </p>
        <Link to="/" className="mt-4 inline-block text-[0.88rem] text-accent hover:underline">
          ← Back to What&apos;s new
        </Link>
      </main>
    );
  }

  if (error) {
    return (
      <main className="mx-auto w-full max-w-[960px] px-6 py-14">
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

  if (post === null) {
    return (
      <main className="mx-auto w-full max-w-[960px] px-6 py-14">
        <p className="text-[0.9rem] text-faint">Loading…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-[960px] px-6 py-10">
      <Link to="/" className="text-[0.84rem] text-accent hover:underline">
        ← All posts
      </Link>

      <div className="mt-5 grid gap-10 md:grid-cols-[minmax(0,1fr)_230px]">
        <article className="post-anchor min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-3 border-b border-line pb-4">
            <h1 className="text-[clamp(1.35rem,3vw,1.75rem)] font-semibold tracking-tight">{post.title}</h1>
            <time className="shrink-0 text-[0.78rem] text-faint" dateTime={post.created_at}>
              {formatMonth(post.created_at)}
            </time>
          </div>
          <div
            className="markdown mt-5"
            // Sanitized in lib/markdown.ts before it ever reaches the DOM.
            dangerouslySetInnerHTML={{ __html: renderMarkdown(post.body) }}
          />
        </article>

        {siblings.length > 1 && (
          <aside className="min-w-0 md:border-l md:border-line md:pl-6">
            <h2 className="text-[0.72rem] font-bold uppercase tracking-wider text-faint">
              More posts
            </h2>
            <ul className="mt-3 space-y-3">
              {siblings.map((other) => {
                const current = other.slug === post.slug;
                return (
                  <li key={other.id}>
                    <Link
                      to={`/${other.slug}`}
                      aria-current={current ? "page" : undefined}
                      className={`block text-[0.85rem] leading-snug ${
                        current ? "font-semibold text-accent" : "text-muted hover:text-accent"
                      }`}
                    >
                      {other.title}
                      <span className="mt-0.5 block text-[0.72rem] text-faint">
                        {formatMonth(other.created_at)}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </aside>
        )}
      </div>

      <div className="mt-10 border-t border-line pt-4">
        <Link to="/" className="text-[0.84rem] text-accent hover:underline">
          ← Back to What&apos;s new
        </Link>
      </div>
    </main>
  );
}

// "Oct 2026" in UTC: same rule as the index, so a post never shows two
// different months depending on where it is read from.
function formatMonth(rfc3339: string): string {
  const date = new Date(rfc3339);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
}
