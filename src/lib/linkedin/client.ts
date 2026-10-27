/**
 * LinkedIn OAuth2 + Video Upload Client
 *
 * LinkedIn video upload flow (3-step):
 *   1. Register upload → get uploadUrl + video asset URN
 *   2. PUT binary to uploadUrl
 *   3. Create a post with the video asset URN
 *
 * Docs: https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/videos-api
 */

const CLIENT_ID = (process.env.LINKEDIN_CLIENT_ID || '').trim();
const CLIENT_SECRET = (process.env.LINKEDIN_CLIENT_SECRET || '').trim();
const REDIRECT_URI =
  process.env.LINKEDIN_REDIRECT_URI ||
  (process.env.NEXTAUTH_URL
    ? `${process.env.NEXTAUTH_URL}/api/linkedin/callback`
    : 'http://localhost:3000/api/linkedin/callback');

const LINKEDIN_AUTH_URL = 'https://www.linkedin.com/oauth/v2/authorization';
const LINKEDIN_TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken';
const LINKEDIN_API = 'https://api.linkedin.com/v2';
const LINKEDIN_REST_API = 'https://api.linkedin.com/rest';

// Scopes needed for video upload + posting
const SCOPES = ['openid', 'profile', 'w_member_social'];

export function isOAuthConfigured(): boolean {
  return !!(CLIENT_ID && CLIENT_SECRET);
}

/** Generate LinkedIn OAuth authorization URL */
export function getAuthUrl(state?: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope: SCOPES.join(' '),
    ...(state ? { state } : {}),
  });
  return `${LINKEDIN_AUTH_URL}?${params}`;
}

/** Exchange authorization code for tokens */
export async function getTokensFromCode(code: string): Promise<{
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  refresh_token_expires_in?: number;
}> {
  const res = await fetch(LINKEDIN_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`LinkedIn token exchange failed: ${err}`);
  }

  return res.json();
}

/** Refresh an expired access token */
export async function refreshAccessToken(refreshToken: string): Promise<{
  access_token: string;
  expires_in: number;
  refresh_token?: string;
}> {
  const res = await fetch(LINKEDIN_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`LinkedIn token refresh failed: ${err}`);
  }

  return res.json();
}

/** Get the authenticated user's LinkedIn person URN */
export async function getLinkedInPersonUrn(accessToken: string): Promise<string> {
  const res = await fetch(`${LINKEDIN_API}/userinfo`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`LinkedIn userinfo failed: ${err}`);
  }

  const data = await res.json();
  return `urn:li:person:${data.sub}`;
}

/** Upload video + create post on LinkedIn */
export interface LinkedInUploadOptions {
  videoBlob: Blob;
  title: string;
  description?: string;
  visibility?: 'PUBLIC' | 'CONNECTIONS';
}

export interface LinkedInPostResponse {
  postUrn: string;
  url: string;
}

export async function uploadVideoToLinkedIn(
  accessToken: string,
  personUrn: string,
  options: LinkedInUploadOptions
): Promise<LinkedInPostResponse> {
  const videoBuffer = Buffer.from(await options.videoBlob.arrayBuffer());

  // Step 1: Initialize video upload
  const initRes = await fetch(`${LINKEDIN_REST_API}/videos?action=initializeUpload`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'LinkedIn-Version': '202504',
      'X-Restli-Protocol-Version': '2.0.0',
    },
    body: JSON.stringify({
      initializeUploadRequest: {
        owner: personUrn,
        fileSizeBytes: videoBuffer.length,
        uploadCaptions: false,
        uploadThumbnail: false,
      },
    }),
  });

  if (!initRes.ok) {
    const err = await initRes.text();
    throw new Error(`LinkedIn video init failed: ${err}`);
  }

  const initData = await initRes.json();
  const uploadUrl = initData.value?.uploadInstructions?.[0]?.uploadUrl;
  const videoUrn = initData.value?.video;

  if (!uploadUrl || !videoUrn) {
    throw new Error('LinkedIn did not return upload URL or video URN');
  }

  // Step 2: Upload the binary
  const uploadRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/octet-stream',
    },
    body: videoBuffer,
  });

  if (!uploadRes.ok) {
    const err = await uploadRes.text();
    throw new Error(`LinkedIn video upload failed: ${err}`);
  }

  // Step 3: Finalize the upload — tells LinkedIn the binary is fully uploaded
  const etag = uploadRes.headers.get('etag') || uploadRes.headers.get('ETag') || '';
  const finalizeRes = await fetch(`${LINKEDIN_REST_API}/videos?action=finalizeUpload`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'LinkedIn-Version': '202504',
      'X-Restli-Protocol-Version': '2.0.0',
    },
    body: JSON.stringify({
      finalizeUploadRequest: {
        video: videoUrn,
        uploadToken: initData.value?.uploadToken ?? '',
        uploadedPartIds: etag ? [etag] : [],
      },
    }),
  });

  if (!finalizeRes.ok) {
    const err = await finalizeRes.text();
    throw new Error(`LinkedIn video finalize failed: ${err}`);
  }

  // Step 4: Create a post with the video
  const postRes = await fetch(`${LINKEDIN_REST_API}/posts`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'LinkedIn-Version': '202504',
      'X-Restli-Protocol-Version': '2.0.0',
    },
    body: JSON.stringify({
      author: personUrn,
      commentary: options.description || options.title,
      visibility: options.visibility === 'CONNECTIONS' ? 'CONNECTIONS' : 'PUBLIC',
      distribution: {
        feedDistribution: 'MAIN_FEED',
        targetEntities: [],
        thirdPartyDistributionChannels: [],
      },
      content: {
        media: {
          title: options.title,
          id: videoUrn,
        },
      },
      lifecycleState: 'PUBLISHED',
      isReshareDisabledByAuthor: false,
    }),
  });

  if (!postRes.ok) {
    const err = await postRes.text();
    throw new Error(`LinkedIn post creation failed: ${err}`);
  }

  // Extract post URN from response header
  const postUrn = postRes.headers.get('x-restli-id') || '';
  // Build a URL to the post — LinkedIn doesn't return a direct URL
  const activityId = postUrn.replace('urn:li:share:', '').replace('urn:li:ugcPost:', '');
  const url = activityId
    ? `https://www.linkedin.com/feed/update/${postUrn}/`
    : 'https://www.linkedin.com/feed/';

  return { postUrn, url };
}
