/**
 * One-time Google OAuth2 setup script.
 * Run this once to authorise the agent to access your Google account.
 *
 * Usage:
 *   npm run setup-google
 *
 * This will:
 *   1. Print an authorisation URL
 *   2. Ask you to paste the code from your browser
 *   3. Save the tokens to data/google-tokens.json
 */

import 'dotenv/config';
import readline from 'readline';
import { createOAuth2Client, saveTokens } from '../src/tools/google/auth.js';

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/drive',
];

async function main() {
  console.log('\n── Google OAuth2 Setup ──────────────────────────────\n');

  const client = createOAuth2Client();

  const authUrl = client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent', // Force consent to always get a refresh_token
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
    saveTokens(client);
    console.log('\n✅ Google authorisation complete! Tokens saved to data/google-tokens.json');
    console.log('   You can now start the agent with: npm start\n');
  } catch (err: any) {
    console.error('\n❌ Failed to exchange code for tokens:', err?.message ?? err);
    console.error('   Make sure the code is correct and has not expired.\n');
    process.exit(1);
  }
}

main();
