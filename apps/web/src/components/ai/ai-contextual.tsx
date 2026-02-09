import { useState, useCallback, useEffect, useRef } from 'react';
import { Sparkles, Wand2, FileText, Languages, ArrowUp, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAI } from '@/lib/ai';
import { useAILayout } from '@/lib/ai-layout';
import { useProject } from '@/lib/project';
import { AIResponse } from './ai-response';

interface ContextualAction {
  id: string;
  label: string;
  prompt: string;
  icon: typeof Sparkles;
}

const contextualActions: ContextualAction[] = [
  { id: 'improve', label: 'Improve writing', prompt: 'Improve the following text for clarity and readability:', icon: Wand2 },
  { id: 'summarize', label: 'Summarize', prompt: 'Summarize the following text concisely:', icon: FileText },
  { id: 'translate', label: 'Translate', prompt: 'Translate the following text to Spanish:', icon: Languages },
  { id: 'expand', label: 'Expand', prompt: 'Expand the following text with more detail and examples:', icon: Sparkles },
];

export function AIContextual() {
  const { mode, contextualSelection, contextualPosition, setContextual } = useAILayout();
  const { loading, streaming, response, executeStreaming } = useAI();
  const projectId = useProject((s) => s.activeProjectId);

  const [customInput, setCustomInput] = useState('');
  const [showResponse, setShowResponse] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const isOpen = mode === 'contextual' && contextualSelection && contextualPosition;
  const isExecuting = loading || streaming;

  // Reset state when closed
  useEffect(() => {
    if (!isOpen) {
      setCustomInput('');
      setShowResponse(false);
    }
  }, [isOpen]);

  // Show response when AI finishes
  useEffect(() => {
    if (response && !streaming) {
      setShowResponse(true);
    }
  }, [response, streaming]);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        setContextual(null, null);
      }
    };
    // Small delay to avoid closing immediately from the selection event
    const timeout = setTimeout(() => {
      document.addEventListener('mousedown', handler);
    }, 100);
    return () => {
      clearTimeout(timeout);
      document.removeEventListener('mousedown', handler);
    };
  }, [isOpen, setContextual]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setContextual(null, null);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, setContextual]);

  const handleAction = useCallback((action: ContextualAction) => {
    if (!projectId || !contextualSelection) return;
    const fullPrompt = `${action.prompt}\n\n"${contextualSelection}"`;
    executeStreaming(projectId, fullPrompt);
  }, [projectId, contextualSelection, executeStreaming]);

  const handleCustomSubmit = useCallback(() => {
    if (!customInput.trim() || !projectId || !contextualSelection) return;
    const fullPrompt = `${customInput.trim()}\n\nSelected text: "${contextualSelection}"`;
    executeStreaming(projectId, fullPrompt);
    setCustomInput('');
  }, [customInput, projectId, contextualSelection, executeStreaming]);

  if (!isOpen) return null;

  // Calculate position — keep card within viewport
  const pos = contextualPosition!;
  const cardStyle: React.CSSProperties = {
    position: 'fixed',
    left: Math.min(pos.x, window.innerWidth - 320),
    top: Math.min(pos.y + 8, window.innerHeight - 300),
    zIndex: 50,
  };

  return (
    <div ref={cardRef} style={cardStyle} className="animate-fade-in-up">
      <div className="w-[300px] rounded-xl border border-border bg-popover shadow-elevated overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-border">
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-ai-indigo" />
            <span className="text-xs font-medium">AI Actions</span>
          </div>
          <button
            onClick={() => setContextual(null, null)}
            className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-3 w-3" />
          </button>
        </div>

        {/* Selected text preview */}
        <div className="border-b border-border bg-muted/30 px-3 py-2">
          <p className="text-xs text-muted-foreground line-clamp-2 italic">
            "{contextualSelection}"
          </p>
        </div>

        {/* Show response if we have one */}
        {showResponse && response && (
          <div className="p-3 border-b border-border max-h-[200px] overflow-y-auto">
            <AIResponse response={response} compact />
          </div>
        )}

        {/* Streaming indicator */}
        {isExecuting && (
          <div className="flex items-center gap-2 p-3 border-b border-border">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
            <span className="text-xs text-muted-foreground">Thinking...</span>
          </div>
        )}

        {/* Quick actions */}
        {!isExecuting && !showResponse && (
          <div className="p-1.5">
            {contextualActions.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.id}
                  onClick={() => handleAction(action)}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors duration-100 hover:bg-accent"
                >
                  <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>{action.label}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Custom input */}
        <div className="border-t border-border px-3 py-2">
          <div className="flex items-center gap-2">
            <input
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleCustomSubmit();
                }
              }}
              placeholder="Custom instruction..."
              className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
            />
            <button
              onClick={handleCustomSubmit}
              disabled={!customInput.trim() || isExecuting}
              className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity duration-100 disabled:opacity-30"
              aria-label="Send"
            >
              <ArrowUp className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
