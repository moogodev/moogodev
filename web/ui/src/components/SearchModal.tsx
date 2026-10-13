// SearchModal — hijau theme, minimal & pasti work (no React #310)
import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { buildSearchIndex, type SearchIndex, type SearchResult, type SearchMatch } from "../lib/search";
import { allDocs, ensureDocs, docsReady } from "../lib/docs";

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialQuery?: string;
}

export function SearchModal({ isOpen, onClose, initialQuery = "" }: SearchModalProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [searchIndex, setSearchIndex] = useState<SearchIndex | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Build search index once when modal first opens
  useEffect(() => {
    const init = async () => {
      if (!docsReady()) await ensureDocs();
      if (allDocs().length > 0 && !searchIndex) {
        setSearchIndex(buildSearchIndex(allDocs()));
      }
    };
    init();
  }, [searchIndex]);

  // Perform search when query changes AND index is ready
  useEffect(() => {
    if (!searchIndex) return;
    if (query.trim().length < 2) { setResults([]); setSelectedIndex(0); return; }
    const res = searchIndex.search(query, 10);
    setResults(res); setSelectedIndex(0);
  }, [query, searchIndex]);

  // Focus input when opened
  useEffect(() => { if (isOpen) setTimeout(() => inputRef.current?.focus(), 50); }, [isOpen]);

  // Simple keyboard navigation — Esc close, Arrows navigate, Enter select
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return;
    if (e.key === "Escape") { e.preventDefault(); onClose(); }
    else if (e.key === "ArrowDown") { e.preventDefault(); setSelectedIndex(i => Math.min(i + 1, results.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSelectedIndex(i => Math.max(i - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); if (results[selectedIndex]) navigateToResult(results[selectedIndex]); }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => { setQuery(e.target.value); setSelectedIndex(0); };

  const navigateToResult = (result: SearchResult) => {
    const page = result.page;
    const headingMatch = result.matches.find((m: SearchMatch) => m.type === "heading");
    const hash = headingMatch?.headingId ? `#${headingMatch.headingId}` : "";
    onClose(); setTimeout(() => navigate(`/docs/${page.slug}${hash}`), 100);
  };

  // Highlight search terms — simple inline, no useCallback complexity
  const highlightText = (text: string, query: string) => {
    if (!query.trim()) return <span>{text}</span>;
    const terms = query.toLowerCase().split(/\s+/).filter(t => t.length >= 2);
    if (terms.length === 0) return <span>{text}</span>;
    const regex = new RegExp(`(${terms.map(escapeRegex).join("|")})`, "gi");
    const parts = text.split(regex);
    return <span>{parts.map((part, i) => regex.test(part) ? <mark key={i} style={{backgroundColor: "rgba(16,185,129,0.3)"}}>{part}</mark> : <span key={i}>{part}</span>)}</span>;
  };

  if (!isOpen) return null;

  // Simple groups — just split results by page.group, no useMemo/useCallback overhead
  const groups = () => {
    const grouped: Record<string, SearchResult[]> = {};
    for (const r of results) {
      const g = r.page.group;
      if (!grouped[g]) grouped[g] = [];
      grouped[g]!.push(r);
    }
    return Object.entries(grouped);
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        backgroundColor: "rgba(0,0,0,0.8)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: "4rem",
      }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Search documentation"
    >
      // Hijau theme panel
      <div
        style={{
          backgroundColor: "#ffffff",
          border: "4px solid #10b981",
          borderRadius: "1rem",
          width: "100%",
          maxWidth: "800px",
          overflow: "hidden",
          fontFamily: "sans-serif",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: "2rem" }}>
          // Hijau input
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Search documentation…"
            aria-label="Search documentation"
            autoComplete="off"
            style={{
              width: "100%",
              padding: "1rem 1.5rem",
              fontSize: "1rem",
              border: "2px solid #e5e7eb",
              borderRadius: "0.5rem",
              marginBottom: "1rem",
              color: "#1f2937",
              backgroundColor: "#f9fafb",
              outline: "none",
              fontFamily: "inherit",
            }}
          />
          <div style={{ maxHeight: "60vh", overflowY: "auto", color: "#1f2937" }}>
            {query.trim().length < 2 && (
              <div style={{ textAlign: "center", padding: "2rem", color: "#6b7280" }}>
                <p style={{ fontWeight: 500, marginBottom: "0.5rem" }}>Type to search</p>
                <p>Searches titles, headings, and content across all pages</p>
              </div>
            )}
            {query.trim().length >= 2 && results.length === 0 && (
              <div style={{ textAlign: "center", padding: "2rem", color: "#6b7280" }}>
                <p style={{ fontWeight: 500, marginBottom: "0.5rem" }}>No results for "{query}"</p>
                <p>Try different keywords or check spelling</p>
              </div>
            )}
            {groups().map(([groupName, groupResults]) => (
              <div key={groupName} style={{ marginTop: "1rem", paddingTop: "1rem", borderTop: "1px solid #e5e7eb" }}>
                <p style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "#9ca3af" }}>{groupName}</p>
                <ul style={{ margin: 0, padding: 0 }}>
                  {groupResults.map(r => {
                    const idx = results.indexOf(r);
                    const sel = idx === selectedIndex;
                    const hm = r.matches.find((m: SearchMatch) => m.type === "heading");
                    const ht = hm ? ` → ${hm.text}` : "";
                    return (
                      <li key={r.page.slug + ht} style={{ listStyle: "none", margin: "0.5rem 0" }}>
                        <button
                          role="option"
                          aria-selected={sel}
                          onClick={() => navigateToResult(r)}
                          onMouseEnter={() => setSelectedIndex(idx)}
                          style={{
                            width: "100%",
                            padding: "0.75rem 1rem",
                            border: sel ? "1px solid #10b981" : "1px solid #e5e7eb",
                            borderRadius: "0.5rem",
                            backgroundColor: sel ? "#ecfdf5" : "#ffffff",
                            color: "#1f2937",
                            fontSize: "0.9rem",
                            cursor: "pointer",
                          }}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontWeight: 500, margin: 0 }}>{highlightText(r.page.title, query)}</p>
                            <p style={{ fontSize: "0.8rem", margin: "0.25rem 0", color: "#6b7280" }}>{highlightText(r.page.description, query)}{ht && <span style={{ color: "#9ca3af", fontSize: "0.7rem" }}> → {highlightText(ht, query)}</span>}</p>
                            {r.matches.some((m: SearchMatch) => m.type === "content") && <p style={{ fontSize: "0.7rem", margin: "0.25rem 0", color: "#6b7280" }}>{highlightText(r.matches.find((m: SearchMatch) => m.type === "content")?.text.slice(0, 120) ?? "", query)}</p>}
                          </div>
                          {sel && <svg style={{ width: "1rem", height: "1rem", marginLeft: "0.5rem" }} fill="none" stroke="#10b981" strokeWidth="2" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5" /></svg>}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
            <div style={{ padding: "1rem", borderTop: "1px solid #e5e7eb", marginTop: "1rem", color: "#6b7280" }}>
              <span style={{ fontSize: "0.75rem" }}>{results.length} result{results.length !== 1 ? "s" : ""}</span>
              <kbd style={{ fontSize: "0.65rem", backgroundColor: "#f3f4f6", border: "1px solid #e5e7eb", padding: "0.2rem 0.5rem", borderRadius: "3px", color: "#1f2937" }}>
                <svg style={{ width: "0.8rem", height: "0.8rem", marginRight: "0.3rem" }} viewBox="0 0 16 16" fill="none" stroke="#10b981" strokeWidth="1.5"><path d="M4 8h8M8 4v8" /></svg>
                <span style={{ marginLeft: "0.3rem" }}>⌘K</span>
              </kbd>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function escapeRegex(str: string) { return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }