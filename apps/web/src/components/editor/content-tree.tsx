import { useEffect, useState, useCallback } from 'react';
import type { Editor } from '@tiptap/react';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Heading1, Heading2, Heading3, Type, Minus, Image,
  Table, LayoutGrid, List, Quote,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ContentTreeProps {
  editor: Editor | null;
}

interface TreeNode {
  id: string;
  type: string;
  text: string;
  level: number;
  pos: number;
  icon: React.ComponentType<{ className?: string }>;
}

const nodeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  heading: Heading1,
  paragraph: Type,
  horizontalRule: Minus,
  image: Image,
  table: Table,
  bulletList: List,
  orderedList: List,
  blockquote: Quote,
  edsBlock: LayoutGrid,
};

const headingIcons: Record<number, React.ComponentType<{ className?: string }>> = {
  1: Heading1,
  2: Heading2,
  3: Heading3,
};

export function ContentTree({ editor }: ContentTreeProps) {
  const [nodes, setNodes] = useState<TreeNode[]>([]);
  const [activePos, setActivePos] = useState<number | null>(null);

  const buildTree = useCallback(() => {
    if (!editor) return;

    const items: TreeNode[] = [];
    let idx = 0;

    editor.state.doc.descendants((node, pos) => {
      // Only show top-level and heading nodes
      if (node.type.name === 'heading') {
        const level = node.attrs.level || 1;
        items.push({
          id: `node-${idx++}`,
          type: 'heading',
          text: node.textContent || `Heading ${level}`,
          level,
          pos,
          icon: headingIcons[level] || Heading1,
        });
        return false; // don't descend
      }

      if (node.type.name === 'horizontalRule') {
        items.push({
          id: `node-${idx++}`,
          type: 'horizontalRule',
          text: '— Section Break —',
          level: 0,
          pos,
          icon: Minus,
        });
        return false;
      }

      if (node.type.name === 'image') {
        items.push({
          id: `node-${idx++}`,
          type: 'image',
          text: node.attrs.alt || 'Image',
          level: 0,
          pos,
          icon: Image,
        });
        return false;
      }

      if (node.type.name === 'table') {
        items.push({
          id: `node-${idx++}`,
          type: 'table',
          text: 'Table',
          level: 0,
          pos,
          icon: Table,
        });
        return false;
      }

      if (node.type.name === 'blockquote') {
        items.push({
          id: `node-${idx++}`,
          type: 'blockquote',
          text: node.textContent.slice(0, 40) || 'Blockquote',
          level: 0,
          pos,
          icon: Quote,
        });
        return false;
      }

      // Continue descending for doc and other wrapper nodes
      return true;
    });

    setNodes(items);
  }, [editor]);

  useEffect(() => {
    if (!editor) return;

    buildTree();

    // Rebuild on every update
    editor.on('update', buildTree);
    const handleSelectionUpdate = () => {
      const { from } = editor.state.selection;
      setActivePos(from);
    };
    editor.on('selectionUpdate', handleSelectionUpdate);

    return () => {
      editor.off('update', buildTree);
      editor.off('selectionUpdate', handleSelectionUpdate);
    };
  }, [editor, buildTree]);

  const scrollToNode = (pos: number) => {
    if (!editor) return;
    editor.chain().focus().setTextSelection(pos).run();
    // Scroll the editor to show the selected node
    const domAtPos = editor.view.domAtPos(pos);
    if (domAtPos.node instanceof HTMLElement) {
      domAtPos.node.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else if (domAtPos.node.parentElement) {
      domAtPos.node.parentElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="border-b px-3 py-2">
        <h3 className="text-xs font-semibold uppercase text-muted-foreground">Document Outline</h3>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-1">
          {nodes.length === 0 && (
            <p className="p-3 text-xs text-muted-foreground">
              Start writing to see the document outline.
            </p>
          )}

          {nodes.map((node) => {
            const Icon = node.icon;
            const isActive = activePos !== null && Math.abs(activePos - node.pos) < 20;
            const indent = node.type === 'heading' ? (node.level - 1) * 12 : 0;

            return (
              <button
                key={node.id}
                className={cn(
                  'flex w-full items-center gap-1.5 rounded-sm px-2 py-1 text-left text-xs hover:bg-muted transition-colors',
                  isActive && 'bg-accent text-accent-foreground',
                  node.type === 'horizontalRule' && 'opacity-60',
                )}
                style={{ paddingLeft: `${indent + 8}px` }}
                onClick={() => scrollToNode(node.pos)}
              >
                <Icon className="h-3 w-3 shrink-0 text-muted-foreground" />
                <span className={cn(
                  'truncate',
                  node.type === 'heading' && node.level === 1 && 'font-semibold',
                  node.type === 'heading' && node.level === 2 && 'font-medium',
                )}>
                  {node.text}
                </span>
              </button>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
