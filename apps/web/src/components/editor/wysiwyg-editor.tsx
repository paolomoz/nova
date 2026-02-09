import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useImperativeHandle,
  forwardRef,
} from 'react';
import { api } from '@/lib/api';
import { Loader2 } from 'lucide-react';

export interface WysiwygEditorHandle {
  getContent: () => Promise<string>;
}

interface WysiwygEditorProps {
  projectId: string;
  pagePath: string;
  onDirty?: () => void;
  onSave?: () => void;
  onBlockSelected?: (blockName: string) => void;
}

export const WysiwygEditor = forwardRef<WysiwygEditorHandle, WysiwygEditorProps>(
  function WysiwygEditor({ projectId, pagePath, onDirty, onSave, onBlockSelected }, ref) {
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const contentResolverRef = useRef<((content: string) => void) | null>(null);

    const iframeSrc = api.getWysiwygUrl(projectId, pagePath);

    // Listen for postMessage events from the bridge
    useEffect(() => {
      function handleMessage(e: MessageEvent) {
        if (e.origin !== window.location.origin) return;
        const msg = e.data;
        if (!msg || !msg.type) return;

        switch (msg.type) {
          case 'bridge:ready':
            setLoading(false);
            setError(null);
            break;
          case 'bridge:content-changed':
            onDirty?.();
            break;
          case 'bridge:block-selected':
            onBlockSelected?.(msg.blockName);
            break;
          case 'bridge:content-response':
            if (contentResolverRef.current) {
              contentResolverRef.current(msg.content);
              contentResolverRef.current = null;
            }
            break;
          case 'bridge:save':
            onSave?.();
            break;
        }
      }

      window.addEventListener('message', handleMessage);
      return () => window.removeEventListener('message', handleMessage);
    }, [onDirty, onSave, onBlockSelected]);

    // Reset loading state when path changes
    useEffect(() => {
      setLoading(true);
      setError(null);
    }, [projectId, pagePath]);

    // Timeout for loading
    useEffect(() => {
      if (!loading) return;
      const timer = setTimeout(() => {
        if (loading) {
          setError('Preview is taking longer than expected. Try refreshing the page.');
          setLoading(false);
        }
      }, 10000);
      return () => clearTimeout(timer);
    }, [loading]);

    // Expose getContent() to parent via ref
    const getContent = useCallback((): Promise<string> => {
      return new Promise((resolve, reject) => {
        const iframe = iframeRef.current;
        if (!iframe?.contentWindow) {
          reject(new Error('WYSIWYG iframe not available'));
          return;
        }

        contentResolverRef.current = resolve;
        iframe.contentWindow.postMessage(
          { type: 'bridge:request-content' },
          window.location.origin,
        );

        // Timeout if bridge doesn't respond
        setTimeout(() => {
          if (contentResolverRef.current) {
            contentResolverRef.current = null;
            reject(new Error('Content extraction timed out'));
          }
        }, 5000);
      });
    }, []);

    useImperativeHandle(ref, () => ({ getContent }), [getContent]);

    return (
      <div className="relative flex-1 h-full">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Loading visual editor...</span>
            </div>
          </div>
        )}

        {error && (
          <div className="absolute inset-x-0 top-0 z-10 bg-amber-50 border-b border-amber-200 px-4 py-2 text-sm text-amber-700">
            {error}
          </div>
        )}

        <iframe
          ref={iframeRef}
          src={iframeSrc}
          className="h-full w-full border-0"
          sandbox="allow-scripts allow-same-origin"
          title="Visual Editor"
        />
      </div>
    );
  },
);
