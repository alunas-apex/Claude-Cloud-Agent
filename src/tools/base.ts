import Anthropic from '@anthropic-ai/sdk';

/**
 * Tool connector module interface. Implement this to add a new integration.
 *
 * Steps to add a new tool connector:
 *  1. Create src/tools/<service>/index.ts implementing this interface
 *  2. Add required env vars to .env.example and .env
 *  3. In src/index.ts, import your module and push it onto the `toolModules` array
 *  4. Done — ToolRegistry merges schemas and handlers automatically
 */
export interface ToolModule {
  /** Human-readable name used in logging */
  name: string;

  /**
   * Anthropic tool definitions — these are passed directly to the Claude API.
   * Each tool has a name, description, and JSON Schema input_schema.
   */
  tools: Anthropic.Tool[];

  /**
   * Handler map keyed by tool name.
   * Each handler receives the parsed tool input and returns a string result
   * that will be fed back to Claude as the tool_result.
   */
  handlers: Record<string, (input: Record<string, unknown>) => Promise<string>>;
}
