import { proxyWizardRequest, missingMastraConfigResponse } from '../../proxy';

type RouteParams = {
  params: Promise<{ threadId: string }>;
};

export async function GET(req: Request, { params }: RouteParams) {
  try {
    const { threadId } = await params;
    return await proxyWizardRequest(req, `/wizard/threads/${encodeURIComponent(threadId)}`);
  } catch (error) {
    return missingMastraConfigResponse(error);
  }
}

export async function DELETE(req: Request, { params }: RouteParams) {
  try {
    const { threadId } = await params;
    return await proxyWizardRequest(req, `/wizard/threads/${encodeURIComponent(threadId)}`, {
      method: 'DELETE',
    });
  } catch (error) {
    return missingMastraConfigResponse(error);
  }
}
