-- OAuth 2.0 tables for ChatGPT Plugin Authorization Code flow

CREATE TABLE IF NOT EXISTS oauth_clients (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  redirect_uris TEXT[] NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS oauth_authorization_codes (
  code TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  redirect_uri TEXT NOT NULL,
  scope TEXT DEFAULT 'generate',
  code_challenge TEXT,
  code_challenge_method TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS oauth_access_tokens (
  token TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  scope TEXT DEFAULT 'generate',
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed ChatGPT as a known client (client_secret not needed for PKCE-less flows)
INSERT INTO oauth_clients (id, name, redirect_uris)
VALUES ('chatgpt', 'ChatGPT Plugin', ARRAY[
  'https://chatgpt.com/aip/g-*/oauth/callback',
  'https://chatgpt.com/oauth/callback'
])
ON CONFLICT (id) DO NOTHING;
