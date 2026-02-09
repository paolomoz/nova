# Nova — Demo Script

**Context:** ~8 min demo. Split-screen layout: AI Rail (left) + WYSIWYG visual editor (right). User builds and refines an AEM Edge Delivery page through conversation, direct manipulation, and proactive AI suggestions.

**Layout chrome:** Left sidebar has Sites nav, AI assistant toggle (glowing purple). Editor toolbar has Source/Visual mode toggle, Save, Preview, Publish. Right panel shows block metadata or preview.

**Proactive UI pattern: Insight Cards** — the AI surfaces observations and suggestions unprompted as cards in the chat rail when it detects something worth flagging. Visually distinct from regular AI responses (colored accent border, icon, action buttons). Each card has Accept / Dismiss / custom actions.

---

## Implementation Status

| Feature | Status | Notes |
|---|---|---|
| Sites console (file browser) | WORKING | Lists pages from DA, 3 view modes, new page, CRUD |
| AI Rail (Cmd+.) | WORKING | Opens/closes, 4 tabs (Chat, Discover, History, Settings) |
| AI chat messages | WORKING | User bubbles + AI responses in chronological thread |
| SSE streaming | WORKING | Direct connection to worker bypasses Vite proxy buffering |
| AI plan execution (multi-step) | WORKING | Plan → step progress → tool calls → validation |
| AI single-step queries | WORKING | "Thinking..." spinner during Claude processing |
| AI page creation via tool-use | WORKING | Claude calls `create_page` tool → saves to DA |
| Insight cards (UI component) | WORKING | 3 types (suggestion/warning/info), action buttons, dismiss |
| Insight cards (proactive trigger) | PARTIAL | Cards can be triggered from SSE `insight` events; backend logic to auto-generate insights not yet implemented |
| Visual Editor (WYSIWYG) | WORKING | Proxied AEM page in iframe, contentEditable |
| WYSIWYG text editing | WORKING | Direct DOM edits + bridge content extraction |
| WYSIWYG Cmd+S save | WORKING | Bridge forwards to parent, saves to DA |
| Block selection + metadata | WORKING | Click block → blue outline → metadata panel |
| Source Editor (TipTap) | WORKING | Rich text, slash commands, collaboration |
| Block Browser | WORKING | Categorized EDS blocks with search |
| Assets panel | WORKING | Tab exists in right sidebar |
| Preview button | WORKING | Triggers AEM preview |
| Publish button | WORKING | Triggers AEM publish |
| Brand page | WORKING | Brand profile configuration UI |
| Version history UI | NOT IMPLEMENTED | DA supports versions, API lists them, but no UI dropdown |
| Change manifest | NOT IMPLEMENTED | No review list of session changes |
| Responsive preview toggle | NOT IMPLEMENTED | No device toggle in editor chrome |
| A/B test configuration | NOT IMPLEMENTED | No experimentation block or Target integration |
| Localization/culturalization | PARTIAL | AI can create pages at locale paths; no dedicated locale UI |
| Auto-navigate to created page | WORKING | Insight card with "Open in Editor" button after AI creates a page via tool-use |

---

## Act 1 — From Brief to Page

**Setup:** User is on the Sites console, viewing the `nova-2` project file tree (list view showing docs, index, nav, footer).

**User opens AI Rail** (clicks the glowing assistant icon or `Cmd+.`) and types:

> I need a landing page for the launch of our new running shoe, the AirPulse Pro. Target audience is urban runners aged 25-40. Tone should be energetic but premium.

**AI response** (streamed via SSE, showing the plan execution in real time):

- **Plan** phase: Claude creates a 3-step plan (get brand profile → get block library → create page)
- **Execute** phase: steps run in order with progress bar and checkmarks
- **Validate** phase: checks results for completeness

The AI creates a new page at `/airpulse-pro` with hero, cards, and CTA blocks.

Page saves to DA. An insight card appears: "Page created at /airpulse-pro. Open it in the editor?" User clicks **Open in Editor** and navigates directly to the Visual Editor.

**Insight card appears:**

> "Pages with video hero sections convert 23% higher for this demographic. Want me to add a video placeholder to the hero block?"

User **dismisses** for now. Card fades. Demonstrates the proactive pattern early without derailing the flow.

---

## Act 2 — Creative Dialogue

Three interaction modes shown in sequence:

### 2a. Chat-driven edit

User types in the AI Rail:

> Make the hero section more dynamic — I want to emphasize speed.

AI streams the plan (plan → execute → validate), then updates the hero block copy and structure. The Visual Editor refreshes with the updated AEM-rendered page.

### 2b. Direct text editing (WYSIWYG)

User clicks the headline in the Visual Editor iframe. The `<main>` is contentEditable (enabled by the bridge script). User edits inline:

> "Introducing AirPulse Pro" → "Built for Your Fastest Mile"

The bridge detects the mutation and sends `bridge:content-changed` to the parent. The editor toolbar shows an unsaved-changes indicator.

User presses `Cmd+S` — the bridge forwards the keystroke to the parent via `bridge:save` postMessage. The save handler extracts patched content from the iframe (tag+text matching against source HTML) and PUTs it to DA.

### 2c. Visual select → scoped prompt

User clicks a block in the Visual Editor — the bridge highlights the block with a blue outline (`2px solid #3B63FB`) and sends `bridge:block-selected` to the parent. The right panel switches to block metadata.

User types in the AI Rail:

> Make this CTA more urgent.

AI scopes the generation to only the selected block. Nothing else on the page changes.

### 2d. AI proactive response

**Insight card appears:**

> "You've shifted toward a performance message across several edits. Want me to regenerate the hero copy to reinforce this angle? I can also update the body copy for consistency."

User clicks **Accept**. AI regenerates hero and body copy with a performance-oriented tone. Preview updates live.

---

## Act 3 — Asset Integration

User navigates to the **Assets** panel (right sidebar) and drags a product photo into the editor.

User types in the AI Rail:

> Use this as the secondary product shot in the features section.

AI places the image in the cards block via DA, adjusts the layout. Visual Editor refreshes.

**Insight card appears:**

> "This product shot has no alt text. Want me to generate accessible descriptions for all images on the page?"

User clicks **Accept**. AI generates alt text for every image and saves to DA. Demonstrates accessibility awareness.

---

## Act 4 — Variations

User types:

> Actually, I'm not sure if we should lead with performance or lifestyle. Show me both directions.

AI generates two complete variations:

- **Performance:** punchy copy, action-oriented hero, competitive CTAs
- **Lifestyle:** softer tone, aspirational hero copy, community-focused CTAs

Both are saved as separate pages (`/airpulse-pro` and `/airpulse-pro-lifestyle`). User can switch between them in the Sites console or open side-by-side in Split View (`Cmd+Shift+.`).

**Insight card appears:**

> "Two creative directions ready. Want me to create an A/B test experiment with a 50/50 split and conversion tracking on the CTA?"

User clicks **Accept**. AI configures the experiment metadata and adds the appropriate AEM experimentation block.

---

## Act 5 — Brand Voice Check

**Insight card appears** (unprompted):

> "'Built for Your Fastest Mile' scores well for engagement, but your brand voice guidelines for the AirPulse line specify an inclusive tone over competitive language. Suggestion: 'Every Mile Is Your Mile.'"
>
> `Accept suggestion` · `Keep original` · `Edit`

User clicks **Accept suggestion**. Headline updates in the Visual Editor and saves to DA.

This demonstrates how Nova enforces brand governance through the Brand profile (configured in the Brand section of the sidebar nav).

---

## Act 6 — Responsive Check

User toggles to a narrow browser viewport (or we demonstrate the mobile preview).

**Insight card appears:**

> "The headline is truncating on mobile. Shorter variant: 'Your Mile. Your Way.'"
>
> `Accept` · `Dismiss`

User **accepts**. AI updates the mobile-optimized variant. Quick beat, move on.

---

## Act 7 — Review & Publish

### Change manifest

AI presents all changes from the session as a reviewable list in the Rail. Each line has an accept/decline toggle:

| | Change |
|---|---|
| :white_check_mark: | Base page: generated from brief with hero + cards + testimonial + CTA blocks |
| :white_check_mark: | Headline: "Introducing AirPulse Pro" → "Every Mile Is Your Mile" |
| :white_check_mark: | Hero copy: rewritten for performance angle |
| :white_check_mark: | Product shot: uploaded + alt text generated |
| :white_check_mark: | Body copy: updated for tonal consistency |
| :zap: | A/B test: Performance vs. Lifestyle variation |
| :white_check_mark: | CTA: "Shop Now" → "Don't Miss Launch Day — Shop Now" |
| :white_check_mark: | Mobile headline: shortened to "Your Mile. Your Way." |

Preview updates live as toggles change. User can also use version history to jump back to any saved version (`v1 — Initial generation`, `v2 — Performance pivot`, etc.).

### Localization

User types:

> We need this for Japan and Saudi Arabia too.

AI creates localized variants — not just translations, full cultural adaptations:

**Japan**
- Increases information density above the fold (Japanese web design convention)
- Adapts copy tone and formality
- Adjusts color emphasis (leverages positive connotations of red)
- AI notes: "Increased information density to match Japanese web conventions."

**Saudi Arabia**
- Flips layout to RTL
- Adjusts imagery for cultural appropriateness
- Adapts copy tone and formality level
- AI notes: "Layout converted to RTL. Adjusted messaging tone for regional conventions."

Localized pages are created as language copies in DA (`/airpulse-pro-ja`, `/airpulse-pro-ar`).

**Insight card appears:**

> "Your Saudi Arabia variant has no approved regional imagery in AEM Assets — all images are from the US library. Want to flag these for regional team review before publishing?"
>
> `Flag for review` · `Approve as-is`

User clicks **Flag for review**. Demonstrates governance at the global scale.

### Publish

User clicks **Publish** in the editor toolbar. The page goes live on AEM Edge Delivery via the DA publish pipeline. The AI Rail shows a confirmation with the live URL.

---

## Pacing Guide

| Act | Time | Demo beat |
|---|---|---|
| 1 — Brief to Page | ~1 min | SSE streaming plan + first insight card |
| 2 — Creative Dialogue | ~1.5 min | 3 interaction modes (chat, WYSIWYG, scoped) |
| 3 — Asset Integration | ~30 sec | Practical asset workflow + accessibility |
| 4 — Variations | ~1.5 min | Two directions, A/B setup |
| 5 — Brand Voice | ~30 sec | Enterprise governance |
| 6 — Responsive | ~20 sec | Quick hit |
| 7 — Review & Publish | ~2 min | Change manifest + localization + publish |

**Total: ~8 minutes**

---

## Insight Cards Summary

The proactive insight card pattern appears 7 times across the demo. Each is visually distinct from regular chat messages and carries action buttons. The cards demonstrate that the AI is an active creative partner — observing, analyzing, and suggesting — not passively waiting for instructions.

| Act | Insight Card | User Action |
|---|---|---|
| 1 | Video hero conversion data | Dismisses |
| 2d | Tonal shift detected → update copy | Accepts |
| 3 | Generate alt text for accessibility | Accepts |
| 4 | A/B test suggestion | Accepts |
| 5 | Brand voice guideline violation | Accepts suggestion |
| 6 | Mobile truncation fix | Accepts |
| 7 | Regional imagery flagged for review | Flags for review |

---

## Technical Architecture (for presenters)

The demo runs on Nova's real stack:

- **Frontend:** React + Vite, split-screen layout with AI Rail and Visual Editor
- **Visual Editor:** Proxied AEM Edge Delivery page in iframe, with injected bridge script for contentEditable, block highlighting, Cmd+S forwarding, and content extraction (tag+text matching against source HTML)
- **AI Pipeline:** SSE streaming through `nova-api` worker — Planner (Claude creates execution plan) → Executor (runs tools in dependency order) → Validator (checks multi-step results). 17 tools available including page CRUD, block generation, search, brand profile, telemetry.
- **Content Store:** DA Admin API (Document Authoring) — all reads/writes go through DA
- **Rendering:** AEM Edge Delivery Services — pages render via `main--{repo}--{org}.aem.page`
- **Infrastructure:** Cloudflare Workers (Hono), D1 (relational), KV (sessions/cache), Vectorize (embeddings)

### Key URLs during demo

| Service | URL |
|---|---|
| Nova frontend | `http://localhost:5173` |
| Nova API worker | `http://localhost:8787` |
| DA Admin | `https://admin.da.live` |
| AEM Preview | `https://main--nova-2--paolomoz.aem.page` |

### Pre-demo checklist

1. `pnpm dev` — start all dev servers
2. Login via dev-login (auto-creates `dev-org` + `nova-2` project)
3. Verify DA credentials in `workers/nova-api/.dev.vars`
4. Open browser to `http://localhost:5173/sites`
5. Confirm Visual Editor loads for `/index` (AEM proxy is working)
6. Confirm AI Rail opens with `Cmd+.`

### Bugs fixed during testing

1. **SSE parser bug** — `currentEvent` was scoped inside the read loop, so event names arriving in a different chunk than their data were lost. Fixed by moving to outer scope.
2. **Vite proxy buffering** — SSE streams were buffered by the Vite dev proxy. Fixed by routing SSE directly to the worker (`localhost:8787`) in dev mode.
3. **CORS credentials** — `Access-Control-Allow-Origin: *` with `credentials: true` is invalid. Fixed to echo the request origin.
4. **No loading indicator** — Single-mode AI queries showed no UI feedback. Fixed by setting `currentStep: 'Thinking...'` on stream start.
5. **AI response not rendered** — Combination of bugs #1 and #2 caused zero AI output in the rail. All fixed.
