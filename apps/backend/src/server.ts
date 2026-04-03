import express from 'express';
import http from 'http';
import { Channel } from './channels/base.js';
import { MessageRouter } from './services/message-router.js';
import { ToolRegistry } from './agent/tool-registry.js';
import { CostTracker } from './agent/cost-tracker.js';
import { ModelRouter } from './agent/model-router.js';
import { McpServerManager } from './services/mcp-server.js';
import { McpClientManager } from './services/mcp-client.js';
import { MemoryService } from './services/memory.js';
import { AgentTeam } from './agents/team.js';
import { PluginManager } from './plugins/manager.js';
import { ChannelManager } from './services/channel-manager.js';
import { initWebSocket } from './services/websocket.js';

interface ServerDeps {
  channels: Channel[];
  router: MessageRouter;
  toolRegistry?: ToolRegistry;
  costTracker?: CostTracker;
  modelRouter?: ModelRouter;
  mcpServer?: McpServerManager;
  mcpClient?: McpClientManager;
  memory?: MemoryService;
  agentTeam?: AgentTeam;
  pluginManager?: PluginManager;
  channelManager?: ChannelManager;
}

export function createServer(deps: ServerDeps): { app: express.Express; httpServer: http.Server } {
  const { channels, router, toolRegistry, costTracker, modelRouter, mcpServer, mcpClient, memory, agentTeam, pluginManager, channelManager } = deps;
  const app = express();
  const httpServer = http.createServer(app);

  // Initialize Socket.IO on the HTTP server
  initWebSocket(httpServer);

  // Parse JSON and URL-encoded bodies (Twilio uses form-encoded)
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));

  // CORS for dashboard
  app.use((_req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    if (_req.method === 'OPTIONS') {
      res.sendStatus(200);
      return;
    }
    next();
  });

  // Health check — enhanced with v2 info
  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      version: '4.0.0',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      channels: channels.map((c) => c.name),
    });
  });

  // ── API Routes (v2) ──────────────────────────────────────────────────────

  app.get('/api/sessions', async (_req, res) => {
    const { listAllSessions } = await import('./services/database.js');
    const limit = parseInt(String(_req.query.limit) || '50', 10);
    const offset = parseInt(String(_req.query.offset) || '0', 10);
    res.json(listAllSessions(limit, offset));
  });

  app.get('/api/sessions/:id', async (req, res) => {
    const { getSession, getSessionMessages } = await import('./services/database.js');
    const session = getSession(req.params.id);
    if (!session) { res.status(404).json({ error: 'Session not found' }); return; }
    const messages = getSessionMessages(req.params.id);
    res.json({ ...session, messages });
  });

  // List registered tools
  app.get('/api/tools', (_req, res) => {
    if (!toolRegistry) {
      res.json([]);
      return;
    }
    const tools = toolRegistry.getTools().map((t) => ({
      name: t.name,
      description: t.description,
    }));
    res.json(tools);
  });

  app.get('/api/tools/executions', async (_req, res) => {
    const { getToolExecutions } = await import('./services/database.js');
    const limit = parseInt(String(_req.query.limit) || '50', 10);
    const offset = parseInt(String(_req.query.offset) || '0', 10);
    res.json(getToolExecutions(limit, offset));
  });

  app.get('/api/cost/today', async (_req, res) => {
    const { getTodayCost } = await import('./services/database.js');
    res.json({ costUsd: getTodayCost() });
  });

  app.get('/api/settings', async (_req, res) => {
    const { getAllSettings } = await import('./services/database.js');
    res.json(getAllSettings());
  });

  app.put('/api/settings', async (req, res) => {
    const { setSetting } = await import('./services/database.js');
    const { key, value } = req.body;
    if (!key || value === undefined) { res.status(400).json({ error: 'key and value required' }); return; }
    setSetting(key, String(value));
    res.json({ ok: true });
  });

  // ── Cost & Budget API (Phase 3) ─────────────────────────────────────────

  app.get('/api/cost/breakdown', (_req, res) => {
    if (!costTracker) { res.json({ byModel: {}, total: { tokensIn: 0, tokensOut: 0, costUsd: 0, requests: 0 } }); return; }
    res.json(costTracker.getCostBreakdown());
  });

  app.get('/api/budget', (_req, res) => {
    if (!costTracker) { res.json({ dailyBudgetUsd: 10, dailySpentUsd: 0, dailyRemainingUsd: 10, sessionBudgetUsd: 2, sessionSpentUsd: 0, sessionRemainingUsd: 2, isOverBudget: false, autoDowngrade: true }); return; }
    const sessionId = _req.query.sessionId as string | undefined;
    res.json(costTracker.getBudgetStatus(sessionId));
  });

  app.get('/api/model/route', (_req, res) => {
    if (!modelRouter) { res.json({ error: 'Model router not initialized' }); return; }
    const message = (_req.query.message as string) || 'test';
    const conversationLength = parseInt(String(_req.query.conversationLength || '0'), 10);
    const budgetRemaining = costTracker ? costTracker.getBudgetRemaining() : undefined;
    const decision = modelRouter.route({ message, conversationLength, budgetRemaining });
    res.json(decision);
  });

  app.get('/api/tools/categories', (_req, res) => {
    if (!toolRegistry) { res.json({}); return; }
    res.json(toolRegistry.getCategoryCounts());
  });

  // ── Agent Team API (Phase 6) ────────────────────────────────────────────

  app.get('/api/agents', (_req, res) => {
    if (!agentTeam) { res.json([]); return; }
    res.json(agentTeam.getAgents());
  });

  app.get('/api/agents/:role', (req, res) => {
    if (!agentTeam) { res.status(404).json({ error: 'Agent team not initialized' }); return; }
    const agent = agentTeam.getAgent(req.params.role as any);
    if (!agent) { res.status(404).json({ error: 'Agent not found' }); return; }
    res.json(agent);
  });

  app.get('/api/agents/tasks/history', (_req, res) => {
    if (!agentTeam) { res.json([]); return; }
    const limit = parseInt(String(_req.query.limit || '10'), 10);
    res.json(agentTeam.getTaskHistory(limit));
  });

  app.post('/api/agents/run', async (req, res) => {
    if (!agentTeam) { res.status(503).json({ error: 'Agent team not initialized' }); return; }
    const { instruction } = req.body;
    if (!instruction) { res.status(400).json({ error: 'instruction required' }); return; }
    try {
      const result = await agentTeam.run(instruction);
      res.json({ ok: true, result });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Memory API (Phase 5) ────────────────────────────────────────────────

  app.get('/api/memory/status', (_req, res) => {
    if (!memory) { res.json({ path: '', exists: false, noteCount: 0, indexedCount: 0, watching: false }); return; }
    res.json({ ...memory.getStatus(), chromaAvailable: memory.isChromaAvailable() });
  });

  app.get('/api/memory/search', async (req, res) => {
    if (!memory) { res.json([]); return; }
    const query = (req.query.q as string) || '';
    const limit = parseInt(String(req.query.limit || '5'), 10);
    if (!query) { res.status(400).json({ error: 'q parameter required' }); return; }
    const results = await memory.search(query, limit);
    res.json(results);
  });

  app.get('/api/memory/recent', async (req, res) => {
    if (!memory) { res.json([]); return; }
    const limit = parseInt(String(req.query.limit || '10'), 10);
    const results = await memory.getRecent(limit);
    res.json(results);
  });

  app.post('/api/memory', async (req, res) => {
    if (!memory) { res.status(503).json({ error: 'Memory service not initialized' }); return; }
    const { content, title, tags, source } = req.body;
    if (!content) { res.status(400).json({ error: 'content required' }); return; }
    const id = await memory.store({ content, title, tags, source: source || 'agent' });
    res.json({ ok: true, id });
  });

  // ── Plugin API (Phase 7) ─────────────────────────────────────────────────

  app.get('/api/plugins', (_req, res) => {
    if (!pluginManager) { res.json([]); return; }
    res.json(pluginManager.getPlugins());
  });

  app.get('/api/plugins/marketplace', (_req, res) => {
    if (!pluginManager) { res.json([]); return; }
    res.json(pluginManager.getMarketplace());
  });

  app.get('/api/plugins/:id', (req, res) => {
    if (!pluginManager) { res.status(404).json({ error: 'Plugin manager not initialized' }); return; }
    const plugin = pluginManager.getPlugin(req.params.id);
    if (!plugin) { res.status(404).json({ error: 'Plugin not found' }); return; }
    res.json(plugin);
  });

  app.put('/api/plugins/:id/enable', async (req, res) => {
    if (!pluginManager) { res.status(503).json({ error: 'Plugin manager not initialized' }); return; }
    try {
      await pluginManager.enable(req.params.id);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.put('/api/plugins/:id/disable', async (req, res) => {
    if (!pluginManager) { res.status(503).json({ error: 'Plugin manager not initialized' }); return; }
    try {
      await pluginManager.disable(req.params.id);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // ── Channel API (Phase 7) ──────────────────────────────────────────────

  app.get('/api/channels', (_req, res) => {
    if (!channelManager) {
      res.json(channels.map((c) => ({ name: c.name, enabled: true, configured: true, missingEnvVars: [] })));
      return;
    }
    res.json(channelManager.getStatuses());
  });

  // ── MCP API (Phase 4) ───────────────────────────────────────────────────

  // Built-in MCP server status
  app.get('/api/mcp/server/status', (_req, res) => {
    if (!mcpServer) { res.json({ enabled: false }); return; }
    res.json({ enabled: true, ...mcpServer.getStatus() });
  });

  // External MCP server management
  app.get('/api/mcp/servers', (_req, res) => {
    if (!mcpClient) { res.json([]); return; }
    res.json(mcpClient.getServers());
  });

  app.post('/api/mcp/servers', async (req, res) => {
    if (!mcpClient) { res.status(503).json({ error: 'MCP client not initialized' }); return; }
    const { id, name, command, args, url, env, enabled } = req.body;
    if (!id || !name) { res.status(400).json({ error: 'id and name required' }); return; }
    try {
      await mcpClient.addServer({ id, name, command, args, url, env, enabled: enabled !== false });
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/mcp/servers/:id', async (req, res) => {
    if (!mcpClient) { res.status(503).json({ error: 'MCP client not initialized' }); return; }
    try {
      await mcpClient.removeServer(req.params.id);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/mcp/servers/:id/toggle', async (req, res) => {
    if (!mcpClient) { res.status(503).json({ error: 'MCP client not initialized' }); return; }
    const { enabled } = req.body;
    try {
      await mcpClient.toggleServer(req.params.id, enabled);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Register MCP SSE endpoints on the Express app
  if (mcpServer) {
    mcpServer.registerSseEndpoints(app);
  }

  // Register all channel webhooks
  const onMessage = (msg: import('./channels/base.js').IncomingMessage) => router.handle(msg);
  for (const channel of channels) {
    channel.register(app, onMessage);
  }

  return { app, httpServer };
}
