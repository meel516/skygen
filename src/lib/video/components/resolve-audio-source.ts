/** Select a browser-readable source without forcing CORS-enabled hosts through Vercel. */
export async function resolveAudioSource(src: string, origin: string): Promise<string> {
  if (src.startsWith('data:') || src.startsWith('blob:')) return src;
  let direct = new URL(src, origin);
  if (direct.origin === origin && direct.pathname === '/api/proxy-media') {
    const original = direct.searchParams.get('url');
    if (original) direct = new URL(original);
  }
  if (direct.origin === origin) return src;
  if (!['https:', 'http:'].includes(direct.protocol)) return src;
  try {
    // A real CORS fetch verifies access from this browser, not the server's IP.
    const response = await fetch(direct.href, {
      headers: { Range: 'bytes=0-0' },
      signal: AbortSignal.timeout(10000),
    });
    await response.body?.cancel();
    if (response.ok) return direct.href;
  } catch { /* CORS restrictions or network failure: try the server proxy. */ }
  return `/api/proxy-media?url=${encodeURIComponent(direct.href)}`;
}
