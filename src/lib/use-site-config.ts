'use client';

import { useState, useEffect } from 'react';

interface SiteConfig {
  config: Record<string, any>;
  blockThumbnails: Record<string, string>;
}

let cachedConfig: SiteConfig | null = null;
let fetchPromise: Promise<SiteConfig> | null = null;

function fetchConfig(): Promise<SiteConfig> {
  if (cachedConfig) return Promise.resolve(cachedConfig);
  if (fetchPromise) return fetchPromise;
  fetchPromise = fetch('/api/site-config')
    .then((r) => r.json())
    .then((data) => {
      cachedConfig = data;
      return data;
    })
    .catch(() => {
      const empty = { config: {}, blockThumbnails: {} };
      cachedConfig = empty;
      return empty;
    });
  return fetchPromise;
}

export function useSiteConfig() {
  const [data, setData] = useState<SiteConfig>(cachedConfig || { config: {}, blockThumbnails: {} });

  useEffect(() => {
    fetchConfig().then(setData);
  }, []);

  return data;
}
