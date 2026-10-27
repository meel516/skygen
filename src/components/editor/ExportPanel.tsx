'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Download,
  Upload,
  Youtube,
  Link,
  Copy,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  Loader2,
  ExternalLink,
  FileVideo,
  Unlink,
  Linkedin,
} from 'lucide-react';

interface ExportPanelProps {
  videoBlob?: Blob | null;
  onDownload?: () => void;
  onYouTubeUpload?: (title: string, description: string, privacy: string) => void;
}

export function ExportPanel({ videoBlob, onDownload, onYouTubeUpload }: ExportPanelProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<'export' | 'youtube' | 'linkedin'>('export');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [videoTitle, setVideoTitle] = useState('My Video');
  const [videoDescription, setVideoDescription] = useState('');
  const [videoPrivacy, setVideoPrivacy] = useState<'private' | 'public' | 'unlisted'>('private');
  const [copied, setCopied] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  // YouTube connection
  const [ytConnected, setYtConnected] = useState(false);
  const [ytStatusLoading, setYtStatusLoading] = useState(true);

  // LinkedIn connection
  const [liConnected, setLiConnected] = useState(false);
  const [liStatusLoading, setLiStatusLoading] = useState(true);
  const [liUploading, setLiUploading] = useState(false);
  const [liProgress, setLiProgress] = useState(0);
  const [liPostUrl, setLiPostUrl] = useState('');
  const [liShowSuccess, setLiShowSuccess] = useState(false);
  const [liDisconnecting, setLiDisconnecting] = useState(false);
  const [liTitle, setLiTitle] = useState('My Video');
  const [liDescription, setLiDescription] = useState('');
  const [liVisibility, setLiVisibility] = useState<'PUBLIC' | 'CONNECTIONS'>('PUBLIC');

  useEffect(() => {
    fetch('/api/youtube/status')
      .then((r) => r.json())
      .then((data) => setYtConnected(data.connected ?? false))
      .catch(() => setYtConnected(false))
      .finally(() => setYtStatusLoading(false));

    fetch('/api/linkedin/status')
      .then((r) => r.json())
      .then((data) => setLiConnected(data.connected ?? false))
      .catch(() => setLiConnected(false))
      .finally(() => setLiStatusLoading(false));
  }, []);

  const handleCopyLink = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── YouTube Upload ──────────────────────────────────────────────────────
  const handleYouTubeUpload = async () => {
    if (!videoBlob || !ytConnected) return;

    setIsUploading(true);
    setUploadProgress(10);

    try {
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => Math.min(prev + 10, 90));
      }, 500);

      const reader = new FileReader();
      const videoData = await new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(videoBlob);
      });

      setUploadProgress(50);

      const response = await fetch('/api/youtube/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoData,
          title: videoTitle,
          description: videoDescription,
          privacyStatus: videoPrivacy,
        }),
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      const data = await response.json();

      if (response.ok && data.video) {
        setYoutubeUrl(data.video.url);
        setShowSuccess(true);
        onYouTubeUpload?.(videoTitle, videoDescription, videoPrivacy);
      } else {
        throw new Error(data.error || 'Upload failed');
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('Upload failed. Please try again.');
    } finally {
      setIsUploading(false);
      setTimeout(() => setUploadProgress(0), 1000);
    }
  };

  const handleConnectYouTube = () => {
    window.location.href = '/api/youtube/auth';
  };

  const handleDisconnectYouTube = async () => {
    setIsDisconnecting(true);
    try {
      await fetch('/api/youtube/disconnect', { method: 'DELETE' });
      setYtConnected(false);
    } catch {
      // ignore
    } finally {
      setIsDisconnecting(false);
    }
  };

  // ── LinkedIn Upload ─────────────────────────────────────────────────────
  const handleLinkedInUpload = async () => {
    if (!videoBlob || !liConnected) return;

    setLiUploading(true);
    setLiProgress(10);

    try {
      const progressInterval = setInterval(() => {
        setLiProgress((prev) => Math.min(prev + 8, 90));
      }, 600);

      const reader = new FileReader();
      const videoData = await new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(videoBlob);
      });

      setLiProgress(50);

      const response = await fetch('/api/linkedin/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoData,
          title: liTitle,
          description: liDescription,
          visibility: liVisibility,
        }),
      });

      clearInterval(progressInterval);
      setLiProgress(100);

      const data = await response.json();

      if (response.ok && data.post) {
        setLiPostUrl(data.post.url);
        setLiShowSuccess(true);
      } else {
        throw new Error(data.error || 'Upload failed');
      }
    } catch (error) {
      console.error('LinkedIn upload error:', error);
      alert('LinkedIn upload failed. Please try again.');
    } finally {
      setLiUploading(false);
      setTimeout(() => setLiProgress(0), 1000);
    }
  };

  const handleConnectLinkedIn = () => {
    window.location.href = '/api/linkedin/auth';
  };

  const handleDisconnectLinkedIn = async () => {
    setLiDisconnecting(true);
    try {
      await fetch('/api/linkedin/disconnect', { method: 'DELETE' });
      setLiConnected(false);
    } catch {
      // ignore
    } finally {
      setLiDisconnecting(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed top-4 right-4 z-50 bg-gradient-to-r from-cyan-600 to-indigo-600 text-slate-900 dark:text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 hover:from-cyan-700 hover:to-indigo-700 transition-all"
      >
        <FileVideo className="w-4 h-4" />
        Export
        <ChevronUp className="w-4 h-4" />
      </button>
    );
  }

  return (
    <div className="fixed top-4 right-4 z-50 w-80 bg-gray-900/95 backdrop-blur-xl rounded-xl shadow-2xl border border-gray-700/50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-800/50 border-b border-gray-700/50">
        <div className="flex items-center gap-2">
          <FileVideo className="w-5 h-5 text-cyan-400" />
          <span className="font-semibold text-slate-900 dark:text-white">Export</span>
        </div>
        <button
          onClick={() => setIsOpen(false)}
          className="p-1 hover:bg-gray-700 rounded-lg transition-colors"
        >
          <ChevronDown className="w-5 h-5 text-gray-400" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-700/50">
        <button
          onClick={() => setActiveTab('export')}
          className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
            activeTab === 'export'
              ? 'text-cyan-400 border-b-2 border-cyan-400 bg-gray-800/30'
              : 'text-gray-400 hover:text-slate-900 dark:text-white'
          }`}
        >
          Download
        </button>
        <button
          onClick={() => setActiveTab('youtube')}
          className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
            activeTab === 'youtube'
              ? 'text-red-400 border-b-2 border-red-400 bg-gray-800/30'
              : 'text-gray-400 hover:text-slate-900 dark:text-white'
          }`}
        >
          YouTube
        </button>
        <button
          onClick={() => setActiveTab('linkedin')}
          className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
            activeTab === 'linkedin'
              ? 'text-blue-400 border-b-2 border-blue-400 bg-gray-800/30'
              : 'text-gray-400 hover:text-slate-900 dark:text-white'
          }`}
        >
          LinkedIn
        </button>
      </div>

      <div className="p-4">
        {/* ── Download Tab ──────────────────────────────────────────── */}
        {activeTab === 'export' && (
          <div className="space-y-3">
            <Button
              onClick={onDownload}
              disabled={!videoBlob}
              className="w-full bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-700 hover:to-indigo-700"
            >
              <Download className="w-4 h-4 mr-2" />
              Download MP4
            </Button>
            <p className="text-xs text-gray-500 text-center">
              Render a video first to enable export options
            </p>
          </div>
        )}

        {/* ── YouTube Tab ──────────────────────────────────────────── */}
        {activeTab === 'youtube' && (
          <div className="space-y-3">
            {showSuccess && youtubeUrl ? (
              <div className="text-center space-y-3">
                <div className="w-12 h-12 mx-auto bg-green-500/20 rounded-full flex items-center justify-center">
                  <Check className="w-6 h-6 text-green-500" />
                </div>
                <p className="text-green-400 font-medium">Uploaded to YouTube!</p>
                <div className="flex items-center gap-2 bg-gray-800 rounded-lg p-2">
                  <Link className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <input type="text" value={youtubeUrl} readOnly className="flex-1 bg-transparent text-sm text-slate-900 dark:text-white outline-none" />
                  <button onClick={() => handleCopyLink(youtubeUrl)} className="p-1 hover:bg-gray-700 rounded transition-colors">
                    {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-gray-400" />}
                  </button>
                </div>
                <a href={youtubeUrl} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 text-red-400 hover:text-red-300 text-sm">
                  <ExternalLink className="w-4 h-4" /> View on YouTube
                </a>
                <button onClick={() => setShowSuccess(false)} className="text-xs text-gray-500 hover:text-gray-400">Upload another</button>
              </div>
            ) : isUploading ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-slate-900 dark:text-white">
                  <Loader2 className="w-5 h-5 animate-spin text-red-400" />
                  <span>Uploading to YouTube...</span>
                </div>
                <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-red-500 to-red-400 transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                </div>
                <p className="text-xs text-gray-400 text-center">{uploadProgress}%</p>
              </div>
            ) : (
              <div className="space-y-3">
                {!ytStatusLoading && (
                  <div className="flex items-center justify-between">
                    {ytConnected ? (
                      <>
                        <span className="flex items-center gap-1.5 text-xs text-green-400"><Check className="w-3 h-3" /> YouTube connected</span>
                        <button onClick={handleDisconnectYouTube} disabled={isDisconnecting} className="flex items-center gap-1 text-xs text-gray-500 hover:text-red-400 transition-colors">
                          <Unlink className="w-3 h-3" /> {isDisconnecting ? 'Disconnecting...' : 'Disconnect'}
                        </button>
                      </>
                    ) : (
                      <span className="text-xs text-gray-500">Not connected</span>
                    )}
                  </div>
                )}
                <input type="text" placeholder="Video title" value={videoTitle} onChange={(e) => setVideoTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-slate-900 dark:text-white text-sm placeholder-gray-500 focus:outline-none focus:border-cyan-500" />
                <textarea placeholder="Description (optional)" value={videoDescription} onChange={(e) => setVideoDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-slate-900 dark:text-white text-sm placeholder-gray-500 focus:outline-none focus:border-cyan-500 resize-none" rows={2} />
                <select value={videoPrivacy} onChange={(e) => setVideoPrivacy(e.target.value as any)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-slate-900 dark:text-white text-sm focus:outline-none focus:border-cyan-500">
                  <option value="private">Private</option>
                  <option value="unlisted">Unlisted</option>
                  <option value="public">Public</option>
                </select>
                {!ytConnected ? (
                  <Button onClick={handleConnectYouTube} disabled={ytStatusLoading} className="w-full bg-red-600 hover:bg-red-700">
                    <Youtube className="w-4 h-4 mr-2" /> {ytStatusLoading ? 'Checking...' : 'Connect YouTube'}
                  </Button>
                ) : (
                  <Button onClick={handleYouTubeUpload} disabled={!videoBlob || !videoTitle} className="w-full bg-red-600 hover:bg-red-700">
                    <Upload className="w-4 h-4 mr-2" /> Upload to YouTube
                  </Button>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── LinkedIn Tab ─────────────────────────────────────────── */}
        {activeTab === 'linkedin' && (
          <div className="space-y-3">
            {liShowSuccess && liPostUrl ? (
              <div className="text-center space-y-3">
                <div className="w-12 h-12 mx-auto bg-green-500/20 rounded-full flex items-center justify-center">
                  <Check className="w-6 h-6 text-green-500" />
                </div>
                <p className="text-green-400 font-medium">Posted to LinkedIn!</p>
                <div className="flex items-center gap-2 bg-gray-800 rounded-lg p-2">
                  <Link className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <input type="text" value={liPostUrl} readOnly className="flex-1 bg-transparent text-sm text-slate-900 dark:text-white outline-none" />
                  <button onClick={() => handleCopyLink(liPostUrl)} className="p-1 hover:bg-gray-700 rounded transition-colors">
                    {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-gray-400" />}
                  </button>
                </div>
                <a href={liPostUrl} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 text-blue-400 hover:text-blue-300 text-sm">
                  <ExternalLink className="w-4 h-4" /> View on LinkedIn
                </a>
                <button onClick={() => setLiShowSuccess(false)} className="text-xs text-gray-500 hover:text-gray-400">Post another</button>
              </div>
            ) : liUploading ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-slate-900 dark:text-white">
                  <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
                  <span>Posting to LinkedIn...</span>
                </div>
                <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all duration-300" style={{ width: `${liProgress}%` }} />
                </div>
                <p className="text-xs text-gray-400 text-center">{liProgress}%</p>
              </div>
            ) : (
              <div className="space-y-3">
                {!liStatusLoading && (
                  <div className="flex items-center justify-between">
                    {liConnected ? (
                      <>
                        <span className="flex items-center gap-1.5 text-xs text-green-400"><Check className="w-3 h-3" /> LinkedIn connected</span>
                        <button onClick={handleDisconnectLinkedIn} disabled={liDisconnecting} className="flex items-center gap-1 text-xs text-gray-500 hover:text-red-400 transition-colors">
                          <Unlink className="w-3 h-3" /> {liDisconnecting ? 'Disconnecting...' : 'Disconnect'}
                        </button>
                      </>
                    ) : (
                      <span className="text-xs text-gray-500">Not connected</span>
                    )}
                  </div>
                )}
                <input type="text" placeholder="Post title" value={liTitle} onChange={(e) => setLiTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-slate-900 dark:text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500" />
                <textarea placeholder="Post description (optional)" value={liDescription} onChange={(e) => setLiDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-slate-900 dark:text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none" rows={2} />
                <select value={liVisibility} onChange={(e) => setLiVisibility(e.target.value as any)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-slate-900 dark:text-white text-sm focus:outline-none focus:border-blue-500">
                  <option value="PUBLIC">Public</option>
                  <option value="CONNECTIONS">Connections only</option>
                </select>
                {!liConnected ? (
                  <Button onClick={handleConnectLinkedIn} disabled={liStatusLoading} className="w-full bg-blue-600 hover:bg-blue-700">
                    <Linkedin className="w-4 h-4 mr-2" /> {liStatusLoading ? 'Checking...' : 'Connect LinkedIn'}
                  </Button>
                ) : (
                  <Button onClick={handleLinkedInUpload} disabled={!videoBlob || !liTitle} className="w-full bg-blue-600 hover:bg-blue-700">
                    <Upload className="w-4 h-4 mr-2" /> Post to LinkedIn
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
