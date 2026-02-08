import { useEffect, useState, useCallback } from 'react';
import { Command } from 'cmdk';
import { useAI } from '@/lib/ai';
import { useProject } from '@/lib/project';
import { api, type AISuggestion } from '@/lib/api';
import { Sparkles, Clock, Loader2, Lightbulb, Check, X, AlertTriangle, Square, ArrowUp, ThumbsUp, ThumbsDown, Copy } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

export function CommandBar() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([]);
  const [copied, setCopied] = useState(false);
  const {
    loading, streaming, response, recentActions,
    currentPlan, currentStep, completedSteps, validationResult,
    executeStreaming, cancelExecution, loadHistory,
  } = useAI();
  const projectId = useProject((s) => s.activeProjectId);

  // Cmd+K to open
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  // Load history and suggestions when opened
  useEffect(() => {
    if (open && projectId) {
      loadHistory(projectId);
      api.getSuggestions(projectId).then((data) => setSuggestions(data.suggestions)).catch(() => {});
    }
  }, [open, projectId, loadHistory]);

  const handleSubmit = useCallback(() => {
    if (!input.trim() || !projectId || loading) return;
    executeStreaming(projectId, input.trim());
    setInput('');
  }, [input, projectId, loading, executeStreaming]);

  const handleCopy = useCallback(() => {
    if (response) {
      navigator.clipboard.writeText(response);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [response]);

  const isExecuting = loading || streaming;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden gap-0 rounded-xl border shadow-elevated">
        <Command className="border-none bg-transparent" shouldFilter={false}>
          {/* Input area with AI icon */}
          <div className="flex items-center gap-3 border-b border-border px-4">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Sparkles className={cn(
                'h-4 w-4 text-primary',
                isExecuting && 'animate-pulse',
              )} />
            </div>
            <Command.Input
              value={input}
              onValueChange={setInput}
              placeholder="Ask Nova anything..."
              className="flex h-14 w-full bg-transparent py-4 text-base outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
            />
            <div className="flex items-center gap-1.5">
              {isExecuting ? (
                <button
                  onClick={cancelExecution}
                  className="flex h-8 items-center gap-1.5 rounded-full bg-destructive/10 px-3 text-xs font-medium text-destructive transition-colors duration-150 hover:bg-destructive/20"
                  title="Cancel execution"
                  aria-label="Cancel execution"
                >
                  <Square className="h-3 w-3" />
                  Stop
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={!input.trim() || !projectId}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity duration-150 disabled:opacity-30"
                  title="Send"
                  aria-label="Send prompt"
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          <Command.List className="max-h-[420px] overflow-y-auto px-3 py-3">
            {/* Streaming Progress — Plan mode */}
            {streaming && currentPlan && (
              <div className="mb-4 animate-fade-in-up rounded-lg bg-background p-4 text-sm space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-foreground-heading">
                    {currentPlan.intent}
                  </span>
                  <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                    {completedSteps.length}/{currentPlan.stepCount}
                  </span>
                </div>

                {/* Progress bar */}
                <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-300"
                    style={{ width: `${(completedSteps.length / currentPlan.stepCount) * 100}%` }}
                  />
                </div>

                {/* Completed steps */}
                <div className="space-y-1.5">
                  {completedSteps.map((step) => (
                    <div key={step.stepId} className="flex items-start gap-2 text-xs">
                      {step.status === 'success' ? (
                        <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-positive/10">
                          <Check className="h-2.5 w-2.5 text-positive" />
                        </div>
                      ) : (
                        <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-destructive/10">
                          <X className="h-2.5 w-2.5 text-destructive" />
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

                  {/* Current step */}
                  {currentStep && (
                    <div className="flex items-center gap-2 text-xs">
                      <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center">
                        <Loader2 className="h-3 w-3 animate-spin text-primary" />
                      </div>
                      <span className="text-foreground">{currentStep}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Streaming without plan (single mode) */}
            {streaming && !currentPlan && currentStep && (
              <div className="mb-4 flex items-center gap-3 animate-fade-in-up rounded-lg bg-background p-4 text-sm">
                <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
                <span className="text-foreground">{currentStep}</span>
              </div>
            )}

            {/* Validation warnings */}
            {validationResult && !validationResult.passed && (
              <div className="mb-4 animate-fade-in-up rounded-lg border border-notice/30 bg-notice/5 p-4 text-sm">
                <div className="flex items-center gap-2 mb-2 font-medium text-notice">
                  <AlertTriangle className="h-4 w-4" />
                  Validation Issues
                </div>
                <div className="space-y-1">
                  {validationResult.issues.map((issue, i) => (
                    <div key={i} className="text-xs text-muted-foreground">- {issue}</div>
                  ))}
                </div>
              </div>
            )}

            {/* AI Response Bubble */}
            {response && !streaming && (
              <div className="mb-4 animate-fade-in-up space-y-2">
                <div className="rounded-lg bg-background p-4 text-[15px] leading-relaxed whitespace-pre-wrap">
                  {response}
                </div>
                {/* Feedback bar */}
                <div className="flex items-center gap-1 px-1">
                  <button
                    onClick={handleCopy}
                    className="flex h-7 items-center gap-1.5 rounded-md px-2 text-xs text-muted-foreground transition-colors duration-100 hover:bg-accent hover:text-accent-foreground"
                    aria-label="Copy response"
                  >
                    {copied ? <Check className="h-3 w-3 text-positive" /> : <Copy className="h-3 w-3" />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                  <button
                    className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors duration-100 hover:bg-accent hover:text-accent-foreground"
                    aria-label="Good response"
                  >
                    <ThumbsUp className="h-3 w-3" />
                  </button>
                  <button
                    className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors duration-100 hover:bg-accent hover:text-accent-foreground"
                    aria-label="Bad response"
                  >
                    <ThumbsDown className="h-3 w-3" />
                  </button>
                </div>
              </div>
            )}

            {/* Discovery Prompts (categorized suggestions) */}
            {suggestions.length > 0 && !input && !response && !isExecuting && (
              <div className="mb-3 space-y-3">
                <div className="px-1 text-xs font-medium text-muted-foreground uppercase tracking-wide">Suggestions</div>
                <div className="grid grid-cols-1 gap-1.5">
                  {suggestions.map((suggestion, i) => (
                    <Command.Item
                      key={i}
                      className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm cursor-pointer transition-colors duration-100 aria-selected:bg-accent"
                      onSelect={() => {
                        if (projectId) {
                          executeStreaming(projectId, suggestion.prompt);
                          setSuggestions([]);
                        }
                      }}
                    >
                      <Lightbulb className="h-4 w-4 shrink-0 text-ai-indigo" />
                      <span className="flex-1">{suggestion.text}</span>
                    </Command.Item>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Actions */}
            {recentActions.length > 0 && !isExecuting && (
              <div className="space-y-2">
                <div className="px-1 text-xs font-medium text-muted-foreground uppercase tracking-wide">Recent</div>
                {recentActions.map((action) => (
                  <Command.Item
                    key={action.id}
                    className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm cursor-pointer transition-colors duration-100 aria-selected:bg-accent"
                  >
                    <Clock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="flex-1 truncate">{action.description}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {new Date(action.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </Command.Item>
                ))}
              </div>
            )}

            {!response && recentActions.length === 0 && suggestions.length === 0 && !isExecuting && (
              <Command.Empty className="flex flex-col items-center gap-3 py-10 text-center text-sm text-muted-foreground">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl ai-gradient-vivid">
                  <Sparkles className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="font-medium text-foreground">What can I help with?</p>
                  <p className="mt-1">Try "list all pages" or "create a new blog post"</p>
                </div>
              </Command.Empty>
            )}
          </Command.List>

          {/* Footer with keyboard hints */}
          <div className="flex items-center justify-between border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <kbd className="rounded-md border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px]">Enter</kbd>
                Send
              </span>
              <span className="flex items-center gap-1">
                <kbd className="rounded-md border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px]">Esc</kbd>
                Close
              </span>
            </div>
            <span className="flex items-center gap-1">
              <kbd className="rounded-md border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px]">⌘K</kbd>
              Toggle
            </span>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
