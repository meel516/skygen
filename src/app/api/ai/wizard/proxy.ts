import { NextResponse } from 'next/server';

import { requireAuthenticatedSession } from '@/lib/api-security';

export const maxDuration = 300;

const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'content-encoding',
  'content-length',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]);

function getMastraBaseUrl(): string {
  const url = process.env.MASTRA_SERVER_URL?.trim();
  if (!url) {
    throw new Error('MASTRA_SERVER_URL is not configured');
  }
  return url.replace(/\/+$/, '');
}

function proxyRequestHeaders(req: Request): Headers {
  const headers = new Headers();
  for (const [key, value] of req.headers.entries()) {
    const lower = key.toLowerCase();
    if (HOP_BY_HOP_HEADERS.has(lower)) continue;
    if (lower === 'host') continue;
    headers.set(key, value);
  }
  return headers;
}

function proxyResponseHeaders(upstream: Response): Headers {
  const headers = new Headers();
  for (const [key, value] of upstream.headers.entries()) {
    const lower = key.toLowerCase();
    if (HOP_BY_HOP_HEADERS.has(lower)) continue;
    headers.set(key, value);
  }
  return headers;
}

export async function proxyWizardRequest(req: Request, path: string): Promise<Response> {
  const isMcpPreview = path.includes('mcp_preview_');
  if (!isMcpPreview) {
    const authResult = await requireAuthenticatedSession();
    if ('response' in authResult) return authResult.response;
  }

  const target = new URL(`${getMastraBaseUrl()}${path}`);
  const requestUrl = new URL(req.url);
  target.search = requestUrl.search;

  const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
  const upstream = await fetch(target, {
    method: req.method,
    headers: proxyRequestHeaders(req),
    body: hasBody ? await req.text() : undefined,
    redirect: 'manual',
    signal: req.signal,
  });

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: proxyResponseHeaders(upstream),
  });
}

export function missingMastraConfigResponse(error: unknown): NextResponse {
  const message = error instanceof Error ? error.message : 'Mastra proxy failed';
  return NextResponse.json({ error: message }, { status: 500 });
}
