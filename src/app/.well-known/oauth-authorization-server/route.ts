import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    issuer: "https://skygen.salru.in",
    authorization_endpoint: "https://skygen.salru.in/oauth/authorize",
    token_endpoint: "https://skygen.salru.in/api/oauth/token",
    token_endpoint_auth_methods_supported: ["none", "client_secret_post", "client_secret_basic"],
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code"],
    code_challenge_methods_supported: ["S256", "plain"],
    scopes_supported: ["generate"],
    client_id_metadata_document_supported: true
  }, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json',
    }
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
    }
  });
}
