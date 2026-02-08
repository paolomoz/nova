import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import ImageExt from '@tiptap/extension-image';
import UnderlineExt from '@tiptap/extension-underline';
import TableExt from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import Placeholder from '@tiptap/extension-placeholder';
import { api } from '@/lib/api';
import { useProject } from '@/lib/project';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { EditorToolbar } from '@/components/editor/editor-toolbar';
import { BlockBrowser } from '@/components/editor/block-browser';
import { ContentTree } from '@/components/editor/content-tree';
import { PreviewPanel } from '@/components/editor/preview-panel';
import { AssetBrowser } from '@/components/editor/asset-browser';
import { GenerativeMarker } from '@/components/editor/generative-marker';
import { BlockMetadataEditor } from '@/components/editor/block-metadata-editor';
import { AIBlockActions } from '@/components/editor/ai-block-actions';
import { SlashCommand } from '@/components/editor/extensions/slash-command';
import { SlashCommandMenu } from '@/components/editor/ai-menu';
import { WysiwygEditor, type WysiwygEditorHandle } from '@/components/editor/wysiwyg-editor';
import {
  Save, Eye, Globe, Loader2, ChevronLeft,
  PanelLeftClose, PanelLeftOpen, PanelRightClose,
  LayoutGrid, FileText, Image, Settings2, Code, Monitor,
} from 'lucide-react';

type EditorMode = 'visual' | 'source';
type LeftPanel = 'tree' | 'blocks';
type RightPanel = 'preview' | 'assets' | 'metadata';

export function EditorPage() {
  const [searchParams] = useSearchParams();
  const { activeProjectId: projectId, loadProjects, loading: projectsLoading } = useProject();
  const pagePath = searchParams.get('path') || '';

  // Ensure projects are loaded (handles direct navigation to editor)
  useEffect(() => {
    if (!projectId) {
      loadProjects();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Editor mode
  const [editorMode, setEditorMode] = useState<EditorMode>('visual');
  const wysiwygRef = useRef<WysiwygEditorHandle>(null);

  // Editor state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  // Key to force iframe reload when switching back to visual after save
  const [wysiwygKey, setWysiwygKey] = useState(0);

  // Panel state
  const [leftPanelOpen, setLeftPanelOpen] = useState(true);
  const [rightPanelOpen, setRightPanelOpen] = useState(false);
  const [leftPanel, setLeftPanel] = useState<LeftPanel>('blocks');
  const [rightPanel, setRightPanel] = useState<RightPanel>('preview');
  const [metadataBlock, setMetadataBlock] = useState<string | null>(null);

  // Slash command state
  const [slashCommand, setSlashCommand] = useState<{
    query: string;
    from: number;
    to: number;
  } | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4, 5, 6] },
      }),
      ImageExt.configure({ inline: false, allowBase64: true }),
      UnderlineExt,
      TableExt.configure({ resizable: true }),
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
        onActivate: (props) => setSlashCommand(props),
        onDeactivate: () => setSlashCommand(null),
      }),
    ],
    content: '',
    onUpdate: () => {
      setDirty(true);
    },
    editorProps: {
      attributes: {
        class: 'nova-editor prose prose-sm sm:prose-base max-w-none focus:outline-none min-h-[500px] px-8 py-6',
      },
    },
  });

  // Load page content (for Source mode / TipTap)
  useEffect(() => {
    if (!projectId || !pagePath) {
      setLoading(false);
      return;
    }

    setLoading(true);
    api.getPageSource(projectId, pagePath).then((data) => {
      if (editor) {
        editor.commands.setContent(data.content);
      }
      setDirty(false);
      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });
  }, [projectId, pagePath, editor]);

  // Auto-trigger preview warmup on page load (so Visual mode has content)
  useEffect(() => {
    if (!projectId || !pagePath) return;
    api.previewPage(projectId, pagePath).catch(() => {
      // Non-fatal: preview warmup failure is fine
    });
  }, [projectId, pagePath]);

  // Save — works for both modes
  const handleSave = useCallback(async () => {
    if (!projectId || !pagePath) return;
    setSaving(true);
    try {
      let html: string;
      if (editorMode === 'visual' && wysiwygRef.current) {
        html = await wysiwygRef.current.getContent();
      } else if (editor) {
        html = editor.getHTML();
      } else {
        return;
      }
      await api.createPage(projectId, pagePath, html);
      setDirty(false);
      setLastSaved(new Date());
    } catch {
      // Handle error
    } finally {
      setSaving(false);
    }
  }, [editor, editorMode, projectId, pagePath]);

  // Keyboard shortcut: Cmd+S to save
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [handleSave]);

  // Mode switch
  const handleModeSwitch = useCallback(async (newMode: EditorMode) => {
    if (newMode === editorMode) return;

    // Save first if dirty
    if (dirty) {
      await handleSave();
    }

    if (newMode === 'source' && projectId && pagePath) {
      // Reload source content into TipTap
      try {
        const data = await api.getPageSource(projectId, pagePath);
        if (editor) {
          editor.commands.setContent(data.content);
        }
      } catch {
        // Keep existing content
      }
    }

    if (newMode === 'visual') {
      // Force iframe reload to pick up any source changes
      setWysiwygKey((k) => k + 1);
    }

    setEditorMode(newMode);
    setDirty(false);
  }, [editorMode, dirty, handleSave, projectId, pagePath, editor]);

  // Preview
  const handlePreview = async () => {
    if (!projectId || !pagePath) return;
    if (dirty) await handleSave();
    try {
      const result = await api.previewPage(projectId, pagePath);
      setPreviewUrl(result.url);
      setRightPanel('preview');
      setRightPanelOpen(true);
    } catch {
      // Handle error
    }
  };

  // Publish
  const handlePublish = async () => {
    if (!projectId || !pagePath) return;
    if (dirty) await handleSave();
    try {
      const result = await api.publishPage(projectId, pagePath);
      window.open(result.url, '_blank');
    } catch {
      // Handle error
    }
  };

  // Insert block
  const handleInsertBlock = (html: string) => {
    if (!editor) return;
    editor.chain().focus().insertContent(html).run();
  };

  // Insert image
  const handleInsertImage = (url: string, alt: string) => {
    if (!editor) return;
    editor.chain().focus().setImage({ src: url, alt }).run();
  };

  // Slash command select
  const handleSlashSelect = useCallback(
    (html: string) => {
      if (!editor || !slashCommand) return;
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

  // Loading projects
  if (projectsLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Empty state — no page selected
  if (!pagePath) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <FileText className="h-16 w-16 text-muted-foreground/20" />
        <div className="text-center">
          <h2 className="text-xl font-semibold">No page selected</h2>
          <p className="mt-2 text-muted-foreground">
            Open a page from the Sites Console to start editing.
          </p>
        </div>
        <Button variant="outline" onClick={() => { window.location.href = '/sites'; }}>
          <ChevronLeft className="mr-1 h-4 w-4" /> Go to Sites
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Editor Header */}
      <div className="flex items-center justify-between border-b px-4 py-2">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" className="h-8" onClick={() => { window.location.href = '/sites'; }}>
            <ChevronLeft className="mr-1 h-4 w-4" />
            Sites
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <span className="text-sm font-mono text-muted-foreground">{pagePath}</span>
          {dirty && <span className="text-xs text-amber-500">(unsaved)</span>}
          {lastSaved && !dirty && (
            <span className="text-xs text-muted-foreground">
              Saved {lastSaved.toLocaleTimeString()}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Visual / Source toggle */}
          <Tabs value={editorMode} onValueChange={(v) => handleModeSwitch(v as EditorMode)}>
            <TabsList className="h-8">
              <TabsTrigger value="visual" className="h-7 text-xs px-2.5 gap-1">
                <Monitor className="h-3 w-3" /> Visual
              </TabsTrigger>
              <TabsTrigger value="source" className="h-7 text-xs px-2.5 gap-1">
                <Code className="h-3 w-3" /> Source
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <Separator orientation="vertical" className="h-6" />

          {editorMode === 'source' && projectId && <GenerativeMarker editor={editor} />}
          {editorMode === 'source' && projectId && <AIBlockActions editor={editor} projectId={projectId} />}

          <Button
            variant="outline"
            size="sm"
            className="h-8"
            onClick={handleSave}
            disabled={saving || !dirty}
          >
            {saving ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1 h-3.5 w-3.5" />}
            Save
          </Button>
          <Button variant="outline" size="sm" className="h-8" onClick={handlePreview}>
            <Eye className="mr-1 h-3.5 w-3.5" />
            Preview
          </Button>
          <Button size="sm" className="h-8" onClick={handlePublish}>
            <Globe className="mr-1 h-3.5 w-3.5" />
            Publish
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar — only in Source mode (Outline needs TipTap) or Blocks tab */}
        {leftPanelOpen && projectId && (editorMode === 'source' || leftPanel === 'blocks') && (
          <div className="flex w-64 shrink-0 flex-col border-r">
            <div className="flex items-center justify-between border-b px-2 py-1">
              <Tabs value={leftPanel} onValueChange={(v) => setLeftPanel(v as LeftPanel)}>
                <TabsList className="h-8">
                  {editorMode === 'source' && (
                    <TabsTrigger value="tree" className="h-7 text-xs px-2">
                      <FileText className="mr-1 h-3 w-3" /> Outline
                    </TabsTrigger>
                  )}
                  <TabsTrigger value="blocks" className="h-7 text-xs px-2">
                    <LayoutGrid className="mr-1 h-3 w-3" /> Blocks
                  </TabsTrigger>
                </TabsList>
              </Tabs>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setLeftPanelOpen(false)}>
                <PanelLeftClose className="h-3.5 w-3.5" />
              </Button>
            </div>

            <div className="flex-1 overflow-hidden">
              {leftPanel === 'tree' && editorMode === 'source' && <ContentTree editor={editor} />}
              {leftPanel === 'blocks' && (
                <BlockBrowser projectId={projectId} onInsertBlock={handleInsertBlock} />
              )}
            </div>
          </div>
        )}

        {/* Toggle left sidebar */}
        {!leftPanelOpen && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute left-16 top-[7.5rem] z-10 h-8 w-8"
            onClick={() => setLeftPanelOpen(true)}
          >
            <PanelLeftOpen className="h-4 w-4" />
          </Button>
        )}

        {/* Main Editor Area */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {editorMode === 'source' && (
            <EditorToolbar
              editor={editor}
              onInsertBlock={() => {
                setLeftPanel('blocks');
                setLeftPanelOpen(true);
              }}
              onAIAction={() => {
                editor?.chain().focus().insertContent('/').run();
              }}
            />
          )}

          <div className="flex-1 overflow-auto relative">
            {editorMode === 'visual' && projectId ? (
              <WysiwygEditor
                key={wysiwygKey}
                ref={wysiwygRef}
                projectId={projectId}
                pagePath={pagePath}
                onDirty={() => setDirty(true)}
                onBlockSelected={(blockName) => {
                  setMetadataBlock(blockName);
                  setRightPanel('metadata');
                  setRightPanelOpen(true);
                }}
              />
            ) : loading ? (
              <div className="flex h-full items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <style>{`
                  .nova-editor .ProseMirror {
                    min-height: 500px;
                  }
                  .nova-editor .ProseMirror > * + * {
                    margin-top: 0.75em;
                  }
                  .nova-editor .ProseMirror hr {
                    border: none;
                    border-top: 2px dashed hsl(var(--border));
                    margin: 2rem 0;
                    position: relative;
                  }
                  .nova-editor .ProseMirror hr::after {
                    content: 'Section Break';
                    position: absolute;
                    top: -0.75em;
                    left: 50%;
                    transform: translateX(-50%);
                    background: hsl(var(--background));
                    padding: 0 0.5rem;
                    font-size: 0.7rem;
                    color: hsl(var(--muted-foreground));
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
                    color: hsl(var(--muted-foreground));
                    pointer-events: none;
                    height: 0;
                  }
                  .nova-editor .ProseMirror table {
                    border-collapse: collapse;
                    width: 100%;
                  }
                  .nova-editor .ProseMirror td,
                  .nova-editor .ProseMirror th {
                    border: 1px solid hsl(var(--border));
                    padding: 0.5rem;
                    min-width: 100px;
                  }
                  .nova-editor .ProseMirror th {
                    background: hsl(var(--muted));
                    font-weight: 600;
                  }
                `}</style>
                <EditorContent editor={editor} />

                {slashCommand && (
                  <SlashCommandMenu
                    query={slashCommand.query}
                    onSelect={handleSlashSelect}
                    onClose={() => setSlashCommand(null)}
                  />
                )}
              </>
            )}
          </div>
        </div>

        {/* Right Sidebar */}
        {rightPanelOpen && projectId && (
          <div className="flex w-80 shrink-0 flex-col border-l">
            <div className="flex items-center justify-between border-b px-2 py-1">
              <div className="flex gap-1">
                <Button
                  variant={rightPanel === 'preview' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setRightPanel('preview')}
                >
                  <Eye className="mr-1 h-3 w-3" /> Preview
                </Button>
                <Button
                  variant={rightPanel === 'assets' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setRightPanel('assets')}
                >
                  <Image className="mr-1 h-3 w-3" /> Assets
                </Button>
                <Button
                  variant={rightPanel === 'metadata' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setRightPanel('metadata')}
                >
                  <Settings2 className="mr-1 h-3 w-3" /> Meta
                </Button>
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setRightPanelOpen(false)}>
                <PanelRightClose className="h-3.5 w-3.5" />
              </Button>
            </div>

            <div className="flex-1 overflow-hidden">
              {rightPanel === 'preview' && (
                <PreviewPanel previewUrl={previewUrl} onRefresh={handlePreview} />
              )}
              {rightPanel === 'assets' && (
                <AssetBrowser projectId={projectId} onInsertImage={handleInsertImage} />
              )}
              {rightPanel === 'metadata' && metadataBlock && (
                <BlockMetadataEditor
                  projectId={projectId}
                  blockName={metadataBlock}
                  onClose={() => setMetadataBlock(null)}
                />
              )}
              {rightPanel === 'metadata' && !metadataBlock && (
                <div className="flex h-full items-center justify-center p-4">
                  <p className="text-xs text-muted-foreground text-center">
                    Select a block to edit its metadata and generative config.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Right sidebar collapsed toggle */}
        {!rightPanelOpen && (
          <div className="flex flex-col gap-1 border-l p-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setRightPanel('preview'); setRightPanelOpen(true); }} title="Preview">
              <Eye className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setRightPanel('assets'); setRightPanelOpen(true); }} title="Assets">
              <Image className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setRightPanel('metadata'); setRightPanelOpen(true); }} title="Block Metadata">
              <Settings2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
