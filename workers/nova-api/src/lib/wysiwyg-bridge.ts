/**
 * WYSIWYG Bridge — injects editing capabilities into a proxied AEM page.
 *
 * The bridge script:
 * - Waits for AEM block decoration to complete
 * - Makes <main> contentEditable
 * - Highlights blocks on hover
 * - Sends mutation events to parent via postMessage
 * - Responds to content extraction requests (returns patched source HTML)
 */

/**
 * Build a WYSIWYG-capable HTML page from a rendered AEM page.
 *
 * All root-relative URLs are rewritten to go through a same-origin proxy
 * (`/api/content/:pid/aem-proxy/...`) to avoid CORS issues with module scripts.
 *
 * @param renderedHtml - The fully rendered HTML from AEM Edge Delivery
 * @param sourceHtml - The original DA source HTML (pre-decoration)
 * @param proxyBasePath - Same-origin proxy path (e.g. /api/content/proj-x/aem-proxy)
 * @param aemBaseUrl - The AEM base URL (for dot-relative ./media URLs via <base>)
 */
export function buildWysiwygPage(
  renderedHtml: string,
  sourceHtml: string,
  proxyBasePath: string,
  aemBaseUrl: string,
): string {
  let html = renderedHtml;

  // Add .appear class to body so AEM CSS reveals content immediately,
  // and remove nonce attributes so scripts run without CSP enforcement.
  html = html.replace(/<body([^>]*)>/i, (_match, attrs: string) => {
    if (/class=["']/.test(attrs)) {
      return `<body${attrs.replace(/class=["']([^"']*)["']/, 'class="$1 appear"')}>`;
    }
    return `<body${attrs} class="appear">`;
  });
  html = html.replace(/\s+nonce=["'][^"']*["']/gi, '');

  // Rewrite root-relative URLs to same-origin proxy to avoid CORS issues.
  // Module scripts require CORS, and AEM CDN doesn't serve CORS headers.
  html = rewriteRootRelativeUrls(html, proxyBasePath);

  // Inject <base href> pointing to the proxy so dynamically created elements
  // (by AEM JS) also resolve through the proxy.
  const baseTag = `<base href="${proxyBasePath}/">`;
  if (html.includes('<head>')) {
    html = html.replace('<head>', `<head>\n${baseTag}`);
  } else if (html.includes('<HEAD>')) {
    html = html.replace('<HEAD>', `<HEAD>\n${baseTag}`);
  } else {
    html = `<!DOCTYPE html><html><head>${baseTag}</head><body>${html}</body></html>`;
  }

  // Override AEM CSS that hides body until JS adds .appear class.
  const overrideStyles = `<style>body { display: block !important; visibility: visible !important; } header, footer { display: block; }</style>`;
  html = html.replace('</head>', `${overrideStyles}\n</head>`);

  // Inject fetch interceptor for runtime fetch() calls with root-relative URLs.
  // Routes them through the same-origin proxy.
  const fetchInterceptor = buildFetchInterceptor(proxyBasePath);
  html = html.replace('</head>', `${fetchInterceptor}\n</head>`);

  // Inject the editing bridge script before </body>
  const bridgeScript = buildBridgeScript(sourceHtml);
  html = html.replace('</body>', `${bridgeScript}\n</body>`);

  // Strip CSP meta tags that would block our injected scripts
  html = html.replace(
    /<meta\s+http-equiv=["']Content-Security-Policy["'][^>]*>/gi,
    '',
  );

  return html;
}

/**
 * Rewrite root-relative URLs in HTML attributes to go through the proxy.
 */
function rewriteRootRelativeUrls(html: string, proxyBase: string): string {
  return html.replace(
    /((?:src|href|content|action|poster)=["'])(\/((?!\/)[^"']*))/gi,
    `$1${proxyBase}/$3`,
  ).replace(
    /(srcset=["'])([^"']+)(["'])/gi,
    (_match, prefix: string, value: string, suffix: string) => {
      const rewritten = value.replace(
        /(?:^|,\s*)(\/[^\s,]+)/g,
        (srcsetMatch: string, url: string) => srcsetMatch.replace(url, `${proxyBase}${url}`),
      );
      return `${prefix}${rewritten}${suffix}`;
    },
  );
}

function escapeForScript(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$/g, '\\$');
}

function buildFetchInterceptor(proxyBase: string): string {
  return `<script>
(function() {
  var proxyBase = ${JSON.stringify(proxyBase)};
  var originalFetch = window.fetch;
  window.fetch = function(input, init) {
    if (typeof input === 'string' && input.startsWith('/') && !input.startsWith(proxyBase)) {
      input = proxyBase + input;
    } else if (input instanceof Request && input.url.startsWith('/') && !input.url.startsWith(proxyBase)) {
      input = new Request(proxyBase + input.url, input);
    }
    return originalFetch.call(this, input, init);
  };
})();
</script>`;
}

function buildBridgeScript(sourceHtml: string): string {
  const escapedSource = escapeForScript(sourceHtml);

  return `<script>
(function() {
  'use strict';

  // Store original source HTML for round-tripping
  window.__NOVA_SOURCE_HTML__ = \`${escapedSource}\`;

  var PARENT_ORIGIN = window.location.origin;
  var ready = false;

  // --- Wait for AEM decoration to complete ---
  function waitForDecoration(callback) {
    var maxWait = 8000;
    var interval = 200;
    var elapsed = 0;

    function check() {
      // AEM EDS marks blocks with data-block-status="loaded" when done
      var blocks = document.querySelectorAll('[data-block-status]');
      var allLoaded = true;
      blocks.forEach(function(b) {
        if (b.getAttribute('data-block-status') !== 'loaded') allLoaded = false;
      });

      // If no blocks or all loaded, or timeout — proceed
      if ((blocks.length === 0 && document.querySelector('main')) || allLoaded || elapsed >= maxWait) {
        callback();
      } else {
        elapsed += interval;
        setTimeout(check, interval);
      }
    }
    // Start checking after a short delay to let AEM JS initialize
    setTimeout(check, 300);
  }

  // --- Block hover highlighting ---
  var lastHighlighted = null;

  function setupBlockHighlighting() {
    document.addEventListener('mouseover', function(e) {
      var block = e.target.closest('[data-block-name]');
      if (block && block !== lastHighlighted) {
        if (lastHighlighted) lastHighlighted.style.outline = '';
        block.style.outline = '2px solid #3B63FB';
        block.style.outlineOffset = '2px';
        lastHighlighted = block;

        // Notify parent of hovered block
        window.parent.postMessage({
          type: 'bridge:block-hover',
          blockName: block.getAttribute('data-block-name')
        }, PARENT_ORIGIN);
      }
    });

    document.addEventListener('mouseout', function(e) {
      if (lastHighlighted && !e.relatedTarget?.closest('[data-block-name]')) {
        lastHighlighted.style.outline = '';
        lastHighlighted = null;
      }
    });

    // Block click → select
    document.addEventListener('click', function(e) {
      var block = e.target.closest('[data-block-name]');
      if (block) {
        window.parent.postMessage({
          type: 'bridge:block-selected',
          blockName: block.getAttribute('data-block-name')
        }, PARENT_ORIGIN);
      }
    });
  }

  // --- Content editing ---
  function setupEditing() {
    var main = document.querySelector('main');
    if (!main) return;

    main.setAttribute('contenteditable', 'true');
    main.style.outline = 'none';

    // Observe mutations to detect edits
    var observer = new MutationObserver(function() {
      if (!ready) return;
      window.parent.postMessage({ type: 'bridge:content-changed' }, PARENT_ORIGIN);
    });

    observer.observe(main, {
      childList: true,
      subtree: true,
      characterData: true,
      characterDataOldValue: true
    });

    // Forward Cmd+S / Ctrl+S to parent so the save handler fires
    document.addEventListener('keydown', function(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        window.parent.postMessage({ type: 'bridge:save' }, PARENT_ORIGIN);
      }
    });
  }

  // --- Content extraction: patch text edits into source HTML ---
  // Strategy: collect all text-bearing elements from source, find their
  // original text, then search the live DOM for the matching element
  // (by tag + original text) and replace with the live text.
  function extractContent() {
    var main = document.querySelector('main');
    if (!main) return window.__NOVA_SOURCE_HTML__;

    var parser = new DOMParser();
    var sourceDoc = parser.parseFromString(window.__NOVA_SOURCE_HTML__, 'text/html');
    var sourceMain = sourceDoc.querySelector('main') || sourceDoc.body;

    // Build a map of original text -> live text for text-bearing elements
    var textTags = ['h1','h2','h3','h4','h5','h6','p','li','td','th','a','strong','em','span','blockquote','figcaption','label','dt','dd'];

    // Collect all source text elements with their original text
    var sourceEls = [];
    textTags.forEach(function(tag) {
      var els = sourceMain.querySelectorAll(tag);
      for (var i = 0; i < els.length; i++) {
        var el = els[i];
        // Only leaf-level text (skip elements that contain other text-bearing elements)
        var hasChildTextEl = false;
        for (var j = 0; j < textTags.length; j++) {
          if (el.querySelector(textTags[j])) { hasChildTextEl = true; break; }
        }
        if (!hasChildTextEl && el.textContent.trim()) {
          sourceEls.push({ el: el, tag: tag, originalText: el.textContent });
        }
      }
    });

    // For each source text element, find the matching live element and patch
    sourceEls.forEach(function(entry) {
      // Find in live DOM: same tag with matching original text
      var liveEls = main.querySelectorAll(entry.tag);
      var matched = null;
      for (var i = 0; i < liveEls.length; i++) {
        // Deep search: AEM decorates blocks, so the element may be deeply nested
        // Match by original text content
        if (liveEls[i].textContent.trim() === entry.originalText.trim()) {
          matched = liveEls[i];
          break;
        }
      }

      // If no exact match, check if the live element's text changed (edited)
      if (!matched) {
        // Look for elements of the same tag that DON'T match any source text
        // This handles the case where text was edited
        var allSourceTexts = sourceEls.map(function(e) { return e.originalText.trim(); });
        for (var i = 0; i < liveEls.length; i++) {
          var liveText = liveEls[i].textContent.trim();
          if (liveText && allSourceTexts.indexOf(liveText) === -1) {
            // This live element has text not in source — likely an edit.
            // Try to match by position: count same-tag elements before it
            var livePos = Array.from(main.querySelectorAll(entry.tag)).indexOf(liveEls[i]);
            var sourcePos = Array.from(sourceMain.querySelectorAll(entry.tag)).indexOf(entry.el);
            if (livePos === sourcePos) {
              matched = liveEls[i];
              break;
            }
          }
        }
      }

      if (matched && matched.textContent !== entry.originalText) {
        // Patch: update the source element's text content
        // Preserve child HTML structure if possible (e.g. <a>, <strong>)
        if (entry.el.children.length === 0) {
          entry.el.textContent = matched.textContent;
        } else {
          // Has child elements — do a careful text-only patch on text nodes
          patchDirectTextNodes(entry.el, matched);
        }
      }
    });

    return sourceMain.innerHTML;
  }

  // Patch only direct text nodes within an element
  function patchDirectTextNodes(sourceEl, liveEl) {
    var sourceTexts = [];
    var liveTexts = [];
    sourceEl.childNodes.forEach(function(n) { if (n.nodeType === Node.TEXT_NODE) sourceTexts.push(n); });
    liveEl.childNodes.forEach(function(n) { if (n.nodeType === Node.TEXT_NODE) liveTexts.push(n); });
    for (var i = 0; i < sourceTexts.length && i < liveTexts.length; i++) {
      if (sourceTexts[i].textContent !== liveTexts[i].textContent) {
        sourceTexts[i].textContent = liveTexts[i].textContent;
      }
    }
    // Also recurse into child elements
    var sourceChildren = Array.from(sourceEl.children);
    var liveChildren = Array.from(liveEl.children);
    for (var i = 0; i < sourceChildren.length && i < liveChildren.length; i++) {
      if (sourceChildren[i].tagName === liveChildren[i].tagName) {
        patchDirectTextNodes(sourceChildren[i], liveChildren[i]);
      }
    }
  }

  // --- Message handler (parent → iframe) ---
  window.addEventListener('message', function(e) {
    if (e.origin !== PARENT_ORIGIN) return;

    var msg = e.data;
    if (!msg || !msg.type) return;

    switch (msg.type) {
      case 'bridge:request-content':
        var content = extractContent();
        window.parent.postMessage({
          type: 'bridge:content-response',
          content: content
        }, PARENT_ORIGIN);
        break;
    }
  });

  // --- Initialize ---
  waitForDecoration(function() {
    setupBlockHighlighting();
    setupEditing();
    ready = true;
    window.parent.postMessage({ type: 'bridge:ready' }, PARENT_ORIGIN);
  });

})();
</script>`;
}

/**
 * Build fallback HTML when AEM preview is not available.
 */
export function buildFallbackPage(message: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      background: #f8f8f8;
      color: #292929;
    }
    .message {
      text-align: center;
      padding: 2rem;
    }
    .message h2 {
      font-size: 1.25rem;
      margin-bottom: 0.5rem;
    }
    .message p {
      color: #666;
      font-size: 0.875rem;
    }
  </style>
</head>
<body>
  <div class="message">
    <h2>Preview Not Available</h2>
    <p>${message.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
    <p>Click <strong>Preview</strong> to generate the AEM preview first, then switch to Visual mode.</p>
  </div>
  <script>
    window.parent.postMessage({ type: 'bridge:ready' }, window.location.origin);
  </script>
</body>
</html>`;
}
