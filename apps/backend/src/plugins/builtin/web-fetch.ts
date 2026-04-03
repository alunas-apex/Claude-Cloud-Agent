import { Plugin, PluginContext } from '../types.js';
import { ToolModule } from '../../tools/base.js';

const WebFetchToolModule: ToolModule = {
  name: 'WebFetch',
  category: 'plugin',
  description: 'Fetch web pages and extract text content',
  tools: [
    {
      name: 'web_fetch',
      description: 'Fetch a web page and return its text content. Useful for reading articles, documentation, and web pages.',
      input_schema: {
        type: 'object' as const,
        properties: {
          url: { type: 'string', description: 'The URL to fetch' },
          max_length: { type: 'number', description: 'Maximum content length to return (default: 5000 chars)' },
        },
        required: ['url'],
      },
    },
    {
      name: 'web_fetch_json',
      description: 'Fetch a JSON API endpoint and return the response.',
      input_schema: {
        type: 'object' as const,
        properties: {
          url: { type: 'string', description: 'The API URL to fetch' },
          method: { type: 'string', description: 'HTTP method (GET, POST, etc.). Default: GET' },
          headers: { type: 'object', description: 'Optional HTTP headers' },
          body: { type: 'string', description: 'Optional request body for POST/PUT' },
        },
        required: ['url'],
      },
    },
  ],
  handlers: {
    async web_fetch(input) {
      const url = input.url as string;
      const maxLength = (input.max_length as number) || 5000;

      try {
        const response = await fetch(url, {
          headers: { 'User-Agent': 'Claude-Cloud-Agent/4.0' },
          signal: AbortSignal.timeout(15000),
        });

        if (!response.ok) {
          return `HTTP ${response.status}: ${response.statusText}`;
        }

        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const json = await response.json();
          return JSON.stringify(json, null, 2).slice(0, maxLength);
        }

        const html = await response.text();
        // Strip HTML tags for a rough text extraction
        const text = html
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();

        return text.slice(0, maxLength);
      } catch (err: any) {
        return `Error fetching ${url}: ${err.message}`;
      }
    },

    async web_fetch_json(input) {
      const url = input.url as string;
      const method = (input.method as string) || 'GET';
      const headers = (input.headers as Record<string, string>) || {};
      const body = input.body as string | undefined;

      try {
        const response = await fetch(url, {
          method,
          headers: { 'User-Agent': 'Claude-Cloud-Agent/4.0', 'Accept': 'application/json', ...headers },
          body: body || undefined,
          signal: AbortSignal.timeout(15000),
        });

        const data = await response.json();
        return JSON.stringify(data, null, 2).slice(0, 5000);
      } catch (err: any) {
        return `Error fetching ${url}: ${err.message}`;
      }
    },
  },
};

export const WebFetchPlugin: Plugin = {
  id: 'web-fetch',
  name: 'Web Fetch',
  version: '1.0.0',
  description: 'Fetch web pages and JSON APIs for information retrieval',
  author: 'Claude Cloud Agent',
  category: 'tools',
  tools: [WebFetchToolModule],

  async activate(_context: PluginContext) {
    console.log('[Plugin:WebFetch] Activated');
  },

  async deactivate() {
    console.log('[Plugin:WebFetch] Deactivated');
  },
};
