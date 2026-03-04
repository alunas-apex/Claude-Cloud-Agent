import express from 'express';
import { Channel } from './channels/base.js';
import { MessageRouter } from './services/message-router.js';

export function createServer(
  channels: Channel[],
  router: MessageRouter
): express.Express {
  const app = express();

  // Parse JSON and URL-encoded bodies (Twilio uses form-encoded)
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));

  // Health check
  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      channels: channels.map((c) => c.name),
    });
  });

  // Register all channel webhooks
  const onMessage = (msg: import('./channels/base.js').IncomingMessage) => router.handle(msg);
  for (const channel of channels) {
    channel.register(app, onMessage);
  }

  return app;
}
