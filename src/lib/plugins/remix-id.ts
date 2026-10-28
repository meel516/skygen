import { randomBytes } from 'crypto';
import { normalizePluginId } from './utils';

/** Reserve room for the suffix before normalization can truncate the ID. */
export function createRemixPluginId(sourcePluginId: string): string {
  const suffix = `-remix-${randomBytes(6).toString('hex')}`;
  const base = normalizePluginId(sourcePluginId)
    .slice(0, 64 - suffix.length)
    .replace(/-+$/g, '') || 'plugin';
  return `${base}${suffix}`;
}
