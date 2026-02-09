import { useEffect } from 'react';
import { Clock, MessageSquare, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAI } from '@/lib/ai';
import { useProject } from '@/lib/project';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ConversationListProps {
  /** Called when a conversation action is selected for replay */
  onSelect?: (prompt: string) => void;
  /** Compact mode for rail */
  compact?: boolean;
  /** Additional className */
  className?: string;
}

export function ConversationList({ onSelect, compact, className }: ConversationListProps) {
  const { recentActions, loadHistory } = useAI();
  const projectId = useProject((s) => s.activeProjectId);

  useEffect(() => {
    if (projectId) {
      loadHistory(projectId);
    }
  }, [projectId, loadHistory]);

  if (recentActions.length === 0) {
    return (
      <div className={cn('flex flex-col items-center justify-center gap-3 py-12 text-center', className)}>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
          <MessageSquare className="h-5 w-5 text-muted-foreground" />
        </div>
        <div>
          <p className="text-sm font-medium">No conversations yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Your AI conversation history will appear here.
          </p>
        </div>
      </div>
    );
  }

  // Group actions by date
  const grouped = groupByDate(recentActions);

  return (
    <ScrollArea className={cn('h-full', className)}>
      <div className="space-y-4 p-3">
        {grouped.map((group) => (
          <div key={group.label}>
            <div className="mb-2 px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {group.label}
            </div>
            <div className="space-y-0.5">
              {group.items.map((action) => (
                <button
                  key={action.id}
                  onClick={() => onSelect?.(action.description)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg px-3 text-left text-sm transition-colors duration-100 hover:bg-accent',
                    compact ? 'py-2' : 'py-2.5',
                  )}
                >
                  <Clock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="truncate">{action.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatTime(action.createdAt)}
                    </p>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}

// Helpers

interface ActionItem {
  id: string;
  actionType: string;
  description: string;
  createdAt: string;
}

function groupByDate(actions: ActionItem[]) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const groups: Record<string, ActionItem[]> = {};

  for (const action of actions) {
    const date = new Date(action.createdAt);
    date.setHours(0, 0, 0, 0);

    let label: string;
    if (date.getTime() === today.getTime()) {
      label = 'Today';
    } else if (date.getTime() === yesterday.getTime()) {
      label = 'Yesterday';
    } else {
      label = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    }

    if (!groups[label]) groups[label] = [];
    groups[label].push(action);
  }

  return Object.entries(groups).map(([label, items]) => ({ label, items }));
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
