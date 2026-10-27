'use client';

// ============================================================================
// PLUGIN PREVIEW PAGE
// /preview/plugin/[id]
//
// Renders a temporary preview plugin in a full-screen Remotion Player.
// No auth required — preview links are shareable for Playwright MCP screenshots.
// Shows a "Preview mode" banner with a note to call approve_plugin_preview once satisfied.
// ============================================================================

import { useEffect, useState } from 'react';
import { Player } from '@remotion/player';
import { DynamicVideo, getCompositionConfig } from '@/lib/video/compositions/DynamicVideo';
import type { VideoInput, VideoPlan } from '@/lib/video/schemas';
import { use } from 'react';
import { useSearchParams } from 'next/navigation';

interface PluginSchema {
  properties?: Record<string, { type?: string; default?: unknown; editor?: string }>;
  defaults?: Record<string, unknown>;
}

function buildInputProps(id: string, schema: PluginSchema): { input: VideoInput; plan: VideoPlan } {
  const pluginData: Record<string, unknown> = {};

  // Use schema.defaults if available, otherwise fall back to property-level defaults
  if (schema.defaults && typeof schema.defaults === 'object') {
    Object.assign(pluginData, schema.defaults);
  } else if (schema.properties) {
    for (const [key, prop] of Object.entries(schema.properties)) {
      if (prop.default !== undefined) {
        pluginData[key] = prop.default;
      }
    }
  }

  const duration = 5; // seconds — enough to see enter animation

  const input: VideoInput = {
    videoMeta: {
      aspectRatio: '9:16',
      theme: 'dark_modern',
      fps: 30,
      // No intro/outro — getCompositionConfig defaults them to 2s each,
      // but we use initialFrame on the Player to skip the intro.
    },
    contentBlocks: [
      {
        type: 'custom-plugin',
        pluginId: id,
        pluginData,
        duration,
      } as unknown as VideoInput['contentBlocks'][0],
    ],
  };

  const plan: VideoPlan = {
    decisions: [
      {
        componentId: 'custom-plugin',
        motionProfile: 'dynamic',
        duration,
        animation: { enter: 0.4, hold: duration - 0.6, exit: 0.2 },
      },
    ],
    totalDuration: duration,
    suggestedTransitions: ['fade'],
  };

  return { input, plan };
}

function getPreviewDimensions(ratio: string) {
  switch (ratio) {
    case '9:16': return { width: 405, height: 720 };
    case '16:9': return { width: 720, height: 405 };
    case '1:1': return { width: 540, height: 540 };
    case '4:5': return { width: 432, height: 540 };
    default:    return { width: 405, height: 720 };
  }
}

export default function PluginPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const searchParams = useSearchParams();
  const isEmbedded = searchParams.get('embed') === '1';

  const [schema, setSchema] = useState<PluginSchema | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/plugins/${id}/schema`)
      .then(r => {
        if (!r.ok) throw new Error(`Schema fetch failed: ${r.status}`);
        return r.json();
      })
      .then(setSchema)
      .catch((e: Error) => setError(e.message));
  }, [id]);

  if (error) {
    return (
      <div style={isEmbedded ? styles.embeddedPage : styles.page}>
        {!isEmbedded && <Banner id={id} />}
        <div style={styles.errorBox}>Plugin schema not found: {error}</div>
      </div>
    );
  }

  if (!schema) {
    return (
      <div style={isEmbedded ? styles.embeddedPage : styles.page}>
        {!isEmbedded && <Banner id={id} />}
        <div style={styles.loading}>Loading plugin schema…</div>
      </div>
    );
  }

  const { input, plan } = buildInputProps(id, schema);
  const config = getCompositionConfig(input, plan);
  const dims = getPreviewDimensions(input.videoMeta.aspectRatio);

  return (
    <div style={isEmbedded ? styles.embeddedPage : styles.page}>
      {!isEmbedded && <Banner id={id} />}

      <div style={isEmbedded ? { ...styles.playerWrapper, ...styles.embeddedPlayerWrapper } : styles.playerWrapper}>
        <Player
          component={DynamicVideo}
          inputProps={{ input, plan }}
          durationInFrames={config.durationInFrames}
          compositionWidth={config.width}
          compositionHeight={config.height}
          fps={config.fps}
          style={{
            width: isEmbedded ? '100%' : dims.width,
            height: isEmbedded ? '100%' : dims.height,
            borderRadius: isEmbedded ? 0 : 12,
            overflow: 'hidden',
          }}
          initialFrame={config.fps * 2}
          controls={!isEmbedded}
          loop
          autoPlay
        />
      </div>

      {!isEmbedded && <p style={styles.hint}>
        Plugin ID: <code style={styles.code}>{id}</code>
      </p>}
    </div>
  );
}

function Banner({ id }: { id: string }) {
  return (
    <div style={styles.banner}>
      <span style={styles.bannerBadge}>PREVIEW MODE</span>
      <span style={styles.bannerText}>
        This is a temporary preview plugin. Once it looks correct, call{' '}
        <code style={styles.code}>approve_plugin_preview</code> to install it permanently, then{' '}
        <code style={styles.code}>delete_plugin(&quot;{id}&quot;)</code> to clean up.
      </span>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: '#0A0A0F',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 24,
    padding: '24px 16px 48px',
    fontFamily: 'system-ui, sans-serif',
  },
  embeddedPage: {
    width: '100%',
    height: '100vh',
    background: '#0A0A0F',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    fontFamily: 'system-ui, sans-serif',
  },
  banner: {
    width: '100%',
    maxWidth: 600,
    background: 'rgba(124, 58, 237, 0.15)',
    border: '1px solid rgba(124, 58, 237, 0.4)',
    borderRadius: 10,
    padding: '12px 16px',
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
    color: '#C4B5FD',
    fontSize: 13,
    lineHeight: 1.5,
  },
  bannerBadge: {
    background: '#7C3AED',
    color: '#fff',
    borderRadius: 4,
    padding: '2px 7px',
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.06em',
    whiteSpace: 'nowrap',
    marginTop: 2,
  },
  bannerText: {
    flex: 1,
  },
  playerWrapper: {
    boxShadow: '0 0 60px rgba(124, 58, 237, 0.2)',
    borderRadius: 14,
    overflow: 'hidden',
    border: '1px solid rgba(255,255,255,0.08)',
  },
  embeddedPlayerWrapper: {
    height: '100%',
    maxHeight: '100vh',
    aspectRatio: '9 / 16',
  },
  errorBox: {
    color: '#f87171',
    background: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    borderRadius: 8,
    padding: '12px 20px',
    fontSize: 14,
  },
  loading: {
    color: '#8B8BAA',
    fontSize: 14,
    marginTop: 40,
  },
  hint: {
    color: '#55556A',
    fontSize: 12,
    margin: 0,
  },
  code: {
    fontFamily: 'monospace',
    background: 'rgba(255,255,255,0.06)',
    padding: '1px 5px',
    borderRadius: 4,
    color: '#A78BFA',
  },
};
