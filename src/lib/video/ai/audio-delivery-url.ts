/** Prefer a tracking-safe URL only when this object is already publicly readable. */
export async function getAudioDeliveryUrl(signedUrl: string): Promise<string> {
  const publicUrl = new URL(signedUrl);
  publicUrl.search = '';
  try {
    const response = await fetch(publicUrl, {
      method: 'HEAD',
      redirect: 'error',
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });
    if (response.ok) return publicUrl.toString();
  } catch {
    // Private or unavailable objects retain their original signed access URL.
  }
  return signedUrl;
}
