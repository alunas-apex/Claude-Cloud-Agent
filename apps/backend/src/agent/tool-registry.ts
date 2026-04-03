import Anthropic from '@anthropic-ai/sdk';
import { ToolModule, ToolContext } from '../tools/base.js';

/**
 * ToolRegistry aggregates all registered ToolModules into a flat list
 * of tool schemas (for the Claude API) and a handler map (for execution).
 *
 * Supports category-based filtering for selective tool inclusion,
 * reducing token usage by only sending relevant tool schemas.
 */
export class ToolRegistry {
  private allTools: Anthropic.Tool[] = [];
  private allHandlers: Record<string, (input: Record<string, unknown>, context?: ToolContext) => Promise<string>> = {};
  private toolCategories: Map<string, string> = new Map(); // toolName → category
  private modulesByCategory: Map<string, string[]> = new Map(); // category → toolNames[]

  register(module: ToolModule): void {
    const category = module.category || 'utility';

    for (const tool of module.tools) {
      if (this.allHandlers[tool.name]) {
        throw new Error(
          `Tool name conflict: "${tool.name}" is already registered. ` +
            `Check your tool modules for duplicate tool names.`
        );
      }
      this.allTools.push(tool);
      this.allHandlers[tool.name] = module.handlers[tool.name];
      this.toolCategories.set(tool.name, category);

      const catTools = this.modulesByCategory.get(category) || [];
      catTools.push(tool.name);
      this.modulesByCategory.set(category, catTools);
    }
    console.log(`[ToolRegistry] Registered ${module.tools.length} tools from "${module.name}" (category: ${category})`);
  }

  /**
   * Get all registered tool schemas (full set).
   */
  getTools(): Anthropic.Tool[] {
    return this.allTools;
  }

  /**
   * Get tool schemas filtered by categories. Returns a subset of tools
   * to reduce token usage when the model doesn't need all tools.
   */
  getToolsByCategories(categories: string[]): Anthropic.Tool[] {
    if (categories.length === 0) return this.allTools;

    const allowedNames = new Set<string>();
    for (const cat of categories) {
      const tools = this.modulesByCategory.get(cat);
      if (tools) tools.forEach(t => allowedNames.add(t));
    }

    return this.allTools.filter(t => allowedNames.has(t.name));
  }

  /**
   * Get tool schemas relevant to a message using keyword matching.
   * Always includes 'utility' tools and adds other categories based on keywords.
   */
  getRelevantTools(message: string): Anthropic.Tool[] {
    const msgLower = message.toLowerCase();
    const categories = new Set<string>(['utility']); // always include utility

    // Keyword → category mapping
    if (/email|gmail|inbox|send|reply|draft|mail/.test(msgLower)) categories.add('google');
    if (/calendar|event|meeting|schedule|meet/.test(msgLower)) categories.add('google');
    if (/gcp|cloud|project|deploy|bucket|iam|service account|cloud run|build/.test(msgLower)) categories.add('google');
    if (/admin|user|group|suspend|workspace|org/.test(msgLower)) categories.add('google');
    if (/drive|file|folder|document|sheet|doc/.test(msgLower)) categories.add('google');
    if (/account/.test(msgLower)) categories.add('google');
    if (/mcp|server|connect/.test(msgLower)) categories.add('mcp');
    if (/plugin/.test(msgLower)) categories.add('plugin');

    // If nothing matched, include all
    if (categories.size <= 1) return this.allTools;

    return this.getToolsByCategories(Array.from(categories));
  }

  /**
   * Get the category for a tool name.
   */
  getToolCategory(toolName: string): string | undefined {
    return this.toolCategories.get(toolName);
  }

  /**
   * Get all available categories.
   */
  getCategories(): string[] {
    return Array.from(this.modulesByCategory.keys());
  }

  /**
   * Get count of tools per category.
   */
  getCategoryCounts(): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const [cat, tools] of this.modulesByCategory) {
      counts[cat] = tools.length;
    }
    return counts;
  }

  async execute(toolName: string, input: Record<string, unknown>, context?: ToolContext): Promise<string> {
    const handler = this.allHandlers[toolName];
    if (!handler) {
      return `Error: Unknown tool "${toolName}". This tool is not registered.`;
    }
    try {
      return await handler(input, context);
    } catch (err: any) {
      console.error(`[ToolRegistry] Tool "${toolName}" threw an error:`, err);
      return `Error executing ${toolName}: ${err?.message ?? String(err)}`;
    }
  }
}
