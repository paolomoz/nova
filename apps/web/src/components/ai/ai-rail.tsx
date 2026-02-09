import { useState, useCallback, useRef, useEffect } from 'react';
import {
  Sparkles, X, Maximize2, ArrowUp, Loader2, Square,
  MessageSquare, Compass, Settings2, Check, AlertTriangle, User,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAI } from '@/lib/ai';
import { useAILayout } from '@/lib/ai-layout';
import { useProject } from '@/lib/project';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AIResponse } from './ai-response';
import { InsightCard } from './insight-card';
import { DiscoveryPrompts } from './discovery-prompts';
import { ConversationList } from './conversation-list';
import { ContextPicker, type ContextScope } from './context-picker';

export function AIRail() {
  const { mode, railTab, setRailTab, close, toggleExpand, railPush, toggleRailPush } = useAILayout();
  const {
    loading, streaming, response, messages, insights, currentPlan, currentStep, completedSteps,
    validationResult, executeStreaming, cancelExecution, dismissInsight, handleInsightAction,
  } = useAI();
  const projectId = useProject((s) => s.activeProjectId);

  const [input, setInput] = useState('');
  const [scope, setScope] = useState<ContextScope | undefined>();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const isOpen = mode === 'rail';
  const isExecuting = loading || streaming;

  // Auto-focus input when rail opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Expose addInsight for demo/testing via window
  const { addInsight } = useAI();
  useEffect(() => {
    (window as unknown as Record<string, unknown>).__novaAddInsight = addInsight;
    return () => { delete (window as unknown as Record<string, unknown>).__novaAddInsight; };
  }, [addInsight]);

  // Auto-scroll to bottom on new messages or streaming updates
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [streaming, currentStep, completedSteps.length, messages.length]);

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

  const tabs = [
    { id: 'chat' as const, label: 'Chat', icon: MessageSquare },
    { id: 'discovery' as const, label: 'Discover', icon: Compass },
    { id: 'conversations' as const, label: 'History', icon: MessageSquare },
    { id: 'settings' as const, label: 'Settings', icon: Settings2 },
  ];

  return (
    <div
      className={cn(
        'flex h-full w-[360px] shrink-0 flex-col border-l border-border bg-background-layer-2 animate-fade-in',
        !railPush && 'absolute right-0 top-0 z-40 shadow-elevated',
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg ai-gradient-vivid">
            <Sparkles className="h-3.5 w-3.5 text-white" />
          </div>
          <span className="text-sm font-semibold text-foreground-heading">Nova AI</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={toggleExpand}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors duration-100 hover:bg-accent hover:text-foreground"
            title="Expand to full screen"
            aria-label="Expand to full screen"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={close}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors duration-100 hover:bg-accent hover:text-foreground"
            title="Close AI panel"
            aria-label="Close AI panel"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-border px-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setRailTab(tab.id)}
              className={cn(
                'flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-medium transition-colors duration-100',
                railTab === tab.id
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Content area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {railTab === 'chat' && (
          <>
            {/* Chat thread */}
            <ScrollArea className="flex-1">
              <div ref={scrollRef} className="space-y-3 p-4">
                {/* Empty state */}
                {messages.length === 0 && !isExecuting && (
                  <div className="flex flex-col items-center gap-3 py-8 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl ai-gradient-vivid">
                      <Sparkles className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">How can I help?</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Ask about your content, or try a suggestion below.
                      </p>
                    </div>
                  </div>
                )}

                {/* Message history */}
                {messages.map((msg) => {
                  if (msg.role === 'user') {
                    return (
                      <div key={msg.id} className="flex justify-end">
                        <div className="max-w-[85%] rounded-lg bg-primary/10 px-3 py-2 text-sm text-foreground">
                          {msg.content}
                        </div>
                      </div>
                    );
                  }
                  if (msg.role === 'insight' && msg.insight) {
                    return (
                      <InsightCard
                        key={msg.id}
                        insight={msg.insight}
                        onAction={handleInsightAction}
                        onDismiss={dismissInsight}
                      />
                    );
                  }
                  if (msg.role === 'assistant') {
                    return <AIResponse key={msg.id} response={msg.content} compact />;
                  }
                  return null;
                })}

                {/* Streaming progress — plan mode */}
                {streaming && currentPlan && (
                  <div className="animate-fade-in-up rounded-lg bg-background p-3 text-sm space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-foreground-heading text-xs">
                        {currentPlan.intent}
                      </span>
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                        {completedSteps.length}/{currentPlan.stepCount}
                      </span>
                    </div>
                    <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary transition-all duration-300"
                        style={{ width: `${(completedSteps.length / currentPlan.stepCount) * 100}%` }}
                      />
                    </div>
                    <div className="space-y-1">
                      {completedSteps.map((step) => (
                        <div key={step.stepId} className="flex items-start gap-1.5 text-xs">
                          {step.status === 'success' ? (
                            <div className="mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-positive/10">
                              <Check className="h-2 w-2 text-positive" />
                            </div>
                          ) : (
                            <div className="mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-destructive/10">
                              <X className="h-2 w-2 text-destructive" />
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
                        <div className="flex items-center gap-1.5 text-xs">
                          <Loader2 className="h-3 w-3 animate-spin text-primary" />
                          <span className="text-foreground">{currentStep}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Streaming without plan */}
                {streaming && !currentPlan && currentStep && (
                  <div className="flex items-center gap-2.5 animate-fade-in-up rounded-lg bg-background p-3 text-sm">
                    <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
                    <span className="text-foreground text-xs">{currentStep}</span>
                  </div>
                )}

                {/* Validation warnings */}
                {validationResult && !validationResult.passed && (
                  <div className="animate-fade-in-up rounded-lg border border-notice/30 bg-notice/5 p-3 text-sm">
                    <div className="flex items-center gap-2 mb-1.5 font-medium text-notice text-xs">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Validation Issues
                    </div>
                    <div className="space-y-1">
                      {validationResult.issues.map((issue, i) => (
                        <div key={i} className="text-xs text-muted-foreground">- {issue}</div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>

            {/* Input area at bottom */}
            <div className="border-t border-border p-3 space-y-2">
              <div className="flex items-end gap-2 rounded-lg border border-border bg-background p-2">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask Nova anything..."
                  rows={1}
                  className="flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground min-h-[24px] max-h-[120px]"
                  style={{ fieldSizing: 'content' } as React.CSSProperties}
                />
                {isExecuting ? (
                  <button
                    onClick={cancelExecution}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive transition-colors duration-100 hover:bg-destructive/20"
                    title="Stop"
                    aria-label="Stop execution"
                  >
                    <Square className="h-3 w-3" />
                  </button>
                ) : (
                  <button
                    onClick={handleSubmit}
                    disabled={!input.trim() || !projectId}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity duration-100 disabled:opacity-30"
                    title="Send"
                    aria-label="Send prompt"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <div className="flex items-center justify-between">
                <ContextPicker scope={scope} onScopeChange={setScope} />
                <span className="text-[10px] text-muted-foreground">
                  <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-mono text-[9px]">Shift+Enter</kbd> for newline
                </span>
              </div>
            </div>
          </>
        )}

        {railTab === 'discovery' && (
          <ScrollArea className="flex-1">
            <div className="p-4">
              <div className="mb-3">
                <h3 className="text-sm font-semibold text-foreground-heading">Discover</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Explore what Nova AI can do for your content.
                </p>
              </div>
              <DiscoveryPrompts
                layout="list"
                onSelect={(prompt) => {
                  setRailTab('chat');
                  if (projectId) {
                    executeStreaming(projectId, prompt);
                  }
                }}
              />
            </div>
          </ScrollArea>
        )}

        {railTab === 'conversations' && (
          <ConversationList
            compact
            onSelect={(prompt) => {
              setRailTab('chat');
              setInput(prompt);
            }}
          />
        )}

        {railTab === 'settings' && (
          <ScrollArea className="flex-1">
            <div className="space-y-4 p-4">
              <div>
                <h3 className="text-sm font-semibold text-foreground-heading">AI Settings</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Configure how the AI assistant behaves.
                </p>
              </div>

              {/* Push / overlay toggle */}
              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <p className="text-sm font-medium">Push layout</p>
                  <p className="text-xs text-muted-foreground">
                    Resize main content when panel is open
                  </p>
                </div>
                <button
                  onClick={toggleRailPush}
                  className={cn(
                    'relative h-6 w-11 rounded-full transition-colors duration-200',
                    railPush ? 'bg-primary' : 'bg-muted',
                  )}
                  role="switch"
                  aria-checked={railPush}
                >
                  <span className={cn(
                    'absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200',
                    railPush && 'translate-x-5',
                  )} />
                </button>
              </div>

              {/* Keyboard shortcuts info */}
              <div className="rounded-lg border border-border p-3 space-y-2">
                <p className="text-sm font-medium">Keyboard shortcuts</p>
                <div className="space-y-1.5 text-xs text-muted-foreground">
                  <div className="flex items-center justify-between">
                    <span>Open Prompt Bar</span>
                    <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px]">Cmd+K</kbd>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Toggle AI Rail</span>
                    <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px]">Cmd+.</kbd>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Full screen AI</span>
                    <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px]">Cmd+Shift+.</kbd>
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}
