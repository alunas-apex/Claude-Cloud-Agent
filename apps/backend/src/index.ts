import 'dotenv/config';
import { createServer } from './server.js';

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
import { AgentTeam }         from './agents/team.js';
import { PluginManager }     from './plugins/manager.js';
import { ChannelManager }    from './services/channel-manager.js';

// ── Built-in Plugins ─────────────────────────────────────────────────────────
import { SystemInfoPlugin }  from './plugins/builtin/system-info.js';
import { WebFetchPlugin }    from './plugins/builtin/web-fetch.js';
import { JsonUtilsPlugin }   from './plugins/builtin/json-utils.js';

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

// ── Wire up channels (auto-detect from env vars) ─────────────────────────────
const channelManager = new ChannelManager();
const channels = channelManager.detectChannels();

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

// ── Wire up Agent Team ────────────────────────────────────────────────────────
const agentTeam = new AgentTeam(toolRegistry, costTracker);

// ── Wire up Plugin System ─────────────────────────────────────────────────────
const pluginManager = new PluginManager(toolRegistry);
pluginManager.register(SystemInfoPlugin);
pluginManager.register(WebFetchPlugin);
pluginManager.register(JsonUtilsPlugin);

// ── Start server ──────────────────────────────────────────────────────────────
const { httpServer, app } = createServer({
  channels, router: messageRouter, toolRegistry, costTracker, modelRouter, mcpServer, mcpClient, memory, agentTeam, pluginManager, channelManager,
});
const port = parseInt(process.env.PORT ?? '3000', 10);

httpServer.listen(port, async () => {
  console.log(`\n[Claude Cloud Agent v4.0] Running on port ${port}`);
  console.log(`  Health:    http://localhost:${port}/health`);
  console.log(`  API:       http://localhost:${port}/api/`);
  console.log(`  MCP SSE:   http://localhost:${port}/mcp/sse`);
  console.log(`  WebSocket: ws://localhost:${port}/ws`);
  console.log(`  Dashboard: http://localhost:3001 (run 'npm run dev:dashboard')`);
  console.log(`  Channels:  ${channels.map((c) => c.name).join(', ') || 'none (no channel env vars configured)'}`);
  console.log(`  Tools:     ${toolRegistry.getTools().length} tools registered`);

  // Initialize plugins
  try {
    await pluginManager.initialize(app);
    const plugins = pluginManager.getPlugins();
    const activeCount = plugins.filter((p) => p.active).length;
    console.log(`  Plugins:   ${plugins.length} registered, ${activeCount} active`);
  } catch (err: any) {
    console.warn(`  Plugins:   Initialization error: ${err.message}`);
  }

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

  // Log channel detection results
  const statuses = channelManager.getStatuses();
  const inactive = statuses.filter((s) => !s.enabled);
  if (inactive.length > 0) {
    console.log(`  Inactive:  ${inactive.map((s) => `${s.name} (missing: ${s.missingEnvVars.join(', ')})`).join('; ')}`);
  }

  console.log('\n  Ready to receive messages.\n');
});

// Graceful shutdown
const shutdown = async (signal: string) => {
  console.log(`[Shutdown] ${signal} received, shutting down gracefully...`);
  await pluginManager.closeAll();
  await memory.close();
  await mcpClient.closeAll();
  await mcpServer.close();
  httpServer.close();
  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
