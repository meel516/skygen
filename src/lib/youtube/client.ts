import { google } from 'googleapis';
import { Readable } from 'stream';

// OAuth configuration - use your existing credentials
const CLIENT_ID = process.env.YOUTUBE_CLIENT_ID || '';
const CLIENT_SECRET = process.env.YOUTUBE_CLIENT_SECRET || '';
const REDIRECT_URI = process.env.YOUTUBE_REDIRECT_URI ||
  (process.env.NEXTAUTH_URL ? `${process.env.NEXTAUTH_URL}/api/youtube/callback` : 'http://localhost:3000/api/youtube/callback');

// Create OAuth client
export function getOAuthClient() {
  return new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
}

// Generate authorization URL for user to approve
export function getAuthUrl(state?: string): string {
  const oauth2Client = getOAuthClient();
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/youtube.upload',
      'https://www.googleapis.com/auth/youtube.readonly',
    ],
    state: state,
    prompt: 'consent',
  });
}

// Exchange authorization code for tokens
export async function getTokensFromCode(code: string) {
  const oauth2Client = getOAuthClient();
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
}

// Upload video to YouTube
export interface UploadVideoOptions {
  videoBlob: Blob;
  title: string;
  description?: string;
  tags?: string[];
  categoryId?: string;
  privacyStatus?: 'public' | 'private' | 'unlisted';
}

export interface YouTubeVideoResponse {
  id: string;
  title: string;
  url: string;
}

export async function uploadVideoToYouTube(
  tokens: { access_token?: string; refresh_token?: string },
  options: UploadVideoOptions
): Promise<YouTubeVideoResponse> {
  const oauth2Client = getOAuthClient();
  oauth2Client.setCredentials(tokens);

  // Convert Blob to Buffer then to Stream
  const arrayBuffer = await options.videoBlob.arrayBuffer();
  const videoBuffer = Buffer.from(arrayBuffer);
  const videoStream = Readable.from(videoBuffer);

  const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

  // Insert video metadata and upload
  const response = await youtube.videos.insert({
    part: ['snippet', 'status'],
    requestBody: {
      snippet: {
        title: options.title,
        description: options.description || '',
        tags: options.tags || [],
        categoryId: options.categoryId || '22',
      },
      status: {
        privacyStatus: options.privacyStatus || 'private',
        selfDeclaredMadeForKids: false,
      },
    },
    media: {
      mimeType: 'video/mp4',
      body: videoStream,
    },
  });

  const videoId = response.data.id;
  return {
    id: videoId || '',
    title: response.data.snippet?.title || options.title,
    url: `https://www.youtube.com/watch?v=${videoId}`,
  };
}

// Refresh an expired access token using the refresh token
export async function refreshAccessToken(refreshToken: string) {
  const oauth2Client = getOAuthClient();
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  const { credentials } = await oauth2Client.refreshAccessToken();
  return credentials;
}

// Check if OAuth is configured
export function isOAuthConfigured(): boolean {
  return !!(CLIENT_ID && CLIENT_SECRET);
}
