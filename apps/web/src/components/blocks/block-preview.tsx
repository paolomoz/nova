import { useRef, useEffect } from 'react';

interface BlockPreviewProps {
  previewHtml?: string;
  previewUrl?: string;
  className?: string;
}

export function BlockPreview({ previewHtml, previewUrl, className = '' }: BlockPreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (previewHtml && iframeRef.current) {
      const doc = iframeRef.current.contentDocument;
      if (doc) {
        doc.open();
        doc.write(previewHtml);
        doc.close();
      }
    }
  }, [previewHtml]);

  const src = previewUrl && !previewHtml ? previewUrl : undefined;

  return (
    <div className={`rounded-lg border bg-white overflow-hidden ${className}`}>
      <iframe
        ref={iframeRef}
        src={src}
        className="w-full h-full min-h-[300px] border-0"
        sandbox="allow-scripts"
        title="Block Preview"
      />
    </div>
  );
}
