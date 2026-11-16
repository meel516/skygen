import { beforeEach, expect, mock, test } from 'bun:test';
import fs from 'node:fs';
import vm from 'node:vm';
import { NextRequest } from 'next/server';

const code = fs.readFileSync('public/editor-media-cache-sw.js', 'utf8');
let entries: Map<string, Response>;
let network: ReturnType<typeof mock>;
let cache: any;
let worker: any;
const keyOf = (key: Request | string) => typeof key === 'string' ? key : key.url;
function createWorker() {
  const context = vm.createContext({
    self: { location: { origin: 'https://skygen.test' }, addEventListener() {}, skipWaiting() {}, clients: { claim() {} } },
    caches: { open: async () => cache }, fetch: (...args: any[]) => network(...args),
    URL, Request, Response, Headers, Blob, Date, console,
  });
  vm.runInContext(code, context);
  return context;
}
const request = (url = 'https://media.test/clip.mp4', range?: string) => new Request(url, { headers: range ? { Range: range } : {} });
beforeEach(() => {
  entries = new Map();
  cache = {
    match: async (key: Request | string) => entries.get(keyOf(key))?.clone(),
    put: async (key: Request | string, response: Response) => { entries.set(keyOf(key), response.clone()); },
    delete: async (key: Request | string) => entries.delete(keyOf(key)),
    keys: async () => [...entries.keys()].map(url => new Request(url)),
  };
  network = mock(async () => new Response('0123456789', { headers: { 'content-type': 'video/mp4' } }));
  worker = createWorker();
});

test('video is fetched once and cached across playback and worker restarts', async () => {
  expect(await (await worker.getMediaResponse(request())).text()).toBe('0123456789');
  expect(await (await worker.getMediaResponse(request())).text()).toBe('0123456789');
  expect(await (await createWorker().getMediaResponse(request())).text()).toBe('0123456789');
  expect(network).toHaveBeenCalledTimes(1);
});

test('seeking and suffix ranges use the complete cached asset', async () => {
  const first = await worker.getMediaResponse(request(undefined, 'bytes=0-0'));
  expect(first.status).toBe(206);
  expect(first.headers.get('content-range')).toBe('bytes 0-0/10');
  expect(await first.text()).toBe('0');
  expect(await (await worker.getMediaResponse(request(undefined, 'bytes=5-'))).text()).toBe('56789');
  expect(await (await worker.getMediaResponse(request(undefined, 'bytes=-2'))).text()).toBe('89');
  expect((await worker.getMediaResponse(request(undefined, 'bytes=20-30'))).status).toBe(416);
  expect(network).toHaveBeenCalledTimes(1);
  expect((network.mock.calls[0][0] as Request).headers.get('range')).toBeNull();
});

test('simultaneous requests for one clip share one download', async () => {
  await Promise.all([worker.getMediaResponse(request()), worker.getMediaResponse(request(undefined, 'bytes=2-5'))]);
  expect(network).toHaveBeenCalledTimes(1);
});

test('at most two complete assets download at a time', async () => {
  const releases: Array<() => void> = [];
  let active = 0;
  let peak = 0;
  network.mockImplementation(async () => {
    active++;
    peak = Math.max(peak, active);
    await new Promise<void>(resolve => releases.push(resolve));
    active--;
    return new Response('asset', { headers: { 'content-type': 'video/mp4' } });
  });
  const tasks = [1, 2, 3].map(i => worker.getMediaResponse(request(`https://media.test/${i}.mp4`)));
  await Bun.sleep(10);
  expect(releases.length).toBe(2);
  releases.splice(0).forEach(release => release());
  await Bun.sleep(10);
  releases.splice(0).forEach(release => release());
  await Promise.all(tasks);
  expect(peak).toBe(2);
});

test('images, audio, and URL changes have independent cache entries', async () => {
  for (const [ext, type] of [['png', 'image/png'], ['mp3', 'audio/mpeg']]) {
    network.mockImplementation(async () => new Response('asset', { headers: { 'content-type': type } }));
    const url = `https://media.test/asset.${ext}?version=1`;
    await worker.getMediaResponse(request(url));
    await worker.getMediaResponse(request(url));
    await worker.getMediaResponse(request(url.replace('version=1', 'version=2')));
  }
  expect(network).toHaveBeenCalledTimes(4);
});

test('expired assets fetch fresh bytes', async () => {
  await worker.getMediaResponse(request());
  const old = entries.get(request().url)!;
  const headers = new Headers(old.headers);
  headers.set('x-skygen-cache-expires', '1');
  entries.set(request().url, new Response('old', { headers }));
  await worker.getMediaResponse(request());
  expect(network).toHaveBeenCalledTimes(2);
});

test('failures, nonmedia responses, and no-store assets never enter the cache', async () => {
  for (const options of [{ status: 404 }, { headers: { 'content-type': 'application/json' } },
    { headers: { 'content-type': 'video/mp4', 'cache-control': 'no-store' } },
    { headers: { 'content-type': 'video/mp4', 'content-length': String(100 * 1024 * 1024) } }]) {
    network.mockImplementation(async () => new Response('data', options));
    await worker.getMediaResponse(request());
    expect(entries.size).toBe(0);
  }
});

test('cached HEAD requests return headers without another download', async () => {
  await worker.getMediaResponse(request());
  const response = await worker.getMediaResponse(new Request(request().url, { method: 'HEAD' }));
  expect(await response.text()).toBe('');
  expect(response.headers.get('content-length')).toBe('10');
  expect(network).toHaveBeenCalledTimes(1);
});

test('storage quota errors still return the downloaded asset', async () => {
  cache.put = async () => { throw new Error('Quota exceeded'); };
  expect(await (await worker.getMediaResponse(request())).text()).toBe('0123456789');
  expect(network).toHaveBeenCalledTimes(1);
});

test('oldest entries are evicted to keep storage within 256 MB', async () => {
  for (let i = 0; i < 5; i++) entries.set(`https://media.test/${i}.mp4`, new Response('fake', { headers: {
    'content-length': String(60 * 1024 * 1024), 'x-skygen-cache-created': String(i),
  } }));
  await worker.trimCache(cache, 20 * 1024 * 1024);
  expect(entries.size).toBe(3);
  expect(entries.has('https://media.test/0.mp4')).toBe(false);
  expect(entries.has('https://media.test/1.mp4')).toBe(false);
});

test('API data, authenticated requests and complex ranges are left alone', () => {
  expect(worker.isMediaRequest(new Request('https://skygen.test/api/user/videos'))).toBe(false);
  expect(worker.isMediaRequest(new Request(request().url, { headers: { Authorization: 'Bearer private' } }))).toBe(false);
  expect(worker.isMediaRequest(request(undefined, 'bytes=0-1,3-4'))).toBe(false);
  expect(worker.isMediaRequest(request())).toBe(true);
});

const { GET, HEAD } = await import('../src/app/api/proxy-media/route');
test('proxy preserves validators and forwards HEAD without downloading the body', async () => {
  const original = globalThis.fetch;
  const fetchMock = mock(async () => new Response(null, { status: 200, headers: { ETag: 'asset-v1', 'content-type': 'video/mp4' } }));
  globalThis.fetch = fetchMock as any;
  try {
    const response = await HEAD(new NextRequest('https://skygen.test/api/proxy-media?url=https://media.test/video.mp4', { method: 'HEAD' }));
    expect(fetchMock.mock.calls[0][1].method).toBe('HEAD');
    expect(response.headers.get('etag')).toBe('asset-v1');
    expect(response.headers.get('cache-control')).toBe('private, max-age=3600');
    expect(await response.text()).toBe('');
  } finally { globalThis.fetch = original; }
});

test('proxy forwards conditional requests and passes through 304', async () => {
  const original = globalThis.fetch;
  const fetchMock = mock(async () => new Response(null, { status: 304, headers: { ETag: 'asset-v1' } }));
  globalThis.fetch = fetchMock as any;
  try {
    const response = await GET(new NextRequest('https://skygen.test/api/proxy-media?url=https://media.test/video.mp4', { headers: { 'If-None-Match': 'asset-v1' } }));
    expect(fetchMock.mock.calls[0][1].headers.get('if-none-match')).toBe('asset-v1');
    expect(response.status).toBe(304);
  } finally { globalThis.fetch = original; }
});
