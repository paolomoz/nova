import { useState, useEffect } from 'react';
import { api, type BlockDefinition } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Search, LayoutGrid, Type, Image, Settings2, Puzzle,
  GripVertical, Sparkles,
} from 'lucide-react';

interface BlockBrowserProps {
  projectId: string;
  onInsertBlock: (html: string) => void;
}

const categoryIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  Structure: LayoutGrid,
  Content: Type,
  Media: Image,
  Configuration: Settings2,
  Custom: Puzzle,
};

export function BlockBrowser({ projectId, onInsertBlock }: BlockBrowserProps) {
  const [blocks, setBlocks] = useState<BlockDefinition[]>([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getBlockLibrary(projectId).then((data) => {
      setBlocks(data.blocks);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [projectId]);

  const filtered = filter
    ? blocks.filter(
        (b) =>
          b.name.toLowerCase().includes(filter.toLowerCase()) ||
          b.description.toLowerCase().includes(filter.toLowerCase()) ||
          b.category.toLowerCase().includes(filter.toLowerCase()),
      )
    : blocks;

  // Group by category
  const grouped = filtered.reduce(
    (acc, block) => {
      const cat = block.category || 'Other';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(block);
      return acc;
    },
    {} as Record<string, BlockDefinition[]>,
  );

  const handleDragStart = (e: React.DragEvent, block: BlockDefinition) => {
    e.dataTransfer.setData(
      'application/x-eds-block',
      JSON.stringify({ name: block.name, structure: block.structure }),
    );
    e.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <div className="flex h-full flex-col">
      <div className="border-b px-3 py-2">
        <h3 className="text-xs font-semibold uppercase text-muted-foreground">Blocks</h3>
        <div className="relative mt-2">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search blocks..."
            className="h-8 pl-8 text-xs"
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2">
          {loading && (
            <p className="p-2 text-xs text-muted-foreground">Loading blocks...</p>
          )}

          {Object.entries(grouped).map(([category, catBlocks]) => {
            const Icon = categoryIcons[category] || Puzzle;
            return (
              <div key={category} className="mb-3">
                <div className="flex items-center gap-1.5 px-2 py-1">
                  <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground">{category}</span>
                  <span className="text-xs text-muted-foreground">({catBlocks.length})</span>
                </div>

                {catBlocks.map((block) => (
                  <button
                    key={block.name}
                    className="flex w-full items-start gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-muted transition-colors group"
                    onClick={() => {
                      if (block.structure) {
                        onInsertBlock(block.structure);
                      } else {
                        // Generate a basic block structure
                        const html = `<div class="${block.name}"><div><div><p>New ${block.name} content</p></div></div></div>`;
                        onInsertBlock(html);
                      }
                    }}
                    draggable
                    onDragStart={(e) => handleDragStart(e, block)}
                  >
                    <GripVertical className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-xs">{block.name}</span>
                        {block.isCustom && (
                          <Badge variant="secondary" className="text-[0.6rem] px-1 py-0">custom</Badge>
                        )}
                        {block.generativeConfig && Object.keys(block.generativeConfig).length > 0 && (
                          <Sparkles className="h-3 w-3 text-amber-500" />
                        )}
                      </div>
                      {block.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{block.description}</p>
                      )}
                      {block.variants.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {block.variants.map((v) => (
                            <Badge key={v} variant="outline" className="text-[0.6rem] px-1 py-0">{v}</Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            );
          })}

          {!loading && filtered.length === 0 && (
            <p className="p-4 text-center text-xs text-muted-foreground">
              {filter ? 'No blocks match your search.' : 'No blocks available.'}
            </p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
