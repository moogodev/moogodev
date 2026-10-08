// The API surface of the news service, always same-origin: in production the
// Go binary serves /api and the pages together, and in dev the Vite proxy
// keeps it that way, so no request ever crosses an origin.

export class ApiError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "ApiError";
  }
}

export interface Post {
  id: number;
  slug: string;
  title: string;
  body: string;
  published: boolean;
  created_at: string;
  updated_at: string;
}

export interface PostInput {
  slug: string;
  title: string;
  body: string;
  published: boolean;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    credentials: "same-origin",
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });

  if (response.status === 204) {
    return null as T;
  }

  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const envelope = (body as { error?: { code?: string; message?: string } } | null)?.error;
    throw new ApiError(
      envelope?.code ?? "unknown",
      envelope?.message ?? `Request failed (${response.status}).`,
    );
  }
  return body as T;
}

export const api = {
  posts: () => request<{ posts: Post[] }>("/api/posts"),
  post: (slug: string) => request<{ post: Post }>(`/api/posts/${encodeURIComponent(slug)}`),
  myPosts: () => request<{ posts: Post[] }>("/api/admin/posts"),
  me: () => request<{ email: string }>("/api/me"),
  login: (email: string, password: string) =>
    request<{ email: string }>("/api/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  logout: () => request<null>("/api/logout", { method: "POST" }),
  createPost: (input: PostInput) =>
    request<{ post: Post }>("/api/admin/posts", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updatePost: (id: number, input: PostInput) =>
    request<{ post: Post }>(`/api/admin/posts/${id}`, {
      method: "PUT",
      body: JSON.stringify(input),
    }),
  deletePost: (id: number) =>
    request<null>(`/api/admin/posts/${id}`, { method: "DELETE" }),
};
