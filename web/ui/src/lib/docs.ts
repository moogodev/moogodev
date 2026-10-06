// The documentation source.
//
// Every page is a Markdown file under content/docs/, bundled into the app at
// build time by the glob import below. That means the docs ship inside the same
// Go binary as the rest of the frontend, are versioned with the code they
// describe, and cost no request at runtime.
//
// The alternative -- fetching markdown from the server -- was rejected because
// it makes a documentation page depend on a second network call, and a docs site
// that shows a spinner because an API is restarting is a bad first impression.
//
// Rendering is marked for Markdown, then DOMPurify for sanitizing. Both run once
// per page per session and the result is memoized in the page component.

import DOMPurify from "dompurify";
import { Marked, type Token, type Tokens } from "marked";

/** One entry in the sidebar. */
export interface DocPage {
  /** URL segment: /docs/sql-api. */
  slug: string;
  /** H1 taken from the file, so the title lives in one place. */
  title: string;
  /** First paragraph, used for the sidebar subtitle and meta description. */
  description: string;
  /** Which sidebar group the page belongs to. */
  group: string;
  /** Previous page in reading order, for the footer pager. */
  previous: DocPage | null;
  /** Next page in reading order. */
  next: DocPage | null;
  /** H2 and H3 headings, for the on-this-page list. */
  headings: DocHeading[];
}

/** One entry in the on-this-page list. */
export interface DocHeading {
  depth: number;
  text: string;
  id: string;
}

/** Raw Markdown keyed by file path. */
const sources = import.meta.glob("/src/content/docs/**/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

// The sidebar is declared here rather than derived from the filesystem, because
// grouping is an editorial decision and filenames are not an editorial format.
//
// Order within a group is the order listed. A slug in the manifest that has no
// file is dropped rather than rendered as an empty entry, and a file not in the
// manifest is appended under "Reference" so an unfinished page is still reachable
// instead of silently vanishing from the docs.
const layout: { group: string; slugs: string[] }[] = [
  {
    group: "Getting started",
    slugs: ["quickstart", "what-is-moogo", "why-moogo", "comparison", "register"],
  },
  {
    group: "Using Moogo",
    slugs: [
      "create-project",
      "credentials",
      "sql-api",
      "create-bucket",
      "object-storage",
      "dashboard",
    ],
  },
  {
    group: "Language Guides",
    slugs: [
      "javascript-vanilla",
      "react",
      "nextjs",
      "nuxt",
      "vue",
      "astro",
      "python-vanilla",
      "fastapi",
      "flask",
      "django",
      "php-vanilla",
      "laravel",
      "go",
      "ruby-rails",
      "java-kotlin",
    ],
  },
  {
    group: "Database",
    slugs: ["schema-best-practices"],
  },
  {
    group: "Reference",
    slugs: ["limits", "security", "errors", "feedback"],
  },
];

// Files are named NN-slug.md so the glob order matches reading order. Strip the
// numeric prefix to get the slug the URL uses.
function slugFromPath(path: string): string {
  const name = path.split("/").pop() ?? "";
  return name.replace(/\.md$/, "").replace(/^\d+-/, "");
}

function sourceFor(slug: string): string | undefined {
  const match = Object.keys(sources).find(
    (path) => slugFromPath(path) === slug,
  );
  return match ? sources[match] : undefined;
}

/** Slugify a heading into a stable anchor id. */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[`*_~]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Assigns unique anchor ids to headings in document order.
 *
 * Duplicates get a numeric suffix so two headings called "Notes" do not fight
 * over one anchor. A fresh instance is used for the table-of-contents pass and
 * for the render pass, and both traverse headings in the same order with the
 * same algorithm, so the ids they produce agree.
 */
class Slugger {
  private seen = new Map<string, number>();

  slug(text: string): string {
    const base = slugify(text) || "section";
    const count = this.seen.get(base) ?? 0;
    this.seen.set(base, count + 1);
    return count === 0 ? base : `${base}-${count}`;
  }
}

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

function textOf(tokens: Token[]): string {
  return tokens
    .map((token) => {
      if ("tokens" in token) {
        return textOf((token as { tokens: Token[] }).tokens);
      }
      return "text" in token ? String((token as Tokens.Text).text) : "";
    })
    .join("");
}

function isHeading(token: Token): token is Tokens.Heading {
  return token.type === "heading";
}

/** Collect the H2 and H3 headings of a document, in order. */
function collectHeadings(tokens: Token[]): DocHeading[] {
  const slugger = new Slugger();
  const headings: DocHeading[] = [];

  for (const token of tokens) {
    if (!isHeading(token)) continue;
    if (token.depth < 2 || token.depth > 3) continue;
    const text = textOf(token.tokens).trim();
    if (!text) continue;
    headings.push({ depth: token.depth, text, id: slugger.slug(text) });
  }

  return headings;
}

// Anchor ids for the headings of the document currently being rendered.
//
// The renderer is called once per heading, in document order, with no way to know
// which heading it is looking at. The ids are therefore computed up front by the
// same traversal that builds the table of contents, and the renderer reads them
// off this queue.
//
// It is module-level because marked's renderer object is built once and holds no
// per-document state. That is safe only because rendering is synchronous: the
// queue is refilled immediately before each parse and fully drained by it, so no
// two documents can ever be in flight at once.
let headingQueue: string[] = [];

// marked's own renderer, extended rather than replaced. The heading override is
// what adds the anchor ids and the clickable link; the code override adds a
// language label and the copy button the page attaches behaviour to.
//
// parser.parser() is called with no options argument on purpose. Passing any
// options object replaces the instance defaults wholesale, and the replacement
// carries no renderer, so every override in here would be silently discarded.
const parser = new Marked({
  gfm: true,
  breaks: false,
  renderer: {
    heading({ tokens, depth }) {
      // The H1 is the page title and is rendered by the layout, so the body
      // starts at the first H2. Rendering it here as well is what makes a docs
      // page show its title twice.
      if (depth === 1) return "";

      const text = textOf(tokens);
      const id = headingQueue.shift() ?? slugify(text);

      const anchor =
        depth === 2
          ? `<a class="heading-anchor" href="#${id}" aria-label="Link to ${escapeHtml(
              text,
            )}">#</a>`
          : "";

      return `<h${depth} id="${id}">${text}${anchor}</h${depth}>\n`;
    },

    code({ text, lang }) {
      const language = (lang ?? "").trim().split(/\s+/)[0];
      const label = language
        ? `<span class="code-lang">${escapeHtml(language)}</span>`
        : "";
      const data = language ? ` data-lang="${escapeHtml(language)}"` : "";

      // The copy button is emitted here rather than added in React because the
      // block is injected as HTML. The page listens for clicks on it by
      // delegation, which keeps this module the only thing that decides what the
      // rendered markup looks like.
      //
      // type="button" matters: without it the button is a submit button, which
      // would be harmless here only by accident.
      const copy =
        '<button type="button" class="code-copy" aria-label="Copy code to clipboard">' +
        '<svg viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" ' +
        'stroke-width="1.6"><rect x="7" y="7" width="9" height="9" rx="2" />' +
        '<path d="M13 5.5V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h.5" /></svg>' +
        "<span>Copy</span></button>";

      return (
        `<div class="code-block"${data}>` +
        label +
        copy +
        `<pre><code>${escapeHtml(text)}</code></pre>` +
        `</div>\n`
      );
    },

    link({ href, title, tokens }) {
      const inner = textOf(tokens);
      const attributes = title ? ` title="${escapeHtml(title)}"` : "";

      // Internal links stay plain anchors so they keep working with middle-click
      // and "open in new tab". The page intercepts same-origin clicks and routes
      // them without a full reload; external links get the usual protections.
      if (/^https?:\/\//i.test(href)) {
        return (
          `<a href="${escapeHtml(href)}"${attributes} target="_blank" ` +
          `rel="noopener noreferrer">${inner}</a>`
        );
      }
      return `<a href="${escapeHtml(href)}"${attributes}>${inner}</a>`;
    },
  },
});

function firstParagraph(tokens: Token[]): string {
  for (const token of tokens) {
    if (token.type !== "paragraph") continue;
    const text = textOf((token as Tokens.Paragraph).tokens).trim();
    if (text) return text;
  }
  return "";
}

/**
 * Return the tokens without the opening paragraph, when it is the one already
 * shown as the page description.
 *
 * Only the first paragraph is considered, and only when its text matches
 * exactly. A paragraph further down that happens to repeat the description is
 * left alone, because removing it would silently drop content the author wrote.
 */
function withoutLeadingParagraph(tokens: Token[], description: string): Token[] {
  const index = tokens.findIndex((token) => token.type === "paragraph");
  if (index < 0) return tokens;

  const paragraph = tokens[index] as Tokens.Paragraph;
  if (textOf(paragraph.tokens).trim() !== description) return tokens;

  // The heading before it is kept: the layout renders the title from the
  // manifest, but the document's own H1 is what anchors the title to its text.
  return [...tokens.slice(0, index), ...tokens.slice(index + 1)];
}

interface LoadedDoc {
  title: string;
  description: string;
  headings: DocHeading[];
  html: string;
}

/**
 * Parse and render one Markdown document.
 *
 * The result is cached because the Docs route re-renders on every search
 * keystroke and on every sidebar navigation, and re-parsing fifteen documents to
 * show one of them is work that produces the same string every time.
 */
const rendered = new Map<string, LoadedDoc>();

export function loadDoc(slug: string): LoadedDoc | undefined {
  const cached = rendered.get(slug);
  if (cached) return cached;

  const source = sourceFor(slug);
  if (source === undefined) return undefined;

  // Lex once and reuse the tokens for the title, the description, the table of
  // contents and the render. Parsing is the expensive part of this pipeline.
  const tokens = parser.lexer(source);
  const headingTokens = tokens.filter(isHeading);
  const title = headingTokens.length ? textOf(headingTokens[0].tokens).trim() : slug;
  const description = firstParagraph(tokens);
  const headings = collectHeadings(tokens);

  // Drop the opening paragraph from the body.
  //
  // The layout prints the description above the article, and that description
  // is the document's first paragraph, so leaving it in the token stream renders
  // the same two sentences twice in a row. Removing it here rather than asking
  // authors to write a separate summary keeps one source of truth: the text in
  // the Markdown is what appears on the page.
  const body = description
    ? withoutLeadingParagraph(tokens, description)
    : tokens;

  // Refill the id queue so the renderer and the table of contents agree.
  //
  // .map() copies on purpose. The renderer drains the queue with shift(), so
  // handing it the array that is about to become the table of contents would
  // empty that array as a side effect and leave the page with no section list.
  headingQueue = collectHeadings(tokens).map((heading) => heading.id);
  const raw = parser.parser(body);

  // Sanitize before the HTML ever reaches innerHTML.
  //
  // The docs are first-party files compiled into the bundle, so this is not
  // defending against an attacker who can write to content/docs/ -- they would
  // already own the build. It is here so that the habit is never skipped: this
  // module is the one place raw text becomes markup, and it should be safe to
  // point at any Markdown without a second thought.
  const html = DOMPurify.sanitize(raw, {
    // Needed for heading anchors and the code-block language label.
    ADD_ATTR: ["target", "rel", "id"],
    USE_PROFILES: { html: true },
  });

  const loaded: LoadedDoc = { title, description, headings, html };
  rendered.set(slug, loaded);
  return loaded;
}

function buildPages(): DocPage[] {
  const titles = new Map<string, { title: string; description: string }>();

  for (const path of Object.keys(sources)) {
    const slug = slugFromPath(path);
    const loaded = loadDoc(slug);
    if (loaded) titles.set(slug, { title: loaded.title, description: loaded.description });
  }

  const ordered: { slug: string; group: string }[] = [];
  const seen = new Set<string>();

  for (const { group, slugs } of layout) {
    for (const slug of slugs) {
      if (!titles.has(slug) || seen.has(slug)) continue;
      ordered.push({ slug, group });
      seen.add(slug);
    }
  }

  // Anything authored but not yet placed in the sidebar still gets a home.
  for (const slug of titles.keys()) {
    if (!seen.has(slug)) ordered.push({ slug, group: "Reference" });
  }

  // The pager is built in a second pass because each page needs both
  // neighbours, and the first pass cannot know its own position until the whole
  // list exists.
  return ordered.map(({ slug, group }, index) => {
    const meta = titles.get(slug)!;
    const loaded = rendered.get(slug);
    const neighbour = (offset: number): DocPage | null => {
      const other = ordered[index + offset];
      if (!other) return null;
      const otherMeta = titles.get(other.slug)!;
      return {
        slug: other.slug,
        title: otherMeta.title,
        description: otherMeta.description,
        group: other.group,
        previous: null,
        next: null,
        headings: [],
      };
    };

    return {
      slug,
      title: meta.title,
      description: meta.description,
      group,
      previous: neighbour(-1),
      next: neighbour(1),
      headings: loaded?.headings ?? [],
    };
  });
}

// Built once at module load. The manifest is small and every page needs it for
// the sidebar, the pager and the prev/next links.
const pages = buildPages();
const bySlug = new Map(pages.map((page) => [page.slug, page]));

/** Every page, in reading order. */
export function allDocs(): DocPage[] {
  return pages;
}

/** The sidebar, grouped in declaration order. */
export function docGroups(): { group: string; pages: DocPage[] }[] {
  const groups: { group: string; pages: DocPage[] }[] = [];
  for (const page of pages) {
    const existing = groups.find((entry) => entry.group === page.group);
    if (existing) existing.pages.push(page);
    else groups.push({ group: page.group, pages: [page] });
  }
  return groups;
}

export function findDoc(slug: string | undefined): DocPage | undefined {
  if (!slug) return undefined;
  return bySlug.get(slug);
}

/** Render one document's body to sanitized HTML. */
export function renderDoc(slug: string): string {
  return loadDoc(slug)?.html ?? "";
}