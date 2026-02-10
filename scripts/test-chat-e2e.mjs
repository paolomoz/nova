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
await page.waitForTimeout(2000);

// Open AI Rail
console.log('1. Opening AI Rail...');
await page.keyboard.press('Meta+.');
await page.waitForTimeout(500);

// Send first message
console.log('2. Sending: "List pages"');
const textarea = await page.$('textarea');
await textarea.fill('List the pages in this project');
await page.keyboard.press('Enter');

// Wait for response
for (let i = 0; i < 25; i++) {
  await page.waitForTimeout(1000);
  const hasResponse = await page.evaluate(() => {
    return document.querySelectorAll('.bg-background-layer-2').length;
  });
  if (hasResponse > 0) { console.log(`   Response after ${i+1}s`); break; }
}

await page.screenshot({ path: '/tmp/nova-chat-1.png' });

// Trigger an insight card from JS
console.log('3. Injecting test insight card...');
await page.evaluate(() => {
  if (window.__novaAddInsight) {
    window.__novaAddInsight({
      message: 'Pages with video hero sections convert 23% higher for this demographic. Want me to generate a short product video for the hero?',
      type: 'suggestion',
      actions: [
        { label: 'Accept', action: 'accept' },
        { label: 'Dismiss', action: 'dismiss' },
      ],
    });
  } else {
    console.error('__novaAddInsight not available');
  }
});

await page.waitForTimeout(500);
await page.screenshot({ path: '/tmp/nova-chat-2-insight.png' });

// Send second message
console.log('4. Sending: "Create a landing page"');
const textarea2 = await page.$('textarea');
await textarea2.fill('Create a landing page at /test-demo for a running shoe product');
await page.keyboard.press('Enter');

// Wait for the plan execution
console.log('   Waiting for plan execution...');
for (let i = 0; i < 40; i++) {
  await page.waitForTimeout(1000);
  const state = await page.evaluate(() => {
    const responses = document.querySelectorAll('.bg-background-layer-2');
    const plans = document.querySelectorAll('.bg-primary');
    const userMsgs = document.querySelectorAll('.bg-primary\\/10');
    return { responses: responses.length, plans: plans.length, userMsgs: userMsgs.length };
  });
  process.stdout.write(`\r   [${i+1}s] responses=${state.responses} userMsgs=${state.userMsgs}`);
  if (state.responses >= 2) { console.log(' ✓'); break; }
}

await page.screenshot({ path: '/tmp/nova-chat-3-multi.png' });
console.log('5. Screenshots saved to /tmp/nova-chat-*.png');

console.log('\nBrowser open. Ctrl+C to close.');
await new Promise(() => {});
