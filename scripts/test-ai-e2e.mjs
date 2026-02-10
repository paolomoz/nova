import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: false });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

// Auth
const resp = await page.request.post('http://localhost:8787/api/auth/dev-login');
const cookies = resp.headers()['set-cookie'] || '';
const match = cookies.match(/nova_session=([^;]+)/);
await context.addCookies([{ name: 'nova_session', value: match[1], domain: 'localhost', path: '/' }]);

// Go to sites
await page.goto('http://localhost:5173/sites', { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);

// Open AI Rail
console.log('Opening AI Rail...');
await page.keyboard.press('Meta+.');
await page.waitForTimeout(500);

// Type and submit
const textarea = await page.$('textarea');
await textarea.fill('List the pages in this project');
await page.waitForTimeout(200);

console.log('Submitting...');
await page.keyboard.press('Enter');

// Wait up to 30 seconds, checking every second
console.log('Waiting for response (up to 30s)...');
for (let i = 0; i < 30; i++) {
  await page.waitForTimeout(1000);
  const state = await page.evaluate(() => {
    const hasSpinner = !!document.querySelector('.animate-spin');
    // Check for AIResponse component (has ai-gradient-vivid header + text)
    const responseEl = document.querySelector('.space-y-4 .bg-background-layer-2');
    return {
      hasSpinner,
      hasResponse: !!responseEl,
      responseText: responseEl?.textContent?.substring(0, 100) || '',
    };
  });
  process.stdout.write(`  [${i+1}s] spinner=${state.hasSpinner} response=${state.hasResponse}`);
  if (state.hasResponse) {
    console.log(` ✓ "${state.responseText.substring(0, 60)}..."`);
    break;
  }
  console.log('');
}

await page.screenshot({ path: '/tmp/nova-ai-e2e.png' });
console.log('Screenshot saved to /tmp/nova-ai-e2e.png');

console.log('\nBrowser open. Ctrl+C to close.');
await new Promise(() => {});
