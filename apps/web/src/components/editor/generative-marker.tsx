import type { Editor } from '@tiptap/react';
import { Button } from '@/components/ui/button';
import { Sparkles } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface GenerativeMarkerProps {
  editor: Editor | null;
}

/**
 * Generative zone marker — allows marking blocks as "generative",
 * meaning AI will fill/regenerate them at runtime on the edge.
 *
 * Visual indicators:
 * - Dashed primary-colored border around generative blocks
 * - "Generative" badge in the top-right
 * - Sparkle icon in the toolbar
 */
export function GenerativeMarker({ editor }: GenerativeMarkerProps) {
  if (!editor) return null;

  const toggleGenerativeZone = () => {
    // Find the current block node and toggle its generative attribute
    const { from } = editor.state.selection;
    const resolvedPos = editor.state.doc.resolve(from);

    // Walk up to find an edsBlock node
    for (let depth = resolvedPos.depth; depth >= 0; depth--) {
      const node = resolvedPos.node(depth);
      if (node.type.name === 'edsBlock') {
        const pos = resolvedPos.before(depth);
        editor
          .chain()
          .focus()
          .command(({ tr }) => {
            tr.setNodeMarkup(pos, undefined, {
              ...node.attrs,
              isGenerative: !node.attrs.isGenerative,
            });
            return true;
          })
          .run();
        return;
      }
    }

    // If no EDS block found, wrap selection in a generative div
    const html = `<div class="generative-zone" data-generative="true"><p>AI-generated content will appear here at runtime.</p></div>`;
    editor.chain().focus().insertContent(html).run();
  };

  // Check if current selection is in a generative block
  const isInGenerativeBlock = (() => {
    if (!editor) return false;
    const { from } = editor.state.selection;
    const resolvedPos = editor.state.doc.resolve(from);
    for (let depth = resolvedPos.depth; depth >= 0; depth--) {
      const node = resolvedPos.node(depth);
      if (node.type.name === 'edsBlock' && node.attrs.isGenerative) {
        return true;
      }
    }
    return false;
  })();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant={isInGenerativeBlock ? 'default' : 'outline'}
          size="sm"
          className="h-8 text-xs"
        >
          <Sparkles className="mr-1 h-3.5 w-3.5" />
          Generative
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64">
        <div className="space-y-3">
          <div>
            <h4 className="text-sm font-medium">Generative Zone</h4>
            <p className="text-xs text-muted-foreground mt-1">
              Mark this block as generative. AI will dynamically generate its content at the edge based on visitor context.
            </p>
          </div>

          <Button
            variant={isInGenerativeBlock ? 'destructive' : 'default'}
            size="sm"
            className="w-full"
            onClick={toggleGenerativeZone}
          >
            <Sparkles className="mr-1 h-3.5 w-3.5" />
            {isInGenerativeBlock ? 'Remove Generative Zone' : 'Mark as Generative'}
          </Button>

          {isInGenerativeBlock && (
            <p className="text-xs text-muted-foreground">
              This block will be replaced with AI-generated content based on visitor signals, brand profile, and content value scores.
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
