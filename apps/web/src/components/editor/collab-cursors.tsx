/**
 * Collaboration presence indicator — shows colored dots / avatars
 * for connected peers in the editor header area.
 */
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { useCollab, type CollabPeer, type CollabStatus } from '@/lib/collab';
import { Wifi, WifiOff, Loader2 } from 'lucide-react';

// ── Status badge ───────────────────────────────────────────────

function StatusDot({ status }: { status: CollabStatus }) {
  if (status === 'connecting') {
    return <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />;
  }

  const color =
    status === 'connected'
      ? 'bg-emerald-500'
      : 'bg-muted-foreground/40';

  return <span className={`inline-block h-2 w-2 rounded-full ${color}`} />;
}

// ── Single peer avatar ─────────────────────────────────────────

function PeerDot({ peer }: { peer: CollabPeer }) {
  const initials = peer.name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold text-white ring-2 ring-background cursor-default"
          style={{ backgroundColor: peer.color }}
        >
          {initials}
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <p className="text-xs">{peer.name}</p>
      </TooltipContent>
    </Tooltip>
  );
}

// ── Main component ─────────────────────────────────────────────

export function CollabCursors() {
  const { status, peers, isMock } = useCollab();

  // Nothing to show when disconnected and no peers
  if (status === 'disconnected' && peers.length === 0 && !isMock) {
    return null;
  }

  const statusLabel =
    status === 'connected'
      ? `Connected${peers.length > 0 ? ` — ${peers.length} other${peers.length > 1 ? 's' : ''}` : ''}`
      : status === 'connecting'
        ? 'Connecting...'
        : 'Offline';

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex items-center gap-1.5">
        {/* Peer avatars — show up to 4, then +N */}
        {peers.slice(0, 4).map((peer) => (
          <PeerDot key={peer.id} peer={peer} />
        ))}
        {peers.length > 4 && (
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-muted text-[10px] font-medium text-muted-foreground ring-2 ring-background">
            +{peers.length - 4}
          </span>
        )}

        {/* Connection status icon */}
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="ml-0.5 flex items-center gap-1 cursor-default">
              <StatusDot status={status} />
              {status === 'connected' ? (
                <Wifi className="h-3.5 w-3.5 text-emerald-600" />
              ) : status === 'connecting' ? (
                <Wifi className="h-3.5 w-3.5 text-muted-foreground" />
              ) : (
                <WifiOff className="h-3.5 w-3.5 text-muted-foreground/50" />
              )}
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p className="text-xs">{statusLabel}</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
