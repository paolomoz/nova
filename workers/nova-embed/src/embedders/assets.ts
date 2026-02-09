/**
 * Asset embedding — images described via GPT-4o-mini vision,
 * then embedded with Voyage AI for semantic search.
 */

import { generateEmbeddings } from '../lib/voyage.js';

const OPENAI_CHAT_URL = 'https://api.openai.com/v1/chat/completions';

const IMAGE_DESCRIBE_PROMPT =
  'Describe this image in detail for search indexing. Include: subject matter, colors, composition, mood, any visible text, objects, setting, and style.';

interface DescribeImageResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

/**
 * Call GPT-4o-mini vision to generate a text description of an image.
 */
async function describeImage(
  imageUrl: string,
  openaiKey: string,
): Promise<string | null> {
  const response = await fetch(OPENAI_CHAT_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${openaiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: IMAGE_DESCRIBE_PROMPT },
            { type: 'image_url', image_url: { url: imageUrl } },
          ],
        },
      ],
      max_tokens: 300,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    console.error(`OpenAI vision error: ${response.status} — ${err}`);
    return null;
  }

  const data = (await response.json()) as DescribeImageResponse;
  return data.choices?.[0]?.message?.content ?? null;
}

/**
 * Resolve the fetchable URL for an asset.
 *
 * Priority:
 *  1. Explicit assetUrl provided in the message
 *  2. R2 bucket lookup (if ASSETS_BUCKET binding exists)
 *  3. null — caller should bail
 */
async function resolveAssetUrl(
  assetPath: string,
  assetUrl: string | undefined,
  assetsBucket: R2Bucket | undefined,
): Promise<string | null> {
  // 1. Explicit URL takes priority
  if (assetUrl) return assetUrl;

  // 2. Try R2 — generate a presigned-style object URL isn't possible from
  //    within a worker, but we can fetch the object and convert to a data URI
  //    so GPT-4o-mini can consume it.
  if (assetsBucket) {
    const obj = await assetsBucket.get(assetPath);
    if (obj) {
      const arrayBuffer = await obj.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(arrayBuffer).reduce(
          (data, byte) => data + String.fromCharCode(byte),
          '',
        ),
      );
      const mime = obj.httpMetadata?.contentType ?? 'image/png';
      return `data:${mime};base64,${base64}`;
    }
  }

  return null;
}

/**
 * Detect MIME type from the asset path extension.
 */
function mimeFromPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase();
  const map: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    avif: 'image/avif',
  };
  return map[ext ?? ''] ?? 'image/png';
}

export interface AssetEmbedEnv {
  OPENAI_API_KEY: string;
  VOYAGE_API_KEY: string;
  VOYAGE_MODEL?: string;
  VECTORIZE: VectorizeIndex;
  ASSETS_BUCKET?: R2Bucket;
}

/**
 * Embed an asset (image) by describing it with GPT-4o-mini vision,
 * then embedding the description with Voyage AI and storing in Vectorize.
 *
 * Returns the number of vectors upserted (0 or 1).
 */
export async function embedAsset(
  assetPath: string,
  projectId: string,
  env: AssetEmbedEnv,
  assetUrl?: string,
): Promise<number> {
  // 1. Resolve a fetchable URL for the image
  const resolvedUrl = await resolveAssetUrl(assetPath, assetUrl, env.ASSETS_BUCKET);
  if (!resolvedUrl) {
    console.warn(`Asset embed: could not resolve URL for ${assetPath}`);
    return 0;
  }

  // 2. Describe the image via GPT-4o-mini vision
  const description = await describeImage(resolvedUrl, env.OPENAI_API_KEY);
  if (!description) {
    console.warn(`Asset embed: could not describe image at ${assetPath}`);
    return 0;
  }

  // 3. Embed the description with Voyage AI
  const model = env.VOYAGE_MODEL ?? 'voyage-3';
  const embeddings = await generateEmbeddings([description], env.VOYAGE_API_KEY, model);

  // 4. Upsert into Vectorize with asset metadata
  const mimeType = mimeFromPath(assetPath);
  const vectorId = `asset:${projectId}:${assetPath}`;

  await env.VECTORIZE.upsert([
    {
      id: vectorId,
      values: embeddings[0].embedding,
      metadata: {
        type: 'asset',
        path: assetPath,
        projectId,
        mimeType,
        description: description.slice(0, 500),
      },
    },
  ]);

  return 1;
}
