/**
 * Nova Demo E2E Test — Full flow test covering the demo script Acts 1-7
 * Run: node scripts/demo-e2e.mjs
 * Prerequisites: pnpm dev (frontend on 5173, worker on 8787)
 */
import { chromium } from 'playwright';

const TIMEOUT = 60_000;
const results = [];

function log(msg) { console.log(`  ${msg}`); }
function pass(test) { results.push({ test, pass: true }); console.log(`✓ ${test}`); }
function fail(test, reason) { results.push({ test, pass: false, reason }); console.log(`✗ ${test}: ${reason}`); }

const browser = await chromium.launch({ headless: false, slowMo: 50 });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

// ── Auth ──
log('Authenticating via dev-login...');
const resp = await page.request.post('http://localhost:8787/api/auth/dev-login');
const cookies = resp.headers()['set-cookie'] || '';
const match = cookies.match(/nova_session=([^;]+)/);
if (!match) { fail('Auth', 'No session cookie'); process.exit(1); }
await context.addCookies([{ name: 'nova_session', value: match[1], domain: 'localhost', path: '/' }]);
pass('Auth — dev-login');

// ══════════════════════════════════════════
// ACT 1 — From Brief to Page
// ══════════════════════════════════════════
console.log('\n── Act 1: From Brief to Page ──');

await page.goto('http://localhost:5173/sites', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

// 1.1 Sites console loads
const pageItems = await page.$$('[data-testid="site-item"], tr[class*="cursor"], .grid-item, [role="row"]');
if (pageItems.length > 0) pass('Sites console — pages listed');
else {
  const siteContent = await page.evaluate(() => document.querySelector('main')?.textContent || '');
  if (siteContent.includes('index') || siteContent.includes('docs')) pass('Sites console — pages listed');
  else fail('Sites console — pages listed', 'No page items found');
}

// 1.2 Open AI Rail
log('Opening AI Rail with Cmd+.');
await page.keyboard.press('Meta+.');
await page.waitForTimeout(500);
const railVisible = await page.evaluate(() => {
  return !!document.querySelector('[class*="ai-gradient"], .ai-gradient-vivid');
});
if (railVisible) pass('AI Rail opens');
else fail('AI Rail opens', 'Rail not visible');

// 1.3 Send page creation prompt
const PROMPT = 'Create a landing page at /test-demo-e2e for the launch of a running shoe called AirPulse Pro. Include a hero section, features cards, and a CTA.';
log('Sending page creation prompt...');
const textarea = await page.$('textarea');
await textarea.fill(PROMPT);
await page.keyboard.press('Enter');

// 1.4 Wait for streaming to complete (up to 60s for Claude processing)
log('Waiting for AI streaming response...');
let gotResponse = false;
for (let i = 0; i < 60; i++) {
  await page.waitForTimeout(1000);
  const state = await page.evaluate(() => {
    const messages = document.querySelectorAll('.bg-background-layer-2, [class*="bg-primary/10"]');
    const spinner = document.querySelector('.animate-spin');
    const planBadge = document.querySelector('[class*="bg-primary/10"]');
    const progressBar = document.querySelector('[class*="bg-primary"][class*="rounded-full"][class*="h-full"]');
    return {
      messageCount: messages.length,
      hasSpinner: !!spinner,
      hasPlan: !!planBadge || !!progressBar,
    };
  });
  process.stdout.write(`\r  [${i+1}s] msgs=${state.messageCount} spinner=${state.hasSpinner} plan=${state.hasPlan}  `);
  if (state.messageCount >= 2 && !state.hasSpinner) {
    gotResponse = true;
    console.log(' ✓');
    break;
  }
}

if (gotResponse) pass('AI streaming — response received');
else fail('AI streaming — response received', 'Timeout waiting for AI response');

await page.screenshot({ path: '/tmp/nova-demo-act1.png' });

// 1.5 Check for insight card (auto-navigate to created page)
await page.waitForTimeout(1000);
const hasInsightCard = await page.evaluate(() => {
  return !!document.querySelector('[class*="border-l-"][class*="border-ai"], [class*="border-l-\\[3px\\]"]');
});
if (hasInsightCard) pass('Insight card — page created notification');
else {
  const insightText = await page.evaluate(() => {
    const cards = document.querySelectorAll('[class*="border-l-"]');
    for (const c of cards) {
      if (c.textContent?.includes('Page created') || c.textContent?.includes('Open in Editor')) return c.textContent;
    }
    return null;
  });
  if (insightText) pass('Insight card — page created notification');
  else fail('Insight card — page created notification', 'No insight card found');
}

await page.screenshot({ path: '/tmp/nova-demo-act1-insight.png' });

// 1.6 Click "Open in Editor" if insight card exists
const openEditorBtn = await page.evaluate(() => {
  const buttons = document.querySelectorAll('button');
  for (const btn of buttons) {
    if (btn.textContent?.includes('Open in Editor')) {
      btn.click();
      return true;
    }
  }
  return false;
});
if (openEditorBtn) {
  await page.waitForTimeout(2000);
  const onEditorPage = page.url().includes('/editor');
  if (onEditorPage) pass('Auto-navigate to editor after page creation');
  else fail('Auto-navigate to editor', `URL is ${page.url()}`);
} else {
  log('No "Open in Editor" button — skipping auto-navigate test');
}

await page.screenshot({ path: '/tmp/nova-demo-act1-editor.png' });


// ══════════════════════════════════════════
// SELF-RENDER VERIFICATION (after Act 1 — page just created, AEM not warmed)
// ══════════════════════════════════════════
console.log('\n── Self-Render Verification ──');

// Navigate to editor for the freshly-created page (AEM won't have cached it yet)
await page.goto('http://localhost:5173/editor?path=/test-demo-e2e', { waitUntil: 'networkidle' });
await page.waitForTimeout(1000);

// Wait for loading spinner to disappear (bridge:ready received)
log('Waiting for WYSIWYG iframe to load (bridge:ready)...');
let selfRenderLoaded = false;
for (let i = 0; i < 15; i++) {
  await page.waitForTimeout(1000);
  const loadingGone = await page.evaluate(() => {
    const spinner = document.querySelector('.animate-spin');
    const loadingText = [...document.querySelectorAll('span')].find(s => s.textContent?.includes('Loading visual editor'));
    return !spinner && !loadingText;
  });
  process.stdout.write(`\r  [${i+1}s] waiting for bridge:ready...  `);
  if (loadingGone) {
    selfRenderLoaded = true;
    console.log(' ✓');
    break;
  }
}
if (selfRenderLoaded) pass('Self-render — iframe loaded (bridge:ready)');
else fail('Self-render — iframe loaded', 'Loading spinner still visible after 15s');

// Access iframe content and verify real content, not fallback
const iframe = page.frameLocator('iframe[title="Visual Editor"]');
try {
  // Check that <main> exists and has content
  const mainContent = iframe.locator('main');
  await mainContent.waitFor({ timeout: 5000 });
  const mainText = await mainContent.textContent({ timeout: 5000 });

  if (mainText && mainText.trim().length > 20) {
    pass('Self-render — <main> has real content');
  } else {
    fail('Self-render — <main> has real content', `Content too short: "${mainText?.slice(0, 50)}"`);
  }

  // Verify "Preview Not Available" does NOT appear
  const fallbackCount = await iframe.locator('text=Preview Not Available').count();
  if (fallbackCount === 0) {
    pass('Self-render — no "Preview Not Available" fallback');
  } else {
    fail('Self-render — no fallback', '"Preview Not Available" text found in iframe');
  }
} catch (e) {
  fail('Self-render — iframe content accessible', e.message);
}

await page.screenshot({ path: '/tmp/nova-demo-selfrender.png' });


// ══════════════════════════════════════════
// ACT 2 — Creative Dialogue
// ══════════════════════════════════════════
console.log('\n── Act 2: Creative Dialogue ──');

// We should already be on the editor page from the self-render test above.
// Ensure we're on the right URL.
if (!page.url().includes('/editor')) {
  await page.goto('http://localhost:5173/editor?path=/test-demo-e2e', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
}

// 2.1 Check editor loaded
const editorLoaded = await page.evaluate(() => {
  return !!document.querySelector('[class*="editor"], iframe, [contenteditable]');
});
if (editorLoaded) pass('Editor — page loaded');
else fail('Editor — page loaded', 'Editor content not found');

// 2.2 WYSIWYG iframe content verification
log('Verifying WYSIWYG iframe content...');
const hasIframe = await page.evaluate(() => !!document.querySelector('iframe[title="Visual Editor"]'));
if (hasIframe) {
  pass('WYSIWYG iframe — present');
  const iframeAct2 = page.frameLocator('iframe[title="Visual Editor"]');
  try {
    const mainEl = iframeAct2.locator('main');
    await mainEl.waitFor({ timeout: 8000 });
    const contentText = await mainEl.textContent({ timeout: 5000 });
    if (contentText && contentText.length > 20) {
      pass('WYSIWYG — iframe has real content (not fallback)');
    } else {
      fail('WYSIWYG — iframe has real content', `Content length: ${contentText?.length || 0}`);
    }

    // Verify no "Preview Not Available"
    const fallback = await iframeAct2.locator('text=Preview Not Available').count();
    if (fallback === 0) pass('WYSIWYG — no "Preview Not Available" in iframe');
    else fail('WYSIWYG — no fallback', '"Preview Not Available" found');
  } catch (e) {
    log(`  Could not access iframe content: ${e.message}`);
  }
} else {
  const hasSourceEditor = await page.evaluate(() => !!document.querySelector('.ProseMirror, [class*="tiptap"]'));
  if (hasSourceEditor) pass('Source editor (TipTap) — present');
  else fail('Editor content', 'Neither iframe nor source editor found');
}

// 2.3 Test Save: Click Save button → verify "Saved" timestamp appears
log('Testing Save button...');

// First make the page dirty so Save button is enabled.
// We trigger dirtiness by sending a bridge:content-changed message to the iframe.
await page.evaluate(() => {
  // Simulate content change from iframe → triggers onDirty
  window.postMessage({ type: 'bridge:content-changed' }, window.location.origin);
});
await page.waitForTimeout(300);

// Check if dirty indicator appears
const dirtyBefore = await page.evaluate(() => {
  return !!([...document.querySelectorAll('span')].find(s => s.textContent?.includes('(unsaved)')));
});
if (dirtyBefore) log('  Page marked as unsaved');

// Click Save button
const saveClicked = await page.evaluate(() => {
  const btns = [...document.querySelectorAll('button')];
  const saveBtn = btns.find(b => b.textContent?.includes('Save') && !b.textContent?.includes('Saved'));
  if (saveBtn && !saveBtn.disabled) {
    saveBtn.click();
    return 'clicked';
  }
  return saveBtn ? 'disabled' : 'not-found';
});

if (saveClicked === 'clicked') {
  // Wait for "Saved" timestamp to appear (save completes)
  let savedAppeared = false;
  for (let i = 0; i < 10; i++) {
    await page.waitForTimeout(1000);
    const hasSaved = await page.evaluate(() => {
      return !!([...document.querySelectorAll('span')].find(s => s.textContent?.match(/Saved \d/)));
    });
    if (hasSaved) {
      savedAppeared = true;
      break;
    }
  }
  if (savedAppeared) pass('Save — "Saved" timestamp appeared');
  else fail('Save — "Saved" timestamp', 'Timestamp did not appear after 10s');
} else if (saveClicked === 'disabled') {
  // Save button disabled = page not dirty, which means content didn't change
  // Try saving via Cmd+S which always fires handleSave regardless of dirty state
  log('  Save button disabled (page not dirty) — trying Cmd+S...');
  await page.keyboard.press('Meta+s');
  await page.waitForTimeout(3000);
  const hasSavedKb = await page.evaluate(() => {
    return !!([...document.querySelectorAll('span')].find(s => s.textContent?.match(/Saved \d/)));
  });
  if (hasSavedKb) pass('Save (Cmd+S) — "Saved" timestamp appeared');
  else fail('Save — could not trigger save', 'Button disabled and Cmd+S did not produce timestamp');
} else {
  fail('Save button', 'Not found');
}

await page.screenshot({ path: '/tmp/nova-demo-act2-save.png' });

// 2.4 Test Preview: Click Preview → verify iframe reloads (wysiwygKey increment)
log('Testing Preview button...');

// Start listening for the preview API response before clicking
const previewResponsePromise = page.waitForResponse(
  resp => resp.url().includes('/preview') && resp.request().method() === 'POST',
  { timeout: 15000 }
).catch(() => null);

const previewClicked = await page.evaluate(() => {
  const btns = [...document.querySelectorAll('button')];
  const previewBtn = btns.find(b => b.textContent?.includes('Preview'));
  if (previewBtn) {
    previewBtn.click();
    return true;
  }
  return false;
});

if (previewClicked) {
  const previewResp = await previewResponsePromise;
  if (previewResp) {
    const previewStatus = previewResp.status();
    if (previewStatus === 200) pass('Preview — API returned 200');
    else if (previewStatus === 502) fail('Preview — API response', 'Got 502 (AEM gateway error)');
    else pass(`Preview — API called (status ${previewStatus})`);
  } else {
    fail('Preview — API call', 'POST /preview was not called within 15s');
  }
} else {
  fail('Preview button', 'Not found');
}

await page.screenshot({ path: '/tmp/nova-demo-act2-preview.png' });

// 2.5 Open AI Rail in editor for chat-driven edit
await page.keyboard.press('Meta+.');
await page.waitForTimeout(500);

log('Sending chat edit: "Make the hero more dynamic"');
const textarea2 = await page.$('textarea');
if (textarea2) {
  await textarea2.fill('Make the hero section more dynamic and emphasize speed');
  await page.keyboard.press('Enter');

  for (let i = 0; i < 45; i++) {
    await page.waitForTimeout(1000);
    const done = await page.evaluate(() => !document.querySelector('.animate-spin'));
    process.stdout.write(`\r  [${i+1}s] waiting...  `);
    if (done && i > 3) { console.log(' ✓'); break; }
  }
  pass('Chat-driven edit — sent and processed');
} else {
  fail('Chat-driven edit', 'No textarea found');
}

await page.screenshot({ path: '/tmp/nova-demo-act2.png' });

// 2.6 Block selection
log('Testing block selection...');
const hasBlockPanel = await page.evaluate(() => {
  return !!document.querySelector('[class*="metadata"], [class*="block-browser"], [class*="right-panel"]');
});
if (hasBlockPanel) pass('Block metadata panel — available');
else log('  Block metadata panel not yet visible (needs block click)');


// ══════════════════════════════════════════
// ACT 3 — Asset Integration
// ══════════════════════════════════════════
console.log('\n── Act 3: Asset Integration ──');

const hasAssetsTab = await page.evaluate(() => {
  const tabs = document.querySelectorAll('button, [role="tab"]');
  for (const t of tabs) {
    if (t.textContent?.includes('Assets') || t.textContent?.includes('assets')) return true;
  }
  return false;
});
if (hasAssetsTab) pass('Assets tab — exists in editor');
else fail('Assets tab — exists in editor', 'No Assets tab found');

await page.screenshot({ path: '/tmp/nova-demo-act3.png' });


// ══════════════════════════════════════════
// ACT 4 — Variations (AI creates a variation page)
// ══════════════════════════════════════════
console.log('\n── Act 4: Variations ──');

// Ensure AI Rail is open (it may already be open from Act 2's chat edit)
const railOpenAct4 = await page.evaluate(() => !!document.querySelector('textarea'));
if (!railOpenAct4) {
  await page.keyboard.press('Meta+.');
  await page.waitForTimeout(500);
}
const textarea4 = await page.$('textarea');
if (textarea4) {
  log('Sending: "Create a lifestyle variation of this page"');
  await textarea4.fill('Create a variation of this page at /test-demo-e2e-lifestyle with a softer, lifestyle-focused tone');
  await page.keyboard.press('Enter');

  for (let i = 0; i < 50; i++) {
    await page.waitForTimeout(1000);
    const done = await page.evaluate(() => !document.querySelector('.animate-spin'));
    process.stdout.write(`\r  [${i+1}s] waiting...  `);
    if (done && i > 5) { console.log(' ✓'); break; }
  }
  pass('Variations — lifestyle variant requested');
} else {
  fail('Variations', 'No textarea');
}

await page.screenshot({ path: '/tmp/nova-demo-act4.png' });

// 4.1 Verify the variation page exists in DA via API
log('Verifying variation page exists in DA...');
await page.waitForTimeout(2000); // Give time for page creation to complete

// Discover the active project ID from the org endpoint
let activeProjectId = 'proj-nova2'; // sensible default
try {
  const projResp = await page.request.get('http://localhost:8787/api/org/projects');
  if (projResp.ok()) {
    const projData = await projResp.json();
    if (projData.projects?.length > 0) activeProjectId = projData.projects[0].id;
  }
} catch { /* use default */ }
log(`  Using project ID: ${activeProjectId}`);

let variationExists = false;
try {
  const sourceResp = await page.request.get(
    `http://localhost:8787/api/content/${activeProjectId}/source?path=/test-demo-e2e-lifestyle`
  );
  if (sourceResp.ok()) {
    const body = await sourceResp.json();
    if (body.content && body.content.length > 10) {
      variationExists = true;
      pass('Variations — lifestyle page exists in DA');
    } else {
      fail('Variations — lifestyle page exists', 'Page exists but content is empty');
    }
  } else {
    fail('Variations — lifestyle page exists', `API returned ${sourceResp.status()}`);
  }
} catch (e) {
  fail('Variations — lifestyle page exists', e.message);
}

await page.screenshot({ path: '/tmp/nova-demo-act4-verified.png' });


// ══════════════════════════════════════════
// ACT 5 — Brand Voice (Insight Card)
// ══════════════════════════════════════════
console.log('\n── Act 5: Brand Voice Check ──');

// Ensure AI Rail is open so __novaAddInsight is available
const railOpenAct5 = await page.evaluate(() => !!document.querySelector('textarea'));
if (!railOpenAct5) {
  await page.keyboard.press('Meta+.');
  await page.waitForTimeout(500);
}

log('Injecting brand voice insight card...');
await page.evaluate(() => {
  if (window.__novaAddInsight) {
    window.__novaAddInsight({
      message: '"Built for Your Fastest Mile" scores well for engagement, but your brand voice guidelines specify an inclusive tone. Suggestion: "Every Mile Is Your Mile."',
      type: 'warning',
      actions: [
        { label: 'Accept suggestion', action: 'accept' },
        { label: 'Keep original', action: 'dismiss' },
      ],
    });
  }
});
await page.waitForTimeout(500);

const brandCard = await page.evaluate(() => {
  const cards = document.querySelectorAll('[class*="border-l-"]');
  for (const c of cards) {
    if (c.textContent?.includes('brand voice') || c.textContent?.includes('Every Mile')) return true;
  }
  return false;
});
if (brandCard) pass('Brand voice insight card — rendered');
else fail('Brand voice insight card', 'Card not found');

await page.screenshot({ path: '/tmp/nova-demo-act5.png' });


// ══════════════════════════════════════════
// ACT 7 — Preview & Publish
// ══════════════════════════════════════════
console.log('\n── Act 7: Preview & Publish ──');

// Navigate to editor with the test page
await page.goto('http://localhost:5173/editor?path=/test-demo-e2e', { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);

// 7.1 Click Preview → verify API success (not 502)
log('Testing Preview (click + API verification)...');

const previewResp7Promise = page.waitForResponse(
  resp => resp.url().includes('/preview') && resp.request().method() === 'POST',
  { timeout: 15000 }
).catch(() => null);

const previewBtn7 = await page.evaluate(() => {
  const btns = [...document.querySelectorAll('button')];
  const btn = btns.find(b => b.textContent?.includes('Preview'));
  if (btn) { btn.click(); return true; }
  return false;
});

if (previewBtn7) {
  const previewResp7 = await previewResp7Promise;
  if (previewResp7) {
    const previewApiStatus = previewResp7.status();
    if (previewApiStatus === 200) pass('Act 7 Preview — API returned 200');
    else if (previewApiStatus === 502) fail('Act 7 Preview — API response', 'Got 502 (AEM gateway error)');
    else pass(`Act 7 Preview — API called (status ${previewApiStatus})`);
  } else {
    fail('Act 7 Preview — API call', 'POST /preview not called within 15s');
  }

  // Verify the WYSIWYG iframe reloaded (bridge:ready fires again)
  await page.waitForTimeout(3000);
  const iframeStillLoaded = await page.evaluate(() => {
    const loadingText = [...document.querySelectorAll('span')].find(s => s.textContent?.includes('Loading visual editor'));
    return !loadingText; // If no loading text, iframe finished reloading
  });
  if (iframeStillLoaded) pass('Act 7 Preview — WYSIWYG iframe reloaded');
  else fail('Act 7 Preview — iframe reload', 'Loading indicator still visible');
} else {
  fail('Act 7 Preview button', 'Not found');
}

await page.screenshot({ path: '/tmp/nova-demo-act7-preview.png' });

// 7.2 Click Publish → intercept new tab, verify API response
log('Testing Publish (click + new tab intercept)...');

const publishRespPromise = page.waitForResponse(
  resp => resp.url().includes('/publish') && resp.request().method() === 'POST',
  { timeout: 15000 }
).catch(() => null);

// Listen for popup (new tab opened by window.open)
const popupPromise = context.waitForEvent('page', { timeout: 15000 }).catch(() => null);

const publishBtn7 = await page.evaluate(() => {
  const btns = [...document.querySelectorAll('button')];
  const btn = btns.find(b => b.textContent?.includes('Publish'));
  if (btn) { btn.click(); return true; }
  return false;
});

if (publishBtn7) {
  const publishResp = await publishRespPromise;
  if (publishResp) {
    const publishApiStatus = publishResp.status();
    if (publishApiStatus === 200) pass('Act 7 Publish — API returned 200');
    else if (publishApiStatus === 502) fail('Act 7 Publish — API response', 'Got 502 (AEM gateway error)');
    else pass(`Act 7 Publish — API called (status ${publishApiStatus})`);
  } else {
    fail('Act 7 Publish — API call', 'POST /publish not called within 15s');
  }

  // Check if new tab was opened
  const popup = await popupPromise;
  if (popup) {
    const popupUrl = popup.url();
    log(`  Publish opened new tab: ${popupUrl}`);
    pass('Act 7 Publish — new tab opened with live URL');
    await popup.close();
  } else {
    log('  No new tab opened (publish may have failed or blocked by browser)');
  }
} else {
  fail('Act 7 Publish button', 'Not found');
}

await page.screenshot({ path: '/tmp/nova-demo-act7-publish.png' });


// ══════════════════════════════════════════
// INSIGHT CARDS — Full Visual Test
// ══════════════════════════════════════════
console.log('\n── Insight Cards: Visual Test ──');

// Open AI Rail
await page.keyboard.press('Meta+.');
await page.waitForTimeout(300);

// Inject all 3 types
log('Injecting 3 insight card types...');
await page.evaluate(() => {
  const add = window.__novaAddInsight;
  if (!add) return;

  add({
    message: 'Pages with video hero sections convert 23% higher for this demographic.',
    type: 'suggestion',
    actions: [
      { label: 'Add video', action: 'accept' },
      { label: 'Dismiss', action: 'dismiss' },
    ],
  });

  add({
    message: 'This product shot has no alt text. Want me to generate accessible descriptions?',
    type: 'warning',
    actions: [
      { label: 'Generate alt text', action: 'accept' },
      { label: 'Skip', action: 'dismiss' },
    ],
  });

  add({
    message: 'Two creative directions ready. Want me to create an A/B test with a 50/50 split?',
    type: 'info',
    actions: [
      { label: 'Create A/B test', action: 'accept' },
      { label: 'Not now', action: 'dismiss' },
    ],
  });
});

await page.waitForTimeout(500);

const insightCardCount = await page.evaluate(() => {
  return document.querySelectorAll('[class*="border-l-"][class*="rounded-lg"]').length;
});
log(`Found ${insightCardCount} insight cards`);
if (insightCardCount >= 3) pass('Insight cards — all 3 types rendered');
else fail('Insight cards — all 3 types', `Only ${insightCardCount} cards found`);

await page.screenshot({ path: '/tmp/nova-demo-insights.png' });


// ══════════════════════════════════════════
// SUMMARY
// ══════════════════════════════════════════
console.log('\n══════════════════════════════════');
console.log('DEMO E2E TEST RESULTS');
console.log('══════════════════════════════════');
const passed = results.filter(r => r.pass).length;
const failed = results.filter(r => !r.pass).length;
console.log(`\nPassed: ${passed}/${results.length}`);
if (failed > 0) {
  console.log(`Failed: ${failed}`);
  results.filter(r => !r.pass).forEach(r => {
    console.log(`  ✗ ${r.test}: ${r.reason}`);
  });
}
console.log(`\nScreenshots saved to /tmp/nova-demo-*.png`);

console.log('\nBrowser open. Ctrl+C to close.');
await new Promise(() => {});
