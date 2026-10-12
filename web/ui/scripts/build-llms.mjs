// Generates the machine-readable copies of the documentation.
//
// The docs are a client route: /docs/quickstart answers with the single-page
// app shell, and the text only appears once JavaScript runs. A client that does
// not execute scripts -- an AI agent, a link preview, curl -- therefore reads an
// empty page. This script writes the same Markdown the site renders to three
// places those clients can fetch directly:
//
//   llms.txt         a link index of every page, grouped like the sidebar
//   llms-full.txt    the whole corpus in one file, for a single fetch
//   docs/<slug>.md   one page, served at /docs/<slug>.md
//
// It runs after `vite build` because Vite empties the output directory, and it
// reads the sidebar order out of src/lib/docs.ts so the index cannot drift from
// what the site shows.
//
// Run with: node scripts/build-llms.mjs

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Marked } from "marked";

const here = dirname(fileURLToPath(import.meta.url));
const uiDir = join(here, "..");
const docsDir = join(uiDir, "src", "content", "docs");
const distDir = join(uiDir, "..", "dist");

if (!existsSync(docsDir)) {
  throw new Error(`documentation directory not found: ${docsDir}`);
}
if (!existsSync(distDir)) {
  throw new Error("web/dist is missing; run `vite build` before this script");
}

const parser = new Marked({ gfm: true, breaks: false });

// --- Reading the Markdown -----------------------------------------------

function textOf(tokens) {
  return tokens
    .map((token) => ("tokens" in token ? textOf(token.tokens) : (token.text ?? "")))
    .join("");
}

function firstHeading(tokens) {
  const heading = tokens.find((token) => token.type === "heading" && token.depth === 1);
  return heading ? textOf(heading.tokens).trim() : "";
}

function firstParagraph(tokens) {
  for (const token of tokens) {
    if (token.type !== "paragraph") continue;
    const text = textOf(token.tokens).trim();
    if (text) return text;
  }
  return "";
}

// Files are named NN-slug.md; the URL uses the slug alone. The numeric prefix
// is stripped from the basename only, matching slugFromPath() in lib/docs.ts.
const slugOf = (path) =>
  path.split("/").pop().replace(/\.md$/, "").replace(/^\d+-/, "");

// The sidebar order is an editorial decision declared in docs.ts. Read it out
// of the source rather than duplicating the list here, so adding a page to the
// sidebar cannot leave it out of the index or reorder it by accident.
function readLayout() {
  const source = readFileSync(join(uiDir, "src", "lib", "docs.ts"), "utf8");
  const guideGroup = source.match(/const GUIDE_GROUP = "([^"]+)";/)?.[1];

  const groups = [];
  const entry = /group:\s*(GUIDE_GROUP|"([^"]+)")\s*,\s*slugs:\s*\[([^\]]*)\]/g;
  for (const match of source.matchAll(entry)) {
    const group = match[1] === "GUIDE_GROUP" ? guideGroup : match[2];
    const slugs = [...match[3].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
    if (group) groups.push({ group, slugs });
  }

  if (groups.length === 0) {
    throw new Error("could not read the sidebar layout out of src/lib/docs.ts");
  }
  return groups;
}

function oneLine(text) {
  const collapsed = text.replace(/\s+/g, " ").trim();
  if (collapsed.length <= 240) return collapsed;
  return collapsed.slice(0, 237).replace(/\s+\S*$/, "") + "...";
}

const intro =
  "Moogo is a hosted backend that gives every project its own SQLite " +
  "database and object storage, reachable over plain HTTP: no connection " +
  "string, driver, or database client to install.";

const files = readdirSync(docsDir, { recursive: true })
  .filter((name) => name.endsWith(".md"))
  .map((name) => name.replaceAll("\\", "/"))
  .sort();

const docs = new Map();
for (const file of files) {
  const slug = slugOf(file);
  if (docs.has(slug)) {
    throw new Error(`two documents share the slug "${slug}"`);
  }
  const source = readFileSync(join(docsDir, file), "utf8");
  const tokens = parser.lexer(source);
  docs.set(slug, {
    slug,
    title: firstHeading(tokens) || slug,
    description: firstParagraph(tokens),
    source,
  });
}

// Reading order: the sidebar layout, then anything authored but not yet placed.
const ordered = [];
const seen = new Set();
for (const { group, slugs } of readLayout()) {
  for (const slug of slugs) {
    if (!docs.has(slug) || seen.has(slug)) continue;
    ordered.push({ ...docs.get(slug), group });
    seen.add(slug);
  }
}
for (const [slug, doc] of docs) {
  if (!seen.has(slug)) ordered.push({ ...doc, group: "Reference" });
}

const index = ["# Moogo", "", `> ${intro}`, ""];
let currentGroup = null;
for (const doc of ordered) {
  if (doc.group !== currentGroup) {
    if (currentGroup !== null) index.push("");
    currentGroup = doc.group;
    index.push(`## ${currentGroup}`, "");
  }
  const description = oneLine(doc.description);
  index.push(
    `- [${doc.title}](/docs/${doc.slug}.md)${description ? `: ${description}` : ""}`,
  );
}
index.push("");

const full = ["# Moogo documentation", "", `> ${intro}`, ""];
for (const doc of ordered) {
  full.push("---", "", `<!-- source: /docs/${doc.slug}.md -->`, "", doc.source.trimEnd(), "");
}

const markdownDir = join(distDir, "docs");
rmSync(markdownDir, { recursive: true, force: true });
mkdirSync(markdownDir, { recursive: true });
for (const doc of ordered) {
  writeFileSync(join(markdownDir, `${doc.slug}.md`), doc.source);
}
writeFileSync(join(distDir, "llms.txt"), index.join("\n") + "\n");
writeFileSync(join(distDir, "llms-full.txt"), full.join("\n") + "\n");

console.log(`llms.txt: ${ordered.length} documents indexed`);
