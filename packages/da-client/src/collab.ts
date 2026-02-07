/**
 * DA Collaboration API — WebSocket wrapper for real-time editing.
 * Stub for Phase 2 implementation.
 */

export interface CollabSession {
  connect(path: string): Promise<void>;
  disconnect(): void;
  onUpdate(callback: (update: Uint8Array) => void): void;
  sendUpdate(update: Uint8Array): void;
}

export function createCollabSession(): CollabSession {
  // Phase 2: Y.js integration with DA Collaboration API
  return {
    async connect(_path: string) {
      throw new Error('Collab not yet implemented — see Phase 2');
    },
    disconnect() {},
    onUpdate() {},
    sendUpdate() {},
  };
}
