'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FieldEditor, generateEditorFromSchema, getDefaultsFromSchema } from '@/lib/plugins/schema-to-ui';
import { useWizardChatStore } from '@/store/wizard-chat-store';
import type { PluginSchema, SchemaProperty } from '../../../shared/plugin-types';

function QuickEditField({ name, property, value, disabled, onChange, depth = 0 }: {
  name: string; property: SchemaProperty; value: unknown; disabled: boolean;
  onChange: (value: unknown) => void; depth?: number;
}) {
  if (property.type === 'object' && property.properties && depth < 5) {
    const data = (value ?? property.default ?? {}) as Record<string, unknown>;
    return <details className="border border-border rounded-sm p-2" open>
      <summary className="text-xs cursor-pointer">{property.title || name}</summary>
      <div className="space-y-3 mt-3">{Object.entries(property.properties).map(([key, child]) => (
        <QuickEditField key={key} name={key} property={child} value={data[key]} disabled={disabled} depth={depth + 1}
          onChange={(next) => onChange({ ...data, [key]: next })} />
      ))}</div>
    </details>;
  }
  if (property.type === 'array' && property.items && depth < 5) {
    const items = (Array.isArray(value) ? value : Array.isArray(property.default) ? property.default : []) as unknown[];
    return <div className="space-y-3">
      <div className="text-xs font-medium">{property.title || name}</div>
      {items.map((item, index) => <div key={index} className="border border-border rounded-sm p-2 space-y-2">
        <QuickEditField name={`${name} ${index + 1}`} property={property.items!} value={item} disabled={disabled}
          depth={depth + 1} onChange={(next) => onChange(items.map((old, i) => i === index ? next : old))} />
        <button type="button" className="text-xs text-muted-foreground" disabled={disabled || items.length <= (property.minItems ?? 0)}
          onClick={() => onChange(items.filter((_, i) => i !== index))}>Remove item {index + 1}</button>
      </div>)}
      <button type="button" className="text-xs text-primary" disabled={disabled || items.length >= Math.min(property.maxItems ?? 100, 100)}
        onClick={() => {
          const child = property.items!;
          const initial = child.default ?? (child.type === 'object'
            ? Object.fromEntries(Object.entries(child.properties ?? {}).filter(([, p]) => p.default !== undefined).map(([key, p]) => [key, p.default]))
            : child.type === 'array' ? [] : child.type === 'boolean' ? false : child.type === 'number' || child.type === 'integer' ? child.minimum ?? 0 : '');
          onChange([...items, initial]);
        }}>Add item</button>
    </div>;
  }
  if (property.type === 'object' || property.type === 'array') {
    return <p className="text-xs text-muted-foreground">{property.title || name}: edit this structured field in chat.</p>;
  }
  return <FieldEditor field={name} property={property} value={value} disabled={disabled} onChange={(next) => {
    onChange((property.type === 'number' || property.type === 'integer') && typeof next === 'string' ? Number(next) : next);
  }} />;
}

interface Props {
  threadId: string;
  pluginId: string;
  schemaJson: string;
  disabled: boolean;
  onPreviewChange: (values: Record<string, unknown>) => void;
}

export function PluginQuickEdit({ threadId, pluginId, schemaJson, disabled, onPreviewChange }: Props) {
  const schema = useMemo<PluginSchema | null>(() => {
    try {
      const parsed = JSON.parse(schemaJson);
      return parsed?.properties && typeof parsed.properties === 'object' ? parsed : null;
    } catch { return null; }
  }, [schemaJson]);
  const defaults = useMemo(() => schema ? getDefaultsFromSchema(schema) : {}, [schema]);
  const [changes, setChanges] = useState<Record<string, unknown>>({});
  const changesRef = useRef(changes);
  const savingRef = useRef<Promise<void> | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dirty = Object.keys(changes).length > 0;

  const flush = useCallback(async () => {
    if (savingRef.current) return savingRef.current;
    if (!Object.keys(changesRef.current).length) return;
    const request = async () => {
      setSaving(true);
      setError(null);
      try {
        const response = await fetch('/api/ai/wizard/plugin-sandbox', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ threadId, pluginId, action: 'update-settings', expectedSchemaJson: schemaJson, changes: changesRef.current }),
        });
        const result = await response.json();
        if (!response.ok || !result.ok) throw new Error(result.error || 'Could not apply settings.');
        const current = useWizardChatStore.getState();
        if (current.threadId !== threadId || current.pendingPlugin?.pluginId !== pluginId || current.pendingPlugin.schemaJson !== schemaJson) {
          throw new Error('The draft changed while saving. Reload the preview to see its latest settings.');
        }
        current.setPendingPlugin(result.pending);
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : 'Could not apply settings.';
        setError(message);
        throw new Error(message);
      } finally {
        setSaving(false);
      }
    };
    savingRef.current = request();
    try { await savingRef.current; } finally { savingRef.current = null; }
  }, [threadId, pluginId, schemaJson]);

  // All chat and approval actions flush pending edits before starting an agent.
  useEffect(() => {
    useWizardChatStore.setState({ flushPluginSettings: flush });
    return () => {
      if (useWizardChatStore.getState().flushPluginSettings === flush) {
        useWizardChatStore.setState({ flushPluginSettings: null });
      }
    };
  }, [flush]);

  const change = (key: string, value: unknown) => {
    const next = { ...changesRef.current, [key]: value };
    if (JSON.stringify(defaults[key]) === JSON.stringify(value)) delete next[key];
    changesRef.current = next;
    setChanges(next);
    setError(null);
    onPreviewChange(next);
  };
  const sections = schema ? generateEditorFromSchema(schema) : [];
  return (
    <aside aria-label="Plugin quick edit" className="w-full lg:w-72 xl:w-80 shrink-0 border-t lg:border-t-0 lg:border-l border-border flex flex-col min-h-0 bg-card/40">
      <div className="flex items-center justify-between gap-2 p-3 border-b border-border">
        <h3 className="text-sm font-semibold">Quick Edit</h3>
        <div className="flex gap-2 text-xs">
          <button type="button" disabled={!dirty || saving || disabled} onClick={() => {
            changesRef.current = {};
            setChanges({});
            setError(null);
            onPreviewChange({});
          }} className="disabled:opacity-40">Revert</button>
          <button type="button" disabled={!dirty || saving || disabled} onClick={() => void flush().catch(() => {})}
            className="rounded-sm px-3 py-1.5 bg-primary text-primary-foreground disabled:opacity-40">
            {saving ? 'Applying…' : 'Apply'}
          </button>
        </div>
      </div>
      <div className="overflow-y-auto p-3 space-y-4 max-h-80 lg:max-h-none flex-1">
        <p className="text-xs text-muted-foreground">Changes preview instantly. Apply to keep them in this draft. Chat and save also apply your changes.</p>
        {error && <p role="alert" className="text-xs text-red-400">{error}</p>}
        {dirty && <p role="status" className="text-xs text-amber-400">Unapplied changes</p>}
        {!sections.length && <p className="text-xs text-muted-foreground">This plugin has no editable fields yet. Ask in chat to expose the settings you need.</p>}
        <fieldset disabled={disabled || saving} className="space-y-3 min-w-0 disabled:opacity-60">
          {sections.map((section, index) => (
            <details key={`${section.title}-${index}`} open={section.defaultOpen || index === 0} className="rounded-sm border border-border p-3">
              <summary className="cursor-pointer text-xs font-semibold">{section.title}</summary>
              <div className="space-y-3 mt-3">
                {section.fields.map(({ key, property }) => <QuickEditField key={key} name={key} property={property}
                  value={Object.hasOwn(changes, key) ? changes[key] : defaults[key]}
                  disabled={disabled || saving} onChange={(value) => change(key, value)} />)}
              </div>
            </details>
          ))}
        </fieldset>
      </div>
    </aside>
  );
}
