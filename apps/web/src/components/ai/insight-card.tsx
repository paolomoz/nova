import { Lightbulb, AlertTriangle, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { InsightCard as InsightCardData } from '@/lib/ai';

interface InsightCardProps {
  insight: InsightCardData;
  onAction: (insightId: string, action: string) => void;
  onDismiss: (id: string) => void;
}

const typeConfig = {
  suggestion: {
    icon: Lightbulb,
    borderColor: 'border-primary/40',
    bgColor: 'bg-primary/5',
    iconColor: 'text-primary',
    label: 'Suggestion',
  },
  warning: {
    icon: AlertTriangle,
    borderColor: 'border-notice/40',
    bgColor: 'bg-notice/5',
    iconColor: 'text-notice',
    label: 'Attention',
  },
  info: {
    icon: Info,
    borderColor: 'border-ai-indigo/40',
    bgColor: 'bg-ai-indigo/5',
    iconColor: 'text-ai-indigo',
    label: 'Insight',
  },
};

export function InsightCard({ insight, onAction, onDismiss }: InsightCardProps) {
  if (insight.dismissed) return null;

  const config = typeConfig[insight.type] || typeConfig.info;
  const Icon = config.icon;

  return (
    <div
      className={cn(
        'animate-fade-in-up rounded-lg border-l-[3px] p-3 space-y-2',
        config.borderColor,
        config.bgColor,
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon className={cn('h-3.5 w-3.5 shrink-0', config.iconColor)} />
          <span className={cn('text-[10px] font-semibold uppercase tracking-wider', config.iconColor)}>
            {config.label}
          </span>
        </div>
        <button
          onClick={() => onDismiss(insight.id)}
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label="Dismiss"
        >
          <X className="h-3 w-3" />
        </button>
      </div>

      {/* Content */}
      <p className="text-sm leading-relaxed text-foreground">
        {insight.message}
      </p>

      {/* Actions */}
      {insight.actions.length > 0 && (
        <div className="flex items-center gap-2 pt-1">
          {insight.actions.map((action, i) => (
            <button
              key={action.action}
              onClick={() => onAction(insight.id, action.action)}
              className={cn(
                'rounded-md px-2.5 py-1 text-xs font-medium transition-colors duration-100',
                i === 0
                  ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                  : 'border border-border bg-background text-foreground hover:bg-accent',
              )}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
