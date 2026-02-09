/**
 * Real-time collaboration store — Y.js + DA Collab WebSocket bridge.
 *
 * Provides a Y.js Doc and a provider compatible with TipTap's
 * Collaboration and CollaborationCursor extensions.
 *
 * In mock mode (VITE_MOCK=true) collab is simulated with fake peers.
 */
import { create } from 'zustand';
import * as Y from 'yjs';
import { Awareness } from 'y-protocols/awareness';

// ── Types ──────────────────────────────────────────────────────

export interface CollabPeer {
  id: string;
  name: string;
  color: string;
}

export type CollabStatus = 'disconnected' | 'connecting' | 'connected';

interface CollabState {
  /** Y.js document instance (stable across reconnects) */
  ydoc: Y.Doc;
  /** Awareness instance for cursor / presence tracking */
  awareness: Awareness;
  /** Current connection status */
  status: CollabStatus;
  /** Connected peers (excluding self) */
  peers: CollabPeer[];
  /** Whether we're running in mock mode */
  isMock: boolean;
  /** Connect to the DA collab session */
  connect: (opts: ConnectOpts) => void;
  /** Disconnect cleanly */
  disconnect: () => void;
}

interface ConnectOpts {
  org: string;
  repo: string;
  path: string;
  user: { id: string; name: string };
  token?: string;
}

// ── Helpers ────────────────────────────────────────────────────

const COLLAB_HOST = 'wss://collab.da.live';

/** Deterministic color from a user id string */
function userColor(userId: string): string {
  const PALETTE = [
    '#3B63FB', '#E5484D', '#30A46C', '#E38627',
    '#8E4EC6', '#0091FF', '#E54666', '#F76B15',
    '#12A594', '#7C66DC', '#D6409F', '#6E56CF',
  ];
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash + userId.charCodeAt(i)) | 0;
  }
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

// ── Provider (DA Collab WebSocket <-> Y.js) ────────────────────

/** Lightweight Y.js provider that speaks the DA Collab binary protocol. */
class DACollabProvider {
  private ws: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private destroyed = false;

  constructor(
    private readonly ydoc: Y.Doc,
    private readonly awareness: Awareness,
    private readonly url: string,
    private readonly user: { id: string; name: string },
    private readonly token?: string,
    private readonly onStatusChange?: (status: CollabStatus) => void,
    private readonly onPeersChange?: (peers: CollabPeer[]) => void,
  ) {}

  connect(): void {
    if (this.destroyed) return;
    this.onStatusChange?.('connecting');

    try {
      const protocols = this.token ? [this.token] : undefined;
      const ws = new WebSocket(this.url, protocols);
      ws.binaryType = 'arraybuffer';
      this.ws = ws;

      ws.addEventListener('open', () => {
        this.onStatusChange?.('connected');

        // Send initial awareness (our presence)
        this.broadcastAwareness();

        // Send full Y.js state as initial sync
        const state = Y.encodeStateAsUpdate(this.ydoc);
        this.sendUpdate(state);
      });

      ws.addEventListener('message', (event: MessageEvent) => {
        if (event.data instanceof ArrayBuffer) {
          this.handleBinary(new Uint8Array(event.data));
        } else if (typeof event.data === 'string') {
          this.handleText(event.data);
        }
      });

      ws.addEventListener('close', () => {
        this.onStatusChange?.('disconnected');
        this.scheduleReconnect();
      });

      ws.addEventListener('error', () => {
        this.onStatusChange?.('disconnected');
        ws.close();
      });

      // Listen for local Y.js updates and forward to peers
      this.ydoc.on('update', this.handleLocalUpdate);

      // Listen for local awareness changes
      this.awareness.on('change', this.handleAwarenessChange);
    } catch {
      this.onStatusChange?.('disconnected');
    }
  }

  destroy(): void {
    this.destroyed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ydoc.off('update', this.handleLocalUpdate);
    this.awareness.off('change', this.handleAwarenessChange);
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  // ── Binary protocol handlers ────────────────────────────────

  private handleBinary = (data: Uint8Array) => {
    if (data.length === 0) return;
    const msgType = data[0];
    const payload = data.slice(1);

    if (msgType === 0) {
      // Sync / update — apply Y.js update
      Y.applyUpdate(this.ydoc, payload);
    } else if (msgType === 1) {
      // Awareness
      this.handleAwarenessPayload(payload);
    }
  };

  private handleText = (raw: string) => {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const peers: CollabPeer[] = [];
        for (const entry of parsed) {
          if (entry.user && entry.user.id !== this.user.id) {
            peers.push({
              id: entry.user.id,
              name: entry.user.name,
              color: userColor(entry.user.id),
            });
          }
        }
        this.onPeersChange?.(peers);
      }
    } catch {
      // Ignore non-JSON text
    }
  };

  private handleAwarenessPayload = (payload: Uint8Array) => {
    try {
      const text = new TextDecoder().decode(payload);
      const states = JSON.parse(text) as Array<{ clientId: number; user: { id: string; name: string } }>;
      const peers: CollabPeer[] = [];
      for (const s of states) {
        if (s.user && s.user.id !== this.user.id) {
          peers.push({
            id: s.user.id,
            name: s.user.name,
            color: userColor(s.user.id),
          });
        }
      }
      this.onPeersChange?.(peers);
    } catch {
      // Malformed awareness — ignore
    }
  };

  // ── Outbound ────────────────────────────────────────────────

  private handleLocalUpdate = (update: Uint8Array, origin: unknown) => {
    // Only forward updates that originate locally (not from remote sync)
    if (origin === this) return;
    this.sendUpdate(update);
  };

  private sendUpdate(update: Uint8Array): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const msg = new Uint8Array(update.length + 1);
    msg[0] = 0; // sync / update
    msg.set(update, 1);
    this.ws.send(msg.buffer);
  }

  private handleAwarenessChange = () => {
    this.broadcastAwareness();
  };

  private broadcastAwareness(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const localState = this.awareness.getLocalState();
    const payload = new TextEncoder().encode(
      JSON.stringify({ user: { id: this.user.id, name: this.user.name }, ...localState }),
    );
    const msg = new Uint8Array(payload.length + 1);
    msg[0] = 1; // awareness
    msg.set(payload, 1);
    this.ws.send(msg.buffer);
  }

  // ── Reconnect ───────────────────────────────────────────────

  private scheduleReconnect(): void {
    if (this.destroyed) return;
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, 3000);
  }
}

// ── Mock provider (fake peers) ─────────────────────────────────

function createMockPeers(): CollabPeer[] {
  return [
    { id: 'mock-peer-1', name: 'Alice Chen', color: userColor('mock-peer-1') },
    { id: 'mock-peer-2', name: 'Bob Taylor', color: userColor('mock-peer-2') },
  ];
}

// ── Zustand Store ──────────────────────────────────────────────

const isMock = import.meta.env.VITE_MOCK === 'true';

// Shared doc & awareness live outside the store so they are never recreated
const sharedDoc = new Y.Doc();
const sharedAwareness = new Awareness(sharedDoc);

let activeProvider: DACollabProvider | null = null;

export const useCollab = create<CollabState>((set, get) => ({
  ydoc: sharedDoc,
  awareness: sharedAwareness,
  status: 'disconnected',
  peers: isMock ? createMockPeers() : [],
  isMock,

  connect: (opts: ConnectOpts) => {
    // Disconnect any existing provider
    get().disconnect();

    if (isMock) {
      // In mock mode, just show as connected with fake peers
      set({ status: 'connected', peers: createMockPeers() });
      return;
    }

    const color = userColor(opts.user.id);

    // Set local awareness state for cursor rendering
    sharedAwareness.setLocalStateField('user', {
      id: opts.user.id,
      name: opts.user.name,
      color,
    });

    const url = `${COLLAB_HOST}/${opts.org}/${opts.repo}${opts.path}`;

    const provider = new DACollabProvider(
      sharedDoc,
      sharedAwareness,
      url,
      opts.user,
      opts.token,
      (status) => set({ status }),
      (peers) => set({ peers }),
    );

    activeProvider = provider;
    provider.connect();
  },

  disconnect: () => {
    if (activeProvider) {
      activeProvider.destroy();
      activeProvider = null;
    }
    if (!isMock) {
      set({ status: 'disconnected', peers: [] });
    }
  },
}));
