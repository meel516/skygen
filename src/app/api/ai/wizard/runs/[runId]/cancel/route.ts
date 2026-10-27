import { proxyWizardRequest, missingMastraConfigResponse } from '../../../proxy';

export const maxDuration = 60;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  try {
    const { runId } = await params;
    return await proxyWizardRequest(req, `/wizard/runs/${encodeURIComponent(runId)}/cancel`);
  } catch (error) {
    return missingMastraConfigResponse(error);
  }
}
