'use client';

import { useEditorStore } from '@/store/editor-store';
import { Button } from '@/components/ui/button';
import {
  Undo2, Redo2, Code, FileJson, Upload, Video, Sparkles,
  Keyboard, Rocket, Layout, Save, Settings2, Search,
  MoreHorizontal, Loader2, BarChart3, LayoutGrid, User,
  ChevronDown, ChevronRight, AlertTriangle, CheckCircle2,
} from '@/components/ui/studio-icons';
import { useMemo, useState } from 'react';
import { ApiKeySettings } from './ApiKeySettings';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useToast } from '@/hooks/use-toast';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { hasPremiumAccess } from '@/lib/roles';
import { usePremiumConfig, getUpgradeUrl } from '@/lib/use-premium-config';

interface EditorToolbarProps {
  onOpenSettings: () => void;
  onOpenCmdPalette: () => void;
}

export function EditorToolbar({ onOpenSettings, onOpenCmdPalette }: EditorToolbarProps) {
  const { undo, redo, canUndo, canRedo, getVideoJson, setVideoInput, videoInput, isDirty, editingTemplateId, exportOutputUrl } = useEditorStore();
  const { data: session } = useSession();
  const router = useRouter();
  const [jsonDialogOpen, setJsonDialogOpen] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [templatePreview, setTemplatePreview] = useState('');
  const [importJson, setImportJson] = useState('');
  const [rendering, setRendering] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const { shortcuts } = useKeyboardShortcuts();
  const { toast } = useToast();
  const hasPremium = hasPremiumAccess(session?.user?.role);
  const premiumConfig = usePremiumConfig();

  const blockCount = videoInput.contentBlocks.length;
  const totalDuration = videoInput.contentBlocks.reduce(
    (acc, b) => acc + ((b as { duration?: number }).duration || 3), 0
  );
  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
  };

  const handlePreviewUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setTemplatePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleImport = () => {
    try {
      const parsed = JSON.parse(importJson);
      setVideoInput(parsed);
      setJsonDialogOpen(false);
      setImportJson('');
    } catch {
      toast({ title: 'Invalid JSON', description: 'Please check your JSON format.', variant: 'destructive' });
    }
  };

  const openPremiumUpgrade = () => {
    toast({
      title: 'Premium required',
      description: 'Upgrade to Premium to save templates and access My Templates.',
    });
    window.open(getUpgradeUrl(premiumConfig), '_blank');
  };

  const handleOpenSaveDialog = () => {
    if (!hasPremium) {
      openPremiumUpgrade();
      return;
    }
    setSaveDialogOpen(true);
  };

  const handleSaveTemplate = async () => {
    if (!hasPremium) {
      openPremiumUpgrade();
      return;
    }

    const { saveAsTemplate, editingTemplateId: editId, userTemplates } = useEditorStore.getState();
    const existingName = editId ? (userTemplates.find(t => t.id === editId)?.name ?? templateName) : templateName;
    const nameToUse = editId ? existingName : templateName.trim();

    if (!editId && !nameToUse) return;

    try {
      setSavingTemplate(true);
      const previewUrl = exportOutputUrl || templatePreview || undefined;
      await saveAsTemplate(nameToUse, previewUrl, templateDescription.trim() || undefined);
      setSaveDialogOpen(false);
      setTemplateName('');
      setTemplateDescription('');
      setTemplatePreview('');
      toast({
        title: editId ? 'Template Updated' : 'Template Saved',
        description: editId ? 'Your template has been updated.' : `"${nameToUse}" saved to your templates.`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save template.';
      toast({ title: 'Template Not Saved', description: message, variant: 'destructive' });
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleExportJson = () => {
    const json = getVideoJson();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `video-project-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRender = async () => {
    setRendering(true);
    try {
      handleExportJson();
    } finally {
      setRendering(false);
    }
  };

  return (
    <div
      className="h-12 flex items-center justify-between px-4 flex-shrink-0 z-30 border-b"
      style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
    >
      {/* LEFT — Logo + undo/redo */}
      <div className="flex items-center gap-3">
        {/* Logo */}
        <div className="w-7 h-7 rounded-sm bg-muted flex items-center justify-center flex-shrink-0 shadow-none shadow-none">
          <Video className="w-3.5 h-3.5 text-white" />
        </div>

        {/* Name + dirty dot */}
        <div className="flex items-center gap-1.5">
          <span className="text-[13px] font-semibold text-foreground dark:text-[var(--foreground)]">Video Editor</span>
          {isDirty && (
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-dot-pulse" />
          )}
        </div>

        <div className="w-px h-4" style={{ background: 'var(--border)' }} />

        {/* Undo / Redo */}
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost" size="sm"
            className="h-7 w-7 p-0 rounded-sm disabled:opacity-25 text-muted-foreground dark:text-[var(--muted-foreground)]"

            onClick={undo}
            disabled={!canUndo()}
            title="Undo (Ctrl+Z)"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost" size="sm"
            className="h-7 w-7 p-0 rounded-sm disabled:opacity-25 text-muted-foreground dark:text-[var(--muted-foreground)]"

            onClick={redo}
            disabled={!canRedo()}
            title="Redo (Ctrl+Y)"
          >
            <Redo2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* CENTER — block count + duration */}
      <div
        className="flex items-center gap-2 px-3 py-1 rounded-sm"
        style={{ background: 'var(--border)', border: '1px solid var(--border)' }}
      >
        <Sparkles className="w-3 h-3" style={{ color: 'var(--primary)' }} />
        <span className="text-[11px] text-[var(--muted-foreground)]" >
          {blockCount} block{blockCount !== 1 ? 's' : ''}
        </span>
        {blockCount > 0 && (
          <>
            <span style={{ color: 'rgba(255,255,255,0.15)' }}>·</span>
            <span className="text-[11px] font-mono tabular-nums text-[var(--muted-foreground)]" >
              {formatDuration(totalDuration)}
            </span>
          </>
        )}
      </div>

      {/* RIGHT — actions */}
      <div className="flex items-center gap-1">
        {/* Templates */}
        <button
          onClick={() => window.location.href = '/templates'}
          className="h-7 px-2.5 rounded-sm flex items-center gap-1.5 text-[11px] hover:bg-[var(--accent)]"
          style={{ color: 'var(--muted-foreground)', border: '1px solid var(--border)' }}
          title="Template Gallery"
        >
          <LayoutGrid className="w-3 h-3" />
          Templates
        </button>

        {/* Account */}
        <button
          onClick={() => window.location.href = '/account/usage'}
          className="h-7 px-2.5 rounded-sm flex items-center gap-1.5 text-[11px] hover:bg-[var(--accent)]"
          style={{ color: 'var(--muted-foreground)', border: '1px solid var(--border)' }}
          title="My Account"
        >
          <User className="w-3 h-3" />
          Account
        </button>

        {/* ⌘K command palette */}
        <button
          onClick={onOpenCmdPalette}
          className="h-7 px-2 rounded-sm flex items-center gap-1.5 text-[11px] hover:bg-[var(--accent)] text-muted-foreground dark:text-[var(--muted-foreground)]"

        >
          <Search className="w-3.5 h-3.5" />
          <kbd
            className="text-[10px] px-1.5 py-0.5 rounded font-sans"
            style={{ background: 'var(--border)', border: '1px solid var(--border)', color: 'var(--muted-foreground)' }}
          >
            ⌘K
          </kbd>
        </button>

        {/* AI Settings */}
        <ApiKeySettings />

        {/* Scene settings cog */}
        <Button
          variant="ghost" size="sm"
          className="h-7 w-7 p-0 rounded-sm text-muted-foreground dark:text-[var(--muted-foreground)]"

          onClick={onOpenSettings}
          title="Scene Settings"
        >
          <Settings2 className="w-3.5 h-3.5" />
        </Button>

        {/* More dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 rounded-sm text-muted-foreground dark:text-[var(--muted-foreground)]" >
              <MoreHorizontal className="w-3.5 h-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="min-w-[190px]"
            style={{ background: 'var(--muted)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
          >
            <DropdownMenuItem
              className="text-[12px] gap-2 cursor-pointer hover:bg-[var(--accent)] focus:bg-[var(--accent)] text-[var(--foreground)]"
              onClick={() => {
                setImportJson(getVideoJson());
                setJsonDialogOpen(true);
              }}
            >
              <Code className="w-3.5 h-3.5 text-[var(--muted-foreground)]" />
              Edit JSON
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-[12px] gap-2 cursor-pointer hover:bg-[var(--accent)] focus:bg-[var(--accent)] text-[var(--foreground)]"
              onClick={handleExportJson}
            >
              <FileJson className="w-3.5 h-3.5 text-[var(--muted-foreground)]" />
              Export JSON
            </DropdownMenuItem>
            <DropdownMenuSeparator style={{ background: 'var(--border)' }} />
            <DropdownMenuItem
              className="text-[12px] gap-2 cursor-pointer hover:bg-[var(--accent)] focus:bg-[var(--accent)] text-[var(--foreground)]"

              onClick={handleOpenSaveDialog}
            >
              <Save className="w-3.5 h-3.5 text-[var(--muted-foreground)]"  />
              {hasPremium ? 'Save as Template' : 'Save as Template (Premium)'}
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-[12px] gap-2 cursor-pointer hover:bg-[var(--accent)] focus:bg-[var(--accent)] text-[var(--foreground)]"

              onClick={() => window.location.href = '/templates'}
            >
              <Layout className="w-3.5 h-3.5 text-[var(--muted-foreground)]"  />
              Template Gallery
            </DropdownMenuItem>
            <DropdownMenuSeparator style={{ background: 'var(--border)' }} />
            <DropdownMenuItem
              className="text-[12px] gap-2 cursor-pointer hover:bg-[var(--accent)] focus:bg-[var(--accent)] text-[var(--foreground)]"

              onClick={() => window.location.href = '/account/usage'}
            >
              <BarChart3 className="w-3.5 h-3.5 text-[var(--muted-foreground)]"  />
              Dashboard
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-[12px] gap-2 cursor-pointer hover:bg-[var(--accent)] focus:bg-[var(--accent)] text-[var(--foreground)]"

              onClick={() => setShortcutsOpen(true)}
            >
              <Keyboard className="w-3.5 h-3.5 text-[var(--muted-foreground)]"  />
              Keyboard Shortcuts
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="w-px h-4 mx-0.5" style={{ background: 'var(--border)' }} />

        {/* Save as Template */}
        <Button
          variant="ghost" size="sm"
          className="h-7 px-2.5 rounded-sm text-[11px] gap-1.5 text-[var(--muted-foreground)]"

          onClick={handleOpenSaveDialog}
          disabled={blockCount === 0}
          title={hasPremium ? 'Save as Template' : 'Premium required to save templates'}
        >
          <Save className="w-3 h-3" />
          {editingTemplateId ? 'Update' : (hasPremium ? 'Save' : 'Save (Premium)')}
        </Button>

        {/* Render */}
        <Button
          className="h-7 px-3 text-[11px] font-semibold rounded-sm text-white"
          style={{ background: 'var(--primary)', boxShadow: 'none' }}
          onClick={handleRender}
          disabled={rendering || blockCount === 0}
        >
          {rendering ? (
            <><Loader2 className="w-3 h-3 mr-1.5 animate-spin" />Rendering...</>
          ) : (
            <><Rocket className="w-3 h-3 mr-1.5" />Render</>
          )}
        </Button>
      </div>

      {/* --- Dialogs --- */}
      {/* Edit JSON */}
      <Dialog open={jsonDialogOpen} onOpenChange={setJsonDialogOpen}>
        <DialogContent className="max-w-[min(1100px,calc(100vw-2rem))] max-h-[85vh] overflow-y-auto flex flex-col p-0 bg-card dark:bg-[var(--muted)] border-border dark:border-white/[0.07]">
          <DialogHeader className="px-5 pt-5 pb-3 border-b border-border dark:border-white/[0.07]">
            <DialogTitle className="text-[var(--foreground)]">Edit Video JSON</DialogTitle>
          </DialogHeader>
          <JsonEditorPanel
            value={importJson}
            onChange={setImportJson}
            placeholder="Paste or edit your video JSON here..."
          />
          <div className="flex justify-end gap-2 px-5 py-4 border-t border-border dark:border-white/[0.07]">
            <Button variant="outline" onClick={() => setJsonDialogOpen(false)}
              className="border-white/10 text-[var(--muted-foreground)]">
              Cancel
            </Button>
            <Button onClick={handleImport} className="bg-[var(--primary)] text-primary-foreground">
              Apply Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Save as Template */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent className="bg-card dark:bg-[var(--muted)] border-border dark:border-white/[0.07] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-[var(--foreground)]">{editingTemplateId ? 'Update Template' : 'Save as Template'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm mb-2 block text-[var(--muted-foreground)]">Template Name</label>
              <Input
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="Enter template name..."
                className="text-sm bg-muted dark:bg-white/[0.05] border-border dark:border-white/[0.1] text-[var(--foreground)]"
                onKeyDown={(e) => e.key === 'Enter' && void handleSaveTemplate()}
                autoFocus
              />
            </div>
            <div>
              <label className="text-sm mb-2 block text-[var(--muted-foreground)]">Description (optional)</label>
              <textarea
                value={templateDescription}
                onChange={(e) => setTemplateDescription(e.target.value)}
                placeholder="Describe this template so AI knows how to fill it — e.g. 'A motivational short about an athlete's journey with stats and parallax story blocks'"
                rows={3}
                className="text-sm w-full resize-none bg-muted dark:bg-white/[0.05] border border-border dark:border-white/[0.1] text-[var(--foreground)] rounded-sm p-2"
              />
            </div>
            <div>
              <label className="text-sm mb-2 block text-[var(--muted-foreground)]" >
                Preview Image (optional)
                {exportOutputUrl && <span className="ml-2 text-xs text-emerald-300">Rendered video will be used</span>}
              </label>
              <div className="flex items-center gap-4">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePreviewUpload}
                  className="text-sm file:mr-4 file:py-1.5 file:px-3 file:rounded-sm file:border-0 file:text-xs file:font-medium file:bg-[var(--primary)] file:text-primary-foreground hover:file:bg-[var(--primary)] text-[var(--muted-foreground)]"

                />
                {templatePreview && (
                  <img src={templatePreview} alt="Preview" className="w-14 h-14 object-cover rounded-sm"
                    style={{ border: '1px solid var(--border)' }} />
                )}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setSaveDialogOpen(false)} className="text-[var(--muted-foreground)]">
                Cancel
              </Button>
              <Button onClick={() => void handleSaveTemplate()} disabled={(!editingTemplateId && !templateName.trim()) || savingTemplate}
                className="bg-[var(--primary)] text-primary-foreground">
                {savingTemplate ? 'Saving...' : (editingTemplateId ? 'Update Template' : 'Save Template')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Keyboard Shortcuts */}
      <Dialog open={shortcutsOpen} onOpenChange={setShortcutsOpen}>
        <DialogContent className="max-w-md bg-card dark:bg-[var(--muted)] border-border dark:border-white/[0.07]" >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[var(--foreground)]" >
              <Keyboard className="w-4 h-4" />
              Keyboard Shortcuts
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-1">
            {shortcuts.map((shortcut, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b last:border-0"
                style={{ borderColor: 'var(--border)' }}>
                <span className="text-sm text-[var(--muted-foreground)]" >{shortcut.action}</span>
                <div className="flex items-center gap-1">
                  {shortcut.keys.map((key, j) => (
                    <span key={j}>
                      <kbd className="px-2 py-1 rounded text-xs font-mono"
                        style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--foreground)' }}>
                        {key}
                      </kbd>
                      {j < shortcut.keys.length - 1 && (
                        <span className="mx-1 text-muted-foreground dark:text-[var(--muted-foreground)]" >+</span>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

type JsonValue = null | string | number | boolean | JsonValue[] | { [key: string]: JsonValue };

function JsonEditorPanel({
  value,
  onChange,
  readOnly = false,
  placeholder,
}: {
  value: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  placeholder?: string;
}) {
  const [mode, setMode] = useState<'code' | 'tree'>('code');
  const [collapsedPaths, setCollapsedPaths] = useState<Set<string>>(new Set());

  const parsed = useMemo(() => {
    if (!value.trim()) return { ok: false as const, error: 'Paste JSON to begin.', data: null };
    try {
      return { ok: true as const, error: null, data: JSON.parse(value) as JsonValue };
    } catch (error) {
      return {
        ok: false as const,
        error: error instanceof Error ? error.message : 'Invalid JSON',
        data: null,
      };
    }
  }, [value]);

  const collapsiblePaths = useMemo(() => {
    if (!parsed.ok) return [];
    const paths: string[] = [];
    collectJsonPaths(parsed.data, '$', paths);
    return paths;
  }, [parsed]);

  const formatJson = () => {
    if (!parsed.ok || readOnly) return;
    onChange?.(JSON.stringify(parsed.data, null, 2));
  };

  const collapseAll = () => setCollapsedPaths(new Set(collapsiblePaths));
  const expandAll = () => setCollapsedPaths(new Set());
  const togglePath = (path: string) => {
    setCollapsedPaths(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="px-5 py-3 flex flex-wrap items-center justify-between gap-3" style={{ background: '#181824' }}>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMode('code')}
            className="px-3 py-1.5 rounded-sm text-xs font-medium"
            style={{
              background: mode === 'code' ? 'color-mix(in srgb, var(--primary) 22%, transparent)' : 'var(--border)',
              color: mode === 'code' ? '#DDD6FE' : 'var(--muted-foreground)',
              border: `1px solid ${mode === 'code' ? 'color-mix(in srgb, var(--primary) 35%, transparent)' : 'var(--border)'}`,
            }}
          >
            Raw JSON
          </button>
          <button
            type="button"
            onClick={() => setMode('tree')}
            className="px-3 py-1.5 rounded-sm text-xs font-medium disabled:opacity-40"
            disabled={!parsed.ok}
            style={{
              background: mode === 'tree' ? 'color-mix(in srgb, var(--primary) 22%, transparent)' : 'var(--border)',
              color: mode === 'tree' ? '#DDD6FE' : 'var(--muted-foreground)',
              border: `1px solid ${mode === 'tree' ? 'color-mix(in srgb, var(--primary) 35%, transparent)' : 'var(--border)'}`,
            }}
          >
            Tree
          </button>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs" style={{ color: parsed.ok ? '#86EFAC' : '#FCA5A5' }}>
            {parsed.ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
            <span>{parsed.ok ? 'Valid JSON' : parsed.error}</span>
          </div>
          {!readOnly && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={formatJson}
              disabled={!parsed.ok}
              className="h-7 px-2 text-xs text-[var(--muted-foreground)]"

            >
              Format
            </Button>
          )}
          {mode === 'tree' && parsed.ok && (
            <>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={collapseAll}
                className="h-7 px-2 text-xs text-[var(--muted-foreground)]"

              >
                Collapse all
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={expandAll}
                className="h-7 px-2 text-xs text-[var(--muted-foreground)]"

              >
                Expand all
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 px-5 pb-5">
        {mode === 'code' ? (
          <Textarea
            value={value}
            onChange={(e) => onChange?.(e.target.value)}
            readOnly={readOnly}
            placeholder={placeholder}
            spellCheck={false}
            className="h-full min-h-0 resize-none font-mono text-xs leading-5"
            style={{
              background: '#101018',
              borderColor: 'var(--border)',
              color: '#EDEDF7',
              scrollbarWidth: 'thin',
              scrollbarColor: 'rgba(139,139,170,0.45) transparent',
            }}
          />
        ) : (
          <div
            className="h-full overflow-auto rounded-sm border p-3 font-mono text-xs"
            style={{
              background: '#101018',
              borderColor: 'var(--border)',
              color: '#EDEDF7',
              scrollbarWidth: 'thin',
              scrollbarColor: 'rgba(139,139,170,0.45) transparent',
            }}
          >
            {parsed.ok ? (
              <JsonTreeNode
                name="$"
                value={parsed.data}
                path="$"
                depth={0}
                collapsedPaths={collapsedPaths}
                onToggle={togglePath}
              />
            ) : (
              <div className="flex items-center gap-2 text-xs" style={{ color: '#FCA5A5' }}>
                <AlertTriangle className="w-4 h-4" />
                {parsed.error}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function JsonTreeNode({
  name,
  value,
  path,
  depth,
  collapsedPaths,
  onToggle,
}: {
  name: string;
  value: JsonValue;
  path: string;
  depth: number;
  collapsedPaths: Set<string>;
  onToggle: (path: string) => void;
}) {
  const isArray = Array.isArray(value);
  const isObject = value !== null && typeof value === 'object';
  const isCollapsed = collapsedPaths.has(path);

  if (!isObject) {
    return (
      <div className="flex items-start gap-2 py-0.5" style={{ paddingLeft: depth * 16 }}>
        <span style={{ color: 'var(--primary)' }}>{name}:</span>
        <JsonPrimitive value={value} />
      </div>
    );
  }

  const entries = isArray
    ? value.map((item, index) => [String(index), item] as const)
    : Object.entries(value);
  const label = isArray ? `Array(${entries.length})` : `Object(${entries.length})`;

  return (
    <div>
      <button
        type="button"
        onClick={() => onToggle(path)}
        className="flex items-center gap-1 py-0.5 rounded hover:bg-black/5 dark:hover:bg-white/5 w-full text-left"
        style={{ paddingLeft: depth * 16, color: '#EDEDF7' }}
      >
        {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        <span style={{ color: 'var(--primary)' }}>{name}</span>
        <span className="text-muted-foreground dark:text-[var(--muted-foreground)]">{label}</span>
      </button>
      {!isCollapsed && (
        <div>
          {entries.map(([childName, childValue]) => (
            <JsonTreeNode
              key={`${path}.${childName}`}
              name={childName}
              value={childValue}
              path={`${path}.${childName}`}
              depth={depth + 1}
              collapsedPaths={collapsedPaths}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function JsonPrimitive({ value }: { value: string | number | boolean | null }) {
  if (value === null) return <span style={{ color: '#FCA5A5' }}>null</span>;
  if (typeof value === 'string') return <span style={{ color: '#86EFAC' }}>{JSON.stringify(value)}</span>;
  if (typeof value === 'number') return <span style={{ color: 'var(--primary)' }}>{value}</span>;
  return <span style={{ color: '#FDBA74' }}>{String(value)}</span>;
}

function collectJsonPaths(value: JsonValue, path: string, paths: string[]) {
  if (value === null || typeof value !== 'object') return;
  paths.push(path);
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectJsonPaths(item, `${path}.${index}`, paths));
    return;
  }
  Object.entries(value).forEach(([key, child]) => collectJsonPaths(child, `${path}.${key}`, paths));
}
