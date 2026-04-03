import Anthropic from '@anthropic-ai/sdk';

/**
 * Context passed to tool handlers during execution.
 * Provides session info and real-time event emission.
 */
export interface ToolContext {
  sessionId: string;
  userId: string;
  channel: string;
  emit: (event: string, data: unknown) => void;
}

/**
 * Tool connector module interface. Implement this to add a new integration.
 *
 * Steps to add a new tool connector:
 *  1. Create src/tools/<service>/index.ts implementing this interface
 *  2. Add required env vars to .env.example and .env
 *  3. In src/index.ts, import your module and register it with the ToolRegistry
 *  4. Done — ToolRegistry merges schemas and handlers automatically
 */
export interface ToolModule {
  /** Human-readable name used in logging */
  name: string;

  /** Optional description of this tool module */
  description?: string;

  /** Tool category for grouping and selective inclusion */
  category?: 'google' | 'utility' | 'mcp' | 'plugin' | 'system';

  /**
   * Anthropic tool definitions — these are passed directly to the Claude API.
   * Each tool has a name, description, and JSON Schema input_schema.
   */
  tools: Anthropic.Tool[];

  /**
   * Handler map keyed by tool name.
   * Each handler receives the parsed tool input and returns a string result
   * that will be fed back to Claude as the tool_result.
   *
   * Handlers optionally accept a ToolContext as second argument for
   * session-aware tools. Existing handlers without context still work.
   */
  handlers: Record<string, (input: Record<string, unknown>, context?: ToolContext) => Promise<string>>;

  /** Environment variables required for this module to function */
  requiredEnvVars?: string[];

  /** Check if this tool module is functional (e.g. API keys configured) */
  healthCheck?(): Promise<boolean>;
}
