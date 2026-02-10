import { useState, useEffect, useCallback } from 'react';
import { api, type BlockDefinition } from '@/lib/api';
import { useProject } from '@/lib/project';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { BlockGeneratorDialog } from './block-generator-dialog';
import { BlockPreview } from './block-preview';
import {
  Plus, Sparkles, Search, Trash2, ExternalLink, Code, Eye, Pencil,
} from 'lucide-react';

export function BlockLibraryManager() {
  const { activeProjectId: projectId, loadProjects } = useProject();
  const [blocks, setBlocks] = useState<BlockDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedBlock, setSelectedBlock] = useState<string | null>(null);
  const [generatorOpen, setGeneratorOpen] = useState(false);
  const [previewBlockId, setPreviewBlockId] = useState<string | null>(null);

  // Ensure projects are loaded (needed when navigating directly to /blocks)
  useEffect(() => { loadProjects(); }, [loadProjects]);

  const loadBlocks = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const data = await api.getBlocks(projectId);
      setBlocks(data.blocks);
    } catch {
      // Non-fatal
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { loadBlocks(); }, [loadBlocks]);

  const handleDelete = async (blockName: string) => {
    if (!projectId) return;
    const block = blocks.find((b) => b.name === blockName && b.isCustom);
    if (!block) return;
    try {
      await api.deleteBlock(projectId, blockName);
    } catch {
      // Non-fatal — block may not have a DB ID yet
    }
    loadBlocks();
  };

  const filteredBlocks = blocks.filter(
    (b) =>
      b.name.toLowerCase().includes(search.toLowerCase()) ||
      b.category.toLowerCase().includes(search.toLowerCase()) ||
      b.description?.toLowerCase().includes(search.toLowerCase()),
  );

  const categories = [...new Set(filteredBlocks.map((b) => b.category))].sort();

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b">
        <div>
          <h1 className="text-lg font-semibold">Block Library</h1>
          <p className="text-sm text-muted-foreground">
            {blocks.length} blocks available
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search blocks..."
              className="pl-8 w-64"
            />
          </div>
          <Button onClick={() => setGeneratorOpen(true)} className="gap-1">
            <Sparkles className="h-4 w-4" />
            Generate Block
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="text-sm text-muted-foreground">Loading blocks...</div>
        ) : (
          <div className="space-y-8">
            {categories.map((category) => (
              <div key={category}>
                <h2 className="text-sm font-semibold text-muted-foreground mb-3">{category}</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredBlocks
                    .filter((b) => b.category === category)
                    .map((block) => (
                      <div
                        key={block.name}
                        className={`rounded-lg border p-4 cursor-pointer transition-colors hover:bg-accent/50 ${
                          selectedBlock === block.name ? 'ring-2 ring-primary' : ''
                        }`}
                        onClick={() => setSelectedBlock(selectedBlock === block.name ? null : block.name)}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h3 className="text-sm font-medium">{block.name}</h3>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {block.description || 'No description'}
                            </p>
                          </div>
                          <div className="flex items-center gap-1">
                            {block.isCustom && <Badge variant="secondary" className="text-[10px]">Custom</Badge>}
                            {block.variants.length > 0 && (
                              <Badge variant="outline" className="text-[10px]">
                                {block.variants.length} variant{block.variants.length > 1 ? 's' : ''}
                              </Badge>
                            )}
                          </div>
                        </div>

                        {/* Block structure preview */}
                        {block.structure && (
                          <div className="mt-2 rounded bg-muted/50 px-2 py-1.5 font-mono text-[10px] text-muted-foreground overflow-hidden max-h-16">
                            {block.structure.slice(0, 200)}
                          </div>
                        )}

                        {/* Variants */}
                        {selectedBlock === block.name && block.variants.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-1">
                            {block.variants.map((v) => (
                              <Badge key={v} variant="outline" className="text-[10px]">
                                {v}
                              </Badge>
                            ))}
                          </div>
                        )}

                        {/* Actions */}
                        {selectedBlock === block.name && (
                          <div className="mt-3 flex items-center gap-1 border-t pt-2">
                            {block.isCustom && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 text-xs gap-1"
                                  onClick={(e) => { e.stopPropagation(); setPreviewBlockId(block.name); }}
                                >
                                  <Eye className="h-3 w-3" />
                                  Preview
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 text-xs gap-1"
                                  onClick={(e) => { e.stopPropagation(); setSelectedBlock(block.name); }}
                                >
                                  <Pencil className="h-3 w-3" />
                                  Edit
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 text-xs gap-1 text-destructive"
                                  onClick={(e) => { e.stopPropagation(); handleDelete(block.name); }}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs gap-1"
                              onClick={(e) => { e.stopPropagation(); setPreviewBlockId(block.name); }}
                            >
                              <Code className="h-3 w-3" />
                              View Code
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <BlockGeneratorDialog
        open={generatorOpen}
        onOpenChange={setGeneratorOpen}
        onBlockGenerated={() => loadBlocks()}
      />
    </div>
  );
}
