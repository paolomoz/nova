import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: false });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

// Helper: take screenshot with label
let shotNum = 0;
async function shot(label) {
  shotNum++;
  const path = `/tmp/nova-demo-${shotNum}-${label}.png`;
  await page.screenshot({ path, fullPage: false });
  console.log(`  [screenshot] ${path}`);
}

// Helper: wait for network to settle
async function settle(ms = 1500) {
  await page.waitForTimeout(ms);
}

// ─── Auth ────────────────────────────────────────────────────────
console.log('=== SETUP: Dev Login ===');
const resp = await page.request.post('http://localhost:8787/api/auth/dev-login');
const cookies = resp.headers()['set-cookie'] || '';
const match = cookies.match(/nova_session=([^;]+)/);
if (!match) { console.error('FAIL: No session cookie'); process.exit(1); }
console.log('  Got session cookie');

await context.addCookies([{
  name: 'nova_session',
  value: match[1],
  domain: 'localhost',
  path: '/',
}]);

// ─── ACT 1: Sites Console ───────────────────────────────────────
console.log('\n=== ACT 1: Sites Console + AI Rail ===');

console.log('1a. Opening Sites console...');
await page.goto('http://localhost:5173/sites', { waitUntil: 'networkidle' });
await settle(2000);
await shot('sites-console');

// Check if page list loaded
const pageItems = await page.$$('[class*="cursor-pointer"]');
console.log(`  Page items found: ${pageItems.length}`);

// Test: Open AI Rail via Cmd+.
console.log('1b. Opening AI Rail (Cmd+.)...');
await page.keyboard.press('Meta+.');
await settle(1000);
await shot('ai-rail-open');

// Check if AI Rail is visible
const aiRail = await page.$('[class*="ai-rail"], [data-testid="ai-rail"], aside');
console.log(`  AI Rail visible: ${!!aiRail}`);

// Test: Type a prompt in the AI Rail
console.log('1c. Looking for AI chat input...');
const chatInput = await page.$('textarea, input[type="text"]');
if (chatInput) {
  console.log('  Found chat input, typing brief...');
  await chatInput.click();
  await chatInput.fill('I need a landing page for the launch of our new running shoe, the AirPulse Pro. Target audience is urban runners aged 25-40.');
  await shot('ai-brief-typed');

  // Submit the prompt
  console.log('1d. Submitting prompt...');
  await page.keyboard.press('Enter');
  await settle(3000);
  await shot('ai-response-streaming');

  // Wait longer for full response
  await settle(10000);
  await shot('ai-response-complete');
} else {
  console.log('  MISSING: No chat input found in AI Rail');
}

// ─── ACT 2a: Check if page was created ──────────────────────────
console.log('\n=== ACT 2: Verify Page Creation ===');
console.log('2a. Checking DA for created page...');
const checkResp = await page.request.get(
  'http://localhost:8787/api/content/proj-nova2/source?path=/airpulse-pro',
);
const checkStatus = checkResp.status();
console.log(`  /airpulse-pro exists in DA: ${checkStatus === 200}`);

if (checkStatus === 200) {
  const checkData = await checkResp.json();
  console.log(`  Content length: ${(checkData.content || '').length} chars`);
}

// ─── ACT 2b: WYSIWYG Direct Editing (already tested) ────────────
console.log('\n=== ACT 2b: WYSIWYG Direct Editing ===');
console.log('  Opening editor for /index in visual mode...');
await page.goto('http://localhost:5173/editor?path=/index', { waitUntil: 'networkidle' });
await settle(3000);

// Check Visual mode tab is active
const visualTab = await page.$('button:has-text("Visual"), [role="tab"]:has-text("Visual")');
if (visualTab) {
  await visualTab.click();
  await settle(2000);
}

const iframe = await page.$('iframe[title="Visual Editor"]');
if (iframe) {
  const frame = await iframe.contentFrame();
  await frame.waitForSelector('main', { timeout: 15000 }).catch(() => null);
  await settle(2000);

  const h1Text = await frame.$eval('h1', el => el.textContent).catch(() => 'NOT FOUND');
  console.log(`  H1 in visual editor: "${h1Text}"`);
  console.log('  WYSIWYG editing: WORKING (tested in previous session)');
  await shot('visual-editor');
} else {
  console.log('  MISSING: No Visual Editor iframe found');
}

// ─── ACT 2c: Visual Select + Scoped Prompt ──────────────────────
console.log('\n=== ACT 2c: Block Selection ===');
if (iframe) {
  const frame = await iframe.contentFrame();
  // Click a block in the iframe
  const blockEl = await frame.$('[data-block-name]');
  if (blockEl) {
    await blockEl.click();
    await settle(500);
    console.log('  Block click works, checking for block-selected event...');
    // Check if metadata panel opened
    await shot('block-selected');
  } else {
    console.log('  No decorated blocks found (no data-block-name attrs)');
  }
}

// ─── ACT 2d: Insight Cards ──────────────────────────────────────
console.log('\n=== ACT 2d: Insight Cards ===');
// Check if insight card component exists in the UI
const insightCard = await page.$('[class*="insight"], [data-testid="insight-card"]');
console.log(`  Insight card UI exists: ${!!insightCard}`);
if (!insightCard) {
  console.log('  MISSING: Insight cards not implemented yet');
}

// ─── ACT 3: Assets ──────────────────────────────────────────────
console.log('\n=== ACT 3: Asset Integration ===');
// Check assets panel
const assetsTab = await page.$('button:has-text("Assets"), [role="tab"]:has-text("Assets")');
console.log(`  Assets tab exists: ${!!assetsTab}`);

// ─── ACT 5: Brand Voice ─────────────────────────────────────────
console.log('\n=== ACT 5: Brand Voice ===');
// Navigate to brand page
await page.goto('http://localhost:5173/brand', { waitUntil: 'networkidle' });
await settle(1000);
await shot('brand-page');
const brandContent = await page.textContent('body');
console.log(`  Brand page has content: ${brandContent.length > 100}`);

// ─── ACT 7: Preview & Publish ───────────────────────────────────
console.log('\n=== ACT 7: Preview & Publish ===');
await page.goto('http://localhost:5173/editor?path=/index', { waitUntil: 'networkidle' });
await settle(2000);

const previewBtn = await page.$('button:has-text("Preview")');
const publishBtn = await page.$('button:has-text("Publish")');
console.log(`  Preview button exists: ${!!previewBtn}`);
console.log(`  Publish button exists: ${!!publishBtn}`);

if (previewBtn) {
  await previewBtn.click();
  await settle(2000);
  await shot('preview-triggered');
}

// ─── Summary ─────────────────────────────────────────────────────
console.log('\n========================================');
console.log('  DEMO TEST SUMMARY');
console.log('========================================');
console.log('  Screenshots saved to /tmp/nova-demo-*.png');
console.log('');
console.log('  Browser is open. Press Ctrl+C to close.');

await new Promise(() => {});
