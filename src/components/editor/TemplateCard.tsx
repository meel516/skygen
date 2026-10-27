'use client';
import { VideoTemplate } from '@/lib/video/templates/template-definitions';
import { Button } from '@/components/ui/button';

interface TemplateCardProps {
  template: VideoTemplate & { previewUrl?: string };
  onSelect?: () => void;
  onUse?: () => void;
}
export function TemplateCard({ template, onSelect, onUse }: TemplateCardProps) {
  return <article className="overflow-hidden border border-border bg-card text-foreground">
    <div className="relative aspect-video bg-muted">
      {template.previewUrl ? <img src={template.previewUrl} alt={`${template.name} preview`} className="h-full w-full object-cover" /> : <div className="flex h-full flex-col justify-between p-5"><span className="studio-eyebrow">{template.category}</span><span className="font-serif text-4xl">{template.name.slice(0, 1)}</span><span className="text-xs text-muted-foreground">{template.videoMeta.aspectRatio} / {template.videoMeta.fps} fps</span></div>}
    </div>
    <div className="space-y-3 p-5"><h3 className="text-lg font-medium">{template.name}</h3><p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">{template.description}</p><p className="text-xs text-muted-foreground">{template.blocks.length} scenes · {template.requiredVariables.length} editable fields</p><div className="flex flex-wrap gap-2 pt-2"><Button variant="outline" onClick={onSelect}>Preview</Button><Button onClick={onUse}>Use template</Button></div></div>
  </article>;
}
