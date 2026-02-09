import { useState } from 'react';
import { ThumbsUp, ThumbsDown, Flag, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AIFeedbackProps {
  /** Unique identifier for the response being rated */
  responseId?: string;
  /** Compact mode for inline use */
  compact?: boolean;
  className?: string;
}

type FeedbackState = 'none' | 'positive' | 'negative' | 'flagged';

export function AIFeedback({ responseId, compact, className }: AIFeedbackProps) {
  const [feedback, setFeedback] = useState<FeedbackState>('none');
  const [submitted, setSubmitted] = useState(false);

  const handleFeedback = (type: FeedbackState) => {
    setFeedback(type);
    setSubmitted(true);
    // In production, this would call an API endpoint to record feedback
    // api.submitFeedback(responseId, type)
    setTimeout(() => setSubmitted(false), 2000);
  };

  if (submitted) {
    return (
      <div className={cn('flex items-center gap-1.5 text-xs text-positive', className)}>
        <Check className="h-3 w-3" />
        <span>Thanks for your feedback</span>
      </div>
    );
  }

  return (
    <div className={cn('flex items-center gap-0.5', className)}>
      <button
        onClick={() => handleFeedback('positive')}
        className={cn(
          'flex items-center justify-center rounded-md text-muted-foreground transition-colors duration-100 hover:bg-accent hover:text-accent-foreground',
          compact ? 'h-6 w-6' : 'h-7 w-7',
          feedback === 'positive' && 'text-positive bg-positive/10',
        )}
        aria-label="Good response"
        title="Good response"
      >
        <ThumbsUp className={cn(compact ? 'h-3 w-3' : 'h-3.5 w-3.5')} />
      </button>
      <button
        onClick={() => handleFeedback('negative')}
        className={cn(
          'flex items-center justify-center rounded-md text-muted-foreground transition-colors duration-100 hover:bg-accent hover:text-accent-foreground',
          compact ? 'h-6 w-6' : 'h-7 w-7',
          feedback === 'negative' && 'text-destructive bg-destructive/10',
        )}
        aria-label="Bad response"
        title="Bad response"
      >
        <ThumbsDown className={cn(compact ? 'h-3 w-3' : 'h-3.5 w-3.5')} />
      </button>
      <button
        onClick={() => handleFeedback('flagged')}
        className={cn(
          'flex items-center justify-center rounded-md text-muted-foreground transition-colors duration-100 hover:bg-accent hover:text-accent-foreground',
          compact ? 'h-6 w-6' : 'h-7 w-7',
          feedback === 'flagged' && 'text-notice bg-notice/10',
        )}
        aria-label="Flag response"
        title="Flag as problematic"
      >
        <Flag className={cn(compact ? 'h-3 w-3' : 'h-3.5 w-3.5')} />
      </button>
    </div>
  );
}
