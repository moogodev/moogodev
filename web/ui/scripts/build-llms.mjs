// Generates the machine-readable copies of the documentation.
//
// The docs are a client route: /docs/quickstart answers with the single-page
// app shell, and the text only appears once JavaScript runs. A client that does
// not execute scripts -- an AI agent, a link preview, curl -- therefore reads an
// empty page. This script writes the same Markdown the site renders to places
// those clients can fetch directly:
//
//   llms.txt         a link index of every page, grouped like the sidebar
//   agent.txt        a link index of every page (alternate filename)
//   llms-full.txt    the whole corpus in one file, for a single fetch
//   agent-full.txt   the whole corpus in one file (alternate filename)
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

// ---------- Markdown helpers (stand-alone, no import.meta.glob) ----------

const marked = new Marked({ gfm: true, breaks: false });

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

// slug from NN-slug.md -> slug  (strip numeric prefix + .md)
const slugOf = (path) =>
  path.split("/").pop().replace(/\.md$/, "").replace(/^\d+-/, "");

// Read the sidebar layout out of src/lib/docs.ts so the index cannot drift.
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

// Order documents by the sidebar layout, then anything orphaned under "Reference".
function buildOrderedDocs() {
  const docs = new Map();
  const files = readdirSync(docsDir, { recursive: true })
    .filter((name) => name.endsWith(".md"))
    .map((name) => name.replaceAll("\\", "/"))
    .sort();

  for (const file of files) {
    const slug = slugOf(file);
    if (docs.has(slug)) throw new Error(`two docs share slug "${slug}"`);
    const source = readFileSync(join(docsDir, file), "utf8");
    const tokens = marked.lexer(source);
    docs.set(slug, {
      slug,
      title: firstHeading(tokens) || slug,
      description: firstParagraph(tokens),
      source,
    });
  }

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
  return ordered;
}

// ------- Index (llms.txt / agent.txt) -----------------------------------

function oneLine(text) {
  const collapsed = text.replace(/\s+/g, " ").trim();
  if (collapsed.length <= 240) return collapsed;
  return collapsed.slice(0, 237).replace(/\s+\S*$/, "") + "...";
}

function buildIndexTxt(groups, docs) {
  const lines = ["# Moogo", "", `> ${intro}`, ""];
  let currentGroup = null;
  for (const doc of docs) {
    if (doc.group !== currentGroup) {
      if (currentGroup !== null) lines.push("");
      currentGroup = doc.group;
      lines.push(`## ${currentGroup}`, "");
    }
    const description = oneLine(doc.description);
    lines.push(
      `- [${doc.title}](/docs/${doc.slug}.md)${description ? `: ${description}` : ""}`,
    );
  }
  lines.push("");
  return lines.join("\n");
}

// ------- Full txt (llms-full.txt / agent-full.txt) --------------------

function buildFullTxt(groups, docs) {
  const parts = ["# Moogo documentation", "", `> ${intro}`, ""];
  for (const doc of docs) {
    parts.push("---", "", `<!-- source: /docs/${doc.slug}.md -->`, "", doc.source.trimEnd(), "");
  }
  return parts.join("\n") + "\n";
}

// ------- Intro text -----------------------------------------------------

const intro =
  "Moogo is a hosted backend that gives every project its own SQLite " +
  "database and object storage, reachable over plain HTTP: no connection " +
  "string, driver, or database client to install.";

// ------- Main -------------------------------------------------------------

const groups = readLayout();
const docs = buildOrderedDocs();
const indexContent = buildIndexTxt(groups, docs);
const fullContent = buildFullTxt(groups, docs);

const markdownDir = join(distDir, "docs");
rmSync(markdownDir, { recursive: true, force: true });
mkdirSync(markdownDir, { recursive: true });
for (const doc of docs) {
  writeFileSync(join(markdownDir, `${doc.slug}.md`), doc.source);
}
writeFileSync(join(distDir, "llms.txt"), indexContent + "\n");
writeFileSync(join(distDir, "llms-full.txt"), fullContent);
writeFileSync(join(distDir, "agent.txt"), indexContent + "\n");
writeFileSync(join(distDir, "agent-full.txt"), fullContent);

console.log(`llms.txt: ${docs.length} documents indexed`);
console.log(`agent.txt: generated (alternate filename)`);
