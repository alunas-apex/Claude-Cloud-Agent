import { Plugin, PluginContext } from '../types.js';
import { ToolModule } from '../../tools/base.js';

const JsonUtilsToolModule: ToolModule = {
  name: 'JsonUtils',
  category: 'plugin',
  description: 'JSON manipulation and transformation utilities',
  tools: [
    {
      name: 'json_format',
      description: 'Pretty-print and format a JSON string.',
      input_schema: {
        type: 'object' as const,
        properties: {
          json: { type: 'string', description: 'JSON string to format' },
          indent: { type: 'number', description: 'Indentation spaces (default: 2)' },
        },
        required: ['json'],
      },
    },
    {
      name: 'json_query',
      description: 'Extract a value from JSON using a dot-notation path (e.g. "data.users.0.name").',
      input_schema: {
        type: 'object' as const,
        properties: {
          json: { type: 'string', description: 'JSON string to query' },
          path: { type: 'string', description: 'Dot-notation path (e.g. "data.items.0.name")' },
        },
        required: ['json', 'path'],
      },
    },
    {
      name: 'json_transform',
      description: 'Pick specific fields from a JSON object or array of objects.',
      input_schema: {
        type: 'object' as const,
        properties: {
          json: { type: 'string', description: 'JSON string to transform' },
          fields: { type: 'string', description: 'Comma-separated list of fields to keep' },
        },
        required: ['json', 'fields'],
      },
    },
  ],
  handlers: {
    async json_format(input) {
      try {
        const parsed = JSON.parse(input.json as string);
        const indent = (input.indent as number) || 2;
        return JSON.stringify(parsed, null, indent);
      } catch (err: any) {
        return `Invalid JSON: ${err.message}`;
      }
    },

    async json_query(input) {
      try {
        const parsed = JSON.parse(input.json as string);
        const path = (input.path as string).split('.');
        let current: any = parsed;
        for (const key of path) {
          if (current == null) return 'null (path not found)';
          current = current[key];
        }
        return typeof current === 'object' ? JSON.stringify(current, null, 2) : String(current);
      } catch (err: any) {
        return `Error: ${err.message}`;
      }
    },

    async json_transform(input) {
      try {
        const parsed = JSON.parse(input.json as string);
        const fields = (input.fields as string).split(',').map((f: string) => f.trim());

        const pick = (obj: Record<string, unknown>) => {
          const result: Record<string, unknown> = {};
          for (const field of fields) {
            if (field in obj) result[field] = obj[field];
          }
          return result;
        };

        if (Array.isArray(parsed)) {
          return JSON.stringify(parsed.map(pick), null, 2);
        }
        return JSON.stringify(pick(parsed), null, 2);
      } catch (err: any) {
        return `Error: ${err.message}`;
      }
    },
  },
};

export const JsonUtilsPlugin: Plugin = {
  id: 'json-utils',
  name: 'JSON Utilities',
  version: '1.0.0',
  description: 'Format, query, and transform JSON data',
  author: 'Claude Cloud Agent',
  category: 'utilities',
  tools: [JsonUtilsToolModule],

  async activate(_context: PluginContext) {
    console.log('[Plugin:JsonUtils] Activated');
  },

  async deactivate() {
    console.log('[Plugin:JsonUtils] Deactivated');
  },
};
