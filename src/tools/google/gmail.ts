import { google } from 'googleapis';
import { ToolModule } from '../base.js';
import { getAuthClient } from './auth.js';

const ACCOUNT_ID_PROP = {
  accountId: {
    type: 'string',
    description: 'Google account to use (e.g. "work", "personal"). Defaults to primary account.',
  },
} as const;

function getGmail(accountId?: string) {
  return google.gmail({ version: 'v1', auth: getAuthClient(accountId) });
}

function decodeBody(data?: string | null): string {
  if (!data) return '';
  return Buffer.from(data, 'base64').toString('utf-8');
}

function extractBody(payload: any): string {
  if (!payload) return '';
  if (payload.body?.data) return decodeBody(payload.body.data);
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        return decodeBody(part.body.data);
      }
    }
    for (const part of payload.parts) {
      const body = extractBody(part);
      if (body) return body;
    }
  }
  return '';
}

function getHeader(headers: any[], name: string): string {
  return headers?.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value ?? '';
}

export const GmailToolModule: ToolModule = {
  name: 'Gmail',

  tools: [
    {
      name: 'list_emails',
      description:
        'List recent emails from Gmail. Optionally filter by query (same syntax as Gmail search).',
      input_schema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description:
              'Gmail search query, e.g. "is:unread", "from:alice@example.com", "subject:invoice". Defaults to inbox.',
          },
          maxResults: {
            type: 'number',
            description: 'Max number of emails to return (default 10, max 25).',
          },
          ...ACCOUNT_ID_PROP,
        },
        required: [],
      },
    },
    {
      name: 'read_email',
      description: 'Read the full content of a specific email by its message ID.',
      input_schema: {
        type: 'object',
        properties: {
          messageId: { type: 'string', description: 'Gmail message ID.' },
          ...ACCOUNT_ID_PROP,
        },
        required: ['messageId'],
      },
    },
    {
      name: 'send_email',
      description: 'Compose and send a new email.',
      input_schema: {
        type: 'object',
        properties: {
          to: { type: 'string', description: 'Recipient email address.' },
          subject: { type: 'string', description: 'Email subject.' },
          body: { type: 'string', description: 'Plain-text email body.' },
          cc: { type: 'string', description: 'CC email address (optional).' },
          ...ACCOUNT_ID_PROP,
        },
        required: ['to', 'subject', 'body'],
      },
    },
    {
      name: 'reply_to_email',
      description: 'Reply to an existing email thread.',
      input_schema: {
        type: 'object',
        properties: {
          messageId: { type: 'string', description: 'Gmail message ID to reply to.' },
          body: { type: 'string', description: 'Reply text.' },
          ...ACCOUNT_ID_PROP,
        },
        required: ['messageId', 'body'],
      },
    },
    {
      name: 'search_emails',
      description: 'Search emails and return a summary list.',
      input_schema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Gmail search query string.' },
          maxResults: { type: 'number', description: 'Max results (default 10).' },
          ...ACCOUNT_ID_PROP,
        },
        required: ['query'],
      },
    },
  ],

  handlers: {
    async list_emails(input) {
      const gmail = getGmail(input.accountId as string | undefined);
      const maxResults = Math.min((input.maxResults as number) ?? 10, 25);
      const query = (input.query as string) ?? 'in:inbox';

      const listRes = await gmail.users.messages.list({ userId: 'me', q: query, maxResults });
      const messages = listRes.data.messages ?? [];
      if (messages.length === 0) return 'No emails found matching that query.';

      const summaries = await Promise.all(
        messages.map(async (m) => {
          const msg = await gmail.users.messages.get({
            userId: 'me',
            id: m.id!,
            format: 'metadata',
            metadataHeaders: ['From', 'Subject', 'Date'],
          });
          const h = msg.data.payload?.headers ?? [];
          return `ID: ${m.id}\nFrom: ${getHeader(h, 'from')}\nSubject: ${getHeader(h, 'subject')}\nDate: ${getHeader(h, 'date')}`;
        })
      );

      return summaries.join('\n\n---\n\n');
    },

    async read_email(input) {
      const gmail = getGmail(input.accountId as string | undefined);
      const msg = await gmail.users.messages.get({
        userId: 'me',
        id: input.messageId as string,
        format: 'full',
      });

      const h = msg.data.payload?.headers ?? [];
      const body = extractBody(msg.data.payload);

      return [
        `From: ${getHeader(h, 'from')}`,
        `To: ${getHeader(h, 'to')}`,
        `Subject: ${getHeader(h, 'subject')}`,
        `Date: ${getHeader(h, 'date')}`,
        '',
        body || '(no body)',
      ].join('\n');
    },

    async send_email(input) {
      const gmail = getGmail(input.accountId as string | undefined);
      const { to, subject, body, cc } = input as {
        to: string;
        subject: string;
        body: string;
        cc?: string;
      };

      const lines = [
        `To: ${to}`,
        cc ? `Cc: ${cc}` : null,
        `Subject: ${subject}`,
        'Content-Type: text/plain; charset=utf-8',
        '',
        body,
      ]
        .filter(Boolean)
        .join('\n');

      const raw = Buffer.from(lines).toString('base64url');
      await gmail.users.messages.send({ userId: 'me', requestBody: { raw } });
      return `Email sent to ${to} with subject "${subject}".`;
    },

    async reply_to_email(input) {
      const gmail = getGmail(input.accountId as string | undefined);
      const { messageId, body } = input as { messageId: string; body: string };

      const original = await gmail.users.messages.get({
        userId: 'me',
        id: messageId,
        format: 'metadata',
        metadataHeaders: ['From', 'Subject', 'Message-ID', 'References', 'To'],
      });

      const h = original.data.payload?.headers ?? [];
      const from = getHeader(h, 'from');
      const subject = getHeader(h, 'subject');
      const msgId = getHeader(h, 'message-id');
      const threadId = original.data.threadId!;
      const replySubject = subject.startsWith('Re:') ? subject : `Re: ${subject}`;

      const lines = [
        `To: ${from}`,
        `Subject: ${replySubject}`,
        `In-Reply-To: ${msgId}`,
        `References: ${msgId}`,
        'Content-Type: text/plain; charset=utf-8',
        '',
        body,
      ].join('\n');

      const raw = Buffer.from(lines).toString('base64url');
      await gmail.users.messages.send({ userId: 'me', requestBody: { raw, threadId } });
      return `Reply sent to ${from} on thread "${replySubject}".`;
    },

    async search_emails(input) {
      return GmailToolModule.handlers.list_emails(input);
    },
  },
};
