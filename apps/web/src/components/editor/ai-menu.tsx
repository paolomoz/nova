import { useState, useEffect, useRef } from 'react';
import {
  Sparkles, Type, Heading, Image, LayoutGrid, List,
  Table, Minus, Quote, Code, Wand2, FileText,
} from 'lucide-react';

interface SlashCommandMenuProps {
  query: string;
  onSelect: (html: string) => void;
  onClose: () => void;
  onAICommand?: (prompt: string) => void;
}

interface CommandItem {
  id: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  group: string;
  html: string;
}

const commands: CommandItem[] = [
  // Content
  { id: 'h1', label: 'Heading 1', description: 'Large section heading', icon: Heading, group: 'Content', html: '<h1>Heading</h1>' },
  { id: 'h2', label: 'Heading 2', description: 'Medium section heading', icon: Heading, group: 'Content', html: '<h2>Heading</h2>' },
  { id: 'h3', label: 'Heading 3', description: 'Small section heading', icon: Heading, group: 'Content', html: '<h3>Heading</h3>' },
  { id: 'paragraph', label: 'Paragraph', description: 'Plain text paragraph', icon: Type, group: 'Content', html: '<p></p>' },
  { id: 'bullet-list', label: 'Bullet List', description: 'Unordered list', icon: List, group: 'Content', html: '<ul><li>Item 1</li><li>Item 2</li></ul>' },
  { id: 'ordered-list', label: 'Numbered List', description: 'Ordered list', icon: List, group: 'Content', html: '<ol><li>Item 1</li><li>Item 2</li></ol>' },
  { id: 'blockquote', label: 'Quote', description: 'Blockquote', icon: Quote, group: 'Content', html: '<blockquote><p>Quote text</p></blockquote>' },
  { id: 'code-block', label: 'Code Block', description: 'Code snippet', icon: Code, group: 'Content', html: '<pre><code>code here</code></pre>' },
  { id: 'image', label: 'Image', description: 'Insert an image', icon: Image, group: 'Content', html: '<p><img src="" alt=""></p>' },
  { id: 'table', label: 'Table', description: 'Insert a table', icon: Table, group: 'Content', html: '<table><tr><th>Header 1</th><th>Header 2</th></tr><tr><td>Cell 1</td><td>Cell 2</td></tr></table>' },
  { id: 'divider', label: 'Section Break', description: 'Separate sections', icon: Minus, group: 'Content', html: '<hr>' },

  // EDS Blocks
  { id: 'hero', label: 'Hero', description: 'Hero block with image, heading, text, and CTA', icon: LayoutGrid, group: 'EDS Blocks', html: '<div class="hero"><div><div><picture><img src="" alt="Hero image"></picture></div><div><h1>Hero Heading</h1><p>Hero description text.</p><p><a href="#">Get Started</a></p></div></div></div>' },
  { id: 'cards', label: 'Cards', description: 'Grid of cards with images', icon: LayoutGrid, group: 'EDS Blocks', html: '<div class="cards"><div><div><picture><img src="" alt="Card image"></picture></div><div><h3>Card Title</h3><p>Card description.</p></div></div><div><div><picture><img src="" alt="Card image"></picture></div><div><h3>Card Title</h3><p>Card description.</p></div></div></div>' },
  { id: 'columns', label: 'Columns', description: 'Side-by-side content (1 row, N cells)', icon: LayoutGrid, group: 'EDS Blocks', html: '<div class="columns"><div><div><h3>Column One</h3><p>Content.</p></div><div><h3>Column Two</h3><p>Content.</p></div></div></div>' },
  { id: 'accordion', label: 'Accordion', description: 'Expandable Q&A (question cell + answer cell)', icon: LayoutGrid, group: 'EDS Blocks', html: '<div class="accordion"><div><div><h3>Question?</h3></div><div><p>Answer.</p></div></div></div>' },
  { id: 'tabs', label: 'Tabs', description: 'Tabbed content (label cell + content cell)', icon: LayoutGrid, group: 'EDS Blocks', html: '<div class="tabs"><div><div>Tab One</div><div><p>Content for tab one.</p></div></div><div><div>Tab Two</div><div><p>Content for tab two.</p></div></div></div>' },

  // AI
  { id: 'ai-generate', label: 'AI Generate', description: 'Generate content with AI', icon: Sparkles, group: 'AI', html: '' },
  { id: 'ai-expand', label: 'AI Expand', description: 'Expand on the current content', icon: Wand2, group: 'AI', html: '' },
  { id: 'ai-summarize', label: 'AI Summarize', description: 'Create a summary', icon: FileText, group: 'AI', html: '' },
];

export function SlashCommandMenu({ query, onSelect, onClose, onAICommand }: SlashCommandMenuProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);

  const filtered = query
    ? commands.filter(
        (c) =>
          c.label.toLowerCase().includes(query.toLowerCase()) ||
          c.id.includes(query.toLowerCase()),
      )
    : commands;

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const item = filtered[selectedIndex];
        if (item) {
          if (item.html) {
            onSelect(item.html);
          } else if (onAICommand) {
            onAICommand(item.description);
          } else {
            onSelect(`<p><em>${item.label}: generating...</em></p>`);
          }
        }
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [filtered, selectedIndex, onSelect, onClose]);

  if (filtered.length === 0) return null;

  // Group items
  const groups = filtered.reduce(
    (acc, item) => {
      if (!acc[item.group]) acc[item.group] = [];
      acc[item.group].push(item);
      return acc;
    },
    {} as Record<string, CommandItem[]>,
  );

  let globalIdx = 0;

  return (
    <div
      ref={menuRef}
      className="absolute left-8 z-50 w-72 rounded-lg border bg-popover shadow-lg"
      style={{ top: '50%' }}
    >
      <div className="max-h-80 overflow-auto p-1">
        {Object.entries(groups).map(([group, items]) => (
          <div key={group}>
            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">{group}</div>
            {items.map((item) => {
              const idx = globalIdx++;
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  className={`flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm ${
                    idx === selectedIndex ? 'bg-accent text-accent-foreground' : 'hover:bg-muted'
                  }`}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  onClick={() => {
                    if (item.html) {
                      onSelect(item.html);
                    } else if (onAICommand) {
                      onAICommand(item.description);
                    } else {
                      onSelect(`<p><em>${item.label}: generating...</em></p>`);
                    }
                  }}
                >
                  <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1 text-left">
                    <div className="text-sm">{item.label}</div>
                    <div className="text-xs text-muted-foreground">{item.description}</div>
                  </div>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
