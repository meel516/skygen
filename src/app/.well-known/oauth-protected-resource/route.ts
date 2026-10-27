import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    resource: "https://skygen.salru.in/api/mcp",
    authorization_servers: ["https://skygen.salru.in"]
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
