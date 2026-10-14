// The documentation search palette.
//
// It is a command palette rather than a dialog: the field sits at the top, the
// results replace the body as you type, and Cmd/Ctrl+K opens it from anywhere
// on a docs page. It is mounted for the life of the route and hidden with an
// early return, which is why every hook is called before that return -- a hook
// placed after it changes the hook count the first time the palette opens, and
// React tears the whole route down in response.
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  buildSearchIndex,
  type SearchIndex,
  type SearchResult,
} from "../lib/search";
import { allDocs, ensureDocs, docsReady } from "../lib/docs";
import { ArrowRight } from "./icons";

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialQuery?: string;
}

export function SearchModal({
  isOpen,
  onClose,
  initialQuery = "",
}: SearchModalProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState(initialQuery);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [searchIndex, setSearchIndex] = useState<SearchIndex | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Build the index once the documents are in memory. The field still opens
  // before then; it simply has nothing to search yet.
  useEffect(() => {
    if (searchIndex) return undefined;

    let cancelled = false;
    const init = async () => {
      if (!docsReady()) await ensureDocs();
      if (cancelled) return;
      if (allDocs().length > 0) setSearchIndex(buildSearchIndex(allDocs()));
    };
    void init();

    return () => {
      cancelled = true;
    };
  }, [searchIndex]);

  // While open, focus the field and hold the page behind it still. Both are
  // released on close so the reading position and the scrollbar come back.
  useEffect(() => {
    if (!isOpen) return undefined;

    const frame = window.setTimeout(() => inputRef.current?.focus(), 30);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.clearTimeout(frame);
      document.body.style.overflow = previous;
    };
  }, [isOpen]);

  // Escape closes the palette even if focus has left the field, which is the
  // path a keyboard user takes when a result turned out to be the wrong one.
  useEffect(() => {
    if (!isOpen) return undefined;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  // Every hook is above this line on purpose; see the file header.
  if (!isOpen) return null;

  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .filter((term) => term.length >= 2);

  // The hits are derived during render rather than stored in state: they are a
  // pure function of the query and the index, and an effect that mirrored them
  // into state would render twice for every keystroke.
  const results =
    searchIndex && query.trim().length >= 2 ? searchIndex.search(query, 10) : [];
  const activeIndex = results.length > 0 ? Math.min(selectedIndex, results.length - 1) : -1;

  // Group the hits under their sidebar section, in the sidebar's order.
  const groups = new Map<string, SearchResult[]>();
  for (const result of results) {
    const bucket = groups.get(result.page.group);
    if (bucket) bucket.push(result);
    else groups.set(result.page.group, [result]);
  }

  const navigateToResult = (result: SearchResult) => {
    const heading = result.matches.find((match) => match.type === "heading");
    const hash = heading?.headingId ? `#${heading.headingId}` : "";
    onClose();
    navigate(`/docs/${result.page.slug}${hash}`);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (results.length > 0) {
        setSelectedIndex((current) => Math.min(current + 1, results.length - 1));
      }
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setSelectedIndex((current) => Math.max(current - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const result = results[activeIndex];
      if (result) navigateToResult(result);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/50 px-3 pb-3 pt-[10vh] backdrop-blur-sm sm:px-6 sm:pb-6 sm:pt-[14vh]"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search documentation"
        onClick={(event) => event.stopPropagation()}
        className="surface-raised flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden"
      >
        <div className="flex items-center gap-3 border-b border-edge px-4 focus-within:border-accent-strong">
          <svg
            viewBox="0 0 20 20"
            aria-hidden="true"
            className="h-4 w-4 shrink-0 text-faint"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
          >
            <circle cx="9" cy="9" r="5.5" />
            <path d="M13.5 13.5 17 17" strokeLinecap="round" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Search documentation…"
            aria-label="Search documentation"
            role="combobox"
            aria-expanded={results.length > 0}
            aria-controls="docs-search-results"
            aria-activedescendant={
              activeIndex >= 0
                ? `docs-search-option-${results[activeIndex].page.slug}`
                : undefined
            }
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            className="min-w-0 flex-1 bg-transparent py-4 text-[0.95rem] text-foreground caret-accent-strong outline-none placeholder:text-faint"
          />
          <kbd className="hidden shrink-0 rounded border border-edge bg-background-alt px-1.5 py-0.5 font-mono text-[0.6rem] text-faint sm:inline-block">
            Esc
          </kbd>
        </div>

        <div
          id="docs-search-results"
          role="listbox"
          aria-label="Search results"
          className="min-h-0 flex-1 overflow-y-auto p-2"
        >
          {query.trim().length < 2 ? (
            <EmptyState query={query} />
          ) : results.length === 0 ? (
            <NoResults query={query} />
          ) : (
            Array.from(groups.entries()).map(([groupName, groupResults]) => (
              <div key={groupName} className="mb-1">
                <p className="px-3 pb-1 pt-3 text-[0.68rem] font-semibold uppercase tracking-[0.11em] text-faint">
                  {groupName}
                </p>
                {groupResults.map((result) => {
                  const index = results.indexOf(result);
                  const selected = index === activeIndex;
                  const heading = result.matches.find(
                    (match) => match.type === "heading",
                  );
                  return (
                    <button
                      key={`${result.page.slug}-${heading?.text ?? ""}`}
                      type="button"
                      role="option"
                      id={`docs-search-option-${result.page.slug}`}
                      aria-selected={selected}
                      onMouseEnter={() => setSelectedIndex(index)}
                      onClick={() => navigateToResult(result)}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                        selected ? "bg-hover-bg" : "hover:bg-hover-bg"
                      }`}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[0.92rem] font-medium text-foreground">
                          <Highlight text={result.page.title} terms={terms} />
                        </span>
                        <span className="mt-0.5 block truncate text-[0.8rem] text-muted">
                          {heading?.text ? (
                            <>
                              in{" "}
                              <Highlight text={heading.text} terms={terms} />
                            </>
                          ) : (
                            <Highlight
                              text={result.page.description}
                              terms={terms}
                            />
                          )}
                        </span>
                      </span>
                      {selected ? (
                        <ArrowRight className="h-4 w-4 shrink-0 text-accent-strong" />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-edge px-4 py-2.5 text-[0.72rem] text-faint">
          <span>
            {results.length} result{results.length === 1 ? "" : "s"}
          </span>
          <span className="hidden items-center gap-1.5 sm:flex">
            <Key>↑</Key>
            <Key>↓</Key>
            <span>to navigate</span>
            <Key>↵</Key>
            <span>to open</span>
          </span>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ query }: { query: string }) {
  return (
    <div className="px-4 py-12 text-center">
      <p className="text-[0.95rem] font-medium text-foreground">
        {query.trim() ? "Keep typing…" : "Search the documentation"}
      </p>
      <p className="mx-auto mt-1.5 max-w-[34em] text-[0.85rem] text-muted">
        Type at least two characters to search page titles, section headings,
        and body text.
      </p>
    </div>
  );
}

function NoResults({ query }: { query: string }) {
  return (
    <div className="px-4 py-12 text-center">
      <p className="text-[0.95rem] font-medium text-foreground">
        No results for &ldquo;{query.trim()}&rdquo;
      </p>
      <p className="mx-auto mt-1.5 max-w-[34em] text-[0.85rem] text-muted">
        Try a different keyword, or check the spelling.
      </p>
    </div>
  );
}

// A small keycap, used for the shortcut hints in the footer.
function Key({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border border-edge bg-background-alt px-1.5 py-0.5 font-mono text-[0.65rem] leading-none text-faint">
      {children}
    </kbd>
  );
}

// Wraps every occurrence of a search term in a highlight.
//
// The split is done with a capturing group, so the matched separators come back
// in the same array as the surrounding text; a Set membership test decides
// which parts to mark. The obvious `regex.test()` on a /g regex is stateful and
// would highlight only every other match.
function Highlight({ text, terms }: { text: string; terms: string[] }) {
  if (terms.length === 0) return <>{text}</>;

  const pattern = new RegExp(`(${terms.map(escapeRegex).join("|")})`, "gi");
  const lowered = new Set(terms);

  return (
    <>
      {text.split(pattern).map((part, index) =>
        lowered.has(part.toLowerCase()) ? (
          <mark
            key={index}
            className="rounded bg-accent/25 px-[0.15em] text-foreground"
          >
            {part}
          </mark>
        ) : (
          <span key={index}>{part}</span>
        ),
      )}
    </>
  );
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
