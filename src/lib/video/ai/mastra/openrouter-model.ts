// Switched from OpenRouter to Google AI Studio (free tier: 1500 req/day).
// Re-exported under the old name so all 5 agents keep working unchanged.
// To flip back to OpenRouter, replace this import with:
//   export { createOpenRouterModel } from '../providers/openrouter';
export { createGoogleModel as createOpenRouterModel } from '../providers/google';
