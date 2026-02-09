import { useState, useCallback, useRef, useEffect } from 'react';
import {
  Sparkles, Minimize2, ArrowUp, Loader2, Square,
  Check, X, AlertTriangle, MessageSquare,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAI } from '@/lib/ai';
import { useAILayout } from '@/lib/ai-layout';
import { useProject } from '@/lib/project';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AIResponse } from './ai-response';
import { DiscoveryPrompts } from './discovery-prompts';
import { ConversationList } from './conversation-list';
import { ContextPicker, type ContextScope } from './context-picker';

export function AIFullScreen() {
  const { mode, close, toggleExpand } = useAILayout();
  const {
    loading, streaming, response, currentPlan, currentStep, completedSteps,
    validationResult, executeStreaming, cancelExecution,
  } = useAI();
  const projectId = useProject((s) => s.activeProjectId);

  const [input, setInput] = useState('');
  const [scope, setScope] = useState<ContextScope | undefined>();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const isOpen = mode === 'fullscreen';
  const isExecuting = loading || streaming;

  // Auto-focus input when fullscreen opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Auto-scroll when streaming
  useEffect(() => {
    if (streaming && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [streaming, currentStep, completedSteps.length]);

  // Escape to close
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        close();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, close]);

  const handleSubmit = useCallback(() => {
    if (!input.trim() || !projectId || isExecuting) return;
    executeStreaming(projectId, input.trim());
    setInput('');
  }, [input, projectId, isExecuting, executeStreaming]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background animate-fade-in">
      {/* Top navigation bar */}
      <div className="flex items-center justify-between border-b border-border px-6 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg ai-gradient-vivid">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <div>
            <span className="text-base font-semibold text-foreground-heading">Nova AI</span>
            <span className="ml-2 text-xs text-muted-foreground">Full screen mode</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ContextPicker scope={scope} onScopeChange={setScope} />
          <button
            onClick={toggleExpand}
            className="flex h-8 items-center gap-1.5 rounded-md border border-border px-3 text-xs font-medium text-muted-foreground transition-colors duration-100 hover:bg-accent hover:text-foreground"
            title="Collapse to rail"
            aria-label="Collapse to rail"
          >
            <Minimize2 className="h-3.5 w-3.5" />
            Collapse
          </button>
          <button
            onClick={close}
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors duration-100 hover:bg-accent hover:text-foreground"
            title="Close"
            aria-label="Close AI"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Main content — three-column layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left column: conversation history */}
        <div className="hidden w-72 shrink-0 border-r border-border lg:flex lg:flex-col">
          <div className="border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">History</span>
            </div>
          </div>
          <ConversationList
            onSelect={(prompt) => setInput(prompt)}
          />
        </div>

        {/* Center column: main conversation */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Chat area */}
          <ScrollArea className="flex-1">
            <div ref={scrollRef} className="mx-auto max-w-3xl space-y-6 px-6 py-8">
              {/* Streaming progress — plan mode */}
              {streaming && currentPlan && (
                <div className="animate-fade-in-up rounded-xl bg-background-layer-2 p-6 text-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-base font-bold text-foreground-heading">
                      {currentPlan.intent}
                    </span>
                    <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                      {completedSteps.length}/{currentPlan.stepCount}
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-300"
                      style={{ width: `${(completedSteps.length / currentPlan.stepCount) * 100}%` }}
                    />
                  </div>
                  <div className="space-y-2">
                    {completedSteps.map((step) => (
                      <div key={step.stepId} className="flex items-start gap-2.5 text-sm">
                        {step.status === 'success' ? (
                          <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-positive/10">
                            <Check className="h-3 w-3 text-positive" />
                          </div>
                        ) : (
                          <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-destructive/10">
                            <X className="h-3 w-3 text-destructive" />
                          </div>
                        )}
                        <span className={cn(
                          'leading-relaxed',
                          step.status === 'error' ? 'text-destructive' : 'text-muted-foreground',
                        )}>
                          {step.description || step.toolName || step.stepId}
                        </span>
                      </div>
                    ))}
                    {currentStep && (
                      <div className="flex items-center gap-2.5 text-sm">
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        <span className="text-foreground">{currentStep}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Streaming without plan */}
              {streaming && !currentPlan && currentStep && (
                <div className="flex items-center gap-3 animate-fade-in-up rounded-xl bg-background-layer-2 p-6 text-sm">
                  <Loader2 className="h-5 w-5 animate-spin text-primary shrink-0" />
                  <span className="text-foreground">{currentStep}</span>
                </div>
              )}

              {/* Validation warnings */}
              {validationResult && !validationResult.passed && (
                <div className="animate-fade-in-up rounded-xl border border-notice/30 bg-notice/5 p-5 text-sm">
                  <div className="flex items-center gap-2 mb-2 font-medium text-notice">
                    <AlertTriangle className="h-4 w-4" />
                    Validation Issues
                  </div>
                  <div className="space-y-1.5">
                    {validationResult.issues.map((issue, i) => (
                      <div key={i} className="text-sm text-muted-foreground">- {issue}</div>
                    ))}
                  </div>
                </div>
              )}

              {/* AI Response */}
              {response && !streaming && (
                <AIResponse response={response} />
              )}

              {/* Empty state */}
              {!response && !isExecuting && (
                <div className="flex flex-col items-center gap-4 py-20 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-3xl ai-gradient-vivid">
                    <Sparkles className="h-8 w-8 text-white" />
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-foreground-heading">
                      What can I help you with?
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground max-w-md">
                      I can help you manage content, analyze your site, optimize SEO,
                      generate pages, and much more.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Expanded input area */}
          <div className="border-t border-border px-6 py-4">
            <div className="mx-auto max-w-3xl">
              <div className="flex items-end gap-3 rounded-xl border border-border bg-background-layer-2 p-3 shadow-emphasized">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask Nova anything..."
                  rows={2}
                  className="flex-1 resize-none bg-transparent text-base outline-none placeholder:text-muted-foreground min-h-[48px] max-h-[200px]"
                  style={{ fieldSizing: 'content' } as React.CSSProperties}
                />
                <div className="flex items-center gap-2">
                  {isExecuting ? (
                    <button
                      onClick={cancelExecution}
                      className="flex h-9 items-center gap-1.5 rounded-full bg-destructive/10 px-4 text-sm font-medium text-destructive transition-colors duration-150 hover:bg-destructive/20"
                      title="Cancel"
                      aria-label="Cancel execution"
                    >
                      <Square className="h-3.5 w-3.5" />
                      Stop
                    </button>
                  ) : (
                    <button
                      onClick={handleSubmit}
                      disabled={!input.trim() || !projectId}
                      className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity duration-100 disabled:opacity-30"
                      title="Send"
                      aria-label="Send prompt"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-2">
                  <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px]">Shift+Enter</kbd>
                  for newline
                </span>
                <span className="flex items-center gap-2">
                  <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px]">Esc</kbd>
                  to close
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right column: discovery prompts */}
        <div className="hidden w-80 shrink-0 border-l border-border xl:flex xl:flex-col">
          <div className="border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-ai-indigo" />
              <span className="text-sm font-medium">Discover</span>
            </div>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-4">
              <DiscoveryPrompts
                layout="list"
                onSelect={(prompt) => {
                  if (projectId) {
                    executeStreaming(projectId, prompt);
                  }
                }}
              />
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
