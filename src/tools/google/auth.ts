import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const REGISTRY_PATH = path.join(DATA_DIR, 'google-accounts.json');

// ── Account Registry ──────────────────────────────────────────────────────────

export interface GoogleAccount {
  id: string;       // e.g. "primary", "work", "personal"
  email: string;    // confirmed email after first auth
  label: string;    // human-readable label
  addedAt: string;  // ISO timestamp
}

interface AccountRegistry {
  default: string;
  accounts: GoogleAccount[];
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadRegistry(): AccountRegistry {
  ensureDataDir();
  if (!fs.existsSync(REGISTRY_PATH)) {
    return { default: 'primary', accounts: [] };
  }
  try {
    return JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf-8'));
  } catch {
    return { default: 'primary', accounts: [] };
  }
}

function saveRegistry(registry: AccountRegistry): void {
  ensureDataDir();
  fs.writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2));
}

export function listAccounts(): GoogleAccount[] {
  return loadRegistry().accounts;
}

export function getDefaultAccountId(): string {
  return loadRegistry().default;
}

export function setDefaultAccount(accountId: string): void {
  const registry = loadRegistry();
  const exists = registry.accounts.some((a) => a.id === accountId);
  if (!exists) {
    throw new Error(
      `Account "${accountId}" is not registered. Use list_google_accounts to see available accounts.`
    );
  }
  registry.default = accountId;
  saveRegistry(registry);
}

export function registerAccount(accountId: string, email: string): void {
  ensureDataDir();
  const registry = loadRegistry();
  const existing = registry.accounts.findIndex((a) => a.id === accountId);
  const account: GoogleAccount = {
    id: accountId,
    email,
    label: accountId.charAt(0).toUpperCase() + accountId.slice(1),
    addedAt: new Date().toISOString(),
  };
  if (existing >= 0) {
    registry.accounts[existing] = account;
  } else {
    registry.accounts.push(account);
  }
  // First account becomes the default
  if (registry.accounts.length === 1) registry.default = accountId;
  saveRegistry(registry);
}

// ── Token Management ──────────────────────────────────────────────────────────

function tokenPath(accountId: string): string {
  return path.join(DATA_DIR, `google-tokens-${accountId}.json`);
}

export function loadTokens(client: OAuth2Client, accountId: string): boolean {
  const filePath = tokenPath(accountId);
  if (!fs.existsSync(filePath)) return false;
  try {
    const tokens = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    client.setCredentials(tokens);
    return true;
  } catch {
    return false;
  }
}

export function saveTokens(client: OAuth2Client, accountId: string): void {
  ensureDataDir();
  fs.writeFileSync(tokenPath(accountId), JSON.stringify(client.credentials, null, 2));
}

// ── OAuth2 Client Factory ─────────────────────────────────────────────────────

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

// ── Singleton Client Cache ────────────────────────────────────────────────────

const clientCache = new Map<string, OAuth2Client>();

/**
 * Returns an authenticated OAuth2 client for the given account.
 * If accountId is omitted, uses the default account from the registry.
 *
 * To add a new account:
 *   npm run setup-google -- --account work
 *
 * All Google tool handlers accept an optional `accountId` parameter.
 */
export function getAuthClient(accountId?: string): OAuth2Client {
  const id = accountId ?? getDefaultAccountId();

  if (clientCache.has(id)) return clientCache.get(id)!;

  const client = createOAuth2Client();
  const loaded = loadTokens(client, id);

  if (!loaded) {
    const registry = loadRegistry();
    const known = registry.accounts.map((a) => `${a.id} (${a.email})`).join(', ') || 'none';
    throw new Error(
      `No tokens found for Google account "${id}". ` +
        `Run: npm run setup-google -- --account ${id}\n` +
        `Connected accounts: ${known}`
    );
  }

  // Persist refreshed tokens automatically
  client.on('tokens', (tokens) => {
    client.setCredentials({ ...client.credentials, ...tokens });
    saveTokens(client, id);
  });

  clientCache.set(id, client);
  return client;
}
