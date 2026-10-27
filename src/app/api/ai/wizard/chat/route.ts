import { proxyWizardRequest, missingMastraConfigResponse } from '../proxy';

export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    return await proxyWizardRequest(req, '/wizard/chat');
  } catch (error) {
    return missingMastraConfigResponse(error);
  }
}
