import { useState, useCallback, useRef, useEffect } from 'react';
import {
  Sparkles, X, GripVertical, ArrowUp, Loader2, Square,
  Maximize2, Check, AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAI } from '@/lib/ai';
import { useAILayout } from '@/lib/ai-layout';
import { useProject } from '@/lib/project';
import { AIResponse } from './ai-response';

interface AISplitViewProps {
  /** The content to show in the left pane (editor content) */
  children: React.ReactNode;
}

export function AISplitView({ children }: AISplitViewProps) {
  const { mode, splitRatio, setSplitRatio, close, toggleExpand } = useAILayout();
  const {
    loading, streaming, response, currentPlan, currentStep, completedSteps,
    validationResult, executeStreaming, cancelExecution,
  } = useAI();
  const projectId = useProject((s) => s.activeProjectId);

  const [input, setInput] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const isOpen = mode === 'split';
  const isExecuting = loading || streaming;

  const handleSubmit = useCallback(() => {
    if (!input.trim() || !projectId || isExecuting) return;
    executeStreaming(projectId, input.trim());
    setInput('');
  }, [input, projectId, isExecuting, executeStreaming]);

  // Drag resize handler
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);

    const startX = e.clientX;
    const startRatio = splitRatio;
    const containerWidth = containerRef.current?.offsetWidth || 1;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startX;
      const deltaPercent = (delta / containerWidth) * 100;
      setSplitRatio(startRatio + deltaPercent);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [splitRatio, setSplitRatio]);

  if (!isOpen) {
    return <>{children}</>;
  }

  return (
    <div ref={containerRef} className="flex h-full overflow-hidden">
      {/* Left pane: main content / editor */}
      <div
        className="flex-shrink-0 overflow-auto"
        style={{ width: `${splitRatio}%` }}
      >
        {children}
      </div>

      {/* Resize handle */}
      <div
        onMouseDown={handleMouseDown}
        className={cn(
          'flex w-2 cursor-col-resize items-center justify-center border-x border-border transition-colors duration-100 hover:bg-accent',
          isDragging && 'bg-primary/10',
        )}
      >
        <GripVertical className="h-4 w-4 text-muted-foreground/50" />
      </div>

      {/* Right pane: AI preview */}
      <div className="flex flex-1 flex-col overflow-hidden bg-background-layer-2">
        {/* AI pane header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-2">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md ai-gradient-vivid">
              <Sparkles className="h-3 w-3 text-white" />
            </div>
            <span className="text-sm font-semibold text-foreground-heading">AI Preview</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={toggleExpand}
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors duration-100 hover:bg-accent hover:text-foreground"
              title="Full screen"
              aria-label="Full screen"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={close}
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors duration-100 hover:bg-accent hover:text-foreground"
              title="Close split view"
              aria-label="Close split view"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* AI content area */}
        <div className="flex-1 overflow-auto p-4 space-y-4">
          {/* Streaming progress — plan mode */}
          {streaming && currentPlan && (
            <div className="animate-fade-in-up rounded-lg bg-background p-4 text-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-foreground-heading">
                  {currentPlan.intent}
                </span>
                <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                  {completedSteps.length}/{currentPlan.stepCount}
                </span>
              </div>
              <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-300"
                  style={{ width: `${(completedSteps.length / currentPlan.stepCount) * 100}%` }}
                />
              </div>
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
                {currentStep && (
                  <div className="flex items-center gap-2 text-xs">
                    <Loader2 className="h-3 w-3 animate-spin text-primary" />
                    <span className="text-foreground">{currentStep}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Streaming without plan */}
          {streaming && !currentPlan && currentStep && (
            <div className="flex items-center gap-3 animate-fade-in-up rounded-lg bg-background p-4 text-sm">
              <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
              <span className="text-foreground">{currentStep}</span>
            </div>
          )}

          {/* Validation warnings */}
          {validationResult && !validationResult.passed && (
            <div className="animate-fade-in-up rounded-lg border border-notice/30 bg-notice/5 p-4 text-sm">
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

          {/* AI Response */}
          {response && !streaming && (
            <AIResponse response={response} />
          )}

          {/* Empty state */}
          {!response && !isExecuting && (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl ai-gradient-vivid">
                <Sparkles className="h-7 w-7 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium">AI-powered preview</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Ask a question to see AI-generated content side by side.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Input area */}
        <div className="border-t border-border p-3">
          <div className="flex items-center gap-2 rounded-lg border border-border bg-background p-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              placeholder="Ask Nova to generate content..."
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            {isExecuting ? (
              <button
                onClick={cancelExecution}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive"
                title="Stop"
                aria-label="Stop"
              >
                <Square className="h-3 w-3" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={!input.trim() || !projectId}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-30"
                title="Send"
                aria-label="Send"
              >
                <ArrowUp className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
