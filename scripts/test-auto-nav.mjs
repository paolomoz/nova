/**
 * Quick test: Auto-navigate to created page via insight card
 * Run: node scripts/test-auto-nav.mjs
 */
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: false });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

// Auth
const resp = await page.request.post('http://localhost:8787/api/auth/dev-login');
const cookies = resp.headers()['set-cookie'] || '';
const match = cookies.match(/nova_session=([^;]+)/);
await context.addCookies([{ name: 'nova_session', value: match[1], domain: 'localhost', path: '/' }]);

await page.goto('http://localhost:5173/sites', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

// Open AI Rail
console.log('1. Opening AI Rail...');
await page.keyboard.press('Meta+.');
await page.waitForTimeout(500);

// Send create page prompt
console.log('2. Sending page creation prompt...');
const textarea = await page.$('textarea');
await textarea.fill('Create a simple test page at /auto-nav-test with a hero block');
await page.keyboard.press('Enter');

// Wait for streaming to complete
console.log('3. Waiting for AI response...');
for (let i = 0; i < 60; i++) {
  await page.waitForTimeout(1000);
  const state = await page.evaluate(() => {
    const spinner = document.querySelector('.animate-spin');
    const insightCards = document.querySelectorAll('[class*="border-l-"]');
    let hasOpenEditor = false;
    for (const btn of document.querySelectorAll('button')) {
      if (btn.textContent?.includes('Open in Editor')) hasOpenEditor = true;
    }
    return { hasSpinner: !!spinner, insightCount: insightCards.length, hasOpenEditor };
  });
  process.stdout.write(`\r  [${i+1}s] spinner=${state.hasSpinner} insights=${state.insightCount} openEditor=${state.hasOpenEditor}  `);

  if (state.hasOpenEditor) {
    console.log('\n✓ "Open in Editor" insight card appeared!');

    // Click "Open in Editor"
    console.log('4. Clicking "Open in Editor"...');
    await page.evaluate(() => {
      for (const btn of document.querySelectorAll('button')) {
        if (btn.textContent?.includes('Open in Editor')) { btn.click(); return; }
      }
    });
    await page.waitForTimeout(2000);
    console.log(`5. Current URL: ${page.url()}`);
    if (page.url().includes('/editor')) {
      console.log('✓ Auto-navigated to editor!');
    } else {
      console.log('✗ Did not navigate to editor');
    }
    break;
  }

  if (!state.hasSpinner && i > 10) {
    console.log('\n✗ Response finished but no "Open in Editor" button found');
    // Debug: check what's in the DOM
    const debug = await page.evaluate(() => {
      const cards = document.querySelectorAll('[class*="border-l-"]');
      return Array.from(cards).map(c => c.textContent?.slice(0, 100));
    });
    console.log('Cards found:', debug);
    break;
  }
}

await page.screenshot({ path: '/tmp/nova-auto-nav.png' });
console.log('\nScreenshot: /tmp/nova-auto-nav.png');
console.log('Browser open. Ctrl+C to close.');
await new Promise(() => {});
