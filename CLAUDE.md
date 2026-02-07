# Nova — AI-native CMS

## Architecture

Nova is a monorepo (pnpm + turbo) with three layers:

- **`apps/web`** — React frontend (Vite + Tailwind + shadcn/ui)
- **`workers/`** — Cloudflare Workers (Hono framework)
  - `nova-api` — Main API (auth, content proxy, AI orchestration)
  - `nova-gen` — Generative pipeline (classify → reason → generate, SSE streaming)
  - `nova-embed` — Embedding pipeline (content → Voyage AI → Vectorize)
- **`packages/`** — Shared libraries
  - `shared-types` — TypeScript type definitions
  - `da-client` — Document Authoring API client (token service + admin API)

## Key Conventions

- All workers use Hono for HTTP routing
- DA (Document Authoring) is the content store — all content CRUD goes through DA Admin API
- AI uses Claude tool-use pattern: define tools, let Claude call them
- SSE for streaming responses (generative pipeline, AI command bar)
- D1 for relational data, KV for sessions/cache, Vectorize for embeddings, R2 for assets
- GitHub OAuth for auth (Phase 0), Adobe IMS later (Phase 11)

## Code Style

- TypeScript strict mode everywhere
- Prefer `interface` over `type` for object shapes
- Use barrel exports (`index.ts`) in packages
- Workers: keep route handlers thin, logic in services/lib
- Frontend: co-locate components with routes, shared UI in `components/ui/`
- Use zod for runtime validation at API boundaries

## Package References

- `@nova/shared-types` — import types from here
- `@nova/da-client` — import DA client from here
- Frontend uses `@/` path alias mapping to `src/`

## Running

```bash
pnpm install        # Install all dependencies
pnpm build          # Build all packages and apps
pnpm dev            # Start dev servers (frontend + workers)
```

## Infrastructure

- **D1**: SQLite database (schema in `infra/d1/schema.sql`)
- **KV**: Session storage, DA token cache, generative session context
- **Vectorize**: Content embeddings for semantic search
- **R2**: Asset storage
- **Queues**: Embedding pipeline triggers
