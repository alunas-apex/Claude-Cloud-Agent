import { ToolModule } from '../base.js';
import { MemoryService } from '../../services/memory.js';

let memoryService: MemoryService | null = null;

export function setMemoryService(service: MemoryService): void {
  memoryService = service;
}

export const MemoryToolModule: ToolModule = {
  name: 'Memory',
  category: 'system',
  tools: [
    {
      name: 'memory_store',
      description: 'Store a piece of information in long-term memory for future recall. Use this to remember important facts, user preferences, conversation summaries, or insights that may be useful later.',
      input_schema: {
        type: 'object',
        properties: {
          content: { type: 'string', description: 'The information to remember' },
          title: { type: 'string', description: 'Short title for this memory (optional)' },
          tags: {
            type: 'array',
            items: { type: 'string' },
            description: 'Tags for categorization (e.g., "preference", "project", "contact")',
          },
        },
        required: ['content'],
      },
    },
    {
      name: 'memory_search',
      description: 'Search long-term memory for relevant information using natural language. Returns semantically similar memories ranked by relevance.',
      input_schema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Natural language search query' },
          limit: { type: 'number', description: 'Maximum results to return (default: 5)' },
        },
        required: ['query'],
      },
    },
    {
      name: 'memory_recent',
      description: 'Get the most recently stored memories. Useful for reviewing what was recently remembered.',
      input_schema: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Number of recent memories (default: 5)' },
        },
      },
    },
    {
      name: 'vault_status',
      description: 'Get the status of the Obsidian vault — file count, indexed count, and sync status.',
      input_schema: {
        type: 'object',
        properties: {},
      },
    },
  ],
  handlers: {
    async memory_store(input: Record<string, unknown>) {
      if (!memoryService) return 'Error: Memory service not initialized.';

      const content = input.content as string;
      const title = input.title as string | undefined;
      const tags = input.tags as string[] | undefined;

      const id = await memoryService.store({ content, title, tags, source: 'agent' });
      return `Memory stored successfully (id: ${id}). Title: "${title || content.slice(0, 60)}"`;
    },

    async memory_search(input: Record<string, unknown>) {
      if (!memoryService) return 'Error: Memory service not initialized.';

      const query = input.query as string;
      const limit = (input.limit as number) || 5;

      const results = await memoryService.search(query, limit);

      if (results.length === 0) {
        return `No memories found matching "${query}".`;
      }

      const formatted = results.map((r, i) => {
        const title = r.metadata.title || r.id;
        const similarity = r.similarity !== undefined ? ` (${(r.similarity * 100).toFixed(0)}% match)` : '';
        const tags = r.metadata.tags ? ` [${r.metadata.tags}]` : '';
        return `${i + 1}. **${title}**${similarity}${tags}\n   ${r.content.slice(0, 200)}${r.content.length > 200 ? '...' : ''}`;
      });

      return `Found ${results.length} memories:\n\n${formatted.join('\n\n')}`;
    },

    async memory_recent(input: Record<string, unknown>) {
      if (!memoryService) return 'Error: Memory service not initialized.';

      const limit = (input.limit as number) || 5;
      const results = await memoryService.getRecent(limit);

      if (results.length === 0) {
        return 'No memories stored yet.';
      }

      const formatted = results.map((r, i) => {
        const title = r.metadata.title || r.id;
        const source = r.metadata.source || r.source;
        return `${i + 1}. [${source}] **${title}**\n   ${r.content.slice(0, 150)}${r.content.length > 150 ? '...' : ''}`;
      });

      return `Recent memories:\n\n${formatted.join('\n\n')}`;
    },

    async vault_status() {
      if (!memoryService) return 'Error: Memory service not initialized.';

      const status = memoryService.getStatus();
      const chromaStatus = memoryService.isChromaAvailable() ? 'Connected' : 'Unavailable (using file search)';

      return [
        `Obsidian Vault Status:`,
        `  Path: ${status.path}`,
        `  Exists: ${status.exists}`,
        `  Notes: ${status.noteCount}`,
        `  Indexed: ${status.indexedCount}`,
        `  Watching: ${status.watching}`,
        `  ChromaDB: ${chromaStatus}`,
      ].join('\n');
    },
  },
};
