// Search index types and builder
//
// The index is built once after all docs are loaded, and provides fast
// client-side search across title, description, headings, and content.

import type { DocPage, DocHeading } from "./docs";

export interface SearchResult {
  page: DocPage;
  score: number;
  matches: SearchMatch[];
}

export interface SearchMatch {
  type: "title" | "description" | "heading" | "content";
  text: string;
  headingId?: string; // for headings, the anchor to scroll to
}

// Build a search index from all pages.
// Called once after ensureDocs() resolves.
export function buildSearchIndex(pages: DocPage[]): SearchIndex {
  const docs: SearchDoc[] = [];

  for (const page of pages) {
    const raw = rawDoc(page.slug);
    const contentText = raw ? extractTextContent(raw) : "";

    docs.push({
      slug: page.slug,
      title: page.title,
      description: page.description,
      group: page.group,
      headings: page.headings,
      content: contentText,
    });
  }

  return new SearchIndex(docs);
}

interface SearchDoc {
  slug: string;
  title: string;
  description: string;
  group: string;
  headings: DocHeading[];
  content: string;
}

export class SearchIndex {
  private docs: SearchDoc[];
  private titleIndex: Map<string, Set<number>> = new Map();
  private contentIndex: Map<string, Set<number>> = new Map();

  constructor(docs: SearchDoc[]) {
    this.docs = docs;
    this.buildIndexes();
  }

  private buildIndexes(): void {
    for (let i = 0; i < this.docs.length; i++) {
      const doc = this.docs[i];

      // Index title words (high weight)
      this.indexText(doc.title.toLowerCase(), i, this.titleIndex, 3);

      // Index description words (medium weight)
      this.indexText(doc.description.toLowerCase(), i, this.contentIndex, 2);

      // Index headings (high weight)
      for (const h of doc.headings) {
        this.indexText(h.text.toLowerCase(), i, this.contentIndex, 3);
      }

      // Index content words (lower weight)
      this.indexText(doc.content.toLowerCase(), i, this.contentIndex, 1);
    }
  }

  private indexText(
    text: string,
    docIndex: number,
    index: Map<string, Set<number>>,
    _weight: number
  ): void {
    const words = text
      .split(/[^\p{L}\p{N}]+/u)
      .filter((w) => w.length >= 2)
      .map((w) => w.slice(0, 50)); // cap word length

    for (const word of words) {
      if (!index.has(word)) index.set(word, new Set());
      index.get(word)!.add(docIndex);
    }
  }

  search(query: string, limit = 10): SearchResult[] {
    const terms = query
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((t) => t.length >= 2);

    if (terms.length === 0) return [];

    // Score each document
    const scores = new Map<number, { score: number; matches: SearchMatch[] }>();

    for (const term of terms) {
      // Exact prefix matches in title index
      for (const [word, docIndices] of this.titleIndex) {
        if (word.startsWith(term)) {
          for (const idx of docIndices) {
            this.addScore(idx, scores, 10, "title", word);
          }
        }
      }

      // Fuzzy matches in content index
      for (const [word, docIndices] of this.contentIndex) {
        if (word.startsWith(term) || this.levenshtein(word, term) <= 1) {
          for (const idx of docIndices) {
            const baseScore = word.startsWith(term) ? 5 : 2;
            this.addScore(idx, scores, baseScore, "content", word);
          }
        }
      }
    }

    // Convert to results, sort by score
    const results: SearchResult[] = [];
    for (const [idx, { score, matches }] of scores) {
      if (score > 0) {
        const page = findDoc(this.docs[idx].slug);
        if (page) {
          results.push({ page, score, matches: this.deduplicateMatches(matches) });
        }
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  }

  private addScore(
    idx: number,
    scores: Map<number, { score: number; matches: SearchMatch[] }>,
    points: number,
    type: SearchMatch["type"],
    matchedText: string
  ): void {
    const existing = scores.get(idx) ?? { score: 0, matches: [] };
    existing.score += points;
    existing.matches.push({ type, text: matchedText });
    scores.set(idx, existing);
  }

  private deduplicateMatches(matches: SearchMatch[]): SearchMatch[] {
    const seen = new Set<string>();
    return matches.filter((m) => {
      const key = `${m.type}:${m.text}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private levenshtein(a: string, b: string): number {
    if (a.length < b.length) return this.levenshtein(b, a);
    if (b.length === 0) return a.length;

    let previousRow = Array.from({ length: b.length + 1 }, (_, i) => i);

    for (let i = 0; i < a.length; i++) {
      const currentRow = [i + 1];
      for (let j = 0; j < b.length; j++) {
        const insertCost = currentRow[j] + 1;
        const deleteCost = previousRow[j + 1] + 1;
        const substituteCost = previousRow[j] + (a[i] === b[j] ? 0 : 1);
        currentRow[j + 1] = Math.min(insertCost, deleteCost, substituteCost);
      }
      previousRow = currentRow;
    }

    return previousRow[b.length];
  }
}

// Extract plain text from markdown for content indexing
function extractTextContent(markdown: string): string {
  return markdown
    .replace(/^#{1,6}\s.*$/gm, "") // headings
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // links -> text
    .replace(/`([^`]+)`/g, "$1") // inline code
    .replace(/\*\*([^*]+)\*\*/g, "$1") // bold
    .replace(/\*([^*]+)\*/g, "$1") // italic
    .replace(/```[\s\S]*?```/g, "") // code blocks
    .replace(/`[^`]+`/g, "") // remaining inline code
    .replace(/[#>*\-\[\]()]/g, " ") // markdown punctuation
    .replace(/\s+/g, " ")
    .trim();
}

// Re-export for modal component
import { allDocs, findDoc, rawDoc } from "./docs";
export { allDocs, findDoc, rawDoc };