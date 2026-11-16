/* Encoded media only: scoped to /editor, never stores decoded video frames. */
const CACHE_NAME = 'skygen-editor-media-v1';
const MAX_BYTES = 256 * 1024 * 1024;
const MAX_ASSET_BYTES = 64 * 1024 * 1024;
const MAX_ENTRIES = 128;
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
const inFlight = new Map();
const lastAccess = new Map();
let cacheWrites = Promise.resolve();
let activeDownloads = 0;
const downloadQueue = [];

async function withDownloadSlot(task) {
  if (activeDownloads < 2) activeDownloads++;
  else await new Promise(resolve => downloadQueue.push(resolve));
  try { return await task(); }
  finally {
    const next = downloadQueue.shift();
    if (next) next(); else activeDownloads--;
  }
}

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil((async () => {
  for (const name of await caches.keys()) {
    if (name.startsWith('skygen-editor-media-') && name !== CACHE_NAME) await caches.delete(name);
  }
  await self.clients.claim();
})()));

function isMediaRequest(request) {
  if (!['GET', 'HEAD'].includes(request.method) || request.headers.has('authorization') ||
      ['reload', 'no-store'].includes(request.cache) || request.headers.has('if-range')) return false;
  const range = request.headers.get('range');
  if (range && !/^bytes=(?:\d+-\d*|-\d+)$/.test(range)) return false;
  const url = new URL(request.url);
  if (!['https:', 'http:'].includes(url.protocol)) return false;
  if (url.origin === self.location.origin && url.pathname.startsWith('/api/')) {
    if (url.pathname === '/api/proxy-media') {
      try {
        const source = new URL(url.searchParams.get('url'));
        if (/\.(json|pbf|m3u8|mpd)$/i.test(source.pathname) || source.pathname.includes('/styles/')) return false;
      } catch { return false; }
      return true;
    }
    return url.pathname.startsWith('/api/music/');
  }
  return ['image', 'audio', 'video', 'font'].includes(request.destination) ||
    /\.(mp4|webm|mov|m4v|mp3|wav|ogg|m4a|aac|flac|opus|png|jpe?g|webp|gif|avif|svg|woff2?|ttf|otf)$/i.test(url.pathname);
}

function isFresh(response) {
  return Number(response.headers.get('x-skygen-cache-expires')) > Date.now();
}

async function trimCache(cache, incomingBytes) {
  const entries = await Promise.all((await cache.keys()).map(async key => {
    const response = await cache.match(key);
    return { key, bytes: Number(response?.headers.get('content-length')) || 0,
      accessed: lastAccess.get(key.url) || Number(response?.headers.get('x-skygen-cache-created')) || 0 };
  }));
  entries.sort((a, b) => a.accessed - b.accessed);
  let bytes = entries.reduce((total, item) => total + item.bytes, 0);
  let count = entries.length;
  for (const entry of entries) {
    if (bytes + incomingBytes <= MAX_BYTES && count < MAX_ENTRIES) break;
    await cache.delete(entry.key);
    lastAccess.delete(entry.key.url);
    bytes -= entry.bytes;
    count--;
  }
}

async function fetchCompleteAsset(request, cache) {
  const headers = new Headers(request.headers);
  for (const name of ['range', 'if-range', 'if-none-match', 'if-modified-since']) headers.delete(name);
  let response;
  try {
    response = await fetch(new Request(request.url, { method: 'GET', headers,
      mode: request.mode === 'no-cors' ? 'cors' : request.mode,
      credentials: request.credentials, redirect: request.redirect, cache: request.cache,
      referrer: request.referrer, referrerPolicy: request.referrerPolicy, signal: request.signal,
    }));
  } catch { return null; }
  // Partial/opaque bodies cannot be used to satisfy arbitrary future seeks.
  const policy = response.headers.get('cache-control') || '';
  const type = response.headers.get('content-type') || '';
  if (response.status !== 200 || /\b(no-store|no-cache)\b/i.test(policy) ||
      !/^(image|video|audio|font)\/|application\/(font|x-font|vnd\.ms-fontobject)/i.test(type) ||
      Number(response.headers.get('content-length')) > MAX_ASSET_BYTES) {
    await response.body?.cancel();
    return null;
  }
  const reader = response.body?.getReader();
  if (!reader) return null;
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_ASSET_BYTES) { await reader.cancel(); return null; }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  if (!size) return null;
  const blob = new Blob(chunks, { type });
  const storedHeaders = new Headers(response.headers);
  storedHeaders.delete('content-encoding');
  storedHeaders.delete('content-range');
  storedHeaders.set('content-length', String(size));
  storedHeaders.set('accept-ranges', 'bytes');
  const maxAge = policy.match(/(?:^|,)\s*max-age=(\d+)/i);
  const lifetime = Math.min(MAX_AGE_MS, maxAge ? Number(maxAge[1]) * 1000 : 60 * 60 * 1000);
  storedHeaders.set('x-skygen-cache-created', String(Date.now()));
  storedHeaders.set('x-skygen-cache-expires', String(Date.now() + lifetime));
  const complete = new Response(blob, { headers: storedHeaders });
  // Serialize accounting and eviction so parallel downloads cannot bypass limits.
  cacheWrites = cacheWrites.catch(() => {}).then(async () => {
    await cache.delete(request.url);
    await trimCache(cache, size);
    await cache.put(request.url, complete.clone());
    lastAccess.set(request.url, Date.now());
  });
  try { await cacheWrites; } catch { /* Disk quota/private browsing: still serve the downloaded body. */ }
  return complete;
}

async function responseForRequest(response, request) {
  const headers = new Headers(response.headers);
  for (const name of ['x-skygen-cache-created', 'x-skygen-cache-expires']) headers.delete(name);
  if (request.method === 'HEAD') return new Response(null, { headers });
  const range = request.headers.get('range');
  if (!range) return new Response(response.body, { headers });
  const blob = await response.blob();
  const [, first, last] = /^bytes=(\d*)-(\d*)$/.exec(range);
  const start = first ? Number(first) : Math.max(0, blob.size - Number(last));
  const end = first ? (last ? Math.min(Number(last), blob.size - 1) : blob.size - 1) : blob.size - 1;
  if (start >= blob.size || start > end || (!first && Number(last) === 0)) {
    headers.set('content-range', `bytes */${blob.size}`);
    headers.set('content-length', '0');
    return new Response(null, { status: 416, headers });
  }
  headers.set('content-range', `bytes ${start}-${end}/${blob.size}`);
  headers.set('content-length', String(end - start + 1));
  return new Response(blob.slice(start, end + 1), { status: 206, headers });
}

async function getMediaResponse(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request.url);
  if (cached && isFresh(cached)) {
    lastAccess.set(request.url, Date.now());
    return responseForRequest(cached, request);
  }
  if (cached) { await cache.delete(request.url); lastAccess.delete(request.url); }
  // An uncached HEAD should not download an entire video.
  if (request.method === 'HEAD') return fetch(request);
  if (!inFlight.has(request.url)) {
    const task = withDownloadSlot(() => fetchCompleteAsset(request, cache)).finally(() => inFlight.delete(request.url));
    inFlight.set(request.url, task);
  }
  const complete = await inFlight.get(request.url);
  return complete ? responseForRequest(complete.clone(), request) : fetch(request);
}

self.addEventListener('fetch', event => {
  if (!isMediaRequest(event.request)) return;
  // Storage/network errors fall back to the original streaming request.
  event.respondWith(getMediaResponse(event.request).catch(() => fetch(event.request)));
});
