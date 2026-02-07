import { useState } from 'react';
import { api } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { X, Save, Loader2 } from 'lucide-react';

interface BlockMetadataEditorProps {
  projectId: string;
  blockName: string;
  onClose: () => void;
}

interface BlockMetadata {
  whenToUse: string;
  dataRequirements: string;
  guardrails: string;
  audienceFit: string[];
  engagementWeight: number;
  conversionWeight: number;
}

export function BlockMetadataEditor({ projectId, blockName, onClose }: BlockMetadataEditorProps) {
  const [metadata, setMetadata] = useState<BlockMetadata>({
    whenToUse: '',
    dataRequirements: '',
    guardrails: '',
    audienceFit: [],
    engagementWeight: 0.5,
    conversionWeight: 0.5,
  });
  const [audienceInput, setAudienceInput] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.updateBlockMetadata(projectId, {
        name: blockName,
        generativeConfig: {
          when_to_use: metadata.whenToUse,
          data_requirements: metadata.dataRequirements,
          guardrails: metadata.guardrails,
        },
        valueMetadata: {
          audience_fit: metadata.audienceFit,
          engagement_weight: metadata.engagementWeight,
          conversion_weight: metadata.conversionWeight,
        },
      });
    } catch {
      // Handle error
    } finally {
      setSaving(false);
    }
  };

  const addAudience = () => {
    if (audienceInput.trim() && !metadata.audienceFit.includes(audienceInput.trim())) {
      setMetadata((prev) => ({
        ...prev,
        audienceFit: [...prev.audienceFit, audienceInput.trim()],
      }));
      setAudienceInput('');
    }
  };

  const removeAudience = (value: string) => {
    setMetadata((prev) => ({
      ...prev,
      audienceFit: prev.audienceFit.filter((a) => a !== value),
    }));
  };

  return (
    <div className="flex h-full w-72 flex-col border-l">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold">Block Metadata</h3>
          <p className="text-xs text-muted-foreground">{blockName}</p>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-4 p-4">
          {/* Generative Config */}
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase">Generative Config</h4>

            <div className="mt-2 space-y-3">
              <div>
                <label className="text-xs font-medium">When to Use</label>
                <textarea
                  value={metadata.whenToUse}
                  onChange={(e) => setMetadata((prev) => ({ ...prev, whenToUse: e.target.value }))}
                  placeholder="Describe when this block should be selected by the AI..."
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  rows={3}
                />
              </div>

              <div>
                <label className="text-xs font-medium">Data Requirements</label>
                <textarea
                  value={metadata.dataRequirements}
                  onChange={(e) => setMetadata((prev) => ({ ...prev, dataRequirements: e.target.value }))}
                  placeholder="What data does this block need? (e.g., images, product data, testimonials)"
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  rows={3}
                />
              </div>

              <div>
                <label className="text-xs font-medium">Guardrails</label>
                <textarea
                  value={metadata.guardrails}
                  onChange={(e) => setMetadata((prev) => ({ ...prev, guardrails: e.target.value }))}
                  placeholder="Constraints on AI generation (e.g., max items, required fields, tone)"
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  rows={3}
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Value Metadata */}
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase">Value Metadata</h4>

            <div className="mt-2 space-y-3">
              <div>
                <label className="text-xs font-medium">Audience Fit</label>
                <div className="mt-1 flex flex-wrap gap-1">
                  {metadata.audienceFit.map((a) => (
                    <Badge key={a} variant="secondary" className="text-xs">
                      {a}
                      <button className="ml-1" onClick={() => removeAudience(a)}>
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <div className="mt-1 flex gap-1">
                  <Input
                    value={audienceInput}
                    onChange={(e) => setAudienceInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') addAudience(); }}
                    placeholder="e.g. developers"
                    className="h-7 text-xs"
                  />
                  <Button variant="outline" size="sm" className="h-7 text-xs shrink-0" onClick={addAudience}>
                    Add
                  </Button>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium">Engagement Weight</label>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.1}
                  value={metadata.engagementWeight}
                  onChange={(e) => setMetadata((prev) => ({ ...prev, engagementWeight: parseFloat(e.target.value) }))}
                  className="mt-1 w-full"
                />
                <div className="flex justify-between text-[0.6rem] text-muted-foreground">
                  <span>Low</span>
                  <span>{metadata.engagementWeight.toFixed(1)}</span>
                  <span>High</span>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium">Conversion Weight</label>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.1}
                  value={metadata.conversionWeight}
                  onChange={(e) => setMetadata((prev) => ({ ...prev, conversionWeight: parseFloat(e.target.value) }))}
                  className="mt-1 w-full"
                />
                <div className="flex justify-between text-[0.6rem] text-muted-foreground">
                  <span>Low</span>
                  <span>{metadata.conversionWeight.toFixed(1)}</span>
                  <span>High</span>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          <Button className="w-full" size="sm" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1 h-3.5 w-3.5" />}
            Save Metadata
          </Button>
        </div>
      </ScrollArea>
    </div>
  );
}
