# Nova Design Instructions

> Derived from the **AEM NextGen AI Assistant Pattern Library** (Figma) and the
> **Adobe Spectrum 2** design system. These instructions are the single source of
> truth for all UI work in the Nova application.

---

## 1. Design System Foundation

Nova's visual language is based on **Adobe Spectrum 2** — Adobe's design system
for Experience Cloud products. We implement it through **Tailwind CSS** with
custom CSS variables, not with the React Spectrum component library.

### Core Principles

| Principle | Implementation |
|---|---|
| **Feel at Home** | Use native web patterns (Radix primitives, shadcn/ui) styled to match Spectrum 2 visual language |
| **Inclusive & Accessible** | WCAG 2.1 AA minimum. Semantic HTML, ARIA attributes, keyboard navigation on all interactive elements |
| **Functional & Joyful** | Lighter feel: generous whitespace, rounded corners, clear hierarchy. Avoid heavy/industrial aesthetics |

### Design Philosophy

- **Lighter, bolder, rounder** — Spectrum 2's visual direction
- Friendlier typography with clear weight hierarchy
- Brighter, more vibrant accent colors
- Generous spacing and breathing room
- Soft shadows for elevation, not hard borders

---

## 2. Color System

### Semantic Color Tokens

Map these to CSS custom properties in `globals.css`. Values below are for the
**light theme** (default).

```
/* ── Backgrounds ── */
--background:           0 0% 97.3%;      /* #F8F8F8  — app frame layer-1 */
--background-layer-2:   0 0% 100%;       /* #FFFFFF  — elevated surfaces */
--background-accent:    230 96% 61%;     /* #3B63FB  — primary accent bg */

/* ── Foreground / Text ── */
--foreground:           0 0% 16.1%;      /* #292929  — body text */
--foreground-heading:   0 0% 7.5%;       /* #131313  — headings */
--foreground-muted:     0 0% 44.3%;      /* #717171  — secondary/muted text */

/* ── Accent / Primary ── */
--primary:              230 96% 61%;     /* #3B63FB  — Spectrum blue-900 */
--primary-foreground:   0 0% 100%;       /* #FFFFFF */

/* ── Borders ── */
--border:               0 0% 88.2%;      /* #E1E1E1  — gray-200 */

/* ── Semantic status colors ── */
--positive:             (green-800 from Spectrum)
--notice:               (orange-800 from Spectrum)
--negative:             (red-800 from Spectrum)
--informative:          230 96% 61%;     /* same as primary */
```

### Extended Palette (for AI-specific gradients and accents)

These chromatic colors appear in AI response renderers, status badges, and
decorative gradients:

| Token | Hex | Usage |
|---|---|---|
| `cyan-400` | `#8AD5FF` | AI gradient element, informative accents |
| `purple-500` | `#D0A7F3` | AI gradient element |
| `indigo-800` | `#7A6AFD` | AI gradient element, deep accent |
| `fuchsia-600` | `#EC69FF` | AI gradient element |
| `fuchsia-700` | `#DF4DF5` | Highlight text, subtitle accent |
| `blue-100` | `#F5F9FF` | Light AI background tint |
| `blue-900` | `#3B63FB` | Primary action, links |
| `corporate-red` | `#EB1000` | Adobe brand red (sparingly) |

### AI Gradient

The signature AI visual identity uses a cool-toned gradient background that
fades from the app background into a blend of cyan, indigo, and fuchsia. Use
this for:
- AI assistant panel headers
- Cover/hero sections of AI features
- Loading/thinking state backgrounds

```css
.ai-gradient {
  background: linear-gradient(
    to right,
    var(--background) 0%,
    var(--background) 70%,
    #8AD5FF 100%
  );
}
```

With overlaid organic blob shapes in `cyan-400`, `indigo-800`, `fuchsia-600`
at various opacities for depth.

---

## 3. Typography

### Font Family

**Primary:** `Adobe Clean` (variable font: `Adobe Clean Spectrum VF`)
**Fallback stack:** `"Adobe Clean", "Source Sans Pro", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
**Monospace:** `"Source Code Pro", Monaco, "Cascadia Code", monospace`

> If Adobe Clean is not available in the deployment, fall back to the system
> sans-serif stack. The design should still look correct with system fonts.

### Type Scale

Based on a **1.125 (major second)** ratio. All sizes are desktop values.

| Token | Size | Weight | Line Height | Usage |
|---|---|---|---|---|
| `body-sm` | 14px | Regular (400) | 1.5 | Default UI text, table cells |
| `body-md` | 16px | Regular (400) | 1.5 | Comfortable reading |
| `body-lg` | 18px | Regular (400) | 1.5 | Emphasized body, AI responses |
| `body-xl` | 20px | Regular (400) | 1.5 | Lead paragraphs |
| `body-xxl` | 22px | Regular (400) | 1.5 | Featured body text |
| `title-lg` | 25px | Bold (700) | 30px | Section titles |
| `heading-xl` | 36px | ExtraBold (800) | 42px | Page headings |
| `heading-xxxl` | 58px | ExtraBold (800) | 66px | Hero headings |

### Weight Hierarchy

| Weight | Value | Usage |
|---|---|---|
| Regular | 400 | Body text, descriptions |
| Medium | 500 | UI labels, navigation items |
| Bold | 700 | Titles, emphasis |
| ExtraBold | 800 | Headings, hero text |

### Letter Spacing

**0** for all text. Do not add letter-spacing unless explicitly needed for
all-caps labels (where use `0.05em`).

---

## 4. Spacing System

Use Spectrum 2's **4px base grid**. All spacing values are multiples of 4px.

| Token | Value | Tailwind | Usage |
|---|---|---|---|
| `spacing-50` | 2px | `0.5` | Micro spacing, icon gaps |
| `spacing-75` | 4px | `1` | Tight element spacing |
| `spacing-100` | 8px | `2` | Default internal padding |
| `spacing-200` | 12px | `3` | Component internal spacing |
| `spacing-300` | 16px | `4` | Standard gap between elements |
| `spacing-400` | 24px | `6` | Section internal padding |
| `spacing-500` | 32px | `8` | Large gaps, card padding |
| `spacing-600` | 40px | `10` | Section spacing |
| `spacing-700` | 48px | `12` | Major section breaks |
| `spacing-800` | 64px | `16` | Page-level spacing |
| `spacing-900` | 80px | `20` | Hero/cover padding |
| `spacing-1000` | 96px | `24` | Maximum spacing |

---

## 5. Shape & Elevation

### Corner Radius

| Context | Radius | Tailwind |
|---|---|---|
| Small components (checkboxes, chips) | 2px | `rounded-sm` |
| Default components (inputs, cards, buttons) | 4px | `rounded` |
| Large containers (panels, dialogs) | 8px | `rounded-lg` |
| Extra large (modals, popovers) | 12px | `rounded-xl` |
| Pill shape (CTAs, tags, badges) | 9999px | `rounded-full` |
| Cover/hero panels | 40-48px | `rounded-[40px]` |

### Shadows / Elevation

Use Spectrum 2's three-layer shadow system:

```css
/* Emphasized (cards, panels) */
--shadow-emphasized:
  0 2px 8px rgba(0, 0, 0, 0.08),
  0 1px 4px rgba(0, 0, 0, 0.04),
  0 0px 1px rgba(0, 0, 0, 0.08);

/* Elevated (popovers, dropdowns, floating panels) */
--shadow-elevated:
  0 8px 24px rgba(0, 0, 0, 0.12),
  0 2px 8px rgba(0, 0, 0, 0.08),
  0 0px 1px rgba(0, 0, 0, 0.08);

/* Dragged (drag operations) */
--shadow-dragged:
  0 16px 48px rgba(0, 0, 0, 0.16),
  0 4px 16px rgba(0, 0, 0, 0.08),
  0 0px 1px rgba(0, 0, 0, 0.08);
```

### Border Width

| Width | Usage |
|---|---|
| 1px | Default — inputs, cards, dividers, popovers |
| 2px | Emphasis — active tabs, focus rings, slider tracks |

---

## 6. AI Assistant Layout Modes

The AEM NextGen AI Assistant defines **five layout modes** for AI interactions.
Nova should support these progressively:

### 6.1 Prompt Bar (Command Bar)

**Current implementation:** `command-bar.tsx` — opened via `Cmd+K`.

**Pattern specification:**
- Centered modal overlay with a text input at the top
- Input: icon + text field + action buttons (send, cancel)
- Below input: scrollable results area showing:
  - **Streaming progress** (plan steps with checkmarks)
  - **AI response** (text, rendered blocks)
  - **Discovery prompts** (categorized suggestions: Learn / Analyze / Optimize)
  - **Recent actions** (conversation history)
- Footer: keyboard shortcut hints
- Autocomplete for data objects triggered by `+` or `@`
- Context picker ("Answer from...") to scope AI queries to specific sites/sandboxes

**Key behaviors:**
- Progressive disclosure: show suggestions first, then results
- Animated loading: spinning icon during execution, step-by-step progress
- Cancel support: stop button during streaming
- One-click presets for common operations

### 6.2 Rail (Right Panel)

**Pattern specification:**
- Narrow panel (320-400px) anchored to the right edge
- Opened via AI assistant icon in the top header bar
- Contains: chat thread, input box at bottom, discovery prompts panel
- Collapsible — does not displace main content (overlay or push)
- Sections: Chat | Discovery | Conversations | Settings

**Use when:** Quick AI interactions while working in the editor, browsing
sites, or managing assets. The default "always available" mode.

### 6.3 Contextual

**Pattern specification:**
- AI features embedded directly within the content editing surface
- Appears inline with the content being edited (e.g., content optimizer
  suggestions next to a paragraph)
- Small floating cards or inline annotations
- Triggered by selection, right-click, or automatic analysis

**Use when:** Content optimization suggestions, inline rewrite proposals,
SEO recommendations, accessibility checks.

### 6.4 Split View

**Pattern specification:**
- Main content area divided into two panes (typically 50/50 or 60/40)
- Left: source content or editor
- Right: AI-generated preview, comparison, or visual output
- Resize handle between panes
- Activated when AI response includes visual content (page previews, images)

**Use when:** Page preview rendering, before/after comparison, visual content
generation, side-by-side editing with AI suggestions.

### 6.5 Full Screen

**Pattern specification:**
- AI takes over the entire viewport (minus top navigation)
- Full conversation interface with expanded input area
- Multi-column layout for discovery prompts and conversation history
- Rich rendering area for complex outputs (data visualizations, full page
  layouts)
- Toggle between full screen and rail via header icon

**Use when:** Complex multi-step workflows, exploration/discovery sessions,
onboarding flows, detailed plan review.

---

## 7. AI Renderer Components

These are the content renderers that display AI-generated outputs within any
layout mode.

### 7.1 Plan Renderer

Displays the AI's planned approach before execution:
- Step list with numbered items
- Status per step: pending (circle), in-progress (spinner), success (check),
  error (x)
- Collapsible detail per step
- Overall progress indicator
- "Execute" / "Modify" / "Cancel" action buttons

### 7.2 Modular Content Renderer

The primary content renderer using a **composable block strategy**:
- AI responses are structured as **content blocks** (text, code, table, image,
  card, list)
- Each block is independently renderable and actionable
- Blocks can be reordered, edited, or accepted individually
- Asset cards within responses show thumbnails, metadata, and quick actions
- Support for rich text formatting within blocks

**Block types:**
- `text` — Markdown-rendered paragraph with formatting
- `code` — Syntax-highlighted code block with copy action
- `table` — Structured data in table format
- `image` — Asset preview with metadata
- `card` — Asset/page card with thumbnail, title, description, actions
- `list` — Ordered or unordered list items
- `chart` — Data visualization (bar, line, area, donut)

### 7.3 Page Preview Renderer

Full-page preview of AI-generated or modified content:
- Rendered in an iframe or shadow DOM for style isolation
- Zoom controls and responsive breakpoint toggles
- Side-by-side diff view (before/after)
- Annotation layer for AI suggestions

### 7.4 File Upload Renderer

Handles asset upload flows within AI context:
- Drag-and-drop zone
- Upload progress indicators
- Thumbnail previews with metadata
- Integration with R2 asset storage

### 7.5 Forms Data Binding Renderer

Interactive form configuration for data-bound content:
- Visual field mapping interface
- Live preview of bound data
- Validation feedback

---

## 8. Interaction Patterns

### 8.1 Discovery Prompts

Pre-configured query suggestions to reduce blank-canvas anxiety:
- Grouped by category: **Learn** | **Analyze** | **Optimize**
- Each suggestion is a selectable chip or list item
- Clicking auto-populates the prompt input
- User can edit before submitting
- Contextual: suggestions adapt based on current page/section

### 8.2 Conversation Management

- Each AI session is a conversation thread
- "Start new conversation" clears context
- Conversation history stored and browsable
- Previous conversations accessible from a list view

### 8.3 Feedback Loop

Three-icon feedback system on every AI response:
- **Thumbs up** — positive signal
- **Thumbs down** — opens feedback form with category selection
- **Flag** — report concern or request detailed review

### 8.4 Context Configuration

Scope AI queries to specific contexts:
- **Site** — which AEM site to operate on
- **Sandbox/Environment** — staging vs production
- **Content scope** — specific page, folder, or entire site
- Shown as a settings popover from the prompt bar

### 8.5 Streaming & Loading States

- Show a spinner in the prompt bar input during processing
- For multi-step operations, show step-by-step progress with:
  - Step description
  - Status icon (spinner → check/x)
  - Elapsed count ("2/5 steps")
- For single operations, show a simple loading indicator with current action text
- Support cancellation at any point

### 8.6 Error Handling

- Inline error messages within the response area (not disruptive modals)
- Amber/warning style for validation issues
- Red/error style for failures
- Always include a retry or alternative action suggestion

---

## 9. Component Specifications

### 9.1 Buttons

| Variant | Background | Text | Border | Radius |
|---|---|---|---|---|
| Primary (CTA) | `--primary` (#3B63FB) | white | none | `rounded-full` (pill) |
| Secondary | `--background-layer-2` | `--foreground` | 1px `--border` | `rounded` (4px) |
| Ghost | transparent | `--foreground-muted` | none | `rounded` (4px) |
| Destructive | red-800 | white | none | `rounded-full` (pill) |

### 9.2 Input Fields

- Height: 40px (default), 32px (compact), 48px (large)
- Border: 1px `--border`, 2px `--primary` on focus
- Radius: 4px
- Placeholder: `--foreground-muted` color
- Background: `--background-layer-2`

### 9.3 Cards

- Background: `--background-layer-2` (white)
- Border: 1px `--border` OR use `--shadow-emphasized`
- Radius: 8px (`rounded-lg`)
- Padding: 16-24px
- Hover: subtle shadow elevation change

### 9.4 Badges / Status Pills

- Radius: `rounded-full` (pill)
- Padding: 4px 12px
- Font: body-sm, medium weight
- Variants: accent (blue bg), success (green), warning (amber), error (red),
  neutral (gray)

### 9.5 Navigation Sidebar (Current: App Shell)

- Width: 64px (icon-only rail)
- Background: `--background` with subtle right border
- Active item: secondary background
- Icon size: 20px
- Spacing between items: 8px

### 9.6 AI Response Bubble

- Background: `--background` (layer-1, light gray) for AI messages
- Background: `--background-layer-2` for user messages
- Radius: 8px
- Padding: 12px 16px
- Font: `body-lg` (18px) for readability
- Expandable sections with chevron toggle for reasoning/sources
- Action bar below: copy, thumbs up/down, flag

---

## 10. Responsive Breakpoints

| Token | Width | Usage |
|---|---|---|
| `sm` | 640px | Mobile layout |
| `md` | 768px | Tablet, collapsed sidebar |
| `lg` | 1024px | Desktop, sidebar visible |
| `xl` | 1280px | Wide desktop, split view comfortable |
| `2xl` | 1536px | Ultra-wide, full AI workspace |

---

## 11. Motion & Animation

### Timing

- **Default transitions:** 150-200ms ease-out
- **Panel open/close:** 200-300ms ease-in-out
- **Content fade-in:** 150ms ease-out
- **Loading spinner:** continuous rotation, 1s linear

### Animations to Use

- Accordion expand/collapse for collapsible sections
- Fade + slide-up for new content appearing (AI responses)
- Gentle scale on hover for interactive cards
- Smooth width/height transitions for panel resizing
- Skeleton loading placeholders while content streams

### Animations to Avoid

- Bouncing or elastic effects (too playful for a CMS)
- Long delays (>300ms feels sluggish)
- Animations that block interaction

---

## 12. Iconography

Use **Lucide React** icons (already in the project). Choose icons that align
with Spectrum 2's rounder, friendlier style.

Key icon mappings:
| Concept | Icon |
|---|---|
| AI / Assistant | `Sparkles` |
| Send / Execute | `ArrowUp` or `Send` |
| Cancel / Stop | `Square` |
| Loading | `Loader2` (animated spin) |
| Success | `Check` |
| Error | `X` |
| Warning | `AlertTriangle` |
| Suggestion | `Lightbulb` |
| History | `Clock` |
| Settings | `Settings` |
| Sites | `Globe` |
| Pages | `FileText` |
| Assets | `Image` |
| Feedback positive | `ThumbsUp` |
| Feedback negative | `ThumbsDown` |
| Flag / Report | `Flag` |
| Expand/Collapse | `ChevronDown` / `ChevronRight` |

---

## 13. Accessibility Requirements

- All interactive elements must be keyboard accessible
- Focus ring: 2px `--primary` outline with 2px offset
- Color contrast: minimum 4.5:1 for body text, 3:1 for large text/icons
- ARIA labels on all icon-only buttons
- Screen reader announcements for streaming state changes
- Reduced motion: respect `prefers-reduced-motion` by disabling animations
- Skip-to-content link for keyboard navigation

---

## 14. Dark Mode Considerations

While the Figma patterns are designed for light theme, Nova should support dark
mode using Spectrum 2's dark theme tokens:

| Light | Dark |
|---|---|
| `--background` #F8F8F8 | `--background` ~#1D1D1D |
| `--background-layer-2` #FFFFFF | `--background-layer-2` ~#292929 |
| `--foreground` #292929 | `--foreground` ~#E1E1E1 |
| `--foreground-heading` #131313 | `--foreground-heading` ~#F8F8F8 |
| `--border` #E1E1E1 | `--border` ~#3A3A3A |

Shadow opacity should increase slightly in dark mode for visibility.

---

## 15. File Organization for UI Components

```
src/components/
├── ui/                    # Base UI primitives (shadcn/ui)
│   ├── button.tsx
│   ├── input.tsx
│   ├── dialog.tsx
│   └── ...
├── shell/                 # App layout
│   └── app-shell.tsx
├── command-bar/           # AI Prompt Bar (Cmd+K)
│   └── command-bar.tsx
├── ai/                    # AI-specific components
│   ├── ai-rail.tsx        # Right panel chat
│   ├── ai-response.tsx    # Response bubble with actions
│   ├── ai-feedback.tsx    # Thumbs up/down/flag
│   ├── discovery-prompts.tsx
│   ├── conversation-list.tsx
│   └── context-picker.tsx
├── renderers/             # AI content renderers
│   ├── plan-renderer.tsx
│   ├── block-renderer.tsx # Modular content blocks
│   ├── page-preview.tsx
│   ├── chart-renderer.tsx
│   └── asset-card.tsx
├── editor/                # Page editor components
│   └── ...
└── sites/                 # Sites console components
    └── ...
```
