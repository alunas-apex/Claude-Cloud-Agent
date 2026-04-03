import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { ToolRegistry } from '../agent/tool-registry.js';
import { ToolModule } from '../tools/base.js';
import { eventBus } from './event-bus.js';
import {
  getSetting, setSetting,
  database,
} from './database.js';

interface McpServerConfig {
  id: string;
  name: string;
  command?: string;      // for stdio transport
  args?: string[];       // for stdio transport
  url?: string;          // for SSE transport
  env?: Record<string, string>;
  enabled: boolean;
}

interface ConnectedServer {
  config: McpServerConfig;
  client: Client;
  transport: StdioClientTransport | SSEClientTransport;
  tools: string[];
}

/**
 * McpClientManager — Connects to external MCP servers and imports their tools.
 *
 * Manages the lifecycle of MCP client connections:
 * - Connect to external MCP servers via stdio or SSE
 * - Discover and import their tools into the ToolRegistry
 * - Reconnect on failure
 * - Persist server configurations in the database
 */
export class McpClientManager {
  private toolRegistry: ToolRegistry;
  private connectedServers: Map<string, ConnectedServer> = new Map();

  constructor(toolRegistry: ToolRegistry) {
    this.toolRegistry = toolRegistry;
  }

  /**
   * Load saved server configs from DB and connect to enabled ones.
   */
  async initialize(): Promise<void> {
    const configs = this.loadServerConfigs();
    console.log(`[MCP Client] Found ${configs.length} configured servers`);

    for (const config of configs) {
      if (config.enabled) {
        try {
          await this.connect(config);
        } catch (err: any) {
          console.error(`[MCP Client] Failed to connect to "${config.name}":`, err.message);
        }
      }
    }
  }

  /**
   * Connect to an external MCP server.
   */
  async connect(config: McpServerConfig): Promise<string[]> {
    // Disconnect existing connection if any
    if (this.connectedServers.has(config.id)) {
      await this.disconnect(config.id);
    }

    const client = new Client(
      { name: 'claude-cloud-agent', version: '3.0.0' },
      { capabilities: {} },
    );

    let transport: StdioClientTransport | SSEClientTransport;

    if (config.url) {
      // SSE transport
      transport = new SSEClientTransport(new URL(config.url));
    } else if (config.command) {
      // stdio transport
      transport = new StdioClientTransport({
        command: config.command,
        args: config.args || [],
        env: { ...process.env, ...(config.env || {}) } as Record<string, string>,
      });
    } else {
      throw new Error(`Server "${config.name}" has neither command nor url configured`);
    }

    await client.connect(transport);
    console.log(`[MCP Client] Connected to "${config.name}"`);

    // Discover tools
    const toolsResult = await client.listTools();
    const toolNames: string[] = [];

    if (toolsResult.tools.length > 0) {
      // Create a ToolModule from the discovered tools
      const module: ToolModule = {
        name: `MCP:${config.name}`,
        category: 'mcp',
        tools: toolsResult.tools.map((t) => ({
          name: `mcp_${config.id}_${t.name}`,
          description: `[MCP:${config.name}] ${t.description || t.name}`,
          input_schema: (t.inputSchema || { type: 'object', properties: {} }) as any,
        })),
        handlers: {},
      };

      // Create handlers that proxy to the MCP server
      for (const tool of toolsResult.tools) {
        const prefixedName = `mcp_${config.id}_${tool.name}`;
        const originalName = tool.name;
        toolNames.push(prefixedName);

        module.handlers[prefixedName] = async (input: Record<string, unknown>) => {
          const startTime = Date.now();

          eventBus.emitToolStart({
            sessionId: 'mcp-client',
            toolName: prefixedName,
            input,
          });

          try {
            const result = await client.callTool({ name: originalName, arguments: input });
            const durationMs = Date.now() - startTime;
            const textContent = (result.content as any[])
              ?.filter((c: any) => c.type === 'text')
              .map((c: any) => c.text)
              .join('\n') || JSON.stringify(result.content);

            eventBus.emitToolComplete({
              sessionId: 'mcp-client',
              toolName: prefixedName,
              result: textContent.slice(0, 500),
              durationMs,
              status: 'success',
            });

            return textContent;
          } catch (err: any) {
            const durationMs = Date.now() - startTime;
            eventBus.emitToolComplete({
              sessionId: 'mcp-client',
              toolName: prefixedName,
              result: err?.message,
              durationMs,
              status: 'error',
            });
            return `Error calling MCP tool ${originalName}: ${err?.message ?? String(err)}`;
          }
        };
      }

      this.toolRegistry.register(module);
      console.log(`[MCP Client] Imported ${toolsResult.tools.length} tools from "${config.name}"`);
    }

    this.connectedServers.set(config.id, { config, client, transport, tools: toolNames });
    return toolNames;
  }

  /**
   * Disconnect from an MCP server.
   */
  async disconnect(serverId: string): Promise<void> {
    const server = this.connectedServers.get(serverId);
    if (!server) return;

    try {
      await server.client.close();
    } catch (err: any) {
      console.warn(`[MCP Client] Error closing "${server.config.name}":`, err.message);
    }

    this.connectedServers.delete(serverId);
    console.log(`[MCP Client] Disconnected from "${server.config.name}"`);
  }

  /**
   * Add a new server config and optionally connect.
   */
  async addServer(config: McpServerConfig): Promise<void> {
    this.saveServerConfig(config);
    if (config.enabled) {
      await this.connect(config);
    }
  }

  /**
   * Remove a server config and disconnect.
   */
  async removeServer(serverId: string): Promise<void> {
    await this.disconnect(serverId);
    this.deleteServerConfig(serverId);
  }

  /**
   * Toggle a server's enabled state.
   */
  async toggleServer(serverId: string, enabled: boolean): Promise<void> {
    const configs = this.loadServerConfigs();
    const config = configs.find((c) => c.id === serverId);
    if (!config) throw new Error(`Server "${serverId}" not found`);

    config.enabled = enabled;
    this.saveServerConfig(config);

    if (enabled) {
      await this.connect(config);
    } else {
      await this.disconnect(serverId);
    }
  }

  /**
   * Get status of all configured servers.
   */
  getServers(): Array<McpServerConfig & { connected: boolean; toolCount: number }> {
    const configs = this.loadServerConfigs();
    return configs.map((c) => {
      const connected = this.connectedServers.has(c.id);
      const toolCount = this.connectedServers.get(c.id)?.tools.length || 0;
      return { ...c, connected, toolCount };
    });
  }

  /**
   * Get list of all connected server IDs.
   */
  getConnectedIds(): string[] {
    return Array.from(this.connectedServers.keys());
  }

  /**
   * Close all connections.
   */
  async closeAll(): Promise<void> {
    for (const [id] of this.connectedServers) {
      await this.disconnect(id);
    }
  }

  // ── Database persistence ──────────────────────────────────────────────

  private loadServerConfigs(): McpServerConfig[] {
    const rows = database.prepare('SELECT * FROM mcp_servers').all() as any[];
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      command: r.command || undefined,
      args: r.args ? JSON.parse(r.args) : undefined,
      url: r.env ? JSON.parse(r.env)._url : undefined,
      env: r.env ? JSON.parse(r.env) : undefined,
      enabled: r.enabled === 1,
    }));
  }

  private saveServerConfig(config: McpServerConfig): void {
    const envJson = JSON.stringify({ ...(config.env || {}), _url: config.url });
    database.prepare(
      `INSERT INTO mcp_servers (id, name, command, args, env, enabled)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name, command = excluded.command,
         args = excluded.args, env = excluded.env, enabled = excluded.enabled`
    ).run(
      config.id, config.name,
      config.command || '', JSON.stringify(config.args || []),
      envJson, config.enabled ? 1 : 0
    );
  }

  private deleteServerConfig(serverId: string): void {
    database.prepare('DELETE FROM mcp_servers WHERE id = ?').run(serverId);
  }
}
