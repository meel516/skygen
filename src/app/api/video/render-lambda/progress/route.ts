import { NextRequest, NextResponse } from 'next/server';
import { requireAuthenticatedSession } from '@/lib/api-security';

/**
 * GET /api/video/render-lambda/progress?renderId=...&bucketName=...&region=...
 * 
 * Note: Rate limiting removed from this endpoint. The progress endpoint is
 * polled frequently (every few seconds) by the client to track render status.
 * It's a lightweight operation that just checks Lambda status, so rate
 * limiting was causing issues without providing much benefit.
 */
export async function GET(request: NextRequest) {
  const authResult = await requireAuthenticatedSession();
  if ('response' in authResult) {
    return authResult.response;
  }

  const { searchParams } = request.nextUrl;
  const renderId = searchParams.get('renderId');
  const bucketName = searchParams.get('bucketName');
  const region = (searchParams.get('region') || process.env.LAMBDA_REGION || 'us-east-1') as 'us-east-1';

  if (!renderId || !bucketName) {
    return NextResponse.json({ error: 'Missing renderId or bucketName' }, { status: 400 });
  }

  try {
    const { getRenderProgress } = await import('@remotion/lambda/client');

    const progress = await getRenderProgress({ renderId, bucketName, functionName: process.env.LAMBDA_FUNCTION_NAME!, region });

    return NextResponse.json({
      done: progress.done,
      overallProgress: progress.overallProgress,
      outputFile: progress.outputFile ?? null,
      errors: progress.errors ?? [],
      fatalErrorEncountered: progress.fatalErrorEncountered,
    });
  } catch (error: any) {
    console.error('Lambda progress error:', error);
    return NextResponse.json({ error: error.message || 'Failed to get progress' }, { status: 500 });
  }
}
