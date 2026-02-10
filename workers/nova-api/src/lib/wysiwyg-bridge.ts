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
    (_match, prefix: string, _fullPath: string, path: string) => {
      // Don't rewrite Nova API URLs — they're already routable via the Vite proxy / same origin
      if (path.startsWith('api/')) return `${prefix}/${path}`;
      return `${prefix}${proxyBase}/${path}`;
    },
  ).replace(
    /(srcset=["'])([^"']+)(["'])/gi,
    (_match, prefix: string, value: string, suffix: string) => {
      const rewritten = value.replace(
        /(?:^|,\s*)(\/[^\s,]+)/g,
        (srcsetMatch: string, url: string) => {
          if (url.startsWith('/api/')) return srcsetMatch;
          return srcsetMatch.replace(url, `${proxyBase}${url}`);
        },
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
  var origin = window.location.origin;

  // Override codeBasePath so AEM's dynamic import() and loadCSS() route through proxy.
  // aem.js sets window.hlx.codeBasePath = '' — the frozen setter prevents that overwrite.
  window.hlx = window.hlx || {};
  Object.defineProperty(window.hlx, 'codeBasePath', {
    get: function() { return proxyBase; },
    set: function() { /* prevent AEM from resetting to empty string */ },
    configurable: false
  });

  var originalFetch = window.fetch;
  window.fetch = function(input, init) {
    var url = typeof input === 'string' ? input : (input instanceof Request ? input.url : null);
    if (url) {
      var rewritten = null;
      // Root-relative paths: /blocks/hero/hero.css → proxy path
      // But skip /api/ paths — they're Nova API routes, not AEM assets
      if (url.startsWith('/') && !url.startsWith(proxyBase) && !url.startsWith('/api/')) {
        rewritten = proxyBase + url;
      }
      // Absolute URLs on current origin that aren't already proxied
      else if (url.startsWith(origin + '/')) {
        var pathname = url.slice(origin.length);
        if (!pathname.startsWith(proxyBase) && !pathname.startsWith('/api/')) {
          rewritten = origin + proxyBase + pathname;
        }
      }
      if (rewritten !== null) {
        input = (input instanceof Request) ? new Request(rewritten, input) : rewritten;
      }
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

  // --- Parse source HTML into sections for change tracking ---
  // Source uses <hr> as section dividers. We split into an array so we can
  // return the original source verbatim for sections the user didn't touch.
  var sourceSections = [];
  var sectionModified = [];

  function parseSourceSections() {
    var raw = window.__NOVA_SOURCE_HTML__;
    // Strip <main>/<body>/<html> wrappers to get inner content
    var m = raw.match(/<main[^>]*>([\\s\\S]*?)<\\/main>/i);
    if (!m) m = raw.match(/<body[^>]*>([\\s\\S]*?)<\\/body>/i);
    var inner = m ? m[1].trim() : raw;
    sourceSections = inner.split(/<hr\\s*\\/?>\\s*/i);
    sectionModified = sourceSections.map(function() { return false; });
  }

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

    // Observe mutations to detect edits and mark affected sections
    var observer = new MutationObserver(function(mutations) {
      if (!ready) return;

      // Identify which section(s) contain the mutations
      var sectionDivs = main.querySelectorAll(':scope > div');
      mutations.forEach(function(mutation) {
        var target = mutation.target;
        for (var i = 0; i < sectionDivs.length; i++) {
          if (sectionDivs[i].contains(target) || sectionDivs[i] === target) {
            sectionModified[i] = true;
            break;
          }
        }
      });

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

  // --- Extract a single modified section from the decorated DOM ---
  function extractSectionFromDOM(sectionDiv) {
    var clone = sectionDiv.cloneNode(true);

    // 1. Remove data-block-name, data-block-status, data-section-status attributes
    clone.querySelectorAll('[data-block-name], [data-block-status], [data-section-status]').forEach(function(el) {
      el.removeAttribute('data-block-name');
      el.removeAttribute('data-block-status');
      el.removeAttribute('data-section-status');
    });
    clone.removeAttribute('data-section-status');

    // 2. Remove AEM-added wrapper divs
    clone.querySelectorAll('[class$="-wrapper"]').forEach(function(wrapper) {
      if (!wrapper.parentNode) return;

      // Default content wrapper: unwrap all children into parent
      if (wrapper.classList.contains('default-content-wrapper')) {
        while (wrapper.firstChild) {
          wrapper.parentNode.insertBefore(wrapper.firstChild, wrapper);
        }
        wrapper.parentNode.removeChild(wrapper);
        return;
      }

      // Block wrapper (hero-wrapper, columns-wrapper, etc.): replace with inner block div
      var blockDiv = wrapper.querySelector(':scope > div[class]');
      if (blockDiv) {
        blockDiv.removeAttribute('data-block-name');
        blockDiv.removeAttribute('data-block-status');
        // Extract the block name (first non-'block' class)
        var blockName = '';
        var classes = blockDiv.className.split(/\\s+/).filter(function(c) {
          if (c === 'block' || c.endsWith('-wrapper')) return false;
          if (!blockName) blockName = c;
          return true;
        });
        blockDiv.className = classes.join(' ');

        // Strip block-internal decoration classes (e.g. hero-image, hero-content, cards-card-body)
        if (blockName) {
          blockDiv.querySelectorAll('[class]').forEach(function(el) {
            var kept = [];
            el.className.split(/\\s+/).forEach(function(cls) {
              // Remove classes prefixed with the block name (decoration classes)
              if (cls && cls.indexOf(blockName + '-') !== 0) {
                kept.push(cls);
              }
            });
            if (kept.length === 0) {
              el.removeAttribute('class');
            } else {
              el.className = kept.join(' ');
            }
          });
        }

        wrapper.parentNode.replaceChild(blockDiv, wrapper);
      } else {
        while (wrapper.firstChild) {
          wrapper.parentNode.insertBefore(wrapper.firstChild, wrapper);
        }
        wrapper.parentNode.removeChild(wrapper);
      }
    });

    // 3. Remove AEM button wrappers → <p><a>
    clone.querySelectorAll('.button-container').forEach(function(container) {
      var link = container.querySelector('a');
      if (link && container.parentNode) {
        link.classList.remove('button', 'primary', 'secondary');
        if (link.className.trim() === '') link.removeAttribute('class');
        var p = document.createElement('p');
        p.appendChild(link.cloneNode(true));
        container.parentNode.replaceChild(p, container);
      }
    });

    // 4. Unwrap AEM's createOptimizedPicture — ONLY <picture> that have <source> children
    // (those were added by AEM). Preserve <picture> without <source> (original source).
    clone.querySelectorAll('picture').forEach(function(picture) {
      if (!picture.querySelector('source')) return; // original source <picture>, keep it
      var img = picture.querySelector('img');
      if (img && picture.parentNode) {
        img.removeAttribute('loading');
        img.removeAttribute('width');
        img.removeAttribute('height');
        picture.parentNode.replaceChild(img, picture);
      }
    });

    // 5. Remove bridge highlight inline styles
    clone.querySelectorAll('[style]').forEach(function(el) {
      var style = el.getAttribute('style');
      if (style && /outline-offset/.test(style)) {
        el.removeAttribute('style');
      }
    });

    // 6. Reverse proxy URL rewriting
    var baseEl = document.querySelector('base');
    var proxyPath = '';
    if (baseEl && baseEl.href) {
      try {
        var baseParsed = new URL(baseEl.href);
        proxyPath = baseParsed.pathname.replace(/\\/$/, '');
      } catch(e) {}
    }
    if (proxyPath) {
      clone.querySelectorAll('[src],[href]').forEach(function(el) {
        ['src', 'href'].forEach(function(attr) {
          var val = el.getAttribute(attr);
          if (!val) return;
          if (val.indexOf(proxyPath + '/') === 0) {
            el.setAttribute(attr, val.slice(proxyPath.length));
          } else if (val.indexOf('://') !== -1) {
            try {
              var parsed = new URL(val);
              if (parsed.pathname.indexOf(proxyPath + '/') === 0) {
                el.setAttribute(attr, parsed.pathname.slice(proxyPath.length));
              }
            } catch(e) {}
          }
        });
      });
    }

    return clone.innerHTML;
  }

  // --- Content extraction: source-based with per-section change tracking ---
  // Unmodified sections → return original source verbatim (preserves block structure).
  // Modified sections → extract from DOM with decoration stripping.
  function extractContent() {
    var main = document.querySelector('main');
    if (!main) return window.__NOVA_SOURCE_HTML__;

    var sectionDivs = main.querySelectorAll(':scope > div');

    // If no section divs, fall back to source
    if (sectionDivs.length === 0) return window.__NOVA_SOURCE_HTML__;

    var parts = [];
    for (var i = 0; i < sectionDivs.length; i++) {
      // Use original source for unmodified sections (if we have source for this index)
      if (!sectionModified[i] && i < sourceSections.length) {
        parts.push(sourceSections[i]);
      } else {
        // Modified or new section — extract from decorated DOM
        parts.push(extractSectionFromDOM(sectionDivs[i]));
      }
    }

    return parts.join('<hr>');
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
  parseSourceSections();
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
 * Extract the inner content from DA source HTML.
 *
 * DA source may include full page wrappers (`<html>`, `<body>`, `<main>`).
 * This extracts just the content inside `<main>` (or `<body>` if no `<main>`),
 * so it can be safely embedded in our own page template without nesting.
 */
function extractMainContent(html: string): string {
  // Try to extract content inside <main>
  const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  if (mainMatch) return mainMatch[1].trim();

  // Try to extract content inside <body>
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch) return bodyMatch[1].trim();

  // No wrappers — return as-is
  return html;
}

/**
 * Wrap DA source HTML into section divs, mimicking AEM's server-side rendering.
 *
 * DA source uses `<hr>` as section dividers. AEM's server wraps content between
 * `<hr>` elements into `<div>` section wrappers. AEM's client-side `decorateSections`
 * expects this structure: `<main> > <div>(section) > <div class="block">(block)`.
 * Without this wrapping, block decoration fails because block divs become sections
 * themselves instead of being children of sections.
 */
function wrapInSectionDivs(html: string): string {
  const sections = html.split(/<hr\s*\/?\s*>/i);
  return sections
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((s) => `<div>${s}</div>`)
    .join('\n');
}

/**
 * Strip AEM decoration artifacts from DA source HTML.
 *
 * DA source may contain leftover decoration from previous saves:
 * - `block` class on block divs (prevents AEM re-decoration)
 * - `data-block-name`, `data-block-status` attributes
 * - `style="outline-offset: ..."` from bridge highlighting
 * - `-wrapper` parent divs from AEM's decorateBlock
 *
 * This cleans the HTML so AEM's client-side JS can decorate from scratch.
 */
function stripDecorationArtifacts(html: string): string {
  return html
    // Remove 'block' class (but keep block name classes like 'hero', 'cards')
    .replace(/\bclass="([^"]*)\bblock\b([^"]*)"/gi, (_m, before: string, after: string) => {
      const cleaned = `${before}${after}`.replace(/\s+/g, ' ').trim();
      return cleaned ? `class="${cleaned}"` : '';
    })
    // Strip AEM-added wrapper classes that may be left from previous saves
    .replace(/\bclass="default-content-wrapper"/gi, '')
    // Remove data-block-name, data-block-status, data-section-status attributes
    .replace(/\s+data-block-(?:name|status)="[^"]*"/gi, '')
    .replace(/\s+data-section-status="[^"]*"/gi, '')
    // Remove bridge highlight inline styles
    .replace(/\s+style="outline-offset:\s*2px;?"/gi, '')
    // Remove empty style attributes left behind
    .replace(/\s+style=""/g, '')
    // Remove empty class attributes left behind
    .replace(/\s+class=""/g, '');
}

/**
 * Build a self-rendered WYSIWYG page from DA source HTML + AEM site-level CSS/JS.
 *
 * Used as an instant fallback when AEM Edge Delivery hasn't pre-rendered the page.
 * AEM's client-side JS (`aem.js`, `scripts.js`) will decorate the raw source HTML
 * in the browser — no server-side rendering needed.
 *
 * @param sourceHtml - The DA source HTML (pre-decoration)
 * @param proxyBasePath - Same-origin proxy path (e.g. /api/content/proj-x/aem-proxy)
 */
export function buildSelfRenderedPage(sourceHtml: string, proxyBasePath: string): string {
  // Extract inner content (strip <html>/<body>/<main> wrappers from DA source)
  const innerContent = stripDecorationArtifacts(extractMainContent(sourceHtml));
  // Wrap DA source into section divs (mimics AEM server-side rendering)
  const sectionWrapped = wrapInSectionDivs(innerContent);
  // Rewrite root-relative URLs in the source HTML to go through the proxy
  const rewrittenSource = rewriteRootRelativeUrls(sectionWrapped, proxyBasePath);

  const fetchInterceptor = buildFetchInterceptor(proxyBasePath);
  const bridgeScript = buildBridgeScript(sourceHtml);

  return `<!DOCTYPE html>
<html>
<head>
  ${fetchInterceptor}
  <base href="${proxyBasePath}/">
  <script src="${proxyBasePath}/scripts/aem.js" type="module"></script>
  <script src="${proxyBasePath}/scripts/scripts.js" type="module"></script>
  <link rel="stylesheet" href="${proxyBasePath}/styles/styles.css">
  <style>
    body { display: block !important; visibility: visible !important; }
    header, footer { display: block; }
  </style>
</head>
<body class="appear">
  <header></header>
  <main>${rewrittenSource}</main>
  <footer></footer>
  ${bridgeScript}
</body>
</html>`;
}

/**
 * Build a standalone preview page from DA source HTML + AEM site-level CSS/JS.
 *
 * Same as `buildSelfRenderedPage` but WITHOUT the editing bridge script.
 * Used for the "Preview" button that opens a new tab — read-only, no editing.
 *
 * @param sourceHtml - The DA source HTML (pre-decoration)
 * @param proxyBasePath - Same-origin proxy path (e.g. /api/content/proj-x/aem-proxy)
 */
export function buildStandalonePreviewPage(sourceHtml: string, proxyBasePath: string): string {
  const innerContent = stripDecorationArtifacts(extractMainContent(sourceHtml));
  const sectionWrapped = wrapInSectionDivs(innerContent);
  const rewrittenSource = rewriteRootRelativeUrls(sectionWrapped, proxyBasePath);
  const fetchInterceptor = buildFetchInterceptor(proxyBasePath);

  return `<!DOCTYPE html>
<html>
<head>
  ${fetchInterceptor}
  <base href="${proxyBasePath}/">
  <script src="${proxyBasePath}/scripts/aem.js" type="module"></script>
  <script src="${proxyBasePath}/scripts/scripts.js" type="module"></script>
  <link rel="stylesheet" href="${proxyBasePath}/styles/styles.css">
  <style>
    body { display: block !important; visibility: visible !important; }
    header, footer { display: block; }
  </style>
</head>
<body class="appear">
  <header></header>
  <main>${rewrittenSource}</main>
  <footer></footer>
</body>
</html>`;
}

/**
 * Build a standalone preview from an AEM-rendered page (no bridge script).
 *
 * @param renderedHtml - The fully rendered HTML from AEM Edge Delivery
 * @param proxyBasePath - Same-origin proxy path
 * @param aemBaseUrl - The AEM base URL
 */
export function buildStandalonePreviewFromAem(
  renderedHtml: string,
  proxyBasePath: string,
  aemBaseUrl: string,
): string {
  let html = renderedHtml;

  html = html.replace(/<body([^>]*)>/i, (_match, attrs: string) => {
    if (/class=["']/.test(attrs)) {
      return `<body${attrs.replace(/class=["']([^"']*)["']/, 'class="$1 appear"')}>`;
    }
    return `<body${attrs} class="appear">`;
  });
  html = html.replace(/\s+nonce=["'][^"']*["']/gi, '');

  html = rewriteRootRelativeUrls(html, proxyBasePath);

  const baseTag = `<base href="${proxyBasePath}/">`;
  if (html.includes('<head>')) {
    html = html.replace('<head>', `<head>\n${baseTag}`);
  } else if (html.includes('<HEAD>')) {
    html = html.replace('<HEAD>', `<HEAD>\n${baseTag}`);
  }

  const overrideStyles = `<style>body { display: block !important; visibility: visible !important; } header, footer { display: block; }</style>`;
  html = html.replace('</head>', `${overrideStyles}\n</head>`);

  const fetchInterceptor = buildFetchInterceptor(proxyBasePath);
  html = html.replace('</head>', `${fetchInterceptor}\n</head>`);

  html = html.replace(
    /<meta\s+http-equiv=["']Content-Security-Policy["'][^>]*>/gi,
    '',
  );

  return html;
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
    <p>Try saving the page in Source mode, then switch back to Visual.</p>
  </div>
  <script>
    window.parent.postMessage({ type: 'bridge:ready' }, window.location.origin);
  </script>
</body>
</html>`;
}
