import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';

/**
 * Slash command extension for TipTap.
 * Detects "/" at the beginning of a line and emits an event for the UI to show a command menu.
 */

export interface SlashCommandOptions {
  onActivate: (props: { query: string; from: number; to: number }) => void;
  onDeactivate: () => void;
}

export const SlashCommand = Extension.create<SlashCommandOptions>({
  name: 'slashCommand',

  addOptions() {
    return {
      onActivate: () => {},
      onDeactivate: () => {},
    };
  },

  addProseMirrorPlugins() {
    const { onActivate, onDeactivate } = this.options;

    return [
      new Plugin({
        key: new PluginKey('slashCommand'),
        props: {
          handleKeyDown(view, event) {
            // Handle "/" key
            if (event.key === '/') {
              const { state } = view;
              const { $from } = state.selection;

              // Only trigger at the beginning of a line or on an empty line
              const textBefore = $from.parent.textContent.slice(0, $from.parentOffset);
              if (textBefore.trim() === '') {
                // Will be handled in the next transaction via appendTransaction
                return false;
              }
            }

            // Handle Escape to close
            if (event.key === 'Escape') {
              onDeactivate();
            }

            return false;
          },
        },

        view() {
          return {
            update(view) {
              const { state } = view;
              const { $from } = state.selection;
              const text = $from.parent.textContent;
              const offset = $from.parentOffset;

              // Check if we have a "/" at the start of the content
              const slashIndex = text.lastIndexOf('/', offset);
              if (slashIndex >= 0) {
                const textBeforeSlash = text.slice(0, slashIndex);
                if (textBeforeSlash.trim() === '') {
                  const query = text.slice(slashIndex + 1, offset);
                  // Only activate for short queries (not regular content with slashes)
                  if (query.length < 30 && !query.includes(' ')) {
                    const from = $from.start() + slashIndex;
                    const to = $from.start() + offset;
                    onActivate({ query, from, to });
                    return;
                  }
                }
              }

              onDeactivate();
            },
          };
        },
      }),
    ];
  },
});
