/**
 * One-time Google OAuth2 setup script.
 * Run this once per Google account you want to connect.
 *
 * Usage:
 *   npm run setup-google                    # Sets up the "primary" account
 *   npm run setup-google -- --account work  # Sets up a "work" account
 *   npm run setup-google -- --account personal
 *
 * Tokens are saved to data/google-tokens-<account>.json (gitignored).
 * The account registry is saved to data/google-accounts.json.
 */

import 'dotenv/config';
import readline from 'readline';
import { google } from 'googleapis';
import { createOAuth2Client, saveTokens, registerAccount } from '../src/tools/google/auth.js';

const SCOPES = [
  // Google Workspace
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/drive',
  // Google Cloud Platform (umbrella scope for all GCP management APIs)
  'https://www.googleapis.com/auth/cloud-platform',
  // Google Workspace Admin SDK
  'https://www.googleapis.com/auth/admin.directory.user',
  'https://www.googleapis.com/auth/admin.directory.group',
  'https://www.googleapis.com/auth/admin.directory.orgunit',
  'https://www.googleapis.com/auth/admin.reports.audit.readonly',
];

// Parse --account <name> from CLI args
function parseAccountId(): string {
  const args = process.argv.slice(2);
  const idx = args.indexOf('--account');
  if (idx !== -1 && args[idx + 1]) {
    const name = args[idx + 1].trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    if (name) return name;
  }
  return 'primary';
}

async function main() {
  const accountId = parseAccountId();
  console.log(`\n── Google OAuth2 Setup (account: "${accountId}") ───────────\n`);

  const client = createOAuth2Client();

  const authUrl = client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent', // Always get a refresh_token
  });

  console.log('1. Open this URL in your browser:\n');
  console.log('   ' + authUrl);
  console.log('\n2. Sign in with your Google account and grant access.');
  console.log('3. Copy the authorisation code shown and paste it below.\n');

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const code = await new Promise<string>((resolve) => {
    rl.question('Authorisation code: ', (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });

  if (!code) {
    console.error('No code entered. Exiting.');
    process.exit(1);
  }

  try {
    const { tokens } = await client.getToken(code);
    client.setCredentials(tokens);

    // Resolve the authenticated email address
    let email = accountId;
    try {
      const oauth2 = google.oauth2({ version: 'v2', auth: client });
      const info = await oauth2.userinfo.get();
      email = info.data.email ?? accountId;
    } catch {
      // Non-fatal — email resolution is best-effort
    }

    saveTokens(client, accountId);
    registerAccount(accountId, email);

    console.log(`\n✅  Account "${accountId}" authorised as ${email}`);
    console.log(`    Tokens saved to data/google-tokens-${accountId}.json`);
    console.log(`    Account registry updated at data/google-accounts.json`);
    console.log('\n   To add another account:');
    console.log('     npm run setup-google -- --account personal\n');
    console.log('   To start the agent:');
    console.log('     npm start\n');
  } catch (err: any) {
    console.error('\n❌  Failed to exchange code for tokens:', err?.message ?? err);
    console.error('    Make sure the code is correct and has not expired.\n');
    process.exit(1);
  }
}

main();
