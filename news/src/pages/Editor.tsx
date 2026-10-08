import { useEffect, useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { api, ApiError, type Post, type PostInput } from "../lib/api";

interface FormState {
  title: string;
  slug: string;
  body: string;
  published: boolean;
}

const emptyForm: FormState = { title: "", slug: "", body: "", published: false };

// The single admin's workspace. Every mutating call goes to /api/admin, which
// the server gates on the session cookie — this guard only decides which page
// to render, the API enforces the rule.
export default function Editor() {
  const [auth, setAuth] = useState<"checking" | "in" | "out">("checking");
  const [me, setMe] = useState<string>("");
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingID, setEditingID] = useState<number | null>(null);
  const [slugTouched, setSlugTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<{ kind: "ok" | "bad"; text: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  async function refresh() {
    try {
      const { posts } = await api.myPosts();
      setPosts(posts);
      setListError(null);
    } catch (cause) {
      setListError(cause instanceof ApiError ? cause.message : "Could not load posts.");
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const account = await api.me();
        if (cancelled) return;
        setMe(account.email);
        setAuth("in");
        await refresh();
      } catch {
        if (!cancelled) setAuth("out");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (auth === "checking") {
    return (
      <main className="mx-auto w-full max-w-[720px] px-6 py-14">
        <p className="text-[0.9rem] text-faint">Loading…</p>
      </main>
    );
  }
  if (auth === "out") {
    return <Navigate to="/login" replace />;
  }

  function onTitle(value: string) {
    setForm((current) => ({
      ...current,
      title: value,
      slug: slugTouched ? current.slug : slugify(value),
    }));
  }

  function startEdit(post: Post) {
    setEditingID(post.id);
    setSlugTouched(true);
    setFlash(null);
    setConfirmDelete(null);
    setForm({ title: post.title, slug: post.slug, body: post.body, published: post.published });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetForm() {
    setEditingID(null);
    setSlugTouched(false);
    setForm(emptyForm);
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setFlash(null);
    const input: PostInput = {
      title: form.title.trim(),
      slug: form.slug.trim(),
      body: form.body,
      published: form.published,
    };
    try {
      if (editingID === null) {
        await api.createPost(input);
        setFlash({ kind: "ok", text: "Post created." });
      } else {
        await api.updatePost(editingID, input);
        setFlash({ kind: "ok", text: "Post saved." });
      }
      resetForm();
      await refresh();
    } catch (cause) {
      setFlash({
        kind: "bad",
        text: cause instanceof ApiError ? cause.message : "Could not save the post.",
      });
    } finally {
      setBusy(false);
    }
  }

  async function togglePublished(post: Post) {
    try {
      await api.updatePost(post.id, {
        slug: post.slug,
        title: post.title,
        body: post.body,
        published: !post.published,
      });
      setFlash({
        kind: "ok",
        text: post.published ? "Moved to draft." : "Published.",
      });
      await refresh();
    } catch (cause) {
      setFlash({
        kind: "bad",
        text: cause instanceof ApiError ? cause.message : "Could not update the post.",
      });
    }
  }

  async function remove(post: Post) {
    if (confirmDelete !== post.id) {
      setConfirmDelete(post.id);
      return;
    }
    try {
      await api.deletePost(post.id);
      setConfirmDelete(null);
      setFlash({ kind: "ok", text: "Post deleted." });
      if (editingID === post.id) resetForm();
      await refresh();
    } catch (cause) {
      setFlash({
        kind: "bad",
        text: cause instanceof ApiError ? cause.message : "Could not delete the post.",
      });
    }
  }

  async function signOut() {
    await api.logout();
    setAuth("out");
  }

  const canSave = form.title.trim() !== "" && form.slug.trim() !== "" && !busy;

  return (
    <main className="mx-auto w-full max-w-[720px] px-6 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[1.3rem] font-semibold tracking-tight">
            {editingID === null ? "New post" : "Edit post"}
          </h1>
          <p className="text-[0.8rem] text-faint">{me}</p>
        </div>
        <div className="flex items-center gap-3 text-[0.82rem]">
          <a href="/" className="text-accent hover:underline">
            View changelog
          </a>
          <button
            type="button"
            onClick={() => void signOut()}
            className="cursor-pointer rounded-lg border border-line px-3 py-1.5 text-muted hover:bg-card"
          >
            Sign out
          </button>
        </div>
      </div>

      {flash && (
        <div
          role={flash.kind === "bad" ? "alert" : "status"}
          className={`mt-4 rounded-lg border px-4 py-2.5 text-[0.86rem] ${
            flash.kind === "bad" ? "border-line bg-card text-warn" : "border-line bg-card text-accent"
          }`}
        >
          {flash.text}
        </div>
      )}

      <form onSubmit={(event) => void save(event)} className="mt-5 rounded-xl border border-line bg-card p-5">
        <div className="grid gap-4">
          <label className="block">
            <FieldLabel>Title</FieldLabel>
            <input
              required
              value={form.title}
              onChange={(event) => onTitle(event.target.value)}
              placeholder="Per-project buckets with a 256 MB quota"
              className={inputClass}
            />
          </label>

          <label className="block">
            <FieldLabel>Slug</FieldLabel>
            <input
              required
              value={form.slug}
              onChange={(event) => {
                setSlugTouched(true);
                setForm((current) => ({ ...current, slug: event.target.value }));
              }}
              placeholder="per-project-buckets"
              className={`${inputClass} font-mono text-[0.85rem]`}
            />
            <span className="mt-1 block text-[0.74rem] text-faint">
              The URL becomes news.moogo.dev/#{form.slug || "slug"}
            </span>
          </label>

          <label className="block">
            <FieldLabel>Body (markdown)</FieldLabel>
            <textarea
              rows={10}
              value={form.body}
              onChange={(event) => setForm((current) => ({ ...current, body: event.target.value }))}
              placeholder={"What changed, why it matters, and how to use it.\n\n- bullet points welcome\n- `code` too"}
              className={`${inputClass} font-mono text-[0.84rem] leading-relaxed`}
            />
          </label>

          <label className="flex items-center gap-2 text-[0.86rem] text-muted">
            <input
              type="checkbox"
              checked={form.published}
              onChange={(event) => setForm((current) => ({ ...current, published: event.target.checked }))}
              className="h-4 w-4 accent-[var(--color-accent)]"
            />
            Published — visible on the public changelog
          </label>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={!canSave}
              className="cursor-pointer rounded-lg bg-accent px-4 py-2 text-[0.88rem] font-semibold text-accent-ink transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? "Saving…" : editingID === null ? "Create post" : "Save changes"}
            </button>
            {editingID !== null && (
              <button
                type="button"
                onClick={resetForm}
                className="cursor-pointer text-[0.86rem] text-muted hover:text-ink"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      </form>

      <h2 className="mt-8 text-[0.8rem] font-bold uppercase tracking-wider text-faint">All posts</h2>

      {listError && (
        <div role="alert" className="mt-3 rounded-lg border border-line bg-card px-4 py-3 text-[0.86rem] text-warn">
          {listError}{" "}
          <button type="button" onClick={() => void refresh()} className="underline">
            Retry
          </button>
        </div>
      )}

      {posts === null && !listError ? (
        <p className="mt-3 text-[0.88rem] text-faint">Loading…</p>
      ) : posts && posts.length === 0 ? (
        <p className="mt-3 text-[0.88rem] text-muted">No posts yet. Create the first one above.</p>
      ) : (
        <ul className="mt-2 border-t border-line">
          {(posts ?? []).map((post) => (
            <li key={post.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line py-3">
              <span
                className={`shrink-0 rounded px-1.5 py-0.5 text-[0.66rem] font-bold uppercase tracking-wide ${
                  post.published ? "bg-accent/15 text-accent" : "bg-card text-faint"
                }`}
              >
                {post.published ? "Live" : "Draft"}
              </span>
              <span className="min-w-0 flex-1 truncate text-[0.9rem] font-medium">{post.title}</span>
              <span className="text-[0.74rem] text-faint">{formatDay(post.updated_at)}</span>
              <span className="flex shrink-0 items-center gap-2 text-[0.78rem]">
                <button
                  type="button"
                  onClick={() => void startEdit(post)}
                  className="cursor-pointer text-accent hover:underline"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => void togglePublished(post)}
                  className="cursor-pointer text-muted hover:text-ink"
                >
                  {post.published ? "Unpublish" : "Publish"}
                </button>
                <button
                  type="button"
                  onClick={() => void remove(post)}
                  className={`cursor-pointer ${confirmDelete === post.id ? "text-warn" : "text-muted hover:text-ink"}`}
                >
                  {confirmDelete === post.id ? "Sure?" : "Delete"}
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

const inputClass =
  "mt-1 w-full rounded-lg border border-line bg-page px-3 py-2 text-[0.9rem] text-ink placeholder:text-faint focus:border-accent focus:outline-none";

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className="text-[0.78rem] font-semibold uppercase tracking-wider text-faint">{children}</span>;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

// "Oct 5, 2026" in UTC — enough precision for a changelog's admin list.
function formatDay(rfc3339: string): string {
  const date = new Date(rfc3339);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}
