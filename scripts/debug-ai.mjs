import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: false });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

// Capture console logs
page.on('console', msg => {
  if (msg.type() === 'error' || msg.text().includes('AI') || msg.text().includes('stream') || msg.text().includes('SSE')) {
    console.log(`[BROWSER ${msg.type()}] ${msg.text()}`);
  }
});

page.on('pageerror', err => {
  console.log(`[PAGE ERROR] ${err.message}`);
});

// Get a dev session
const resp = await page.request.post('http://localhost:8787/api/auth/dev-login');
const cookies = resp.headers()['set-cookie'] || '';
const match = cookies.match(/nova_session=([^;]+)/);
if (!match) { console.error('No session cookie'); process.exit(1); }

await context.addCookies([{
  name: 'nova_session',
  value: match[1],
  domain: 'localhost',
  path: '/',
}]);

// Go to sites
await page.goto('http://localhost:5173/sites', { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);

// Intercept the AI stream request to see what happens
page.on('response', async (response) => {
  const url = response.url();
  if (url.includes('/ai/') && url.includes('/stream')) {
    console.log(`[NETWORK] AI stream response: ${response.status()} ${response.statusText()}`);
    console.log(`[NETWORK] Content-Type: ${response.headers()['content-type']}`);
    try {
      const body = await response.text();
      console.log(`[NETWORK] Body (first 500): ${body.substring(0, 500)}`);
    } catch (e) {
      console.log(`[NETWORK] Could not read body: ${e.message}`);
    }
  }
});

page.on('requestfailed', (request) => {
  if (request.url().includes('/ai/')) {
    console.log(`[NETWORK FAIL] ${request.url()} - ${request.failure()?.errorText}`);
  }
});

// Open AI Rail
console.log('Opening AI Rail...');
await page.keyboard.press('Meta+.');
await page.waitForTimeout(500);

// Type and submit a simple prompt
const textarea = await page.$('textarea');
if (!textarea) {
  console.log('ERROR: No textarea found');
  process.exit(1);
}

console.log('Typing prompt...');
await textarea.fill('List the pages in this project');
await page.waitForTimeout(200);

console.log('Submitting...');
await page.keyboard.press('Enter');

// Monitor the AI state from within the page
console.log('Monitoring AI state...');
for (let i = 0; i < 20; i++) {
  await page.waitForTimeout(1000);
  const state = await page.evaluate(() => {
    // Access zustand store directly
    const store = document.querySelector('[data-ai-store]');
    // Try to read from window
    return {
      // Check if any response text is in the DOM
      responseText: document.querySelector('.ai-gradient-vivid')?.closest('.space-y-4')?.textContent?.substring(0, 200) || 'empty',
      hasStreamingUI: !!document.querySelector('.animate-spin'),
      hasResponse: !!document.querySelector('[class*="bg-background-layer-2"][class*="rounded-lg"][class*="text-"]'),
      railContent: document.querySelector('.space-y-4')?.innerHTML?.substring(0, 300) || 'none',
    };
  });
  console.log(`[${i+1}s] spinner=${state.hasStreamingUI} response=${state.hasResponse} content=${state.responseText.substring(0, 80)}`);

  if (state.hasResponse || (!state.hasStreamingUI && i > 3)) break;
}

await page.screenshot({ path: '/tmp/nova-ai-debug.png' });
console.log('Screenshot saved to /tmp/nova-ai-debug.png');

console.log('\nBrowser is open. Press Ctrl+C to close.');
await new Promise(() => {});
