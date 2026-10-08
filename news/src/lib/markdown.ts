import DOMPurify from "dompurify";
import { marked } from "marked";

// Render markdown to sanitized HTML. Sanitizing here rather than trusting the
// author is deliberate even though the only author is the admin: the output
// is injected as HTML, and one bypassed check should not be enough to run
// script on the changelog origin.
export function renderMarkdown(source: string): string {
  const html = marked.parse(source, { async: false }) as string;
  return DOMPurify.sanitize(html);
}
