// The server embeds the failed status in the document it serves when a
// browser request to a page address could not be handled: a hidden data
// block ahead of the app root, read once here. Requests that fail only in the
// client, or when the marker is absent, fall back to the default 404.
export type ServerError = {
  status: number;
};

export function readServerError(): ServerError | null {
  const marker = document.getElementById("moogo-error");
  if (!marker) {
    return null;
  }

  try {
    const parsed = JSON.parse(marker.textContent ?? "") as { status?: unknown };
    if (typeof parsed.status === "number") {
      return { status: parsed.status };
    }
  } catch {
    // A marker that does not parse is treated as no marker at all.
  }
  return null;
}
