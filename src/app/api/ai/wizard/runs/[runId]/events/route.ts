import { proxyWizardRequest, missingMastraConfigResponse } from '../../../proxy';

export const maxDuration = 300;

export async function GET(
  req: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  try {
    const { runId } = await params;
    return await proxyWizardRequest(req, `/wizard/runs/${encodeURIComponent(runId)}/events`);
  } catch (error) {
    return missingMastraConfigResponse(error);
  }
}
