import { useState, useEffect } from 'react';
import { Lightbulb, Search, TrendingUp, BookOpen, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { api, type AISuggestion } from '@/lib/api';
import { useProject } from '@/lib/project';

interface DiscoveryPromptsProps {
  /** Called when a prompt chip is selected */
  onSelect: (prompt: string) => void;
  /** Layout: grid for fullscreen, list for rail */
  layout?: 'grid' | 'list';
  /** Additional className */
  className?: string;
}

interface PromptCategory {
  id: string;
  label: string;
  icon: typeof Lightbulb;
  color: string;
}

const categories: PromptCategory[] = [
  { id: 'learn', label: 'Learn', icon: BookOpen, color: 'text-ai-cyan' },
  { id: 'analyze', label: 'Analyze', icon: Search, color: 'text-ai-indigo' },
  { id: 'optimize', label: 'Optimize', icon: TrendingUp, color: 'text-ai-fuchsia' },
];

/** Built-in discovery prompts, used as fallback when API returns nothing */
const defaultPrompts: Record<string, Array<{ text: string; prompt: string }>> = {
  learn: [
    { text: 'What pages does this site have?', prompt: 'List all pages in this project' },
    { text: 'Explain this site\'s structure', prompt: 'Analyze the site structure and content hierarchy' },
    { text: 'Summarize recent changes', prompt: 'What content has been modified recently?' },
  ],
  analyze: [
    { text: 'Find broken links', prompt: 'Scan all pages for broken internal links' },
    { text: 'Check SEO health', prompt: 'Analyze SEO metadata across all pages' },
    { text: 'Content quality audit', prompt: 'Run a content quality audit on the site' },
  ],
  optimize: [
    { text: 'Improve page titles', prompt: 'Suggest better titles for all pages based on SEO best practices' },
    { text: 'Generate meta descriptions', prompt: 'Generate meta descriptions for pages that are missing them' },
    { text: 'Optimize images', prompt: 'Find images missing alt text and suggest improvements' },
  ],
};

export function DiscoveryPrompts({ onSelect, layout = 'list', className }: DiscoveryPromptsProps) {
  const [activeCategory, setActiveCategory] = useState<string>('learn');
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([]);
  const projectId = useProject((s) => s.activeProjectId);

  // Load API suggestions
  useEffect(() => {
    if (!projectId) return;
    api.getSuggestions(projectId).then((data) => {
      setSuggestions(data.suggestions);
    }).catch(() => {});
  }, [projectId]);

  // Merge API suggestions into our categories
  const getPromptsForCategory = (categoryId: string) => {
    const apiSuggestions = suggestions.map((s) => ({ text: s.text, prompt: s.prompt }));
    const builtIn = defaultPrompts[categoryId] || [];
    // If we have API suggestions, mix them in with the first category
    if (categoryId === 'learn' && apiSuggestions.length > 0) {
      return [...apiSuggestions.slice(0, 3), ...builtIn.slice(0, 2)];
    }
    return builtIn;
  };

  const isGrid = layout === 'grid';

  return (
    <div className={cn('space-y-3', className)}>
      {/* Category tabs */}
      <div className="flex items-center gap-1">
        {categories.map((cat) => {
          const Icon = cat.icon;
          return (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors duration-100',
                activeCategory === cat.id
                  ? 'bg-accent text-foreground'
                  : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
              )}
            >
              <Icon className={cn('h-3.5 w-3.5', activeCategory === cat.id && cat.color)} />
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* Prompt chips */}
      <div className={cn(
        isGrid ? 'grid grid-cols-2 gap-2' : 'flex flex-col gap-1.5',
      )}>
        {getPromptsForCategory(activeCategory).map((prompt, i) => (
          <button
            key={i}
            onClick={() => onSelect(prompt.prompt)}
            className={cn(
              'flex items-start gap-2.5 rounded-lg border border-transparent px-3 py-2.5 text-left text-sm transition-all duration-150',
              'hover:border-border hover:bg-accent hover:shadow-emphasized',
              isGrid && 'flex-col gap-1.5',
            )}
          >
            <Sparkles className={cn(
              'h-3.5 w-3.5 shrink-0 text-ai-indigo',
              !isGrid && 'mt-0.5',
            )} />
            <span className="flex-1 leading-snug">{prompt.text}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
