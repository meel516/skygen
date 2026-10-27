import { NextResponse } from 'next/server';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const PLUGIN_MANIFEST = {
  schema_version: 'v1',
  name_for_human: 'SkyGen Video Studio',
  name_for_model: 'skygen',
  description_for_human:
    'Create, preview, and approve Remotion video plugins directly from ChatGPT.',
  description_for_model:
    'Use SkyGen to write Remotion React code, generate live video previews, and approve final plugin compilations. Always present the returned preview URL as a clickable link to the user.',
  auth: {
    type: 'oauth',
    client_url: 'https://skygen.salru.in/oauth/authorize',
    scope: 'generate',
    authorization_url: 'https://skygen.salru.in/api/oauth/token',
    authorization_content_type: 'application/x-www-form-urlencoded',
    verification_tokens: {},
  },
  api: {
    type: 'openapi',
    url: 'https://skygen.salru.in/api/oauth/openapi.yaml',
  },
  logo_url: 'https://skygen.salru.in/icon.png',
  contact_email: 'support@skygen.salru.in',
  legal_info_url: 'https://skygen.salru.in/terms',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET() {
  return NextResponse.json(PLUGIN_MANIFEST, {
    status: 200,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
