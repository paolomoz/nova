import { chunkHtmlContent, embedContent } from './embedders/content.js';
import { embedStructuredData } from './embedders/structured.js';
import { embedAsset } from './embedders/assets.js';

interface Env {
  VOYAGE_API_KEY: string;
  VOYAGE_MODEL: string;
  OPENAI_API_KEY: string;
  VECTORIZE: VectorizeIndex;
  ASSETS_BUCKET?: R2Bucket;
}

interface EmbedMessage {
  type: 'content' | 'structured' | 'asset';
  projectId: string;
  path: string;
  html?: string;
  data?: Record<string, unknown>;
  assetUrl?: string;
}

export default {
  // HTTP trigger for manual embedding
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ status: 'ok', service: 'nova-embed' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (url.pathname === '/embed' && request.method === 'POST') {
      const body = (await request.json()) as EmbedMessage;
      const result = await processMessage(body, env);
      return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response('Not found', { status: 404 });
  },

  // Queue consumer for async embedding
  async queue(batch: MessageBatch<EmbedMessage>, env: Env): Promise<void> {
    for (const message of batch.messages) {
      try {
        await processMessage(message.body, env);
        message.ack();
      } catch (err) {
        console.error(`Embed error for ${message.body.path}:`, err);
        message.retry();
      }
    }
  },
};

async function processMessage(
  msg: EmbedMessage,
  env: Env,
): Promise<{ embedded: number; type: string }> {
  switch (msg.type) {
    case 'content': {
      if (!msg.html) return { embedded: 0, type: 'content' };
      const chunks = chunkHtmlContent(msg.html, msg.path, msg.projectId);
      const count = await embedContent(chunks, env.VOYAGE_API_KEY, env.VECTORIZE, env.VOYAGE_MODEL);
      return { embedded: count, type: 'content' };
    }
    case 'structured': {
      if (!msg.data) return { embedded: 0, type: 'structured' };
      await embedStructuredData(msg.data, msg.path, msg.projectId, env.VOYAGE_API_KEY, env.VECTORIZE);
      return { embedded: 1, type: 'structured' };
    }
    case 'asset': {
      const count = await embedAsset(msg.path, msg.projectId, {
        OPENAI_API_KEY: env.OPENAI_API_KEY,
        VOYAGE_API_KEY: env.VOYAGE_API_KEY,
        VOYAGE_MODEL: env.VOYAGE_MODEL,
        VECTORIZE: env.VECTORIZE,
        ASSETS_BUCKET: env.ASSETS_BUCKET,
      }, msg.assetUrl);
      return { embedded: count, type: 'asset' };
    }
    default:
      return { embedded: 0, type: 'unknown' };
  }
}
