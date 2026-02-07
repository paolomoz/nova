import { useState, useEffect, useRef } from 'react';
import { api, type SearchResult } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Search, FileText, X } from 'lucide-react';

interface SearchBarProps {
  projectId: string;
  onNavigate: (path: string) => void;
}

export function SearchBar({ projectId, onNavigate }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!query.trim() || query.length < 2) {
      setResults([]);
      setShowResults(false);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await api.search(projectId, query);
        setResults(data.results);
        setShowResults(true);
        setSelectedIndex(0);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, projectId]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showResults || results.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const result = results[selectedIndex];
      if (result) {
        const dir = result.path.split('/').slice(0, -1).join('/') || '/';
        onNavigate(dir);
        setShowResults(false);
        setQuery('');
      }
    } else if (e.key === 'Escape') {
      setShowResults(false);
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => results.length > 0 && setShowResults(true)}
          placeholder="Search content..."
          className="h-9 w-64 pl-9 pr-8"
        />
        {query && (
          <button
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            onClick={() => { setQuery(''); setResults([]); setShowResults(false); }}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {showResults && results.length > 0 && (
        <div className="absolute top-full z-50 mt-1 w-96 rounded-md border bg-popover shadow-lg">
          <div className="max-h-72 overflow-auto p-1">
            {results.map((result, i) => (
              <button
                key={result.path}
                className={`flex w-full items-start gap-2 rounded-sm px-2 py-2 text-left text-sm ${
                  i === selectedIndex ? 'bg-accent text-accent-foreground' : 'hover:bg-muted'
                }`}
                onClick={() => {
                  const dir = result.path.split('/').slice(0, -1).join('/') || '/';
                  onNavigate(dir);
                  setShowResults(false);
                  setQuery('');
                }}
                onMouseEnter={() => setSelectedIndex(i)}
              >
                <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{result.title}</div>
                  <div className="truncate text-xs text-muted-foreground">{result.path}</div>
                  {result.snippet && (
                    <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{result.snippet}</div>
                  )}
                </div>
              </button>
            ))}
          </div>
          <div className="border-t px-2 py-1 text-xs text-muted-foreground">
            {results.length} result{results.length !== 1 ? 's' : ''} {loading && '(searching...)'}
          </div>
        </div>
      )}
    </div>
  );
}
