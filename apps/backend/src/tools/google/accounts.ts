import { ToolModule } from '../base.js';
import { listAccounts, setDefaultAccount, getDefaultAccountId } from './auth.js';

/**
 * AccountsToolModule — manage connected Google accounts.
 * Users can connect multiple Google accounts (work, personal, etc.) and
 * specify which account to use for any Gmail, Calendar, Drive, GCP, or Admin tool call.
 *
 * To add a new account:
 *   npm run setup-google -- --account work
 */
export const AccountsToolModule: ToolModule = {
  name: 'GoogleAccounts',

  tools: [
    {
      name: 'list_google_accounts',
      description:
        'List all connected Google accounts. Shows their account IDs, emails, and which one is the default.',
      input_schema: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
    {
      name: 'set_default_google_account',
      description:
        'Set which connected Google account is used by default when no accountId is specified in other tools.',
      input_schema: {
        type: 'object',
        properties: {
          accountId: {
            type: 'string',
            description: 'Account ID to set as default (e.g. "primary", "work", "personal").',
          },
        },
        required: ['accountId'],
      },
    },
  ],

  handlers: {
    async list_google_accounts(_input) {
      const accounts = listAccounts();
      if (accounts.length === 0) {
        return (
          'No Google accounts connected yet.\n' +
          'Run: npm run setup-google\n' +
          'To add a second account: npm run setup-google -- --account work'
        );
      }

      const defaultId = getDefaultAccountId();
      const lines = accounts.map((a) => {
        const marker = a.id === defaultId ? ' ★ (default)' : '';
        return `• ${a.id}${marker}\n  Email: ${a.email}\n  Added: ${new Date(a.addedAt).toLocaleDateString()}`;
      });

      return `Connected Google accounts:\n\n${lines.join('\n\n')}\n\nTo add another account: npm run setup-google -- --account <name>`;
    },

    async set_default_google_account(input) {
      const accountId = input.accountId as string;
      setDefaultAccount(accountId);
      return `Default Google account set to "${accountId}". All tools will now use this account unless overridden with an accountId parameter.`;
    },
  },
};
