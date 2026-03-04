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
import { ToolRegistry }  from './agent/tool-registry.js';
import { Assistant }     from './agent/assistant.js';
import { MessageRouter } from './services/message-router.js';

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

// ── Wire up channels ──────────────────────────────────────────────────────────
const channels = [
  TwilioChannel,
  // TelegramChannel,  // Uncomment to activate
  // SlackChannel,     // Uncomment to activate
  // WhatsAppChannel,  // Uncomment to activate
];

// ── Wire up agent & router ────────────────────────────────────────────────────
const assistant = new Assistant(toolRegistry);
const messageRouter = new MessageRouter(assistant);

// ── Start server ──────────────────────────────────────────────────────────────
const app = createServer(channels, messageRouter);
const port = parseInt(process.env.PORT ?? '3000', 10);

app.listen(port, () => {
  console.log(`\n[Claude Cloud Agent] Running on port ${port}`);
  console.log(`  Health: http://localhost:${port}/health`);
  console.log(`  Channels: ${channels.map((c) => c.name).join(', ')}`);
  console.log(`  Tools: Accounts, Gmail, Calendar, GCP (16 tools), Admin (13 tools), Datetime`);
  console.log('\n  Ready to receive messages.\n');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[Shutdown] SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('[Shutdown] SIGINT received, shutting down gracefully...');
  process.exit(0);
});
