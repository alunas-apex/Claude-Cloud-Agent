import Anthropic from '@anthropic-ai/sdk';
import { ToolModule } from '../tools/base.js';

/**
 * ToolRegistry aggregates all registered ToolModules into a flat list
 * of tool schemas (for the Claude API) and a handler map (for execution).
 */
export class ToolRegistry {
  private allTools: Anthropic.Tool[] = [];
  private allHandlers: Record<string, (input: Record<string, unknown>) => Promise<string>> = {};

  register(module: ToolModule): void {
    for (const tool of module.tools) {
      if (this.allHandlers[tool.name]) {
        throw new Error(
          `Tool name conflict: "${tool.name}" is already registered. ` +
            `Check your tool modules for duplicate tool names.`
        );
      }
      this.allTools.push(tool);
      this.allHandlers[tool.name] = module.handlers[tool.name];
    }
    console.log(`[ToolRegistry] Registered ${module.tools.length} tools from "${module.name}"`);
  }

  getTools(): Anthropic.Tool[] {
    return this.allTools;
  }

  async execute(toolName: string, input: Record<string, unknown>): Promise<string> {
    const handler = this.allHandlers[toolName];
    if (!handler) {
      return `Error: Unknown tool "${toolName}". This tool is not registered.`;
    }
    try {
      return await handler(input);
    } catch (err: any) {
      console.error(`[ToolRegistry] Tool "${toolName}" threw an error:`, err);
      return `Error executing ${toolName}: ${err?.message ?? String(err)}`;
    }
  }
}
