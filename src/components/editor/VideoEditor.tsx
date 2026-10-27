'use client';

import { useState, useEffect } from 'react';
import { useEditorStore } from '@/store/editor-store';
import { motion, AnimatePresence } from 'framer-motion';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  ResizableHandle, ResizablePanel, ResizablePanelGroup,
} from '@/components/ui/resizable';
import { ChevronUp, Eye, PanelRight, Grid3X3, Layers } from '@/components/ui/studio-icons';
import { BlockLibrarySidebar } from './BlockLibrarySidebar';
import { VideoPreview } from './VideoPreview';
import { TimelineEditor } from './TimelineEditor';
import { PropertiesPanel } from './PropertiesPanel';
import { EditorToolbar } from './EditorToolbar';
import { IconNavStrip } from './IconNavStrip';
import { SceneSettingsSheet } from './SceneSettingsSheet';
import { CommandPalette } from './CommandPalette';
import { LayersPanel } from './LayersPanel';
import { AudioPanelTab } from './AudioPanelTab';
import { HistoryPanel } from './HistoryPanel';
import { Dialog, DialogContent } from '@/components/ui/dialog';

type ActiveTab = 'blocks' | 'layers' | 'audio' | 'history' | null;
type MobileTab = 'preview' | 'blocks' | 'timeline' | 'properties';

const MOBILE_TABS: { id: MobileTab; label: string; icon: typeof Eye }[] = [
  { id: 'preview', label: 'Preview', icon: Eye },
  { id: 'blocks', label: 'Blocks', icon: Grid3X3 },
  { id: 'timeline', label: 'Timeline', icon: Layers },
  { id: 'properties', label: 'Properties', icon: PanelRight },
];

export function VideoEditor() {
  useKeyboardShortcuts();
  const setVideoInput = useEditorStore((s) => s.setVideoInput);
  const setEditingTemplateId = useEditorStore((s) => s.setEditingTemplateId);
  const isMobile = useIsMobile();

  useEffect(() => {
    // Load from ?videoId= URL param (MCP / direct link)
    try {
      const videoId = new URLSearchParams(window.location.search).get('videoId');
      if (videoId) {
        fetch(`/api/user/videos/${videoId}`)
          .then(r => r.json())
          .then(video => { if (video?.data) setVideoInput(video.data); })
          .catch(() => {});
        return;
      }
    } catch {
      // ignore
    }

    try {
      const pending = sessionStorage.getItem('pending_video_input');
      if (pending) {
        sessionStorage.removeItem('pending_video_input');
        setVideoInput(JSON.parse(pending));
      }
    } catch {
      // ignore
    }

    // Load template for editing (from account/templates page)
    try {
      const editRaw = localStorage.getItem('edit_template');
      if (editRaw) {
        localStorage.removeItem('edit_template');
        const template = JSON.parse(editRaw);
        const videoMeta = template.data?.videoMeta ?? template.videoMeta ?? {};
        const blocks = template.data?.blocks ?? template.blocks ?? [];
        setVideoInput({ videoMeta, contentBlocks: blocks });
        setEditingTemplateId(template.id);
      }
    } catch {
      // ignore
    }
  }, [setVideoInput, setEditingTemplateId]);

  const [activeTab, setActiveTab] = useState<ActiveTab>('blocks');
  const [showTimeline, setShowTimeline] = useState(true);
  const [showProperties, setShowProperties] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [cmdPaletteOpen, setCmdPaletteOpen] = useState(false);

  const [mobileTab, setMobileTab] = useState<MobileTab>('preview');
  const [mobileBlocksOpen, setMobileBlocksOpen] = useState(false);

  const handleTabClick = (tab: 'blocks' | 'layers' | 'audio' | 'history') => {
    setActiveTab((prev) => (prev === tab ? null : tab));
  };

  const leftPanelOpen = activeTab !== null;

  // Desktop layout
  if (!isMobile) {
    return (
      <div
        className="h-screen flex flex-col overflow-hidden text-foreground dark:text-[var(--foreground)] bg-background dark:bg-[var(--background)]"
      >
        <EditorToolbar
          onOpenSettings={() => setSettingsOpen(true)}
          onOpenCmdPalette={() => setCmdPaletteOpen(true)}
        />
        <div className="flex-1 min-h-0 flex">
          <IconNavStrip
            activeTab={activeTab}
            onTabClick={handleTabClick}
            propertiesOpen={showProperties}
            onToggleProperties={() => setShowProperties((v) => !v)}
          />
          <AnimatePresence initial={false}>
            {leftPanelOpen && (
              <motion.div
                key="left-panel"
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 280, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                className="flex-shrink-0 overflow-hidden border-r"
                style={{ borderColor: 'var(--border)', minWidth: 0 }}
              >
                <div style={{ width: 280, height: '100%' }}>
                  {activeTab === 'blocks' && <BlockLibrarySidebar />}
                  {activeTab === 'layers' && <LayersPanel />}
                  {activeTab === 'audio' && <AudioPanelTab />}
                  {activeTab === 'history' && <HistoryPanel />}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <div className="flex-1 min-w-0 flex flex-col min-h-0">
            <ResizablePanelGroup direction="vertical" className="flex-1 min-h-0">
              <ResizablePanel defaultSize={showTimeline ? 70 : 100} minSize={45}>
                <ResizablePanelGroup direction="horizontal" className="h-full">
                  <ResizablePanel
                    defaultSize={showProperties ? 72 : 100}
                    minSize={40}
                  >
                    <VideoPreview />
                  </ResizablePanel>
                  <AnimatePresence initial={false}>
                    {showProperties && (
                      <>
                        <ResizableHandle
                          withHandle
                          className="w-1 bg-transparent hover:bg-primary/30"
                          style={{ background: 'var(--border)' }}
                        />
                        <ResizablePanel defaultSize={28} minSize={20} maxSize={35}>
                          <div
                            className="h-full border-l"
                            style={{ borderColor: 'var(--border)' }}
                          >
                            <PropertiesPanel />
                          </div>
                        </ResizablePanel>
                      </>
                    )}
                  </AnimatePresence>
                </ResizablePanelGroup>
              </ResizablePanel>
              <AnimatePresence initial={false}>
                {showTimeline && (
                  <>
                    <ResizableHandle
                      withHandle
                      className="h-1 bg-transparent hover:bg-primary/30"
                      style={{ background: 'var(--border)' }}
                    />
                    <ResizablePanel defaultSize={30} minSize={20} maxSize={40}>
                      <TimelineEditor
                        onCollapse={() => setShowTimeline(false)}
                      />
                    </ResizablePanel>
                  </>
                )}
              </AnimatePresence>
            </ResizablePanelGroup>
            <AnimatePresence>
              {!showTimeline && (
                <motion.button
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  transition={{ duration: 0.15 }}
                  onClick={() => setShowTimeline(true)}
                  className="h-8 w-full flex items-center justify-center gap-2 flex-shrink-0 text-xs bg-muted border-t border-border text-muted-foreground hover:text-foreground dark:bg-[var(--card)] dark:border-white/[0.07] dark:text-[var(--muted-foreground)] dark:hover:text-[var(--foreground)]"
                >
                  <ChevronUp className="w-3.5 h-3.5" />
                  Show Timeline
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </div>
        <SceneSettingsSheet
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
        />
        <CommandPalette
          open={cmdPaletteOpen}
          onOpenChange={setCmdPaletteOpen}
        />
      </div>
    );
  }

  // Mobile layout
  return (
    <div
      className="h-[100dvh] flex flex-col overflow-hidden text-foreground dark:text-[var(--foreground)] bg-background dark:bg-[var(--background)]"
    >
      <div
        className="flex items-center justify-between px-3 py-2.5 border-b flex-shrink-0 bg-card dark:bg-[var(--card)] border-border dark:border-white/[0.07]"
      >
        <span className="text-sm font-bold text-foreground dark:text-[var(--foreground)]">
          SKYGEN
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMobileBlocksOpen(true)}
            className="px-2.5 py-1.5 rounded-sm text-[11px] font-medium"
            style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
          >
            Add Block
          </button>
        </div>
      </div>

      {/* Mobile Content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {mobileTab === 'preview' && <VideoPreview />}
        {mobileTab === 'blocks' && (
          <div className="h-full overflow-auto p-3 pb-20">
            <BlockLibrarySidebar />
          </div>
        )}
        {mobileTab === 'timeline' && (
          <div className="h-full overflow-auto">
            <TimelineEditor onCollapse={() => setMobileTab('preview')} />
          </div>
        )}
        {mobileTab === 'properties' && (
          <div className="h-full overflow-auto p-3 pb-20">
            <PropertiesPanel />
          </div>
        )}
      </div>

      <div
        className="flex items-center justify-around py-1.5 border-t flex-shrink-0 bg-card dark:bg-[var(--card)] border-border dark:border-white/[0.07]"
        style={{ paddingBottom: 'max(0.375rem, env(safe-area-inset-bottom))' }}
      >
        {MOBILE_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = mobileTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setMobileTab(tab.id)}
              className="flex flex-col items-center gap-0.5 px-3 py-1 rounded-sm"
              style={{
                color: isActive ? 'var(--primary)' : 'var(--muted-foreground)',
              }}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Mobile Blocks Modal */}
      <Dialog open={mobileBlocksOpen} onOpenChange={setMobileBlocksOpen}>
        <DialogContent
          className="max-w-[calc(100vw-2rem)] max-h-[80vh] overflow-auto bg-card dark:bg-muted dark:bg-[#1a1a2e] border-border dark:border-border dark:border-white/10"
        >
          <BlockLibrarySidebar />
        </DialogContent>
      </Dialog>

      <SceneSettingsSheet open={settingsOpen} onOpenChange={setSettingsOpen} />
      <CommandPalette open={cmdPaletteOpen} onOpenChange={setCmdPaletteOpen} />
    </div>
  );
}
