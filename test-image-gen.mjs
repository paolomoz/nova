import { chromium } from 'playwright';

const TIMEOUT = 120_000;
const TARGET_PROJECT_NAME = 'Nova 2';
const PROJECT_ID = 'proj-demo-nova2'; // paolomoz/nova-2

async function main() {
  const browser = await chromium.launch({ headless: false, slowMo: 200 });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  page.on('console', (msg) => {
    if (msg.type() === 'error') console.log(`[BROWSER ERROR] ${msg.text()}`);
  });

  // --- Step 1: Navigate and auto-login ---
  console.log('==> Step 1: Navigate to app');
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  console.log('    URL:', page.url());

  // --- Step 2: Verify project loaded ---
  console.log(`==> Step 2: Using project "${TARGET_PROJECT_NAME}" (${PROJECT_ID})`);
  // With mock mode off and only one project in DB, it auto-selects Nova 2
  await page.waitForTimeout(1000);

  // --- Step 3: Open AI Rail ---
  console.log('==> Step 3: Open AI Rail');
  await page.keyboard.press('Meta+.');
  await page.waitForTimeout(1000);

  const railVisible = await page.locator('text=Nova AI').isVisible().catch(() => false);
  console.log('    AI Rail visible:', railVisible);
  if (!railVisible) {
    console.log('    ERROR: Could not open AI Rail');
    await browser.close();
    return;
  }

  // --- Step 4: Generate a page with images ---
  const testSlug = `bakery-roundtrip-${Date.now()}`;
  console.log(`==> Step 4: Send prompt to generate page at /en/${testSlug}`);
  const textarea = page.locator('textarea[placeholder="Ask Nova anything..."]');
  await textarea.fill(`Create a landing page for a bakery at /en/${testSlug} with a hero image and two cards with images`);
  await page.getByRole('button', { name: /send prompt/i }).click();
  console.log('    Prompt sent, waiting for AI...');

  // Wait for completion
  try {
    await page.getByRole('button', { name: /send prompt/i }).waitFor({ state: 'visible', timeout: TIMEOUT });
    console.log('    AI execution completed!');
  } catch {
    console.log('    AI execution timed out');
  }
  await page.waitForTimeout(1000);
  await page.screenshot({ path: '/tmp/nova-test-ai-result.png' });

  // --- Step 5: Check source HTML via in-page fetch (shares session cookies) ---
  console.log('==> Step 5: Verify source HTML (via in-page fetch)');
  const sourceData = await page.evaluate(async ({ pid, slug }) => {
    try {
      const sourceResp = await fetch(
        `/api/content/${pid}/source?path=/en/${slug}.html`,
        { credentials: 'include' }
      );
      return await sourceResp.json();
    } catch (err) {
      return { error: err.message };
    }
  }, { pid: PROJECT_ID, slug: testSlug });

  if (sourceData?.content) {
    const content = sourceData.content;
    console.log(`    Project ID: ${PROJECT_ID}`);
    console.log('    Has placehold.co (BAD):', content.includes('placehold.co'));
    console.log('    Has /media/generated/ paths (GOOD):', content.includes('/media/generated/'));
    console.log('    Has hero block:', content.includes('class="hero"'));
    console.log('    Has cards block:', content.includes('class="cards"'));

    const imgMatches = content.match(/src="([^"]+)"/g) || [];
    for (const match of imgMatches) {
      console.log('    Image URL:', match);
    }
  } else {
    console.log('    Could not fetch source HTML:', sourceData?.error || 'unknown');
  }

  // --- Step 6: Open in editor and check visual rendering ---
  console.log('==> Step 6: Open in editor (first load)');
  await page.goto(`http://localhost:5173/editor?path=%2Fen%2F${testSlug}.html`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(8000);
  await page.screenshot({ path: '/tmp/nova-test-editor-visual.png' });

  // Check images in iframe
  console.log('==> Step 7: Check images in visual editor (first load)');
  let iframe = page.frameLocator('iframe').first();
  try {
    const images = iframe.locator('img');
    const imageCount = await images.count();
    console.log(`    Found ${imageCount} images in editor iframe`);

    for (let i = 0; i < imageCount; i++) {
      const img = images.nth(i);
      const src = await img.getAttribute('src');
      const alt = await img.getAttribute('alt');
      const naturalWidth = await img.evaluate((el) => /** @type {HTMLImageElement} */ (el).naturalWidth);
      console.log(`    Image ${i + 1}: loaded=${naturalWidth > 0}, width=${naturalWidth}, alt="${alt}", src="${src?.slice(0, 120)}"`);
    }
  } catch (err) {
    console.log('    Could not inspect iframe:', err.message);
  }

  // --- Step 8: Save from visual mode and check round-trip ---
  console.log('==> Step 8: Save from visual mode (Cmd+S)');
  try {
    await page.keyboard.press('Meta+s');
    await page.waitForTimeout(3000);
    console.log('    Save triggered');
  } catch (err) {
    console.log('    Save trigger failed:', err.message);
  }
  await page.screenshot({ path: '/tmp/nova-test-after-save.png' });

  // --- Step 9: Check source HTML after save (via in-page fetch) ---
  console.log('==> Step 9: Verify source HTML after save');
  const sourceData2 = await page.evaluate(async ({ pid, slug }) => {
    try {
      const resp = await fetch(
        `/api/content/${pid}/source?path=/en/${slug}.html`,
        { credentials: 'include' }
      );
      return await resp.json();
    } catch (err) {
      return { error: err.message };
    }
  }, { pid: PROJECT_ID, slug: testSlug });

  if (sourceData2?.content) {
    const content = sourceData2.content;
    console.log('    Has proxy URLs (BAD):', content.includes('/aem-proxy/'));
    console.log('    Has <picture> elements (BAD - should be unwrapped):', content.includes('<picture'));
    console.log('    Has /media/generated/ paths (GOOD):', content.includes('/media/generated/'));
    console.log('    Has hero block:', content.includes('class="hero"'));
    console.log('    Has cards block:', content.includes('class="cards"'));
    console.log('    Has "block" class (BAD - AEM artifact):', / class="[^"]*\bblock\b/.test(content));
    console.log('    Has data-block-name (BAD):', content.includes('data-block-name'));
    console.log('    Has default-content-wrapper (BAD):', content.includes('default-content-wrapper'));

    const imgMatches = content.match(/src="([^"]+)"/g) || [];
    for (const match of imgMatches) {
      console.log('    Image URL:', match);
    }

    // Show a snippet of the HTML for debugging
    console.log('\n    --- Source HTML (first 500 chars) ---');
    console.log('    ' + content.slice(0, 500).replace(/\n/g, '\n    '));
    console.log('    --- End ---\n');
  } else {
    console.log('    Could not fetch source HTML after save:', sourceData2?.error || 'unknown');
  }

  // --- Step 10: Reload editor and verify blocks still render ---
  console.log('==> Step 10: Reload editor after save');
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(8000);
  await page.screenshot({ path: '/tmp/nova-test-after-reload.png' });

  console.log('==> Step 11: Check images and blocks after reload');
  iframe = page.frameLocator('iframe').first();
  try {
    const images = iframe.locator('img');
    const imageCount = await images.count();
    console.log(`    Found ${imageCount} images after reload`);

    for (let i = 0; i < imageCount; i++) {
      const img = images.nth(i);
      const src = await img.getAttribute('src');
      const alt = await img.getAttribute('alt');
      const naturalWidth = await img.evaluate((el) => /** @type {HTMLImageElement} */ (el).naturalWidth);
      console.log(`    Image ${i + 1}: loaded=${naturalWidth > 0}, width=${naturalWidth}, alt="${alt}", src="${src?.slice(0, 120)}"`);
    }

    // Check blocks
    const blocks = iframe.locator('[data-block-name]');
    const blockCount = await blocks.count();
    console.log(`    Found ${blockCount} decorated blocks after reload`);
    for (let i = 0; i < blockCount; i++) {
      const name = await blocks.nth(i).getAttribute('data-block-name');
      console.log(`    Block ${i + 1}: ${name}`);
    }
  } catch (err) {
    console.log('    Could not inspect iframe after reload:', err.message);
  }

  await page.screenshot({ path: '/tmp/nova-test-final.png', fullPage: true });
  console.log('\n==> Done. Screenshots at /tmp/nova-test-*.png');
  console.log('    Browser open for 60s...');
  await page.waitForTimeout(60000);
  await browser.close();
}

main().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
