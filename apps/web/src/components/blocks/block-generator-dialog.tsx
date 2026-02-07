import { useState, useCallback } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api, type GeneratedBlockResult } from '@/lib/api';
import { useProject } from '@/lib/project';
import { BlockPreview } from './block-preview';
import { Sparkles, Loader2, Send, GitBranch } from 'lucide-react';

interface BlockGeneratorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBlockGenerated?: (blockId: string) => void;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export function BlockGeneratorDialog({ open, onOpenChange, onBlockGenerated }: BlockGeneratorDialogProps) {
  const projectId = useProject((s) => s.activeProjectId);
  const [intent, setIntent] = useState('');
  const [loading, setLoading] = useState(false);
  const [blockId, setBlockId] = useState<string | null>(null);
  const [block, setBlock] = useState<GeneratedBlockResult | null>(null);
  const [feedback, setFeedback] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [committing, setCommitting] = useState(false);
  const [prUrl, setPrUrl] = useState<string | null>(null);

  const handleGenerate = useCallback(async () => {
    if (!intent.trim() || !projectId || loading) return;
    setLoading(true);
    try {
      const result = await api.generateBlock(projectId, intent.trim());
      setBlockId(result.id);
      setBlock(result.block);
      setChatHistory([
        { role: 'user', content: intent.trim() },
        { role: 'assistant', content: `Generated "${result.block.name}" block: ${result.block.description}` },
      ]);
      setIntent('');
    } catch (err) {
      setChatHistory((prev) => [...prev, { role: 'assistant', content: `Error: ${(err as Error).message}` }]);
    } finally {
      setLoading(false);
    }
  }, [intent, projectId, loading]);

  const handleIterate = useCallback(async () => {
    if (!feedback.trim() || !projectId || !blockId || loading) return;
    setLoading(true);
    const msg = feedback.trim();
    setFeedback('');
    setChatHistory((prev) => [...prev, { role: 'user', content: msg }]);

    try {
      const result = await api.iterateBlock(projectId, blockId, msg, chatHistory);
      setBlock(result.block);
      setChatHistory((prev) => [
        ...prev,
        { role: 'assistant', content: `Updated: ${result.block.description}` },
      ]);
    } catch (err) {
      setChatHistory((prev) => [...prev, { role: 'assistant', content: `Error: ${(err as Error).message}` }]);
    } finally {
      setLoading(false);
    }
  }, [feedback, projectId, blockId, loading, chatHistory]);

  const handleCommit = useCallback(async () => {
    if (!projectId || !blockId || committing) return;
    setCommitting(true);
    try {
      const result = await api.commitBlock(projectId, blockId);
      setPrUrl(result.pr.url);
      onBlockGenerated?.(blockId);
    } catch (err) {
      setChatHistory((prev) => [...prev, { role: 'assistant', content: `Commit error: ${(err as Error).message}` }]);
    } finally {
      setCommitting(false);
    }
  }, [projectId, blockId, committing, onBlockGenerated]);

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      setBlock(null);
      setBlockId(null);
      setIntent('');
      setFeedback('');
      setChatHistory([]);
      setPrUrl(null);
    }
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col p-0 gap-0">
        <div className="flex items-center gap-2 px-4 py-3 border-b">
          <Sparkles className="h-4 w-4 text-purple-500" />
          <h2 className="text-sm font-semibold">AI Block Generator</h2>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* Chat / Input Column */}
          <div className="flex flex-col w-1/2 border-r">
            {/* Chat messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {chatHistory.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Describe the block you want to create. For example: &quot;A pricing table with 3 tiers and a toggle for monthly/annual billing&quot;
                </p>
              )}
              {chatHistory.map((msg, i) => (
                <div
                  key={i}
                  className={`text-sm rounded-lg px-3 py-2 ${
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground ml-8'
                      : 'bg-muted mr-8'
                  }`}
                >
                  {msg.content}
                </div>
              ))}
              {loading && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {block ? 'Updating block...' : 'Generating block...'}
                </div>
              )}
            </div>

            {/* Input */}
            <div className="border-t p-3">
              {!block ? (
                <div className="flex gap-2">
                  <Input
                    value={intent}
                    onChange={(e) => setIntent(e.target.value)}
                    placeholder="Describe the block to generate..."
                    onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
                    disabled={loading}
                  />
                  <Button onClick={handleGenerate} disabled={loading || !intent.trim()} size="sm">
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Input
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    placeholder="Iterate: &quot;make it wider&quot;, &quot;add hover effects&quot;..."
                    onKeyDown={(e) => e.key === 'Enter' && handleIterate()}
                    disabled={loading}
                  />
                  <Button onClick={handleIterate} disabled={loading || !feedback.trim()} size="sm">
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Preview Column */}
          <div className="flex flex-col w-1/2">
            {block ? (
              <>
                <div className="flex items-center justify-between px-4 py-2 border-b">
                  <div>
                    <span className="text-sm font-medium">{block.name}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{block.category}</span>
                  </div>
                  <div className="flex gap-2">
                    {prUrl ? (
                      <a
                        href={prUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                      >
                        <GitBranch className="h-3 w-3" />
                        View PR
                      </a>
                    ) : (
                      <Button
                        onClick={handleCommit}
                        disabled={committing}
                        size="sm"
                        variant="outline"
                        className="text-xs h-7"
                      >
                        {committing ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <GitBranch className="h-3 w-3 mr-1" />}
                        Commit to GitHub
                      </Button>
                    )}
                  </div>
                </div>
                <div className="flex-1 min-h-0">
                  <BlockPreview previewHtml={block.previewHtml} className="h-full rounded-none border-0" />
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                Preview will appear here
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
