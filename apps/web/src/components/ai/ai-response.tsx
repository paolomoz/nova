import { useState } from 'react';
import { Copy, Check, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AIFeedback } from './ai-feedback';

interface AIResponseProps {
  /** The AI response text */
  response: string;
  /** Optional response ID for feedback tracking */
  responseId?: string;
  /** Compact mode for smaller displays */
  compact?: boolean;
  /** Additional className */
  className?: string;
}

export function AIResponse({ response, responseId, compact, className }: AIResponseProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(response);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={cn('animate-fade-in-up space-y-2', className)}>
      {/* Response bubble */}
      <div className={cn(
        'rounded-lg bg-background-layer-2 text-[15px] leading-relaxed whitespace-pre-wrap',
        compact ? 'p-3 text-sm' : 'p-4',
      )}>
        <div className="mb-2 flex items-center gap-2">
          <div className="flex h-5 w-5 items-center justify-center rounded-md ai-gradient-vivid">
            <Sparkles className="h-3 w-3 text-white" />
          </div>
          <span className="text-xs font-medium text-muted-foreground">Nova AI</span>
        </div>
        {response}
      </div>

      {/* Action bar: copy + feedback */}
      <div className="flex items-center gap-1 px-1">
        <button
          onClick={handleCopy}
          className={cn(
            'flex items-center gap-1.5 rounded-md px-2 text-xs text-muted-foreground transition-colors duration-100 hover:bg-accent hover:text-accent-foreground',
            compact ? 'h-6' : 'h-7',
          )}
          aria-label="Copy response"
        >
          {copied ? <Check className="h-3 w-3 text-positive" /> : <Copy className="h-3 w-3" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
        <div className="mx-1 h-3 w-px bg-border" />
        <AIFeedback responseId={responseId} compact={compact} />
      </div>
    </div>
  );
}
