export const PLUGIN_PREVIEW_FORMATS = {
  '9:16': { width: 1080, height: 1920 },
  '16:9': { width: 1920, height: 1080 },
  '1:1': { width: 1080, height: 1080 },
} as const;

export type PluginPreviewFormat = keyof typeof PLUGIN_PREVIEW_FORMATS;

/** Fit the composition into its available space without changing its ratio. */
export function fitPluginPreview(availableWidth: number, availableHeight: number, format: PluginPreviewFormat) {
  const { width, height } = PLUGIN_PREVIEW_FORMATS[format];
  const scale = Math.max(0, Math.min(availableWidth / width, availableHeight / height));
  return { width: width * scale, height: height * scale };
}
