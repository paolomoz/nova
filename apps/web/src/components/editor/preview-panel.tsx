import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { Monitor, Tablet, Smartphone, ExternalLink, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PreviewPanelProps {
  previewUrl: string | null;
  onRefresh?: () => void;
}

type Viewport = 'desktop' | 'tablet' | 'mobile';

const viewportWidths: Record<Viewport, number> = {
  desktop: 1440,
  tablet: 768,
  mobile: 375,
};

const viewportIcons: Record<Viewport, React.ComponentType<{ className?: string }>> = {
  desktop: Monitor,
  tablet: Tablet,
  mobile: Smartphone,
};

export function PreviewPanel({ previewUrl, onRefresh }: PreviewPanelProps) {
  const [viewport, setViewport] = useState<Viewport>('desktop');
  const [key, setKey] = useState(0);

  const handleRefresh = () => {
    setKey((k) => k + 1);
    onRefresh?.();
  };

  if (!previewUrl) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <Monitor className="h-12 w-12 text-muted-foreground/30" />
        <div>
          <p className="text-sm font-medium">No preview available</p>
          <p className="text-xs text-muted-foreground mt-1">
            Save and preview the page to see it here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <TooltipProvider delayDuration={300}>
        <div className="flex items-center justify-between border-b px-3 py-1.5">
          <div className="flex items-center gap-1">
            {(Object.keys(viewportWidths) as Viewport[]).map((vp) => {
              const Icon = viewportIcons[vp];
              return (
                <Tooltip key={vp}>
                  <TooltipTrigger asChild>
                    <Button
                      variant={viewport === vp ? 'secondary' : 'ghost'}
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setViewport(vp)}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{vp} ({viewportWidths[vp]}px)</p>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>

          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground">{viewportWidths[viewport]}px</span>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleRefresh}>
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => window.open(previewUrl, '_blank')}
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </TooltipProvider>

      <div className="flex-1 overflow-auto bg-muted/30 p-4">
        <div
          className={cn('mx-auto bg-background shadow-lg transition-all duration-300')}
          style={{
            width: viewport === 'desktop' ? '100%' : `${viewportWidths[viewport]}px`,
            maxWidth: '100%',
            height: '100%',
          }}
        >
          <iframe
            key={key}
            src={previewUrl}
            className="h-full w-full border-0"
            title="Page Preview"
            sandbox="allow-scripts allow-same-origin"
          />
        </div>
      </div>
    </div>
  );
}
