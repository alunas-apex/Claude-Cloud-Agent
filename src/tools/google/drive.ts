/**
 * Google Drive Tool Module (STUB)
 *
 * To activate:
 *  1. Ensure your Google Cloud project has the Drive API enabled
 *  2. Uncomment this module in src/index.ts
 *  3. The existing GOOGLE_CLIENT_ID/SECRET credentials are reused — no extra env vars needed
 *     (but you may need to re-run `npm run setup-google` to grant Drive scope)
 */

import { ToolModule } from '../base.js';

export const DriveToolModule: ToolModule = {
  name: 'GoogleDrive',

  tools: [
    {
      name: 'list_drive_files',
      description: 'List files in Google Drive.',
      input_schema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Drive search query (optional).' },
          maxResults: { type: 'number', description: 'Max files to return (default 10).' },
        },
        required: [],
      },
    },
    {
      name: 'read_drive_file',
      description: 'Read the text content of a Google Drive file (Docs, Sheets summary, plain text).',
      input_schema: {
        type: 'object',
        properties: {
          fileId: { type: 'string', description: 'Google Drive file ID.' },
        },
        required: ['fileId'],
      },
    },
    {
      name: 'create_drive_document',
      description: 'Create a new Google Doc with given title and content.',
      input_schema: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Document title.' },
          content: { type: 'string', description: 'Initial document content.' },
        },
        required: ['title', 'content'],
      },
    },
    {
      name: 'share_drive_file',
      description: 'Share a Drive file with a specific email address.',
      input_schema: {
        type: 'object',
        properties: {
          fileId: { type: 'string', description: 'Google Drive file ID.' },
          email: { type: 'string', description: 'Email to share with.' },
          role: {
            type: 'string',
            enum: ['reader', 'commenter', 'writer'],
            description: 'Permission level.',
          },
        },
        required: ['fileId', 'email'],
      },
    },
  ],

  handlers: {
    async list_drive_files(_input) {
      return 'Google Drive integration is not yet activated. See src/tools/google/drive.ts.';
    },
    async read_drive_file(_input) {
      return 'Google Drive integration is not yet activated. See src/tools/google/drive.ts.';
    },
    async create_drive_document(_input) {
      return 'Google Drive integration is not yet activated. See src/tools/google/drive.ts.';
    },
    async share_drive_file(_input) {
      return 'Google Drive integration is not yet activated. See src/tools/google/drive.ts.';
    },
  },
};

// TODO: Replace stub handlers above with real implementations using:
//   import { google } from 'googleapis';
//   import { getAuthClient } from './auth.js';
//   const drive = google.drive({ version: 'v3', auth: getAuthClient() });
//   const docs  = google.docs({ version: 'v1', auth: getAuthClient() });
