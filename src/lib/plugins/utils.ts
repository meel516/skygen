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

/** Keep historical IDs that were truncated after their trailing-hyphen trim. */
export async function resolvePluginSaveId(
  input: string,
  exists: (id: string) => Promise<boolean>,
): Promise<string> {
  const normalized = normalizePluginId(input);
  if (input.length === 64 && /^[a-z0-9][a-z0-9-]*-$/.test(input) && await exists(input)) {
    return input;
  }
  return normalized;
}
