/**
 * DA Collaboration API — WebSocket wrapper for real-time editing.
 *
 * The DA Collaboration API uses Y.js for real-time multi-user editing.
 * Documents are synced via WebSocket connections to the DA collab endpoint.
 *
 * The collab server expects Y.js encoded updates and awareness protocol messages.
 */

export interface CollabUser {
  id: string;
  name: string;
  color: string;
}

export interface CollabSession {
  /** Connect to a DA collaboration session for the given document path */
  connect(path: string): Promise<void>;
  /** Disconnect from the current session */
  disconnect(): void;
  /** Register callback for Y.js document updates from remote peers */
  onUpdate(callback: (update: Uint8Array) => void): void;
  /** Send a local Y.js document update to remote peers */
  sendUpdate(update: Uint8Array): void;
  /** Register callback for awareness updates (cursor positions, user presence) */
  onAwareness(callback: (states: Map<number, CollabUser>) => void): void;
  /** Send local awareness state (cursor position, etc.) */
  sendAwareness(state: Record<string, unknown>): void;
  /** Get list of currently connected users */
  getConnectedUsers(): CollabUser[];
  /** Whether the session is currently connected */
  isConnected(): boolean;
}

interface CollabSessionOptions {
  /** DA org identifier */
  org: string;
  /** DA repo identifier */
  repo: string;
  /** User info for awareness */
  user: CollabUser;
  /** DA collab WebSocket endpoint (defaults to wss://collab.da.live) */
  collabHost?: string;
  /** Auth token for the connection */
  token?: string;
}

const DEFAULT_COLLAB_HOST = 'wss://collab.da.live';

export function createCollabSession(options: CollabSessionOptions): CollabSession {
  const { org, repo, user, collabHost = DEFAULT_COLLAB_HOST, token } = options;

  let ws: WebSocket | null = null;
  let connected = false;
  let updateCallback: ((update: Uint8Array) => void) | null = null;
  let awarenessCallback: ((states: Map<number, CollabUser>) => void) | null = null;
  const connectedUsers = new Map<number, CollabUser>();
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let currentPath: string | null = null;

  const connect = async (path: string): Promise<void> => {
    currentPath = path;
    const url = `${collabHost}/${org}/${repo}${path}`;

    return new Promise((resolve, reject) => {
      try {
        const socket = new WebSocket(url, token ? [token] : undefined);
        ws = socket;

        // Use addEventListener for cross-runtime compatibility (browser + Workers)
        socket.addEventListener('open', () => {
          connected = true;
          sendAwareness({ user });
          resolve();
        });

        socket.addEventListener('message', (event: MessageEvent) => {
          const rawData = event.data;
          const processBuffer = (buf: ArrayBuffer) => {
            const data = new Uint8Array(buf);
            if (data.length === 0) return;

            // Protocol: first byte is message type (0 = sync/update, 1 = awareness)
            const messageType = data[0];
            const payload = data.slice(1);

            if (messageType === 0 && updateCallback) {
              updateCallback(payload);
            } else if (messageType === 1 && awarenessCallback) {
              try {
                const text = new TextDecoder().decode(payload);
                const states = JSON.parse(text) as Array<{ clientId: number; user: CollabUser }>;
                const stateMap = new Map<number, CollabUser>();
                for (const s of states) {
                  stateMap.set(s.clientId, s.user);
                }
                connectedUsers.clear();
                for (const [id, u] of stateMap) {
                  connectedUsers.set(id, u);
                }
                awarenessCallback(stateMap);
              } catch {
                // Ignore malformed awareness
              }
            }
          };

          if (rawData instanceof ArrayBuffer) {
            processBuffer(rawData);
          } else if (typeof rawData === 'string') {
            // Text messages — try to parse as JSON awareness
            try {
              const parsed = JSON.parse(rawData);
              if (Array.isArray(parsed)) {
                const stateMap = new Map<number, CollabUser>();
                for (const s of parsed) {
                  stateMap.set(s.clientId, s.user);
                }
                connectedUsers.clear();
                for (const [id, u] of stateMap) {
                  connectedUsers.set(id, u);
                }
                if (awarenessCallback) awarenessCallback(stateMap);
              }
            } catch {
              // Ignore
            }
          }
        });

        socket.addEventListener('close', () => {
          connected = false;
          if (currentPath) {
            reconnectTimer = setTimeout(() => {
              if (currentPath) connect(currentPath);
            }, 3000);
          }
        });

        socket.addEventListener('error', () => {
          connected = false;
          reject(new Error('WebSocket connection failed'));
        });
      } catch (err) {
        reject(err);
      }
    });
  };

  const disconnect = () => {
    currentPath = null;
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    if (ws) {
      ws.close();
      ws = null;
    }
    connected = false;
    connectedUsers.clear();
  };

  const onUpdate = (callback: (update: Uint8Array) => void) => {
    updateCallback = callback;
  };

  const sendUpdate = (update: Uint8Array) => {
    if (ws && connected) {
      // Prefix with message type 0 (sync/update)
      const message = new Uint8Array(update.length + 1);
      message[0] = 0;
      message.set(update, 1);
      ws.send(message.buffer);
    }
  };

  const onAwareness = (callback: (states: Map<number, CollabUser>) => void) => {
    awarenessCallback = callback;
  };

  const sendAwareness = (state: Record<string, unknown>) => {
    if (ws && connected) {
      const payload = new TextEncoder().encode(JSON.stringify(state));
      const message = new Uint8Array(payload.length + 1);
      message[0] = 1;
      message.set(payload, 1);
      ws.send(message.buffer);
    }
  };

  const getConnectedUsers = (): CollabUser[] => {
    return Array.from(connectedUsers.values());
  };

  const isConnected = (): boolean => connected;

  return {
    connect,
    disconnect,
    onUpdate,
    sendUpdate,
    onAwareness,
    sendAwareness,
    getConnectedUsers,
    isConnected,
  };
}
