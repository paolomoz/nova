import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: false });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

// Capture ALL console logs
page.on('console', msg => console.log(`[CONSOLE ${msg.type()}] ${msg.text()}`));
page.on('pageerror', err => console.log(`[PAGE ERROR] ${err.message}`));

// Auth
const resp = await page.request.post('http://localhost:8787/api/auth/dev-login');
const cookies = resp.headers()['set-cookie'] || '';
const match = cookies.match(/nova_session=([^;]+)/);
await context.addCookies([{ name: 'nova_session', value: match[1], domain: 'localhost', path: '/' }]);

// Load the app
await page.goto('http://localhost:5173/sites', { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);

// Test SSE directly from within the browser context
console.log('=== Testing SSE directly in browser ===');
const result = await page.evaluate(async () => {
  const events = [];
  const startTime = Date.now();

  try {
    // Try both direct and proxied
    const urls = [
      'http://localhost:8787/api/ai/proj-nova2/stream',
      '/api/ai/proj-nova2/stream',
    ];

    for (const url of urls) {
      events.push({ url, time: Date.now() - startTime, msg: `Trying ${url}` });

      try {
        const response = await fetch(url, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: 'How many pages are in this project?' }),
        });

        events.push({ url, time: Date.now() - startTime, status: response.status, type: response.headers.get('content-type') });

        if (!response.ok) {
          events.push({ url, time: Date.now() - startTime, msg: `HTTP ${response.status}` });
          continue;
        }

        const reader = response.body?.getReader();
        if (!reader) { events.push({ url, time: Date.now() - startTime, msg: 'No reader' }); continue; }

        const decoder = new TextDecoder();
        let buffer = '';
        let currentEvent = '';
        let chunkCount = 0;

        while (true) {
          const { done, value } = await reader.read();
          if (done) { events.push({ url, time: Date.now() - startTime, msg: 'Stream done' }); break; }

          chunkCount++;
          const chunk = decoder.decode(value, { stream: true });
          events.push({ url, time: Date.now() - startTime, msg: `Chunk #${chunkCount}: ${chunk.length} bytes` });

          buffer += chunk;
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('event: ')) {
              currentEvent = line.slice(7).trim();
            } else if (line.startsWith('data: ') && currentEvent) {
              try {
                const data = JSON.parse(line.slice(6));
                events.push({ url, time: Date.now() - startTime, event: currentEvent, dataKeys: Object.keys(data) });
              } catch {
                events.push({ url, time: Date.now() - startTime, msg: `Parse error for ${currentEvent}` });
              }
              currentEvent = '';
            }
          }
        }

        // Only test first working URL
        break;
      } catch (err) {
        events.push({ url, time: Date.now() - startTime, error: err.message });
      }
    }
  } catch (err) {
    events.push({ error: err.message });
  }

  return events;
});

console.log('\n=== SSE Test Results ===');
for (const e of result) {
  console.log(JSON.stringify(e));
}

await page.screenshot({ path: '/tmp/nova-sse-debug.png' });
console.log('\nDone. Closing.');
await browser.close();
