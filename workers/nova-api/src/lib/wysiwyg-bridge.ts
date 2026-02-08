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
  }

  // --- Content extraction: patch text edits into source HTML ---
  function extractContent() {
    var main = document.querySelector('main');
    if (!main) return window.__NOVA_SOURCE_HTML__;

    var parser = new DOMParser();
    var sourceDoc = parser.parseFromString(window.__NOVA_SOURCE_HTML__, 'text/html');
    var sourceMain = sourceDoc.querySelector('main') || sourceDoc.body;

    patchTextNodes(sourceMain, main);

    return sourceMain.innerHTML;
  }

  function patchTextNodes(sourceNode, liveNode) {
    var sourceChildren = Array.from(sourceNode.childNodes);
    var liveChildren = Array.from(liveNode.childNodes);

    var liveIdx = 0;
    for (var i = 0; i < sourceChildren.length; i++) {
      var sc = sourceChildren[i];

      if (sc.nodeType === Node.TEXT_NODE) {
        while (liveIdx < liveChildren.length && liveChildren[liveIdx].nodeType !== Node.TEXT_NODE) {
          liveIdx++;
        }
        if (liveIdx < liveChildren.length) {
          var liveText = liveChildren[liveIdx].textContent;
          if (sc.textContent !== liveText) {
            sc.textContent = liveText;
          }
          liveIdx++;
        }
      } else if (sc.nodeType === Node.ELEMENT_NODE) {
        var matchingLive = findMatchingElement(sc, liveChildren, liveIdx);
        if (matchingLive) {
          patchTextNodes(sc, matchingLive.node);
          liveIdx = matchingLive.index + 1;
        }
      }
    }
  }

  function findMatchingElement(sourceEl, liveChildren, startIdx) {
    var sourceTag = sourceEl.tagName.toLowerCase();
    for (var i = startIdx; i < liveChildren.length; i++) {
      var lc = liveChildren[i];
      if (lc.nodeType === Node.ELEMENT_NODE) {
        var liveTag = lc.tagName.toLowerCase();
        if (liveTag === sourceTag) {
          return { node: lc, index: i };
        }
        if (liveTag === 'div') {
          var inner = lc.querySelector(sourceTag);
          if (inner) return { node: inner, index: i };
        }
      }
    }
    return null;
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
