import { NextRequest, NextResponse } from 'next/server';
import { requireAuthenticatedSession } from '@/lib/api-security';
import { createJob, updateJob } from '@/lib/mcp/wizard-jobs';

export async function POST(req: NextRequest) {
  const authResult = await requireAuthenticatedSession();
  if ('response' in authResult) return authResult.response;
  const { session } = authResult;

  try {
    const body = await req.json();
    
    // Fallback to random if not provided (though MCP client should provide one)
    const threadId = body.threadId || `mcp_preview_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    
    // Make sure job exists
    await createJob(threadId, session.user.id);
    
    // Inject the pendingPlugin state
    await updateJob(threadId, {
      status: 'running',
      state: {
        pendingPlugin: {
          pluginId: body.pluginId || `preview-plugin-${Date.now()}`,
          pluginName: body.name || 'Untitled Plugin',
          sceneCode: body.scene_code ?? body.modules?.['Scene.tsx'] ?? '',
          modules: body.modules,
          schemaJson: body.schema_json || '{}',
          dependencies: body.dependencies,
          description: body.description,
          category: body.category,
        }
      }
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://skygen.salru.in';
    const previewUrl = `${appUrl}/chat?t=${encodeURIComponent(threadId)}`;

    return NextResponse.json({
      success: true,
      threadId,
      url: previewUrl,
    });
  } catch (error) {
    console.error('[propose-preview] Failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to propose plugin' },
      { status: 500 },
    );
  }
}
