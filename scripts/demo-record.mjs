/**
 * Nova Demo — Browser Recording with Timing Manifest
 *
 * Records the full demo flow in a visible browser using Playwright's video capture.
 * Outputs: video file + timing.json manifest for talk track generation.
 *
 * Run: node scripts/demo-record.mjs
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const OUTPUT_DIR = '/tmp/nova-demo-recording';
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

// ── Talk Track Segments ──
// Each segment has a key, the narration text, and is timestamped during recording.
const segments = [];
let videoStartTime;

function mark(key, text) {
  const ts = Date.now() - videoStartTime;
  segments.push({ key, text, startMs: ts });
  console.log(`  [${(ts / 1000).toFixed(1)}s] 🎙  ${key}`);
}

async function pause(ms) {
  await new Promise(r => setTimeout(r, ms));
}

// ── Launch browser with video recording ──
const browser = await chromium.launch({ headless: false, slowMo: 30 });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  recordVideo: { dir: OUTPUT_DIR, size: { width: 1440, height: 900 } },
});
const page = await context.newPage();

// ── Auth ──
console.log('Authenticating...');
const resp = await page.request.post('http://localhost:8787/api/auth/dev-login');
const cookies = resp.headers()['set-cookie'] || '';
const match = cookies.match(/nova_session=([^;]+)/);
if (!match) { console.error('Auth failed'); process.exit(1); }
await context.addCookies([{ name: 'nova_session', value: match[1], domain: 'localhost', path: '/' }]);

videoStartTime = Date.now();
console.log('\n🎬 Recording started\n');

// ══════════════════════════════════════════════════════════
// ACT 1 — From Brief to Page
// ══════════════════════════════════════════════════════════
console.log('── Act 1: From Brief to Page ──');

await page.goto('http://localhost:5173/sites', { waitUntil: 'networkidle' });
await pause(2000);

mark('act1_intro', 'This is Nova, an AI-native content management system built on Adobe Experience Manager. We are looking at the Sites console, which shows the pages in our project.');

await pause(4000);

// Open AI Rail
mark('act1_open_rail', 'Let me open the AI assistant. I will press Command-Period to bring up the Nova AI panel.');
await pause(1500);
await page.keyboard.press('Meta+.');
await pause(2500);

// Type the prompt with visible typing
mark('act1_prompt', 'Now I will ask Nova to create a landing page for a new product launch. Watch how it breaks this into a multi-step plan and executes it in real time.');
await pause(2000);

const textarea = await page.$('textarea');
const prompt1 = 'Create a landing page at /airpulse-pro for the launch of our new running shoe, the AirPulse Pro. Target audience is urban runners aged 25-40. Include a hero section, features cards, and a CTA.';
// Type character by character for visual effect
for (const char of prompt1) {
  await textarea.type(char, { delay: 20 });
}
await pause(1000);
await page.keyboard.press('Enter');

// Wait for AI streaming — show the plan execution
mark('act1_streaming', 'Nova is now planning and executing. It retrieves our brand profile, checks the block library, and generates the full page with proper EDS block markup.');

for (let i = 0; i < 45; i++) {
  await pause(1000);
  const state = await page.evaluate(() => ({
    spinner: !!document.querySelector('.animate-spin'),
    openEditor: Array.from(document.querySelectorAll('button')).some(b => b.textContent?.includes('Open in Editor')),
  }));
  if (state.openEditor) break;
  if (!state.spinner && i > 8) break;
}

await pause(2000);
mark('act1_done', 'The page has been created with a hero section, feature cards highlighting AirPulse technology, and a compelling call to action. Notice the insight card at the bottom, offering to open the page in the editor.');

await pause(4000);

// Click "Open in Editor"
const hasOpenEditor = await page.evaluate(() => {
  const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Open in Editor'));
  if (btn) { btn.click(); return true; }
  return false;
});

if (hasOpenEditor) {
  mark('act1_navigate', 'I will click Open in Editor to jump directly into the visual editor.');
  await pause(3000);
} else {
  // Fallback: navigate manually
  await page.goto('http://localhost:5173/editor?path=/airpulse-pro', { waitUntil: 'networkidle' });
  mark('act1_navigate', 'Let me open the page in the visual editor.');
  await pause(3000);
}

// ══════════════════════════════════════════════════════════
// ACT 2 — Creative Dialogue
// ══════════════════════════════════════════════════════════
console.log('\n── Act 2: Creative Dialogue ──');

// Make sure we're on the editor page
if (!page.url().includes('/editor')) {
  await page.goto('http://localhost:5173/editor?path=/airpulse-pro', { waitUntil: 'networkidle' });
}
await pause(3000);

mark('act2_intro', 'Now we are in the visual editor. Nova supports three ways to refine content: chat-driven edits, direct WYSIWYG editing, and scoped block prompts. Let me show you the first — a chat-driven edit.');

await pause(4000);

// Open AI Rail if not open
await page.keyboard.press('Meta+.');
await pause(1000);

// 2a. Chat-driven edit
mark('act2_chat', 'I will ask Nova to make the hero section more dynamic and emphasize speed.');
await pause(1500);

const textarea2 = await page.$('textarea');
if (textarea2) {
  const prompt2 = 'Make the hero section more dynamic — emphasize speed and performance. Use action-oriented language.';
  for (const char of prompt2) {
    await textarea2.type(char, { delay: 25 });
  }
  await pause(800);
  await page.keyboard.press('Enter');

  mark('act2_chat_wait', 'Nova is updating the hero copy with a performance-oriented angle.');

  for (let i = 0; i < 35; i++) {
    await pause(1000);
    const done = await page.evaluate(() => !document.querySelector('.animate-spin'));
    if (done && i > 5) break;
  }
}

await pause(3000);
mark('act2_chat_done', 'The hero copy has been rewritten with dynamic, speed-focused language. The AI scoped the changes to just the hero block without touching the rest of the page.');

await pause(4000);

// 2b. Show Source/Visual toggle
mark('act2_source', 'Nova also has a full source editor powered by TipTap. Let me switch to Source mode to show the rich text editing.');
await pause(1500);

const sourceBtn = await page.evaluate(() => {
  const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Source'));
  if (btn) { btn.click(); return true; }
  return false;
});
await pause(3000);

// Switch back to Visual
const visualBtn = await page.evaluate(() => {
  const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Visual'));
  if (btn) { btn.click(); return true; }
  return false;
});
await pause(2000);

// 2c. Show Block Browser
mark('act2_blocks', 'On the left, you can see the Block Browser — a categorized library of all available EDS blocks like hero, cards, columns, accordion, tabs, and more.');
await pause(5000);

// ══════════════════════════════════════════════════════════
// ACT 3 — Proactive AI: Insight Cards
// ══════════════════════════════════════════════════════════
console.log('\n── Act 3: Proactive AI ──');

mark('act3_intro', 'One of Nova\'s most distinctive features is proactive intelligence. The AI does not just respond to commands — it actively observes, analyzes, and suggests improvements through Insight Cards.');

await pause(4000);

// Inject insight cards
await page.evaluate(() => {
  const add = window.__novaAddInsight;
  if (!add) return;

  add({
    message: 'Pages with video hero sections convert 23% higher for this demographic. Want me to add a video placeholder to the hero block?',
    type: 'suggestion',
    actions: [
      { label: 'Add video', action: 'accept' },
      { label: 'Dismiss', action: 'dismiss' },
    ],
  });
});

await pause(1000);
mark('act3_suggestion', 'Here is a Suggestion card. Nova noticed the target demographic responds well to video content and recommends adding a video hero. Each card has Accept and Dismiss actions.');

await pause(5000);

// Inject warning card
await page.evaluate(() => {
  const add = window.__novaAddInsight;
  if (!add) return;

  add({
    message: '"Built for Your Fastest Mile" scores well for engagement, but your brand voice guidelines for the AirPulse line specify an inclusive tone over competitive language. Suggestion: "Every Mile Is Your Mile."',
    type: 'warning',
    actions: [
      { label: 'Accept suggestion', action: 'accept' },
      { label: 'Keep original', action: 'dismiss' },
    ],
  });
});

await pause(1000);
mark('act3_brand', 'And here is a brand governance card. Nova detected that our headline uses competitive language, but the brand guidelines call for an inclusive tone. It suggests an alternative that better matches the brand voice.');

await pause(5000);

// Click Accept on the brand card
await page.evaluate(() => {
  const buttons = document.querySelectorAll('button');
  for (const btn of buttons) {
    if (btn.textContent?.trim() === 'Accept suggestion') {
      btn.click();
      return;
    }
  }
});

mark('act3_accept', 'I will accept the brand voice suggestion. This demonstrates how Nova enforces brand governance automatically — it is not just a content generator, it is a brand guardian.');

await pause(4000);

// ══════════════════════════════════════════════════════════
// ACT 4 — Variations
// ══════════════════════════════════════════════════════════
console.log('\n── Act 4: Variations ──');

mark('act4_intro', 'Now let me show you creative variations. I will ask Nova to create an alternative version of this page with a completely different tone.');
await pause(3000);

const textarea4 = await page.$('textarea');
if (textarea4) {
  const prompt4 = 'Create a lifestyle variation of this page at /airpulse-pro-lifestyle with a softer, aspirational tone focused on the running community rather than performance.';
  for (const char of prompt4) {
    await textarea4.type(char, { delay: 20 });
  }
  await pause(800);
  await page.keyboard.press('Enter');

  mark('act4_creating', 'Nova is generating a complete lifestyle-focused variation. Same product, completely different creative direction.');

  for (let i = 0; i < 45; i++) {
    await pause(1000);
    const done = await page.evaluate(() => !document.querySelector('.animate-spin'));
    if (done && i > 8) break;
  }
}

await pause(2000);
mark('act4_done', 'The lifestyle variation is ready. We now have two creative directions to compare — performance versus lifestyle. In a production setup, Nova could automatically set up an A-B test between these variants.');

await pause(5000);

// Inject A/B test insight
await page.evaluate(() => {
  const add = window.__novaAddInsight;
  if (!add) return;

  add({
    message: 'Two creative directions ready. Want me to create an A/B test experiment with a 50/50 split and conversion tracking on the CTA?',
    type: 'info',
    actions: [
      { label: 'Create A/B test', action: 'accept' },
      { label: 'Not now', action: 'dismiss' },
    ],
  });
});

await pause(1000);
mark('act4_ab', 'Nova proactively suggests setting up an A-B test between the two variants. This is the kind of intelligent workflow automation that makes Nova a true creative partner.');

await pause(5000);

// ══════════════════════════════════════════════════════════
// ACT 5 — Publish
// ══════════════════════════════════════════════════════════
console.log('\n── Act 5: Publish ──');

mark('act5_intro', 'When we are ready to go live, publishing is built right into the editor. Let me show you the Preview and Publish controls.');

await pause(3000);

// Show the toolbar buttons
mark('act5_buttons', 'The Preview button triggers the AEM Edge Delivery preview pipeline, and the Publish button pushes the page live. Everything flows through the real AEM infrastructure.');

await pause(4000);

// Navigate back to Sites to show the full project
mark('act5_sites', 'Let me go back to the Sites console to show the complete project.');
await pause(1500);

await page.evaluate(() => {
  const link = document.querySelector('a[href*="sites"], button');
  const sitesLink = Array.from(document.querySelectorAll('a, button')).find(
    el => el.textContent?.includes('Sites') || el.getAttribute('href')?.includes('sites')
  );
  if (sitesLink) sitesLink.click();
});
await pause(1000);
await page.goto('http://localhost:5173/sites', { waitUntil: 'networkidle' });
await pause(3000);

mark('act5_closing', 'That is Nova — from a creative brief to a published page in minutes. The AI handles planning, content generation, brand governance, and even suggests optimizations. All built on the real AEM Edge Delivery Services infrastructure. Thank you.');

await pause(5000);

// ══════════════════════════════════════════════════════════
// Finish recording
// ══════════════════════════════════════════════════════════
const totalDuration = Date.now() - videoStartTime;
console.log(`\n🎬 Recording complete — ${(totalDuration / 1000).toFixed(1)}s total`);

// Close context to finalize video
await page.close();
const videoPath = await page.video()?.path();
await context.close();
await browser.close();

// Save timing manifest
const manifest = {
  totalDurationMs: totalDuration,
  videoFile: videoPath,
  segments: segments.map((s, i) => ({
    ...s,
    endMs: i < segments.length - 1 ? segments[i + 1].startMs : totalDuration,
  })),
};

const manifestPath = path.join(OUTPUT_DIR, 'timing.json');
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
console.log(`\n📋 Timing manifest: ${manifestPath}`);
console.log(`🎥 Video file: ${videoPath}`);
console.log(`\nNext: node scripts/demo-audio.mjs`);
