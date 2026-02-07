import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Underline from '@tiptap/extension-underline';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import Placeholder from '@tiptap/extension-placeholder';
import { useCallback, useEffect, useState } from 'react';
import { SlashCommand } from './extensions/slash-command';
import { SlashCommandMenu } from './ai-menu';

interface BlockEditorProps {
  content: string;
  onUpdate: (html: string) => void;
  editable?: boolean;
}

export function BlockEditor({ content, onUpdate, editable = true }: BlockEditorProps) {
  const [slashCommand, setSlashCommand] = useState<{
    query: string;
    from: number;
    to: number;
  } | null>(null);

  const handleSlashActivate = useCallback(
    (props: { query: string; from: number; to: number }) => {
      setSlashCommand(props);
    },
    [],
  );

  const handleSlashDeactivate = useCallback(() => {
    setSlashCommand(null);
  }, []);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4, 5, 6] },
        horizontalRule: {},
      }),
      Image.configure({ inline: false, allowBase64: true }),
      Underline,
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      Placeholder.configure({
        placeholder: ({ node }) => {
          if (node.type.name === 'heading') return 'Heading...';
          return 'Type "/" for commands, or start writing...';
        },
      }),
      SlashCommand.configure({
        onActivate: handleSlashActivate,
        onDeactivate: handleSlashDeactivate,
      }),
    ],
    content,
    editable,
    onUpdate: ({ editor }) => {
      onUpdate(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'nova-editor prose prose-sm sm:prose-base max-w-none focus:outline-none min-h-[500px] px-8 py-6',
      },
      handleDrop: (view, event, _slice, moved) => {
        // Handle block drops from the block browser
        if (!moved && event.dataTransfer) {
          const blockData = event.dataTransfer.getData('application/x-eds-block');
          if (blockData) {
            event.preventDefault();
            try {
              const { structure } = JSON.parse(blockData);
              if (structure) {
                const pos = view.posAtCoords({ left: event.clientX, top: event.clientY });
                if (pos) {
                  // Insert the block HTML at the drop position
                  editor?.chain().focus().insertContentAt(pos.pos, structure).run();
                }
              }
            } catch {
              // Ignore malformed data
            }
            return true;
          }
        }
        return false;
      },
    },
  });

  // Update content when prop changes (e.g., loading a new page)
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  const handleSlashSelect = useCallback(
    (html: string) => {
      if (!editor || !slashCommand) return;
      // Replace the slash command text with the selected content
      editor
        .chain()
        .focus()
        .deleteRange({ from: slashCommand.from, to: slashCommand.to })
        .insertContent(html)
        .run();
      setSlashCommand(null);
    },
    [editor, slashCommand],
  );

  if (!editor) return null;

  return (
    <div className="relative">
      {/* EDS Block visual overlays */}
      <style>{`
        .nova-editor .ProseMirror {
          min-height: 500px;
        }
        .nova-editor .ProseMirror > * + * {
          margin-top: 0.75em;
        }
        .nova-editor .ProseMirror hr {
          border: none;
          border-top: 2px dashed var(--border);
          margin: 2rem 0;
          position: relative;
        }
        .nova-editor .ProseMirror hr::after {
          content: 'Section Break';
          position: absolute;
          top: -0.75em;
          left: 50%;
          transform: translateX(-50%);
          background: var(--background, #fff);
          padding: 0 0.5rem;
          font-size: 0.7rem;
          color: var(--muted-foreground);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .nova-editor .ProseMirror img {
          max-width: 100%;
          height: auto;
          border-radius: 0.5rem;
        }
        .nova-editor .ProseMirror p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: var(--muted-foreground);
          pointer-events: none;
          height: 0;
        }
        .nova-editor .ProseMirror table {
          border-collapse: collapse;
          width: 100%;
        }
        .nova-editor .ProseMirror td,
        .nova-editor .ProseMirror th {
          border: 1px solid var(--border);
          padding: 0.5rem;
          min-width: 100px;
        }
        .nova-editor .ProseMirror th {
          background: var(--muted);
          font-weight: 600;
        }
        .nova-editor [data-eds-block] {
          border: 1px dashed var(--border);
          border-radius: 0.5rem;
          padding: 1rem;
          margin: 1rem 0;
          position: relative;
        }
        .nova-editor [data-eds-block]::before {
          content: attr(data-eds-block);
          position: absolute;
          top: -0.75em;
          left: 0.75rem;
          background: var(--background, #fff);
          padding: 0 0.375rem;
          font-size: 0.65rem;
          font-weight: 600;
          text-transform: uppercase;
          color: var(--primary);
          letter-spacing: 0.05em;
        }
        .nova-editor [data-generative="true"] {
          border-color: var(--primary);
          border-style: dashed;
        }
        .nova-editor [data-generative="true"]::after {
          content: '✦ Generative';
          position: absolute;
          top: -0.75em;
          right: 0.75rem;
          background: var(--background, #fff);
          padding: 0 0.375rem;
          font-size: 0.6rem;
          color: var(--primary);
        }
      `}</style>

      <EditorContent editor={editor} />

      {/* Slash command menu */}
      {slashCommand && (
        <SlashCommandMenu
          query={slashCommand.query}
          onSelect={handleSlashSelect}
          onClose={handleSlashDeactivate}
        />
      )}
    </div>
  );
}

export { useEditor } from '@tiptap/react';
export type { BlockEditorProps };
