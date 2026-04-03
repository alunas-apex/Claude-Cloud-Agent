#!/usr/bin/env node
/**
 * Standalone MCP stdio server entry point.
 *
 * Run this directly to expose all tools via stdio transport.
 * Add to Claude Desktop or Claude Code config:
 *
 *   {
 *     "mcpServers": {
 *       "claude-cloud-agent": {
 *         "command": "node",
 *         "args": ["apps/backend/dist/mcp-stdio.js"]
 *       }
 *     }
 *   }
 */
import 'dotenv/config';

import { ToolRegistry } from './agent/tool-registry.js';
import { McpServerManager } from './services/mcp-server.js';

// Tool Modules
import { DatetimeToolModule } from './tools/utility/datetime.js';
import { AccountsToolModule } from './tools/google/accounts.js';
import { GmailToolModule }    from './tools/google/gmail.js';
import { CalendarToolModule } from './tools/google/calendar.js';
import { GcpToolModule }      from './tools/google/cloud.js';
import { AdminToolModule }    from './tools/google/admin.js';

const toolRegistry = new ToolRegistry();
toolRegistry.register(DatetimeToolModule);
toolRegistry.register(AccountsToolModule);
toolRegistry.register(GmailToolModule);
toolRegistry.register(CalendarToolModule);
toolRegistry.register(GcpToolModule);
toolRegistry.register(AdminToolModule);

const mcpServer = new McpServerManager(toolRegistry);

mcpServer.startStdioTransport().catch((err) => {
  console.error('[MCP stdio] Fatal error:', err);
  process.exit(1);
});
