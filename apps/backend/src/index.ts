import 'dotenv/config';
import { createServer } from './server.js';

// ── Channel Adapters ──────────────────────────────────────────────────────────
import { TwilioChannel } from './channels/twilio/index.js';
// import { TelegramChannel } from './channels/telegram/index.js';  // Uncomment to activate
// import { SlackChannel }    from './channels/slack/index.js';     // Uncomment to activate
// import { WhatsAppChannel } from './channels/whatsapp/index.js';  // Uncomment to activate

// ── Tool Modules — Google Workspace ──────────────────────────────────────────
import { AccountsToolModule } from './tools/google/accounts.js';
import { GmailToolModule }    from './tools/google/gmail.js';
import { CalendarToolModule } from './tools/google/calendar.js';
import { GcpToolModule }      from './tools/google/cloud.js';
import { AdminToolModule }    from './tools/google/admin.js';
// import { DriveToolModule }  from './tools/google/drive.js';  // Uncomment to activate

// ── Tool Modules — Utility & Stubs ────────────────────────────────────────────
import { DatetimeToolModule } from './tools/utility/datetime.js';
// import { ZoomToolModule }   from './tools/zoom/index.js';    // Uncomment to activate

// ── Core Services ─────────────────────────────────────────────────────────────
import { ToolRegistry }      from './agent/tool-registry.js';
import { Assistant }         from './agent/assistant.js';
import { ModelRouter }       from './agent/model-router.js';
import { CostTracker }       from './agent/cost-tracker.js';
import { MessageRouter }     from './services/message-router.js';
import { McpServerManager }  from './services/mcp-server.js';
import { McpClientManager }  from './services/mcp-client.js';
import { MemoryService }     from './services/memory.js';
import { MemoryToolModule, setMemoryService } from './tools/memory/index.js';

// ── Validate required environment variables ───────────────────────────────────
const required = ['ANTHROPIC_API_KEY'];
const missing = required.filter((k) => !process.env[k]);
if (missing.length > 0) {
  console.error(`[Startup] Missing required environment variables: ${missing.join(', ')}`);
  console.error('Copy .env.example to .env and fill in the values.');
  process.exit(1);
}

// ── Wire up tool registry ─────────────────────────────────────────────────────
const toolRegistry = new ToolRegistry();
toolRegistry.register(DatetimeToolModule);
toolRegistry.register(AccountsToolModule);
toolRegistry.register(GmailToolModule);
toolRegistry.register(CalendarToolModule);
toolRegistry.register(GcpToolModule);
toolRegistry.register(AdminToolModule);
// toolRegistry.register(DriveToolModule);  // Uncomment to activate
// toolRegistry.register(ZoomToolModule);   // Uncomment to activate
toolRegistry.register(MemoryToolModule);

// ── Wire up channels ──────────────────────────────────────────────────────────
const channels = [
  TwilioChannel,
  // TelegramChannel,  // Uncomment to activate
  // SlackChannel,     // Uncomment to activate
  // WhatsAppChannel,  // Uncomment to activate
];

// ── Wire up agent & router ────────────────────────────────────────────────────
const modelRouter = new ModelRouter();
const costTracker = new CostTracker();
const assistant = new Assistant(toolRegistry, modelRouter, costTracker);
const messageRouter = new MessageRouter(assistant);

// ── Wire up MCP ───────────────────────────────────────────────────────────────
const mcpServer = new McpServerManager(toolRegistry);
const mcpClient = new McpClientManager(toolRegistry);

// ── Wire up Memory ────────────────────────────────────────────────────────────
const memory = new MemoryService();
setMemoryService(memory);

// ── Start server ──────────────────────────────────────────────────────────────
const { httpServer } = createServer({
  channels, router: messageRouter, toolRegistry, costTracker, modelRouter, mcpServer, mcpClient, memory,
});
const port = parseInt(process.env.PORT ?? '3000', 10);

httpServer.listen(port, async () => {
  console.log(`\n[Claude Cloud Agent v4.0] Running on port ${port}`);
  console.log(`  Health:    http://localhost:${port}/health`);
  console.log(`  API:       http://localhost:${port}/api/`);
  console.log(`  MCP SSE:   http://localhost:${port}/mcp/sse`);
  console.log(`  WebSocket: ws://localhost:${port}/ws`);
  console.log(`  Dashboard: http://localhost:3001 (run 'npm run dev:dashboard')`);
  console.log(`  Channels:  ${channels.map((c) => c.name).join(', ')}`);
  console.log(`  Tools:     ${toolRegistry.getTools().length} tools registered`);

  // Initialize MCP client connections (connect to external servers)
  try {
    await mcpClient.initialize();
    const connected = mcpClient.getConnectedIds();
    if (connected.length > 0) {
      console.log(`  MCP:       ${connected.length} external server(s) connected`);
    }
  } catch (err: any) {
    console.warn(`  MCP:       External server initialization error: ${err.message}`);
  }

  // Initialize memory service (Obsidian vault + ChromaDB)
  try {
    await memory.initialize();
    const status = memory.getStatus();
    console.log(`  Memory:    ${status.noteCount} vault notes, ${status.indexedCount} indexed`);
  } catch (err: any) {
    console.warn(`  Memory:    Initialization error: ${err.message}`);
  }

  console.log('\n  Ready to receive messages.\n');
});

// Graceful shutdown
const shutdown = async (signal: string) => {
  console.log(`[Shutdown] ${signal} received, shutting down gracefully...`);
  await memory.close();
  await mcpClient.closeAll();
  await mcpServer.close();
  httpServer.close();
  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
