// SearchModal — absolutely minimal, explicit colors, no ambiguity
import { useEffect, useRef, useState, useMemo, useCallback } from "react";
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

  useEffect(() => {
    const init = async () => {
      if (!docsReady()) await ensureDocs();
      if (allDocs().length > 0 && !searchIndex) {
        setSearchIndex(buildSearchIndex(allDocs()));
      }
    };
    init();
  }, [searchIndex]);

  useEffect(() => {
    if (!searchIndex) return;
    if (query.trim().length < 2) { setResults([]); setSelectedIndex(0); return; }
    const res = searchIndex.search(query, 10);
    setResults(res); setSelectedIndex(0);
  }, [query, searchIndex]);

  useEffect(() => { if (isOpen) setTimeout(() => inputRef.current?.focus(), 50); }, [isOpen]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!isOpen) return;
    if (e.key === "Escape") { e.preventDefault(); onClose(); }
    else if (e.key === "ArrowDown") { e.preventDefault(); setSelectedIndex(i => Math.min(i + 1, results.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSelectedIndex(i => Math.max(i - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); if (results[selectedIndex]) navigateToResult(results[selectedIndex]); }
  }, [isOpen, results, selectedIndex, onClose, navigate]);

  const [isFocused, setIsFocused] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => { setQuery(e.target.value); setSelectedIndex(0); };

  const handleFocus = () => { setIsFocused(true); };
  const handleBlur = () => { setIsFocused(false); };

  const navigateToResult = (result: SearchResult) => {
    const page = result.page;
    const headingMatch = result.matches.find((m: SearchMatch) => m.type === "heading");
    const hash = headingMatch?.headingId ? `#${headingMatch.headingId}` : "";
    onClose(); setTimeout(() => navigate(`/docs/${page.slug}${hash}`), 100);
  };

  const highlightText = (text: string, query: string) => {
    if (!query.trim()) return <span>{text}</span>;
    const terms = query.toLowerCase().split(/\s+/).filter(t => t.length >= 2);
    const regex = new RegExp(`(${terms.map(escapeRegex).join("|")})`, "gi");
    const parts = text.split(regex);
    return <span>{parts.map((part, i) => regex.test(part) ? <mark key={i} style={{backgroundColor: "rgba(255,0,0,0.3)"}}>{part}</mark> : <span key={i} style={{color: "red"}}>{part}</span>)}</span>;
  };

  if (!isOpen) return null;

  const groups = useMemo(() => {
    const grouped = new Map<string, SearchResult[]>();
    for (const r of results) {
      const g = r.page.group;
      if (!grouped.has(g)) grouped.set(g, []);
      grouped.get(g)!.push(r);
    }
    return Array.from(grouped.entries());
  }, [results]);

  return (
    // z-9999 to be absolutely on top, explicit white background
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
      // Explicit bright white panel with thick border
      <div style={{
        backgroundColor: "#ffffff",
        border: "4px solid #ff0000",
        borderRadius: "1rem",
        width: "100%",
        maxWidth: "800px",
        overflow: "hidden",
        fontFamily: "sans-serif",
      }}>
        <div style={{ padding: "2rem" }}>
          // Explicit black input with clear placeholder
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={handleFocus}
            onBlur={handleBlur}
            placeholder="Search documentation…"
            style={{
              width: "100%",
              padding: "1rem 1.5rem",
              fontSize: "1rem",
              border: "2px solid " + (isFocused ? "#ff0000" : "#cccccc"),
              borderRadius: "0.5rem",
              marginBottom: "1rem",
              color: "#000000",
              backgroundColor: "#f8f8f8",
              outline: "none",
              boxShadow: isFocused ? "0 0 0 3px rgba(255, 0, 0, 0.1)" : "none",
            }}
            aria-label="Search documentation"
          />
          <div style={{ maxHeight: "60vh", overflowY: "auto", color: "#000000" }}>
            {query.trim().length < 2 && (
              <div style={{ textAlign: "center", padding: "2rem", color: "#333333" }}>
                <p style={{ fontWeight: "500", marginBottom: "0.5rem" }}>Type to search</p>
                <p>Searches titles, headings, and content</p>
              </div>
            )}
            {query.trim().length >= 2 && results.length === 0 && (
              <div style={{ textAlign: "center", padding: "2rem", color: "#333333" }}>
                <p style={{ fontWeight: "500", marginBottom: "0.5rem" }}>No results for "{query}"</p>
                <p>Try different keywords or check spelling</p>
              </div>
            )}
            {groups.map(([groupName, groupResults]) => (
              <div key={groupName} style={{ marginTop: "1rem", paddingTop: "1rem", borderTop: "1px solid #e0e0e0" }}>
                <p style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "#666666" }}>{groupName}</p>
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
                            border: sel ? "1px solid #ff0000" : "1px solid #dddddd",
                            borderRadius: "0.5rem",
                            backgroundColor: sel ? "#fff0f0" : "#ffffff",
                            color: "#000000",
                            fontSize: "0.9rem",
                            cursor: "pointer",
                          }}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontWeight: 500, margin: 0 }}>{highlightText(r.page.title, query)}</p>
                            <p style={{ fontSize: "0.8rem", margin: "0.25rem 0", color: "#555555" }}>{highlightText(r.page.description, query)}{ht && <span style={{ color: "#777777", fontSize: "0.7rem" }}> → {highlightText(ht, query)}</span>}</p>
                            {r.matches.some((m: SearchMatch) => m.type === "content") && <p style={{ fontSize: "0.7rem", margin: "0.25rem 0", color: "#555555" }}>{highlightText(r.matches.find((m: SearchMatch) => m.type === "content")?.text.slice(0, 120) ?? "", query)}</p>}
                          </div>
                          {sel && <svg style={{ width: "1rem", height: "1rem", marginLeft: "0.5rem" }} fill="none" stroke="#ff0000" strokeWidth="2" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5" /></svg>}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
            <div style={{ padding: "1rem", borderTop: "1px solid #e0e0e0", marginTop: "1rem", color: "#333333" }}>
              <span style={{ fontSize: "0.75rem" }}>{results.length} result{results.length !== 1 ? "s" : ""}</span>
              <kbd style={{ fontSize: "0.65rem", backgroundColor: "#f0f0f0", border: "1px solid #cccccc", padding: "0.2rem 0.5rem", borderRadius: "3px", color: "#000000" }}>
                <svg style={{ width: "0.8rem", height: "0.8rem", marginRight: "0.3rem" }} viewBox="0 0 16 16" fill="none" stroke="#000000" strokeWidth="1.5"><path d="M4 8h8M8 4v8" /></svg>
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