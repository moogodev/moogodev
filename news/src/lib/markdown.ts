import DOMPurify from "dompurify";
import { marked } from "marked";

// Render markdown to sanitized HTML. Sanitizing here rather than trusting the
// author is deliberate even though the only author is the admin: the output
// is injected as HTML, and one bypassed check should not be enough to run
// script on the changelog origin.
//
// The tag list is a second fence on top of DOMPurify's defaults. Markdown
// cannot produce any of these tags, so a crafted body, a marked regression
// or a DOMPurify bypass still has to get past a denial that has nothing to do
// with parsing: no embedded documents, no form controls that could imitate
// the editor's sign-in, and no style blocks that could restyle the page.
export function renderMarkdown(source: string): string {
  const html = marked.parse(source, { async: false }) as string;
  return DOMPurify.sanitize(html, {
    FORBID_TAGS: [
      "style",
      "form",
      "input",
      "button",
      "select",
      "option",
      "textarea",
      "iframe",
      "object",
      "embed",
      "math",
      "svg",
    ],
    FORBID_ATTR: ["style"],
  });
}
