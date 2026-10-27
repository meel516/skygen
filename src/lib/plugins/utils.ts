/**
 * Normalizes a plugin name into a valid URL-safe identifier (id).
 * Must be lowercase letters, numbers, and hyphens only.
 */
export function normalizePluginId(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-') // Replace non-alphanumeric (except hyphen) with hyphen
    .replace(/^-+|-+$/g, '')      // Trim leading/trailing hyphens
    .substring(0, 64);            // Cap length for DB safety
}
