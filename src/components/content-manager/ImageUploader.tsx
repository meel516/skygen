'use client';

import { useState, useRef } from 'react';
import { Upload, X, Loader2 } from '@/components/ui/studio-icons';

interface ImageUploaderProps {
  value?: string;
  onChange: (url: string | null) => void;
  label?: string;
  accept?: string;
}

export function ImageUploader({ value, onChange, label, accept = 'image/*' }: ImageUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/content-manager/upload', { method: 'POST', body: formData });
      if (!res.ok) throw new Error('Upload failed');
      const { url } = await res.json();
      onChange(url);
    } catch (err) {
      console.error('Upload error:', err);
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) upload(file);
  };

  return (
    <div className="space-y-2">
      {label && <label className="text-sm text-muted-foreground">{label}</label>}
      {value ? (
        <div className="relative group">
          <img
            src={value}
            alt="Uploaded"
            className="w-full h-32 object-contain rounded-sm border border-border bg-card/50"
          />
          <button
            onClick={() => onChange(null)}
            className="absolute top-2 right-2 p-1 bg-red-500/80 rounded-full opacity-100"
          >
            <X className="w-3 h-3 text-white" />
          </button>
        </div>
      ) : (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`flex flex-col items-center justify-center h-32 rounded-sm border-2 border-dashed cursor-pointer transition-colors ${
            dragOver ? 'border-blue-500 bg-blue-500/10' : 'border-border hover:border-border bg-card/30'
          }`}
        >
          {uploading ? (
            <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
          ) : (
            <>
              <Upload className="w-6 h-6 text-muted-foreground mb-2" />
              <span className="text-xs text-muted-foreground">Drop image or click to upload</span>
            </>
          )}
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) upload(file);
          e.target.value = '';
        }}
      />
    </div>
  );
}
