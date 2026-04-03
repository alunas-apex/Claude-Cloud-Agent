import express from 'express';
import http from 'http';
import { Channel } from './channels/base.js';
import { MessageRouter } from './services/message-router.js';
import { ToolRegistry } from './agent/tool-registry.js';
import { initWebSocket } from './services/websocket.js';

export function createServer(
  channels: Channel[],
  router: MessageRouter,
  toolRegistry?: ToolRegistry
): { app: express.Express; httpServer: http.Server } {
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
      version: '2.0.0',
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

  // Register all channel webhooks
  const onMessage = (msg: import('./channels/base.js').IncomingMessage) => router.handle(msg);
  for (const channel of channels) {
    channel.register(app, onMessage);
  }

  return { app, httpServer };
}
