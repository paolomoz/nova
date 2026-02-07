/**
 * AI Design Generation Pipeline
 * Generates design tokens, CSS custom properties, and site styles via Claude.
 * Supports: new site bootstrapping, redesign, style guide generation, themes.
 */

export interface DesignTokens {
  colors: Record<string, string>;
  typography: Record<string, string>;
  spacing: Record<string, string>;
  borders: Record<string, string>;
  shadows: Record<string, string>;
  breakpoints: Record<string, string>;
}

export interface GeneratedDesign {
  tokens: DesignTokens;
  css: string;
  styleGuideHtml: string;
  theme?: { light: Record<string, string>; dark: Record<string, string> };
}

interface DesignEnv {
  ANTHROPIC_API_KEY: string;
}

const DESIGN_SYSTEM_PROMPT = `You are an expert web designer specializing in design systems and CSS custom properties.

You generate professional design tokens and CSS for Edge Delivery Services (EDS) websites.

When generating a design system, respond with a JSON object containing:
{
  "tokens": {
    "colors": { "--color-primary": "#...", "--color-secondary": "#...", "--color-bg": "#...", "--color-text": "#...", "--color-accent": "#...", "--color-muted": "#..." },
    "typography": { "--font-heading": "...", "--font-body": "...", "--font-size-base": "1rem", "--font-size-lg": "1.25rem", "--font-size-xl": "1.5rem", "--font-size-2xl": "2rem", "--font-size-3xl": "2.5rem", "--line-height-base": "1.5", "--line-height-tight": "1.2" },
    "spacing": { "--space-xs": "0.25rem", "--space-sm": "0.5rem", "--space-md": "1rem", "--space-lg": "2rem", "--space-xl": "4rem", "--space-2xl": "6rem" },
    "borders": { "--radius-sm": "0.25rem", "--radius-md": "0.5rem", "--radius-lg": "1rem", "--border-width": "1px" },
    "shadows": { "--shadow-sm": "...", "--shadow-md": "...", "--shadow-lg": "..." },
    "breakpoints": { "--bp-tablet": "768px", "--bp-desktop": "1024px", "--bp-wide": "1440px" }
  },
  "css": ":root { /* all custom properties */ } body { /* base styles */ } h1,h2,h3... { /* typography */ } .section-metadata { /* section styles */ } /* block-specific overrides */",
  "styleGuideHtml": "<!-- complete HTML style guide page -->",
  "theme": {
    "light": { "--color-bg": "#fff", "--color-text": "#333" },
    "dark": { "--color-bg": "#1a1a1a", "--color-text": "#e0e0e0" }
  }
}

Design principles:
- Mobile-first, accessible (WCAG AA contrast ratios)
- Use CSS custom properties for everything
- EDS-compatible: blocks use .block-name selectors
- Performance: no external fonts unless specified, system font stacks as fallback
- Professional, modern aesthetic
- Include dark mode theme tokens`;

export async function generateDesign(
  intent: string,
  brandProfile: Record<string, unknown> | null,
  existingTokens: Record<string, unknown> | null,
  env: DesignEnv,
): Promise<GeneratedDesign> {
  let userPrompt = `Generate a complete design system for this requirement:\n\n${intent}`;

  if (brandProfile) {
    userPrompt += `\n\nBrand profile:\n${JSON.stringify(brandProfile, null, 2)}`;
  }
  if (existingTokens && Object.keys(existingTokens).length > 0) {
    userPrompt += `\n\nExisting design tokens (update/extend these):\n${JSON.stringify(existingTokens, null, 2)}`;
  }

  userPrompt += '\n\nRespond with ONLY the JSON object, no markdown fences.';

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 8192,
      system: DESIGN_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Claude API error: ${response.status} — ${err}`);
  }

  const data = (await response.json()) as {
    content: Array<{ type: string; text?: string }>;
  };

  const text = data.content.find((b) => b.type === 'text')?.text || '';
  const jsonStr = text.replace(/^```json?\s*/m, '').replace(/\s*```$/m, '').trim();
  const parsed = JSON.parse(jsonStr) as GeneratedDesign;

  return {
    tokens: parsed.tokens || { colors: {}, typography: {}, spacing: {}, borders: {}, shadows: {}, breakpoints: {} },
    css: parsed.css || '',
    styleGuideHtml: parsed.styleGuideHtml || '',
    theme: parsed.theme,
  };
}

/** Convert design tokens to CSS custom properties string */
export function tokensToCss(tokens: DesignTokens): string {
  const lines: string[] = [':root {'];
  for (const category of Object.values(tokens)) {
    for (const [key, value] of Object.entries(category)) {
      lines.push(`  ${key}: ${value};`);
    }
  }
  lines.push('}');
  return lines.join('\n');
}

/** Generate a site bootstrap (complete initial page set) */
export async function bootstrapSite(
  description: string,
  brandProfile: Record<string, unknown> | null,
  env: DesignEnv,
): Promise<{ design: GeneratedDesign; pages: Array<{ path: string; title: string; html: string }> }> {
  const design = await generateDesign(
    `Create a complete design system for: ${description}`,
    brandProfile,
    null,
    env,
  );

  // Generate initial pages
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 8192,
      system: `You generate EDS page content using the provided design system. Use EDS block markup (<div class="block-name"><div>rows</div></div>). Generate realistic placeholder content.`,
      messages: [{
        role: 'user',
        content: `Generate 3 initial pages for: "${description}"\n\nDesign tokens:\n${design.css}\n\nReturn JSON: { "pages": [{ "path": "/index", "title": "Home", "html": "..." }, ...] }\n\nRespond with ONLY JSON, no markdown fences.`,
      }],
    }),
  });

  if (!response.ok) throw new Error(`Claude API error: ${response.status}`);

  const data = (await response.json()) as { content: Array<{ type: string; text?: string }> };
  const text = data.content.find((b) => b.type === 'text')?.text || '';
  const jsonStr = text.replace(/^```json?\s*/m, '').replace(/\s*```$/m, '').trim();
  const parsed = JSON.parse(jsonStr) as { pages: Array<{ path: string; title: string; html: string }> };

  return { design, pages: parsed.pages || [] };
}
