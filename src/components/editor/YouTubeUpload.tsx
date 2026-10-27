'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Youtube, Upload, Loader2, CheckCircle, AlertCircle } from '@/components/ui/studio-icons';

interface YouTubeUploadProps {
  videoBlob: Blob;
  onSuccess?: (videoId: string, url: string) => void;
}

export function YouTubeUpload({ videoBlob, onSuccess }: YouTubeUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [title, setTitle] = useState('My Video');
  const [description, setDescription] = useState('');
  const [privacy, setPrivacy] = useState<'private' | 'public' | 'unlisted'>('private');
  const [isConnected, setIsConnected] = useState(false);
  const [statusLoading, setStatusLoading] = useState(true);

  useEffect(() => {
    fetch('/api/youtube/status')
      .then((r) => r.json())
      .then((data) => setIsConnected(data.connected ?? false))
      .catch(() => setIsConnected(false))
      .finally(() => setStatusLoading(false));
  }, []);

  const handleConnectYouTube = () => {
    window.location.href = '/api/youtube/auth';
  };

  const handleUpload = async () => {
    if (!isConnected) {
      handleConnectYouTube();
      return;
    }

    setIsUploading(true);
    setUploadStatus('idle');

    try {
      // Convert blob to base64
      const reader = new FileReader();
      const videoData = await new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(videoBlob);
      });

      const response = await fetch('/api/youtube/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoData,
          title,
          description,
          privacyStatus: privacy,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      setUploadStatus('success');
      setYoutubeUrl(data.video.url);
      onSuccess?.(data.video.id, data.video.url);
    } catch (error) {
      console.error('Upload error:', error);
      setUploadStatus('error');
    } finally {
      setIsUploading(false);
    }
  };

  if (uploadStatus === 'success') {
    return (
      <div className="flex flex-col items-center gap-3 p-4 bg-green-50 rounded-sm">
        <CheckCircle className="w-8 h-8 text-green-600" />
        <p className="text-green-700 font-medium">Video uploaded to YouTube!</p>
        {youtubeUrl && (
          <a
            href={youtubeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline"
          >
            View on YouTube →
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4 bg-background rounded-sm">
      <div className="flex items-center justify-between">
        <span className="font-medium text-foreground">Upload to YouTube</span>
        {isConnected && !statusLoading && (
          <span className="text-xs text-green-600 flex items-center gap-1">
            <CheckCircle className="w-3 h-3" /> Connected
          </span>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <input
          type="text"
          placeholder="Video title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="px-3 py-2 border rounded-sm text-sm"
        />
        <textarea
          placeholder="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="px-3 py-2 border rounded-sm text-sm"
          rows={2}
        />
        <select
          value={privacy}
          onChange={(e) => setPrivacy(e.target.value as 'private' | 'public' | 'unlisted')}
          className="px-3 py-2 border rounded-sm text-sm"
        >
          <option value="private">Private</option>
          <option value="unlisted">Unlisted</option>
          <option value="public">Public</option>
        </select>
      </div>

      {uploadStatus === 'error' && (
        <div className="flex items-center gap-2 text-red-600 text-sm">
          <AlertCircle className="w-4 h-4" />
          Upload failed. Try connecting YouTube again.
        </div>
      )}

      {!isConnected ? (
        <Button
          onClick={handleConnectYouTube}
          disabled={statusLoading}
          className="bg-red-600 hover:bg-red-700 text-foreground dark:text-white"
        >
          <Youtube className="w-4 h-4 mr-2" />
          {statusLoading ? 'Checking…' : 'Connect YouTube'}
        </Button>
      ) : (
        <Button
          onClick={handleUpload}
          disabled={isUploading || !title}
          className="bg-red-600 hover:bg-red-700 text-foreground dark:text-white"
        >
          {isUploading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Uploading...
            </>
          ) : (
            <>
              <Upload className="w-4 h-4 mr-2" />
              Upload to YouTube
            </>
          )}
        </Button>
      )}
    </div>
  );
}
