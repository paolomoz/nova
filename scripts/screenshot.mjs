import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: false });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

// Get a dev session via API
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

// Navigate to editor for the index page
console.log('1. Opening editor for /index...');
await page.goto('http://localhost:5173/editor?path=/index', { waitUntil: 'networkidle' });
await page.waitForTimeout(3000);

// Wait for WYSIWYG iframe
const iframeElement = await page.waitForSelector('iframe[title="Visual Editor"]', { timeout: 10000 });
const frame = await iframeElement.contentFrame();
console.log('2. Got iframe frame');

await frame.waitForSelector('main', { timeout: 20000 });
// Extra wait for AEM block decoration
await page.waitForTimeout(3000);
console.log('3. WYSIWYG loaded!');

const originalText = await frame.$eval('h1', el => el.textContent);
console.log(`4. Original h1 text: "${originalText}"`);

// Directly modify the h1 text in the iframe DOM
const newText = 'Welcome to Nova 2!';
await frame.evaluate((text) => {
  const h1 = document.querySelector('h1');
  h1.textContent = text;
}, newText);
await page.waitForTimeout(500);

const h1After = await frame.$eval('h1', el => el.textContent);
console.log(`5. h1 after DOM edit: "${h1After}"`);

// Test bridge content extraction
console.log('6. Testing bridge content extraction...');
const extractedContent = await page.evaluate(() => {
  return new Promise((resolve) => {
    function handler(e) {
      if (e.data && e.data.type === 'bridge:content-response') {
        window.removeEventListener('message', handler);
        resolve(e.data.content);
      }
    }
    window.addEventListener('message', handler);
    const iframe = document.querySelector('iframe[title="Visual Editor"]');
    iframe.contentWindow.postMessage({ type: 'bridge:request-content' }, window.location.origin);
    setTimeout(() => resolve('TIMEOUT'), 5000);
  });
});

if (extractedContent === 'TIMEOUT') {
  console.log('7. TIMEOUT: Bridge did not respond');
} else {
  const h1Match = extractedContent.match(/<h1[^>]*>(.*?)<\/h1>/);
  console.log(`7. H1 in extracted content: "${h1Match ? h1Match[1] : 'NOT FOUND'}"`);
  console.log(`   Contains new text: ${extractedContent.includes(newText)}`);
}

// Trigger save via bridge postMessage
console.log('8. Saving...');
await frame.evaluate(() => {
  window.parent.postMessage({ type: 'bridge:save' }, window.location.origin);
});
await page.waitForTimeout(4000);

// Verify in DA
console.log('9. Verifying in DA...');
const verifyResp = await page.request.get(
  `http://localhost:8787/api/content/proj-nova2/source?path=/index`,
);
const data = await verifyResp.json();
const savedContent = data.content || '';
const savedH1 = savedContent.match(/<h1[^>]*>(.*?)<\/h1>/);
console.log(`   H1 in DA: "${savedH1 ? savedH1[1] : 'NOT FOUND'}"`);
if (savedContent.includes(newText)) {
  console.log('   SUCCESS: DA source updated!');
} else {
  console.log('   FAIL: DA source not updated');
}

await page.screenshot({ path: '/tmp/nova-editor-final.png', fullPage: false });
console.log('10. Final screenshot saved');

console.log('\nBrowser is open. Press Ctrl+C to close.');
await new Promise(() => {});
