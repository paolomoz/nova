import { useState } from 'react';
import type { Editor } from '@tiptap/react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import {
  Sparkles, Wand2, Expand, Shrink, Languages, RefreshCw,
  Loader2,
} from 'lucide-react';

interface AIBlockActionsProps {
  editor: Editor | null;
  projectId: string;
}

type AIAction = 'rewrite' | 'expand' | 'summarize' | 'translate' | 'custom';

export function AIBlockActions({ editor, projectId }: AIBlockActionsProps) {
  const [loading, setLoading] = useState(false);
  const [customPrompt, setCustomPrompt] = useState('');
  const [open, setOpen] = useState(false);

  if (!editor) return null;

  const getSelectedContent = (): string => {
    const { from, to } = editor.state.selection;
    if (from === to) {
      // No selection — get the current block's content
      const node = editor.state.selection.$from.parent;
      return node.textContent;
    }
    // Get selected text
    return editor.state.doc.textBetween(from, to, '\n');
  };

  const executeAIAction = async (action: AIAction, prompt?: string) => {
    const content = getSelectedContent();
    if (!content && action !== 'custom') return;

    setLoading(true);
    try {
      const prompts: Record<AIAction, string> = {
        rewrite: `Rewrite the following content while preserving the meaning. Return only the HTML content, no explanations:\n\n${content}`,
        expand: `Expand the following content with more detail and examples. Return only the HTML content:\n\n${content}`,
        summarize: `Summarize the following content concisely. Return only the HTML content:\n\n${content}`,
        translate: `Translate the following content to the requested language. Return only the HTML content:\n\n${content}`,
        custom: prompt || '',
      };

      const aiPrompt = prompts[action];
      if (!aiPrompt) return;

      const result = await api.executeAI(projectId, aiPrompt);

      if (result.response) {
        // Try to extract HTML from the response
        const htmlMatch = result.response.match(/<[^>]+>[\s\S]*<\/[^>]+>/);
        const html = htmlMatch ? htmlMatch[0] : `<p>${result.response}</p>`;

        const { from, to } = editor.state.selection;
        if (from !== to) {
          // Replace selection
          editor.chain().focus().deleteRange({ from, to }).insertContent(html).run();
        } else {
          // Insert after current block
          editor.chain().focus().insertContent(html).run();
        }
      }
    } catch {
      // Handle error
    } finally {
      setLoading(false);
      setOpen(false);
    }
  };

  const actions: Array<{
    id: AIAction;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    description: string;
  }> = [
    { id: 'rewrite', label: 'Rewrite', icon: RefreshCw, description: 'Rewrite with same meaning' },
    { id: 'expand', label: 'Expand', icon: Expand, description: 'Add more detail' },
    { id: 'summarize', label: 'Summarize', icon: Shrink, description: 'Make more concise' },
    { id: 'translate', label: 'Translate', icon: Languages, description: 'Translate to another language' },
  ];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 text-xs">
          <Sparkles className="mr-1 h-3.5 w-3.5" />
          AI Actions
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="end">
        <div className="space-y-1">
          <p className="px-2 py-1 text-xs font-semibold text-muted-foreground">Quick Actions</p>

          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.id}
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-muted transition-colors disabled:opacity-50"
                onClick={() => executeAIAction(action.id)}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
                ) : (
                  <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}
                <div className="text-left">
                  <div className="text-sm">{action.label}</div>
                  <div className="text-xs text-muted-foreground">{action.description}</div>
                </div>
              </button>
            );
          })}

          <div className="border-t pt-2 mt-2">
            <p className="px-2 py-1 text-xs font-semibold text-muted-foreground">Custom</p>
            <div className="flex gap-1 px-1">
              <Input
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="Describe what to do..."
                className="h-8 text-xs"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && customPrompt.trim()) {
                    executeAIAction('custom', customPrompt);
                  }
                }}
              />
              <Button
                variant="default"
                size="sm"
                className="h-8 shrink-0"
                disabled={!customPrompt.trim() || loading}
                onClick={() => executeAIAction('custom', customPrompt)}
              >
                <Wand2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
