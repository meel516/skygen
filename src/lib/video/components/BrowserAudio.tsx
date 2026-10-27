import React, { useLayoutEffect, useState } from 'react';
import { Audio } from '@remotion/media';
import { useDelayRender } from 'remotion';
import { resolveAudioSource } from './resolve-audio-source';

export function BrowserAudio(props: React.ComponentProps<typeof Audio>) {
  const { delayRender, continueRender, cancelRender } = useDelayRender();
  const [resolved, setResolved] = useState<{ original: string; url: string; handle: number } | null>(null);
  useLayoutEffect(() => {
    const handle = delayRender('Checking audio source access');
    let active = true;
    // Preserve custom request headers/credentials on the original media component.
    const task = props.requestInit || props.credentials
      ? Promise.resolve(props.src)
      : resolveAudioSource(props.src, window.location.origin);
    void task.then(url => {
      if (active) setResolved({ original: props.src, url, handle });
    }).catch(error => { if (active) cancelRender(error); });
    return () => { active = false; continueRender(handle); };
  }, [props.src, props.requestInit, props.credentials, delayRender, continueRender, cancelRender]);
  useLayoutEffect(() => {
    if (resolved?.original === props.src) continueRender(resolved.handle);
  }, [resolved, props.src, continueRender]);
  if (resolved?.original !== props.src) return null;
  return <Audio {...props} src={resolved.url} />;
}
