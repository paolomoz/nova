interface BlockPreviewProps {
  previewHtml?: string;
  previewUrl?: string;
  className?: string;
}

export function BlockPreview({ previewHtml, previewUrl, className = '' }: BlockPreviewProps) {
  const src = previewUrl && !previewHtml ? previewUrl : undefined;

  return (
    <div className={`rounded-lg border bg-white overflow-hidden ${className}`}>
      <iframe
        srcDoc={previewHtml}
        src={src}
        className="w-full h-full min-h-[300px] border-0"
        sandbox="allow-scripts"
        title="Block Preview"
      />
    </div>
  );
}
