export interface SSEEvent {
  event: string;
  data: Record<string, unknown>;
}

export type SSECallback = (event: SSEEvent) => void;

export function createSSEStream(): {
  readable: ReadableStream;
  write: SSECallback;
  close: () => void;
} {
  const encoder = new TextEncoder();
  let controller: ReadableStreamDefaultController<Uint8Array>;

  const readable = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
    },
    cancel() {
      // Client disconnected
    },
  });

  return {
    readable,
    write: (event: SSEEvent) => {
      try {
        const data = JSON.stringify(event.data);
        const message = `event: ${event.event}\ndata: ${data}\n\n`;
        controller.enqueue(encoder.encode(message));
      } catch {
        // Stream may be closed
      }
    },
    close: () => {
      try {
        controller.close();
      } catch {
        // Already closed
      }
    },
  };
}

export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export const SSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  Connection: 'keep-alive',
  ...CORS_HEADERS,
};
