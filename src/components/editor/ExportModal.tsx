'use client';

import React, { useEffect, useState } from 'react';
import { useEditorStore } from '@/store/editor-store';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import {
  Download,
  Youtube,
  Linkedin,
  CheckCircle2,
  XCircle,
  Loader2,
  ExternalLink,
  Tag,
  X,
} from '@/components/ui/studio-icons';

type UploadState = 'idle' | 'uploading' | 'done' | 'error';

const YOUTUBE_CATEGORIES: { id: string; label: string }[] = [
  { id: '22', label: 'People & Blogs' },
  { id: '1', label: 'Film & Animation' },
  { id: '2', label: 'Autos & Vehicles' },
  { id: '10', label: 'Music' },
  { id: '15', label: 'Pets & Animals' },
  { id: '17', label: 'Sports' },
  { id: '19', label: 'Travel & Events' },
  { id: '20', label: 'Gaming' },
  { id: '23', label: 'Comedy' },
  { id: '24', label: 'Entertainment' },
  { id: '25', label: 'News & Politics' },
  { id: '26', label: 'Howto & Style' },
  { id: '27', label: 'Education' },
  { id: '28', label: 'Science & Technology' },
];

export function ExportModal() {
  const exportJobStatus = useEditorStore(s => s.exportJobStatus);
  const exportProgress = useEditorStore(s => s.exportProgress);
  const exportOutputUrl = useEditorStore(s => s.exportOutputUrl);
  const setExportJobStatus = useEditorStore(s => s.setExportJobStatus);
  const downloadExport = useEditorStore(s => s.downloadExport);

  const isOpen = exportJobStatus !== 'idle';

  // Tab: 'download' | 'youtube' | 'linkedin'
  const [activeTab, setActiveTab] = useState<'download' | 'youtube' | 'linkedin'>('download');

  // YouTube state
  const [ytTitle, setYtTitle] = useState('My Video');
  const [ytDescription, setYtDescription] = useState('');
  const [ytPrivacy, setYtPrivacy] = useState<'private' | 'unlisted' | 'public'>('private');
  const [ytCategory, setYtCategory] = useState('22');
  const [ytTags, setYtTags] = useState<string[]>([]);
  const [ytTagInput, setYtTagInput] = useState('');
  const [ytConnected, setYtConnected] = useState<boolean | null>(null);
  const [ytUploadState, setYtUploadState] = useState<UploadState>('idle');
  const [ytUploadError, setYtUploadError] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');

  // LinkedIn state
  const [liTitle, setLiTitle] = useState('My Video');
  const [liDescription, setLiDescription] = useState('');
  const [liVisibility, setLiVisibility] = useState<'PUBLIC' | 'CONNECTIONS'>('PUBLIC');
  const [liConnected, setLiConnected] = useState<boolean | null>(null);
  const [liUploadState, setLiUploadState] = useState<UploadState>('idle');
  const [liUploadError, setLiUploadError] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');

  // Check connections when render completes
  useEffect(() => {
    if (exportJobStatus === 'completed') {
      fetch('/api/youtube/status')
        .then(r => r.json())
        .then(d => setYtConnected(!!d.connected))
        .catch(() => setYtConnected(false));

      fetch('/api/linkedin/status')
        .then(r => r.json())
        .then(d => setLiConnected(!!d.connected))
        .catch(() => setLiConnected(false));
    }
  }, [exportJobStatus]);

  // Reset state when modal opens fresh
  useEffect(() => {
    if (exportJobStatus === 'processing') {
      setActiveTab('download');
      setYtUploadState('idle');
      setYtUploadError('');
      setYoutubeUrl('');
      setLiUploadState('idle');
      setLiUploadError('');
      setLinkedinUrl('');
    }
  }, [exportJobStatus]);

  function handleClose() {
    setExportJobStatus('idle', null);
    setActiveTab('download');
    setYtUploadState('idle');
    setLiUploadState('idle');
  }

  // ── YouTube tag handling ──
  function handleAddTag() {
    const tag = ytTagInput.trim();
    if (tag && !ytTags.includes(tag) && ytTags.length < 15) {
      setYtTags(prev => [...prev, tag]);
      setYtTagInput('');
    }
  }

  function handleRemoveTag(tag: string) {
    setYtTags(prev => prev.filter(t => t !== tag));
  }

  function handleTagKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      handleAddTag();
    }
  }

  // ── YouTube Upload ──
  async function handleYouTubeUpload() {
    if (!exportOutputUrl) return;
    setYtUploadState('uploading');
    setYtUploadError('');
    try {
      const res = await fetch('/api/youtube/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoUrl: exportOutputUrl,
          title: ytTitle,
          description: ytDescription,
          privacyStatus: ytPrivacy,
          tags: ytTags.length > 0 ? ytTags : undefined,
          categoryId: ytCategory,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      setYoutubeUrl(data.video?.url || '');
      setYtUploadState('done');
    } catch (err: any) {
      setYtUploadError(err.message || 'Upload failed');
      setYtUploadState('error');
    }
  }

  // ── LinkedIn Upload ──
  async function handleLinkedInUpload() {
    if (!exportOutputUrl) return;
    setLiUploadState('uploading');
    setLiUploadError('');
    try {
      const res = await fetch('/api/linkedin/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoUrl: exportOutputUrl,
          title: liTitle,
          description: liDescription,
          visibility: liVisibility,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      setLinkedinUrl(data.post?.url || '');
      setLiUploadState('done');
    } catch (err: any) {
      setLiUploadError(err.message || 'Upload failed');
      setLiUploadState('error');
    }
  }

  const inputStyle = {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.12)',
    color: '#F1F1F8',
    fontSize: 13,
  };

  const labelStyle = { color: '#8B8BAA', fontSize: 12 };

  return (
    <Dialog open={isOpen} onOpenChange={open => { if (!open) handleClose(); }}>
      <DialogContent
        className="max-w-lg max-h-[85vh] overflow-y-auto"
        style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
        onInteractOutside={e => {
          if (exportJobStatus === 'processing') e.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle style={{ color: 'var(--foreground)' }}>
            {exportJobStatus === 'processing' && 'Rendering Video…'}
            {exportJobStatus === 'completed' && 'Video Ready'}
            {exportJobStatus === 'failed' && 'Render Failed'}
          </DialogTitle>
        </DialogHeader>

        {/* ── RENDERING STATE ── */}
        {exportJobStatus === 'processing' && (
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-3">
              <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--primary)' }} />
              <span style={{ color: 'var(--muted-foreground)', fontSize: 14 }}>
                {exportProgress > 0 ? `${exportProgress}% complete` : 'Starting render…'}
              </span>
            </div>
            <Progress value={exportProgress} className="h-2" style={{ background: 'var(--border)' }} />
            <p style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>
              This may take a minute. Don't close this tab.
            </p>
          </div>
        )}

        {/* ── COMPLETED STATE ── */}
        {exportJobStatus === 'completed' && (
          <div className="space-y-4 py-1">
            <div className="flex items-center gap-2" style={{ color: '#22c55e' }}>
              <CheckCircle2 className="w-5 h-5" />
              <span style={{ fontSize: 14 }}>Render complete!</span>
            </div>

            {/* Tabs */}
            <div
              className="flex rounded-sm overflow-hidden"
              style={{ background: 'var(--border)', border: '1px solid var(--border)' }}
            >
              {([
                { id: 'download' as const, label: 'Download', icon: Download, color: '#7c3aed' },
                { id: 'youtube' as const, label: 'YouTube', icon: Youtube, color: '#ff0000' },
                { id: 'linkedin' as const, label: 'LinkedIn', icon: Linkedin, color: '#0a66c2' },
              ]).map(tab => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-[12px] font-medium"
                    style={{
                      background: isActive ? 'var(--border)' : 'transparent',
                      color: isActive ? tab.color : 'var(--muted-foreground)',
                      borderBottom: isActive ? `2px solid ${tab.color}` : '2px solid transparent',
                    }}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* ── Download Tab ── */}
            {activeTab === 'download' && (
              <div className="space-y-3">
                <Button
                  onClick={downloadExport}
                  className="w-full gap-2"
                  style={{ background: 'color-mix(in srgb, var(--primary) 85%, transparent)', color: 'var(--primary-foreground)', border: 'none' }}
                >
                  <Download className="w-4 h-4" />
                  Download MP4
                </Button>
                <a
                  href="/account/videos"
                  className="flex items-center gap-1 text-[12px] justify-center"
                  style={{ color: 'var(--muted-foreground)' }}
                >
                  View in My Videos <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}

            {/* ── YouTube Tab ── */}
            {activeTab === 'youtube' && (
              <div className="space-y-3">
                {ytUploadState === 'done' ? (
                  <div
                    className="rounded-sm p-4 space-y-2"
                    style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}
                  >
                    <div className="flex items-center gap-2" style={{ color: '#22c55e' }}>
                      <CheckCircle2 className="w-4 h-4" />
                      <span style={{ fontSize: 14 }}>Uploaded to YouTube!</span>
                    </div>
                    {youtubeUrl && (
                      <a href={youtubeUrl} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1" style={{ color: 'var(--primary)', fontSize: 13 }}>
                        View on YouTube <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                    <Button onClick={() => setYtUploadState('idle')} variant="outline" size="sm"
                      style={{ borderColor: 'rgba(255,255,255,0.15)', color: 'var(--muted-foreground)', background: 'transparent', fontSize: 12 }}>
                      Upload another
                    </Button>
                  </div>
                ) : ytConnected === false ? (
                  <div className="text-center py-4 space-y-2">
                    <Youtube className="w-8 h-8 mx-auto" style={{ color: 'var(--muted-foreground)' }} />
                    <p style={{ color: 'var(--muted-foreground)', fontSize: 13 }}>YouTube not connected</p>
                    <a href="/api/youtube/auth"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-[12px] font-medium"
                      style={{ background: 'rgba(255,0,0,0.1)', border: '1px solid rgba(255,0,0,0.25)', color: '#ff4444' }}>
                      <ExternalLink className="w-3 h-3" /> Connect YouTube
                    </a>
                  </div>
                ) : (
                  <>
                    <div className="space-y-1">
                      <Label style={labelStyle}>Title *</Label>
                      <Input value={ytTitle} onChange={e => setYtTitle(e.target.value)}
                        placeholder="Video title" style={inputStyle} />
                    </div>
                    <div className="space-y-1">
                      <Label style={labelStyle}>Description</Label>
                      <Textarea value={ytDescription} onChange={e => setYtDescription(e.target.value)}
                        placeholder="Video description (optional)" rows={3}
                        style={{ ...inputStyle, resize: 'none' }} />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label style={labelStyle}>Privacy</Label>
                        <Select value={ytPrivacy} onValueChange={(v: any) => setYtPrivacy(v)}>
                          <SelectTrigger style={inputStyle}><SelectValue /></SelectTrigger>
                          <SelectContent style={{ background: 'var(--muted)', border: '1px solid rgba(255,255,255,0.12)', color: 'var(--foreground)' }}>
                            <SelectItem value="private">Private</SelectItem>
                            <SelectItem value="unlisted">Unlisted</SelectItem>
                            <SelectItem value="public">Public</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label style={labelStyle}>Category</Label>
                        <Select value={ytCategory} onValueChange={setYtCategory}>
                          <SelectTrigger style={inputStyle}><SelectValue /></SelectTrigger>
                          <SelectContent style={{ background: 'var(--muted)', border: '1px solid rgba(255,255,255,0.12)', color: 'var(--foreground)' }}>
                            {YOUTUBE_CATEGORIES.map(cat => (
                              <SelectItem key={cat.id} value={cat.id}>{cat.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Tags */}
                    <div className="space-y-1">
                      <Label style={labelStyle}>
                        <span className="flex items-center gap-1"><Tag className="w-3 h-3" /> Tags</span>
                      </Label>
                      <div className="flex flex-wrap gap-1.5 mb-1.5">
                        {ytTags.map(tag => (
                          <span
                            key={tag}
                            className="flex items-center gap-1 px-2 py-0.5 rounded-sm text-[11px]"
                            style={{ background: 'color-mix(in srgb, var(--primary) 15%, transparent)', color: 'var(--primary)', border: '1px solid color-mix(in srgb, var(--primary) 25%, transparent)' }}
                          >
                            {tag}
                            <button onClick={() => handleRemoveTag(tag)} className="hover:text-foreground dark:text-white">
                              <X className="w-2.5 h-2.5" />
                            </button>
                          </span>
                        ))}
                      </div>
                      <div className="flex gap-1.5">
                        <Input
                          value={ytTagInput}
                          onChange={e => setYtTagInput(e.target.value)}
                          onKeyDown={handleTagKeyDown}
                          placeholder="Type a tag and press Enter"
                          style={{ ...inputStyle, flex: 1 }}
                        />
                        <Button onClick={handleAddTag} size="sm" variant="outline" disabled={!ytTagInput.trim()}
                          style={{ borderColor: 'rgba(255,255,255,0.12)', color: 'var(--muted-foreground)', background: 'transparent', fontSize: 12 }}>
                          Add
                        </Button>
                      </div>
                      <p style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>Up to 15 tags. Press Enter or comma to add.</p>
                    </div>

                    {ytUploadState === 'error' && (
                      <p style={{ color: '#ef4444', fontSize: 12 }}>{ytUploadError}</p>
                    )}

                    <Button
                      onClick={handleYouTubeUpload}
                      disabled={ytUploadState === 'uploading' || !ytTitle.trim()}
                      className="w-full gap-2"
                      style={{ background: '#cc0000', color: '#fff', border: 'none' }}
                    >
                      {ytUploadState === 'uploading' ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> Uploading to YouTube…</>
                      ) : (
                        <><Youtube className="w-4 h-4" /> Upload to YouTube</>
                      )}
                    </Button>
                  </>
                )}
              </div>
            )}

            {/* ── LinkedIn Tab ── */}
            {activeTab === 'linkedin' && (
              <div className="space-y-3">
                {liUploadState === 'done' ? (
                  <div
                    className="rounded-sm p-4 space-y-2"
                    style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}
                  >
                    <div className="flex items-center gap-2" style={{ color: '#22c55e' }}>
                      <CheckCircle2 className="w-4 h-4" />
                      <span style={{ fontSize: 14 }}>Posted to LinkedIn!</span>
                    </div>
                    {linkedinUrl && (
                      <a href={linkedinUrl} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1" style={{ color: 'var(--primary)', fontSize: 13 }}>
                        View on LinkedIn <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                    <Button onClick={() => setLiUploadState('idle')} variant="outline" size="sm"
                      style={{ borderColor: 'rgba(255,255,255,0.15)', color: 'var(--muted-foreground)', background: 'transparent', fontSize: 12 }}>
                      Post another
                    </Button>
                  </div>
                ) : liConnected === false ? (
                  <div className="text-center py-4 space-y-2">
                    <Linkedin className="w-8 h-8 mx-auto" style={{ color: 'var(--muted-foreground)' }} />
                    <p style={{ color: 'var(--muted-foreground)', fontSize: 13 }}>LinkedIn not connected</p>
                    <a href="/api/linkedin/auth"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-[12px] font-medium"
                      style={{ background: 'rgba(10,102,194,0.1)', border: '1px solid rgba(10,102,194,0.25)', color: '#0a66c2' }}>
                      <ExternalLink className="w-3 h-3" /> Connect LinkedIn
                    </a>
                  </div>
                ) : (
                  <>
                    <div className="space-y-1">
                      <Label style={labelStyle}>Post Title *</Label>
                      <Input value={liTitle} onChange={e => setLiTitle(e.target.value)}
                        placeholder="Post title" style={inputStyle} />
                    </div>
                    <div className="space-y-1">
                      <Label style={labelStyle}>Description</Label>
                      <Textarea value={liDescription} onChange={e => setLiDescription(e.target.value)}
                        placeholder="Post description (optional)" rows={3}
                        style={{ ...inputStyle, resize: 'none' }} />
                    </div>
                    <div className="space-y-1">
                      <Label style={labelStyle}>Visibility</Label>
                      <Select value={liVisibility} onValueChange={(v: any) => setLiVisibility(v)}>
                        <SelectTrigger style={inputStyle}><SelectValue /></SelectTrigger>
                        <SelectContent style={{ background: 'var(--muted)', border: '1px solid rgba(255,255,255,0.12)', color: 'var(--foreground)' }}>
                          <SelectItem value="PUBLIC">Public</SelectItem>
                          <SelectItem value="CONNECTIONS">Connections only</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {liUploadState === 'error' && (
                      <p style={{ color: '#ef4444', fontSize: 12 }}>{liUploadError}</p>
                    )}

                    <Button
                      onClick={handleLinkedInUpload}
                      disabled={liUploadState === 'uploading' || !liTitle.trim()}
                      className="w-full gap-2"
                      style={{ background: '#0a66c2', color: '#fff', border: 'none' }}
                    >
                      {liUploadState === 'uploading' ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> Posting to LinkedIn…</>
                      ) : (
                        <><Linkedin className="w-4 h-4" /> Post to LinkedIn</>
                      )}
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── FAILED STATE ── */}
        {exportJobStatus === 'failed' && (
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-2" style={{ color: '#ef4444' }}>
              <XCircle className="w-5 h-5" />
              <span style={{ fontSize: 14 }}>Render failed. Please try again.</span>
            </div>
            <Button onClick={handleClose} variant="outline"
              style={{ borderColor: 'rgba(255,255,255,0.15)', color: 'var(--foreground)', background: 'transparent' }}>
              Close
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
