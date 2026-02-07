import { useEffect, useState, useCallback } from 'react';
import { Command } from 'cmdk';
import { useAI } from '@/lib/ai';
import { useProject } from '@/lib/project';
import { api, type AISuggestion } from '@/lib/api';
import { Sparkles, Clock, Loader2, Lightbulb, Check, X, AlertTriangle, Square } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';

export function CommandBar() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([]);
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

  const isExecuting = loading || streaming;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden">
        <Command className="rounded-lg border-none" shouldFilter={false}>
          <div className="flex items-center border-b px-3">
            <Sparkles className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
            <Command.Input
              value={input}
              onValueChange={setInput}
              placeholder="Ask Nova anything..."
              className="flex h-12 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
            />
            {isExecuting && (
              <button
                onClick={cancelExecution}
                className="ml-2 flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent"
                title="Cancel"
              >
                <Square className="h-3 w-3" />
                Cancel
              </button>
            )}
            {isExecuting && <Loader2 className="ml-2 h-4 w-4 animate-spin text-muted-foreground" />}
          </div>

          <Command.List className="max-h-[400px] overflow-y-auto p-2">
            {/* Streaming Progress */}
            {streaming && currentPlan && (
              <div className="mb-3 rounded-lg bg-muted/50 p-3 text-sm space-y-2">
                <div className="font-medium text-foreground">
                  {currentPlan.intent}
                  <span className="ml-2 text-xs text-muted-foreground">
                    ({completedSteps.length}/{currentPlan.stepCount} steps)
                  </span>
                </div>

                {/* Completed steps */}
                {completedSteps.map((step) => (
                  <div key={step.stepId} className="flex items-start gap-2 text-xs">
                    {step.status === 'success' ? (
                      <Check className="h-3 w-3 mt-0.5 text-green-500 shrink-0" />
                    ) : (
                      <X className="h-3 w-3 mt-0.5 text-red-500 shrink-0" />
                    )}
                    <span className={step.status === 'error' ? 'text-red-500' : 'text-muted-foreground'}>
                      {step.description || step.toolName || step.stepId}
                    </span>
                  </div>
                ))}

                {/* Current step */}
                {currentStep && (
                  <div className="flex items-center gap-2 text-xs">
                    <Loader2 className="h-3 w-3 animate-spin text-blue-500 shrink-0" />
                    <span className="text-foreground">{currentStep}</span>
                  </div>
                )}
              </div>
            )}

            {/* Streaming without plan (single mode) */}
            {streaming && !currentPlan && currentStep && (
              <div className="mb-3 flex items-center gap-2 rounded-lg bg-muted/50 p-3 text-sm">
                <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                <span>{currentStep}</span>
              </div>
            )}

            {/* Validation warnings */}
            {validationResult && !validationResult.passed && (
              <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950">
                <div className="flex items-center gap-2 mb-1 font-medium text-amber-700 dark:text-amber-300">
                  <AlertTriangle className="h-3 w-3" />
                  Validation issues
                </div>
                {validationResult.issues.map((issue, i) => (
                  <div key={i} className="text-xs text-amber-600 dark:text-amber-400">- {issue}</div>
                ))}
              </div>
            )}

            {/* AI Response */}
            {response && !streaming && (
              <div className="mb-3 rounded-lg bg-muted p-3 text-sm whitespace-pre-wrap">
                {response}
              </div>
            )}

            {/* AI Suggestions */}
            {suggestions.length > 0 && !input && !response && !isExecuting && (
              <Command.Group heading="Suggestions">
                {suggestions.map((suggestion, i) => (
                  <Command.Item
                    key={i}
                    className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm cursor-pointer aria-selected:bg-accent"
                    onSelect={() => {
                      if (projectId) {
                        executeStreaming(projectId, suggestion.prompt);
                        setSuggestions([]);
                      }
                    }}
                  >
                    <Lightbulb className="h-3 w-3 text-amber-500" />
                    <span className="flex-1">{suggestion.text}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* Recent Actions */}
            {recentActions.length > 0 && !isExecuting && (
              <Command.Group heading="Recent Actions">
                {recentActions.map((action) => (
                  <Command.Item
                    key={action.id}
                    className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm cursor-pointer aria-selected:bg-accent"
                  >
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    <span className="flex-1">{action.description}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(action.createdAt).toLocaleTimeString()}
                    </span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {!response && recentActions.length === 0 && suggestions.length === 0 && !isExecuting && (
              <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
                Type a command or ask a question. Try "list all pages under /en"
              </Command.Empty>
            )}
          </Command.List>

          <div className="border-t px-3 py-2 text-xs text-muted-foreground">
            Press Enter to execute &middot; Esc to close &middot; <kbd className="rounded bg-muted px-1">⌘K</kbd> to toggle
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
