'use client';

import { useEffect, useState } from 'react';
import { ChipRow } from './ChipRow';
import { useWizardChatStore } from '@/store/wizard-chat-store';
import { FileText, Microphone, Palette, CaretDown, CaretUp, Sliders } from '@phosphor-icons/react';

interface TemplateItem { id: string; name: string; description?: string; category?: string }
interface VoiceItem { id: string; name: string; provider: string; gender?: string }
interface StyleItem { id: string; label: string; emoji: string }

export function SelectionChips() {
  const {
    selectedTemplateId, selectedVoiceId, selectedStyleId,
    setSelectedTemplate, setSelectedVoice, setSelectedStyle,
  } = useWizardChatStore();

  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [voices, setVoices] = useState<VoiceItem[]>([]);
  const [styles, setStyles] = useState<StyleItem[]>([]);
  const [loading, setLoading] = useState({ templates: true, voices: true, styles: true });
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetch('/api/templates').then(r => r.json())
      .then(d => setTemplates(Array.isArray(d) ? d : []))
      .catch(() => setTemplates([]))
      .finally(() => setLoading(s => ({ ...s, templates: false })));

    fetch('/api/voices').then(r => r.json())
      .then(d => {
        const all: VoiceItem[] = d.voices ?? d ?? [];
        setVoices(all.filter(v => v.provider === 'deepgram'));
      })
      .catch(() => setVoices([]))
      .finally(() => setLoading(s => ({ ...s, voices: false })));

    fetch('/api/visual-styles').then(r => r.json())
      .then(d => setStyles(Array.isArray(d) ? d : []))
      .catch(() => setStyles([]))
      .finally(() => setLoading(s => ({ ...s, styles: false })));
  }, []);

  // Count active selections
  const activeCount = [selectedTemplateId, selectedVoiceId, selectedStyleId].filter(Boolean).length;

  // Labels for the summary bar
  const selectedVoice = voices.find(v => v.id === selectedVoiceId);
  const selectedStyle = styles.find(s => s.id === selectedStyleId);
  const selectedTemplate = templates.find(t => t.id === selectedTemplateId);

  return (
    <div
      className="border-t"
      style={{ borderColor: 'rgba(255,255,255,0.06)' }}
    >
      {/* Summary bar — always visible */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 transition-colors"
        style={{ color: '#6B6B8A' }}
      >
        <div className="flex items-center gap-2">
          <Sliders weight="duotone" size={14} className="shrink-0" style={{ color: '#55556A' }} />
          <div className="flex items-center gap-1.5 flex-wrap">
            {activeCount === 0 ? (
              <span className="text-xs" style={{ color: '#55556A' }}>
                Configure template, voice &amp; style
              </span>
            ) : (
              <>
                {selectedTemplate && (
                  <ActivePill label={selectedTemplate.name} color="violet" />
                )}
                {selectedVoice && (
                  <ActivePill label={selectedVoice.name} color="cyan" />
                )}
                {selectedStyle && (
                  <ActivePill label={`${selectedStyle.emoji} ${selectedStyle.label}`} color="orange" />
                )}
              </>
            )}
          </div>
        </div>
        {open
          ? <CaretUp weight="bold" size={14} className="shrink-0" />
          : <CaretDown weight="bold" size={14} className="shrink-0" />
        }
      </button>

      {/* Expanded config panel */}
      {open && (
        <div
          className="px-4 pb-3 flex flex-col gap-0"
          style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}
        >
          {templates.length > 0 && (
            <ChipRow<TemplateItem>
              label="Template"
              icon={<FileText weight="duotone" size={14} />}
              items={templates}
              selectedId={selectedTemplateId}
              onSelect={(id) => setSelectedTemplate(id)}
              getId={t => t.id}
              getLabel={t => t.name}
              loading={loading.templates}
            />
          )}
          <ChipRow<VoiceItem>
            label="Voice"
            icon={<Microphone weight="duotone" size={14} />}
            items={voices}
            selectedId={selectedVoiceId}
            onSelect={(id) => setSelectedVoice(id)}
            getId={v => v.id}
            getLabel={v => v.name}
            getIcon={v => (
              <span className="text-[11px] font-medium" style={{ color: 'inherit', opacity: 0.7 }}>
                {v.gender === 'male' ? '♂' : v.gender === 'female' ? '♀' : ''}
              </span>
            )}
            loading={loading.voices}
          />
          <ChipRow<StyleItem>
            label="Style"
            icon={<Palette weight="duotone" size={14} />}
            items={styles}
            selectedId={selectedStyleId}
            onSelect={(id) => setSelectedStyle(id)}
            getId={s => s.id}
            getLabel={s => s.label}
            getIcon={s => <span className="text-sm">{s.emoji}</span>}
            loading={loading.styles}
          />
        </div>
      )}
    </div>
  );
}

function ActivePill({ label, color }: { label: string; color: 'violet' | 'cyan' | 'orange' }) {
  const colors = {
    violet: { bg: 'rgba(124,58,237,0.15)', border: 'rgba(124,58,237,0.3)', text: '#C4B5FD' },
    cyan:   { bg: 'rgba(6,182,212,0.12)',  border: 'rgba(6,182,212,0.28)',  text: '#67E8F9' },
    orange: { bg: 'rgba(251,146,60,0.12)', border: 'rgba(251,146,60,0.28)', text: '#FDB97D' },
  }[color];
  return (
    <span
      className="text-[11px] font-medium px-2 py-0.5 rounded-full"
      style={{ background: colors.bg, border: `1px solid ${colors.border}`, color: colors.text }}
    >
      {label}
    </span>
  );
}
