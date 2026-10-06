// Verifies the docs markdown pipeline outside a browser.
//
// The Docs page renders Markdown at module load, and a mistake in that pipeline
// (a heading that never gets an anchor, a table that never renders, a sanitizer
// that strips the code blocks) would only show up as a blank page in a running
// app. This exercises the same renderer against the same files and prints what
// it produced, so the output can be checked without a browser.
//
// Run with: node scripts/verify-docs.mjs

import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { Marked } from "marked";
import createDOMPurify from "dompurify";
import { JSDOM } from "jsdom";

const here = dirname(fileURLToPath(import.meta.url));
const docsDir = join(here, "..", "src", "content", "docs");

const escapeHtml = (value) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

function textOf(tokens) {
  return tokens
    .map((token) => ("tokens" in token ? textOf(token.tokens) : (token.text ?? "")))
    .join("");
}

function firstParagraph(tokens) {
  for (const token of tokens) {
    if (token.type !== "paragraph") continue;
    const text = textOf(token.tokens).trim();
    if (text) return text;
  }
  return "";
}

// The layout prints the description above the article, and the description is
// the document's first paragraph, so that paragraph has to be dropped from the
// body or it renders twice in a row.
function withoutLeadingParagraph(tokens, description) {
  const index = tokens.findIndex((token) => token.type === "paragraph");
  if (index < 0) return tokens;
  if (textOf(tokens[index].tokens).trim() !== description) return tokens;
  return [...tokens.slice(0, index), ...tokens.slice(index + 1)];
}

class Slugger {
  seen = new Map();
  slug(text) {
    const base =
      text
        .toLowerCase()
        .replace(/[`*_~]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "section";
    const count = this.seen.get(base) ?? 0;
    this.seen.set(base, count + 1);
    return count === 0 ? base : `${base}-${count}`;
  }
}

let headingQueue = [];

const parser = new Marked({
  gfm: true,
  breaks: false,
  renderer: {
    heading({ tokens, depth }) {
      if (depth === 1) return "";
      const text = textOf(tokens);
      const id = headingQueue.shift() ?? new Slugger().slug(text);
      const anchor =
        depth === 2
          ? `<a class="heading-anchor" href="#${id}" aria-label="Link to ${escapeHtml(text)}">#</a>`
          : "";
      return `<h${depth} id="${id}">${text}${anchor}</h${depth}>\n`;
    },
    code({ text, lang }) {
      const language = (lang ?? "").trim().split(/\s+/)[0];
      return (
        `<div class="code-block"${language ? ` data-lang="${escapeHtml(language)}"` : ""}>` +
        (language ? `<span class="code-lang">${escapeHtml(language)}</span>` : "") +
        `<pre><code>${escapeHtml(text)}</code></pre></div>\n`
      );
    },
  },
});

const window = new JSDOM("").window;
const DOMPurify = createDOMPurify(window);

let failures = 0;
const check = (label, condition, extra = "") => {
  if (!condition) {
    failures += 1;
    console.log(`  FAIL  ${label}${extra ? ` -- ${extra}` : ""}`);
  }
};

// Recurse. docs/guides/*.md are real pages the app ships, and reading only the
// top level left every link into guides/ unverified -- the check reported a
// valid link as broken because guides/ was never in the set of slugs.
const files = readdirSync(docsDir, { recursive: true })
  .filter((name) => name.endsWith(".md"))
  .map((name) => name.replaceAll("\\", "/"))
  .sort();

// Files are named NN-slug.md; the URL uses the slug alone. The leading numeric
// prefix is stripped from the basename only, so guides/14-schema.md and
// schema.md agree on one slug, matching slugFromPath() in lib/docs.ts.
const slugOf = (path) =>
  path.split("/").pop().replace(/\.md$/, "").replace(/^\d+-/, "");

console.log(`Checking ${files.length} documents\n`);

const allSlugs = new Set(files.map(slugOf));

for (const file of files) {
  const slug = slugOf(file);
  const source = readFileSync(join(docsDir, file), "utf8");
  const tokens = parser.lexer(source);

  const h1 = tokens.filter((token) => token.type === "heading" && token.depth === 1);
  check(`${slug}: has exactly one H1`, h1.length === 1, `found ${h1.length}`);

  const headings = tokens.filter(
    (token) => token.type === "heading" && token.depth >= 2 && token.depth <= 3,
  );
  check(`${slug}: has H2 sections`, headings.length >= 2, `found ${headings.length}`);

  // Ids are assigned by the same traversal order the renderer uses, so the
  // table of contents and the rendered anchors cannot disagree.
  const toc = [];
  const slugger = new Slugger();
  for (const token of tokens) {
    if (token.type !== "heading" || token.depth < 2 || token.depth > 3) continue;
    toc.push(slugger.slug(textOf(token.tokens).trim()));
  }
  // Copied, not aliased: the renderer drains the queue with shift(), which would
  // empty the very array this check compares against.
  headingQueue = [...toc];

  const description = firstParagraph(tokens);
  const body = description ? withoutLeadingParagraph(tokens, description) : tokens;

  const html = DOMPurify.sanitize(parser.parser(body), {
    ADD_ATTR: ["target", "rel", "id"],
    USE_PROFILES: { html: true },
  });

  const renderedIds = [...html.matchAll(/<h[23] id="([^"]+)"/g)].map((m) => m[1]);
  check(
    `${slug}: renderer ids match table of contents`,
    JSON.stringify(renderedIds) === JSON.stringify(toc),
    `rendered ${renderedIds.length}, toc ${toc.length}`,
  );

  // The H1 is the page title rendered by the layout, so it must not appear in
  // the body or the page shows its title twice.
  check(`${slug}: H1 not duplicated in body`, !/<h1[\s>]/i.test(html));

  // The description is printed above the article, so the body must not repeat
  // the document's opening paragraph directly underneath it.
  if (description) {
    const firstText = (html.match(/<p>([\s\S]*?)<\/p>/)?.[1] ?? "").replace(
      /<[^>]+>/g,
      "",
    );
    check(
      `${slug}: opening paragraph not repeated in body`,
      firstText.trim() !== description,
      "body starts with the same sentence as the description",
    );
  }
  check(`${slug}: H2 anchors emitted`, (html.match(/id="/g) ?? []).length >= headings.length);
  check(`${slug}: code blocks survive sanitize`, !/class="code-block"[\s\S]{0,400}<pre><code><\/code>/.test(html));

  // Every internal /docs link must resolve to a real page. The path may span
  // more than one segment -- /docs/guides/nextjs addresses one page through a
  // two segment URL -- so the pattern has to allow slashes, or the longest and
  // most fragile links in the corpus are the ones never checked at all.
  for (const match of html.matchAll(/href="(\/docs\/[a-z0-9/-]+)"/g)) {
    let target = match[1].slice("/docs/".length);
    // The SPA serves /docs/guides/:slug from the page whose slug omits the
    // guides/ prefix; resolve it exactly the way main.tsx does.
    if (target.startsWith("guides/")) target = target.slice("guides/".length);
    check(
      `${slug}: link ${match[1]} resolves`,
      allSlugs.has(target),
      "no such page",
    );
  }

  // A heading id must be unique within the page or the TOC highlights the wrong
  // section.
  const ids = [...html.matchAll(/<h[23] id="([^"]+)"/g)].map((m) => m[1]);
  check(`${slug}: heading ids unique`, new Set(ids).size === ids.length);

  const tables = (html.match(/<table>/g) ?? []).length;
  const codes = (html.match(/class="code-block"/g) ?? []).length;
  console.log(
    `  ok    ${slug.padEnd(20)} ${String(ids.length).padStart(2)} headings, ` +
      `${String(tables).padStart(2)} tables, ${String(codes).padStart(2)} code blocks`,
  );
}

// A script tag in the source must not survive sanitization. This is the whole
// reason the pipeline sanitizes at all.
const dirty = DOMPurify.sanitize(
  '<p>ok</p><script>alert(1)</script><img src=x onerror=alert(1)>',
  { ADD_ATTR: ["target", "rel", "id"], USE_PROFILES: { html: true } },
);
check("sanitizer strips <script>", !/<script/i.test(dirty));
check("sanitizer strips onerror", !/onerror/i.test(dirty));

console.log(
  failures === 0
    ? "\nAll checks passed."
    : `\n${failures} check(s) failed.`,
);
process.exit(failures === 0 ? 0 : 1);