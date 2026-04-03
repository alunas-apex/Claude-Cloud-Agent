import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ToolRegistry } from '../agent/tool-registry.js';
import { eventBus } from './event-bus.js';
import type { Express, Request, Response } from 'express';

/**
 * McpServerManager — Exposes all registered tools as an MCP server.
 *
 * Supports two transports:
 * - **SSE**: For Claude Desktop / web clients connecting over HTTP
 * - **stdio**: For Claude Code CLI connecting via subprocess
 *
 * Automatically registers all tools from the ToolRegistry and forwards
 * calls to the existing handler infrastructure.
 */
export class McpServerManager {
  private toolRegistry: ToolRegistry;
  private sseTransports: Map<string, SSEServerTransport> = new Map();
  private server: McpServer;

  constructor(toolRegistry: ToolRegistry) {
    this.toolRegistry = toolRegistry;

    this.server = new McpServer(
      {
        name: 'claude-cloud-agent',
        version: '3.0.0',
      },
      {
        capabilities: {
          tools: {},
          resources: {},
        },
      },
    );

    this.registerAllTools();
  }

  /**
   * Register all ToolRegistry tools as MCP tools.
   */
  private registerAllTools(): void {
    const tools = this.toolRegistry.getTools();

    for (const tool of tools) {
      // Convert Anthropic tool schema to MCP registerTool format
      const inputSchema = tool.input_schema as Record<string, unknown>;

      this.server.registerTool(
        tool.name,
        {
          description: tool.description || tool.name,
          inputSchema: inputSchema as any,
        },
        async (args: Record<string, unknown>) => {
          const startTime = Date.now();

          eventBus.emitToolStart({
            sessionId: 'mcp',
            toolName: tool.name,
            input: args,
          });

          try {
            const result = await this.toolRegistry.execute(tool.name, args);
            const durationMs = Date.now() - startTime;

            eventBus.emitToolComplete({
              sessionId: 'mcp',
              toolName: tool.name,
              result: result.slice(0, 500),
              durationMs,
              status: 'success',
            });

            return {
              content: [{ type: 'text' as const, text: result }],
            };
          } catch (err: any) {
            const durationMs = Date.now() - startTime;

            eventBus.emitToolComplete({
              sessionId: 'mcp',
              toolName: tool.name,
              result: err?.message,
              durationMs,
              status: 'error',
            });

            return {
              content: [{ type: 'text' as const, text: `Error: ${err?.message ?? String(err)}` }],
              isError: true,
            };
          }
        },
      );
    }

    console.log(`[MCP Server] Registered ${tools.length} tools`);
  }

  /**
   * Attach SSE transport endpoints to an Express app.
   * Clients connect via GET /mcp/sse and send messages via POST /mcp/messages.
   */
  registerSseEndpoints(app: Express): void {
    // SSE connection endpoint
    app.get('/mcp/sse', (req: Request, res: Response) => {
      const transport = new SSEServerTransport('/mcp/messages', res);
      const sessionId = transport.sessionId;
      this.sseTransports.set(sessionId, transport);

      console.log(`[MCP SSE] Client connected: ${sessionId}`);

      res.on('close', () => {
        this.sseTransports.delete(sessionId);
        console.log(`[MCP SSE] Client disconnected: ${sessionId}`);
      });

      this.server.connect(transport).catch((err) => {
        console.error(`[MCP SSE] Connection error:`, err);
      });
    });

    // SSE message endpoint
    app.post('/mcp/messages', (req: Request, res: Response) => {
      const sessionId = req.query.sessionId as string;
      const transport = this.sseTransports.get(sessionId);

      if (!transport) {
        res.status(404).json({ error: 'MCP session not found' });
        return;
      }

      transport.handlePostMessage(req, res).catch((err) => {
        console.error(`[MCP SSE] Message error:`, err);
        res.status(500).json({ error: 'Internal error processing MCP message' });
      });
    });

    console.log(`[MCP Server] SSE endpoints registered at /mcp/sse and /mcp/messages`);
  }

  /**
   * Start stdio transport (for CLI usage).
   * This is typically used when this process is spawned by Claude Code.
   */
  async startStdioTransport(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.log(`[MCP Server] stdio transport started`);
  }

  /**
   * Get server status info.
   */
  getStatus(): { toolCount: number; sseClients: number; transports: string[] } {
    return {
      toolCount: this.toolRegistry.getTools().length,
      sseClients: this.sseTransports.size,
      transports: ['sse', 'stdio'],
    };
  }

  /**
   * Close all connections.
   */
  async close(): Promise<void> {
    await this.server.close();
    this.sseTransports.clear();
  }
}
