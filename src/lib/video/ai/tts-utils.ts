// TTS Utility Functions
// Creates temporary blob URLs from base64 audio for use in videos

/**
 * Convert base64 audio to Blob URL
 * @param base64Audio - Base64 encoded audio (with or without data URI prefix)
 * @returns Blob URL that can be used as audio src
 */
export function base64ToBlobUrl(base64Audio: string): string {
  // Remove data URI prefix if present
  const base64Data = base64Audio.replace(/^data:audio\/[^;]+;base64,/, '');

  // Decode base64 to binary
  const binaryString = atob(base64Data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  // Create blob
  const blob = new Blob([bytes], { type: 'audio/wav' });
  const url = URL.createObjectURL(blob);

  return url;
}

/**
 * Check if a string is a valid audio URL (http, https, or blob)
 */
export function isValidAudioUrl(url: string): boolean {
  if (!url) return false;
  return url.startsWith('http://') ||
         url.startsWith('https://') ||
         url.startsWith('blob:');
}

/**
 * Check if string is base64 audio
 */
export function isBase64Audio(str: string): boolean {
  if (!str) return false;
  return str.startsWith('data:audio/');
}
