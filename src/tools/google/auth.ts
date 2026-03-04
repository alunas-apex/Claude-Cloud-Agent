import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import fs from 'fs';
import path from 'path';

const TOKENS_PATH = path.join(process.cwd(), 'data', 'google-tokens.json');

export function createOAuth2Client(): OAuth2Client {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI ?? 'urn:ietf:wg:oauth:2.0:oob';

  if (!clientId || !clientSecret) {
    throw new Error(
      'Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET. ' +
        'Run `npm run setup-google` to complete OAuth setup.'
    );
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

export function loadTokens(client: OAuth2Client): boolean {
  if (!fs.existsSync(TOKENS_PATH)) return false;
  try {
    const raw = fs.readFileSync(TOKENS_PATH, 'utf-8');
    const tokens = JSON.parse(raw);
    client.setCredentials(tokens);
    return true;
  } catch {
    return false;
  }
}

export function saveTokens(client: OAuth2Client): void {
  const dir = path.dirname(TOKENS_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(TOKENS_PATH, JSON.stringify(client.credentials, null, 2));
}

let _client: OAuth2Client | null = null;

/**
 * Returns a singleton OAuth2 client with tokens loaded.
 * Auto-refreshes the access token if expired via the 'tokens' event.
 */
export function getAuthClient(): OAuth2Client {
  if (_client) return _client;

  _client = createOAuth2Client();
  const loaded = loadTokens(_client);

  if (!loaded) {
    throw new Error(
      'Google tokens not found. Run `npm run setup-google` first to authorise this application.'
    );
  }

  // Persist refreshed tokens automatically
  _client.on('tokens', (tokens) => {
    if (_client) {
      _client.setCredentials({ ..._client.credentials, ...tokens });
      saveTokens(_client);
    }
  });

  return _client;
}
