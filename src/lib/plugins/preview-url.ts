export function isPluginPreviewVideoUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 2048) return false;

  try {
    const url = new URL(value);
    return url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      /\.(mp4|webm)$/i.test(url.pathname);
  } catch {
    return false;
  }
}
