// SearchModal — minimal working version matching CreateProjectModal pattern

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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => { setQuery(e.target.value); setSelectedIndex(0); };

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
    return <span>{parts.map((part, i) => regex.test(part) ? <mark key={i} className="bg-accent/30 text-accent-strong px-0.5 rounded">{part}</mark> : <span key={i}>{part}</span>)}</span>;
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
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Search documentation"
    >
      <div className="animate-slide-down w-full max-w-2xl surface-raised" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-edge">
          <div className="relative">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-faint pointer-events-none" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
            <input ref={inputRef} type="search" value={query} onChange={handleInputChange} onKeyDown={handleKeyDown} placeholder="Search documentation…" aria-label="Search documentation" autoComplete="off" className="w-full px-12 py-3.5 pl-10 pr-20 text-[1rem] bg-background border border-edge-strong rounded-xl focus:border-accent-strong focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all placeholder:text-faint" />
          </div>
        </div>
        <div className="max-h-[60vh] overflow-y-auto">
          {query.trim().length < 2 && <EmptyState />}
          {query.trim().length >= 2 && results.length === 0 && <NoResults query={query} />}
          {groups.map(([groupName, groupResults]) => (
            <GroupResults key={groupName} groupName={groupName} groupResults={groupResults} results={results} selectedIndex={selectedIndex} setSelectedIndex={setSelectedIndex} navigateToResult={navigateToResult} query={query} highlightText={highlightText} />
          ))}
          <Footer results={results} />
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="p-8 text-center text-faint">
      <p className="font-medium text-muted mb-2">Type to search</p>
      <p className="text-[0.85rem]">Searches titles, headings, and content</p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {["query","transaction","bucket","credentials","mcp"].map(s => (
          <button key={s} type="button" onClick={()=>{}} className="px-3 py-1.5 text-[0.8rem] bg-background-alt border border-edge rounded-full hover:border-accent-strong hover:text-accent-strong transition-colors">{s}</button>
        ))}
      </div>
    </div>
  );
}

function NoResults({ query }: { query: string }) {
  return <div className="p-8 text-center text-faint"><p className="font-medium text-muted">No results for "{query}"</p><p className="text-[0.85rem] mt-1">Try different keywords</p></div>;
}

function GroupResults({ groupName, groupResults, results, selectedIndex, setSelectedIndex, navigateToResult, query, highlightText }: { groupName: string; groupResults: SearchResult[]; results: SearchResult[]; selectedIndex: number; setSelectedIndex: (i: number) => void; navigateToResult: (r: SearchResult) => void; query: string; highlightText: (t: string, q: string) => React.ReactNode; }) {
  return (
    <div className="border-t border-edge first:border-t-0">
      <div className="px-4 py-2 text-[0.7rem] font-semibold uppercase tracking-[0.1em] text-faint bg-background-alt">{groupName}</div>
      <ul role="listbox" aria-label={`${groupName} results`}>
        {groupResults.map(r => {
          const idx = results.indexOf(r);
          const sel = idx === selectedIndex;
          const hm = r.matches.find((m: SearchMatch) => m.type === "heading");
          const ht = hm ? ` → ${hm.text}` : "";
          return <li key={r.page.slug + ht}><button role="option" aria-selected={sel} onClick={() => navigateToResult(r)} onMouseEnter={() => setSelectedIndex(idx)} className={`w-full px-4 py-3 text-left transition-colors ${sel ? "bg-accent/10 text-foreground" : "text-muted hover:bg-hover-bg hover:text-foreground"} flex items-start gap-3`}><div className="flex-1 min-w-0"><p className="font-medium truncate">{highlightText(r.page.title, query)}</p><p className="text-[0.82rem] truncate text-faint mt-0.5">{highlightText(r.page.description, query)}{ht && <span className="text-faint">{highlightText(ht, query)}</span>}</p>{r.matches.some((m: SearchMatch) => m.type === "content") && <p className="text-[0.75rem] text-faint mt-1 line-clamp-1">{highlightText(r.matches.find((m: SearchMatch) => m.type === "content")?.text.slice(0, 120) ?? "", query)}</p>}</div>{sel && <svg className="shrink-0 h-5 w-5 text-accent-strong" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5" /></svg>}</button></li>;
        })}
      </ul>
    </div>
  );
}

function Footer({ results }: { results: SearchResult[] }) {
  return <div className="px-4 py-3 border-t border-edge bg-background-alt flex items-center justify-between text-[0.75rem] text-faint"><span>{results.length} result{results.length !== 1 ? "s" : ""}</span><kbd className="px-2 py-0.5 text-[0.65rem] font-mono bg-background border border-edge rounded"><svg className="h-3 w-3 inline-block" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 8h8M8 4v8" /></svg><span className="ml-1">⌘K</span></kbd></div>;
}

function escapeRegex(str: string) { return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }