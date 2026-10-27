import { proxyWizardRequest, missingMastraConfigResponse } from '../proxy';

export async function GET(req: Request) {
  try {
    return await proxyWizardRequest(req, '/wizard/threads');
  } catch (error) {
    return missingMastraConfigResponse(error);
  }
}
