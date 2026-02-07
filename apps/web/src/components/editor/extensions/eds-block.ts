import { Node, mergeAttributes } from '@tiptap/core';

/**
 * EDS Block node extension for TipTap.
 *
 * Represents an Edge Delivery Services block. In EDS, blocks are `<div>` elements
 * with class names that define the block type and variants:
 *   <div class="hero dark">
 *     <div><div>...</div><div>...</div></div>  ← row with cells
 *   </div>
 *
 * This node wraps the block content and tracks the block name + variants as attributes.
 * Block content (rows/cells) is treated as generic editable content.
 */

export interface EDSBlockAttributes {
  blockName: string;
  variants: string;
  isGenerative: boolean;
}

export const EDSBlock = Node.create({
  name: 'edsBlock',
  group: 'block',
  content: 'block+',
  defining: true,

  addAttributes() {
    return {
      blockName: {
        default: '',
        parseHTML: (element) => {
          // First class is the block name, rest are variants
          const classes = Array.from(element.classList);
          return classes[0] || '';
        },
      },
      variants: {
        default: '',
        parseHTML: (element) => {
          const classes = Array.from(element.classList);
          return classes.slice(1).join(' ');
        },
      },
      isGenerative: {
        default: false,
        parseHTML: (element) => element.dataset.generative === 'true',
        renderHTML: (attributes) => {
          if (!attributes.isGenerative) return {};
          return { 'data-generative': 'true' };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div',
        getAttrs: (dom) => {
          const element = dom as HTMLElement;
          // Match divs that have a class matching known EDS block patterns
          // Exclude generic wrappers (no class, or only utility classes)
          const className = element.getAttribute('class') || '';
          if (!className) return false;

          // EDS blocks have semantic class names (not utility classes)
          const blockName = className.split(' ')[0];
          // Skip generic wrappers and section-level elements
          if (['section', 'wrapper', 'container'].includes(blockName)) return false;

          // Check if this looks like a block (has child divs as rows)
          const hasRows = element.querySelector(':scope > div');
          if (!hasRows) return false;

          return {};
        },
        priority: 60,
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const blockName = HTMLAttributes.blockName || '';
    const variants = HTMLAttributes.variants || '';
    const classes = [blockName, variants].filter(Boolean).join(' ');

    // Remove our custom attributes from the rendered output
    const { blockName: _bn, variants: _v, isGenerative, ...rest } = HTMLAttributes;

    return [
      'div',
      mergeAttributes(rest, {
        class: classes,
        ...(isGenerative ? { 'data-generative': 'true' } : {}),
      }),
      0,
    ];
  },

  addNodeView() {
    return ({ node, HTMLAttributes }) => {
      const dom = document.createElement('div');
      const blockName = node.attrs.blockName || 'block';
      const variants = node.attrs.variants || '';
      const classes = [blockName, variants].filter(Boolean).join(' ');
      dom.className = classes;

      // Add editor-only visual affordances
      dom.setAttribute('data-eds-block', blockName);
      if (node.attrs.isGenerative) {
        dom.setAttribute('data-generative', 'true');
      }

      const contentDOM = document.createElement('div');
      contentDOM.className = 'eds-block-content';
      dom.appendChild(contentDOM);

      return { dom, contentDOM };
    };
  },
});

/**
 * EDS Section Break — maps to <hr> which separates sections in EDS content.
 * TipTap's StarterKit already includes HorizontalRule, so we just re-use that.
 */

/**
 * EDS Block Row — represents a row within a block.
 * In EDS: <div class="block-name"> > <div> (row) > <div> (cells)
 */
export const EDSBlockRow = Node.create({
  name: 'edsBlockRow',
  group: 'block',
  content: 'edsBlockCell+',

  parseHTML() {
    return [
      {
        tag: 'div',
        getAttrs: (dom) => {
          const element = dom as HTMLElement;
          // A row is a direct child div of a block, containing cell divs
          const parent = element.parentElement;
          if (!parent) return false;
          const parentClass = parent.getAttribute('class') || '';
          if (!parentClass) return false;
          // Check if parent looks like a block (has a semantic class name)
          const hasCellChildren = element.querySelector(':scope > div');
          if (!hasCellChildren) return false;
          return {};
        },
        priority: 50,
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes), 0];
  },
});

/**
 * EDS Block Cell — represents a cell within a block row.
 * Contains rich content (paragraphs, headings, images, links, etc.)
 */
export const EDSBlockCell = Node.create({
  name: 'edsBlockCell',
  group: 'block',
  content: 'block+',

  parseHTML() {
    return [
      {
        tag: 'div',
        priority: 40,
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes), 0];
  },
});
