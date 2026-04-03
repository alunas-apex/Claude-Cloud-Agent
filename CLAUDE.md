# Claude Cloud Agent — Autonomous AI Command Center

A full autonomous AI agent command center powered by Claude AI. Features a web dashboard, multi-model intelligence routing, MCP server integration, Obsidian.md AI brain, agent teams, and connectivity to all Claude platforms.

**Architecture**: Turborepo monorepo with Express + Socket.IO backend, Next.js dashboard, and shared type package.

---

## What It Does

### Current (v2.0 — Phase 1 Foundation)
- **SMS Agent**: Text your Twilio number in plain English for Gmail, Calendar, GCP, and Admin tasks
- **Web Dashboard**: Real-time command center UI at `localhost:3001` with session, tool, and settings management
- **WebSocket**: Real-time event streaming between backend and dashboard via Socket.IO
- **Enhanced Database**: Sessions, messages, tool executions, cost ledger, settings, and plugin registry
- **API**: REST endpoints for sessions, tools, costs, and settings at `/api/*`

### Planned (Phases 2-7)
- **Multi-Model Routing**: Auto-route to Haiku/Sonnet/Opus based on task complexity
- **MCP Integration**: Expose tools to Claude Desktop/Code; connect to external MCP servers
- **Obsidian AI Brain**: Persistent vector memory with bidirectional Obsidian vault sync
- **Agent Teams**: Coordinator, Researcher, Coder, Planner, Executor agents that collaborate
- **Plugin System**: Hot-loadable plugins with marketplace
- **More Channels**: Telegram, Slack, WhatsApp, Discord, Email (stubs ready to activate)

---

## Quick Start

### Prerequisites
- Node.js 20+
- A Google Cloud project with Gmail API + Calendar API enabled
- A Twilio account with an SMS-capable phone number
- An Anthropic API key

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Fill in all required values in .env
```

Required values:
- `ANTHROPIC_API_KEY` — from [console.anthropic.com](https://console.anthropic.com)
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — from Google Cloud Console
- `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_PHONE_NUMBER` — from Twilio Console

### 3. Authorise Google Access (one-time)

```bash
npm run setup-google
```

### 4. Start Development

```bash
# Start backend only (SMS + API + WebSocket)
npm run dev:backend

# Start dashboard only
npm run dev:dashboard

# Start everything (Turborepo)
npm run dev
```

### 5. Docker Compose (Production)

```bash
docker compose up -d
```

Services:
- **Backend**: `http://localhost:3000` (API + WebSocket + SMS webhooks)
- **Dashboard**: `http://localhost:3001` (Next.js UI)
- **Redis**: `localhost:6379` (for agent teams job queue)

---

## Project Structure

```
claude-cloud-agent/
├── apps/
│   ├── backend/                        Express + Socket.IO server
│   │   ├── src/
│   │   │   ├── index.ts               Entry point — register channels & tools
│   │   │   ├── server.ts              Express + Socket.IO + API routes
│   │   │   │
│   │   │   ├── agent/                 Core agent logic
│   │   │   │   ├── assistant.ts       Claude agentic loop (tool use)
│   │   │   │   └── tool-registry.ts   Aggregates all ToolModules
│   │   │   │
│   │   │   ├── channels/              Messaging channel adapters
│   │   │   │   ├── base.ts            Channel interface + ChannelCapabilities
│   │   │   │   ├── twilio/            ✅ Active — SMS via Twilio
│   │   │   │   ├── telegram/          🔧 Stub — ready to activate
│   │   │   │   ├── slack/             🔧 Stub — ready to activate
│   │   │   │   └── whatsapp/          🔧 Stub — ready to activate
│   │   │   │
│   │   │   ├── tools/                 Tool connector modules
│   │   │   │   ├── base.ts            ToolModule interface + ToolContext
│   │   │   │   ├── google/
│   │   │   │   │   ├── auth.ts        Shared Google OAuth2 (multi-account)
│   │   │   │   │   ├── accounts.ts    Account management tools
│   │   │   │   │   ├── gmail.ts       ✅ Gmail read/write/send
│   │   │   │   │   ├── calendar.ts    ✅ Calendar CRUD + Meet
│   │   │   │   │   ├── cloud.ts       ✅ GCP (16 tools)
│   │   │   │   │   ├── admin.ts       ✅ Workspace Admin (13 tools)
│   │   │   │   │   └── drive.ts       🔧 Stub
│   │   │   │   ├── utility/
│   │   │   │   │   └── datetime.ts    ✅ Current date/time
│   │   │   │   └── zoom/              🔧 Stub
│   │   │   │
│   │   │   ├── services/
│   │   │   │   ├── database.ts        SQLite — v1 (conversations) + v2 (sessions, cost, tools)
│   │   │   │   ├── message-router.ts  Channel-agnostic message handler
│   │   │   │   ├── event-bus.ts       ✅ Central event system
│   │   │   │   └── websocket.ts       ✅ Socket.IO manager
│   │   │   │
│   │   │   └── types/
│   │   │       └── index.ts           Re-exports from @claude-agent/shared
│   │   │
│   │   └── scripts/
│   │       └── setup-google-auth.ts   Google OAuth setup
│   │
│   └── dashboard/                      Next.js command center UI
│       └── src/app/
│           ├── page.tsx               Dashboard home (stats + health)
│           ├── sessions/              Session management
│           ├── agents/                Agent team configuration
│           ├── tools/                 Tool registry + execution log
│           ├── memory/                Obsidian vault + vector search
│           ├── mcp/                   MCP server management
│           ├── plugins/               Plugin marketplace
│           └── settings/              Model config, budgets, API keys, channels
│
├── packages/
│   └── shared/                         Shared types + constants
│       └── src/index.ts               Session, Message, Cost, Model types
│
├── turbo.json                          Turborepo config
├── docker-compose.yml                  Full stack deployment
├── ecosystem.config.js                 PM2 config
├── .env.example                        Environment variables template
└── CLAUDE.md                           This file
```

---

## How to Add a New Messaging Channel

1. Create `apps/backend/src/channels/<platform>/index.ts` implementing the `Channel` interface:

```typescript
import { Channel, IncomingMessage } from '../base.js';
import { Express } from 'express';

export const MyChannel: Channel = {
  name: 'myplatform',
  capabilities: {  // Optional — enhances system behavior
    maxMessageLength: 4000,
    supportsMarkdown: true,
    supportsStreaming: false,
    supportsMedia: false,
  },

  register(app: Express, onMessage: (msg: IncomingMessage) => Promise<string>): void {
    app.post('/webhook/myplatform', async (req, res) => {
      res.sendStatus(200);
      const reply = await onMessage({
        channel: 'myplatform',
        userId: req.body.userId,
        text: req.body.text,
        raw: req.body,
      });
      await MyChannel.send(req.body.userId, reply);
    });
  },

  async send(userId: string, message: string): Promise<void> {
    // Call your platform's send API
  },
};
```

2. Add env vars to `.env.example`
3. In `apps/backend/src/index.ts`, import and add to `channels` array

---

## How to Add a New Tool Connector

1. Create `apps/backend/src/tools/<service>/index.ts` implementing the `ToolModule` interface:

```typescript
import { ToolModule } from '../base.js';

export const MyToolModule: ToolModule = {
  name: 'MyService',
  category: 'utility',  // Optional: 'google' | 'utility' | 'mcp' | 'plugin' | 'system'
  tools: [
    {
      name: 'do_something',
      description: 'Does something useful.',
      input_schema: {
        type: 'object',
        properties: { param: { type: 'string', description: 'A parameter.' } },
        required: ['param'],
      },
    },
  ],
  handlers: {
    async do_something(input, context?) {
      // context?.emit('tool:progress', { step: 1 }) — optional real-time updates
      return `Done: ${input.param}`;
    },
  },
};
```

2. In `apps/backend/src/index.ts`, register: `toolRegistry.register(MyToolModule);`

---

## API Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/health` | GET | Health check + version + uptime |
| `/api/sessions` | GET | List all sessions (paginated) |
| `/api/sessions/:id` | GET | Get session with messages |
| `/api/tools/executions` | GET | Tool execution log (paginated) |
| `/api/cost/today` | GET | Today's total cost |
| `/api/settings` | GET | Get all settings |
| `/api/settings` | PUT | Update a setting |
| `/webhook/sms` | POST | Twilio SMS webhook |
| `/webhook/telegram` | POST | Telegram webhook (stub) |
| `/webhook/slack` | POST | Slack webhook (stub) |
| `/webhook/whatsapp` | POST | WhatsApp webhook (stub) |

**WebSocket**: Connect to `ws://localhost:3000/ws` for real-time events:
- `tool:start` / `tool:complete` — Tool execution updates
- `message:chunk` / `message:complete` — Streaming responses
- `cost:update` — Cost tracking updates
- `session:created` / `session:updated` — Session lifecycle

---

## Development

```bash
npm run dev           # Start all (Turborepo)
npm run dev:backend   # Backend only (hot-reload)
npm run dev:dashboard # Dashboard only (Next.js dev)
npm run build         # Build all packages
npm run typecheck     # Type check all packages
npm run test          # Run all tests
npm run setup-google  # Google OAuth setup
```

---

## Architecture Notes

- **Monorepo**: Turborepo manages `apps/backend`, `apps/dashboard`, `packages/shared`
- **Database**: SQLite with v1 tables (backwards compat for SMS) + v2 tables (sessions, cost, tools)
- **Events**: EventBus decouples components; Socket.IO forwards events to dashboard
- **Channels**: Twilio SMS active; Telegram, Slack, WhatsApp ready to activate
- **Tools**: 39+ tools across Gmail, Calendar, GCP, Admin, datetime; extensible via ToolModule interface
- **Token optimization**: Planned selective tool inclusion, conversation summarization, model routing
- **Data directory**: `data/` is gitignored — contains SQLite DB, Google tokens, Obsidian vault

---

## Security

- Twilio webhook signatures validated on every SMS request
- Google OAuth tokens stored locally (auto-refreshed on expiry)
- No user data sent to third parties beyond configured services
- Dashboard API has CORS configured for localhost
- API keys stored encrypted in database (when using settings UI)

---

## Claude Code Autonomous Workflow Rules

**These rules are MANDATORY for all Claude Code sessions working on this project.**

### After Every Task or Phase Completion:

1. **Update Docs First**: Update this CLAUDE.md file and any other .md files to reflect current state — architecture, file tree, API docs, phase status, dependency changes.

2. **Auto-Commit**: Stage and commit all changes with a descriptive message. Do not wait to be asked.

3. **Auto-Push**: Push to the current remote branch immediately after committing. Use `git push -u origin <branch-name>`. Retry up to 4 times with exponential backoff on network failure.

4. **Auto-PR**: After completing a full phase or major feature, create a pull request using GitHub MCP tools (`mcp__github__create_pull_request`). Include:
   - Summary of all changes (bullet points)
   - Test plan
   - Phase number and what was accomplished

5. **Auto-Merge**: After PR creation, enable auto-merge using `mcp__github__enable_pr_auto_merge` or `mcp__github__merge_pull_request`.

6. **Use All Tools**: Leverage all available GitHub MCP tools, skills, plugins, and connectors. Use the full toolset to maximize automation.

7. **Phase Tracking**: Update the phase roadmap below after completing each phase.

### Phase Roadmap Status

| Phase | Name | Status | Description |
|-------|------|--------|-------------|
| 1 | Foundation | **COMPLETE** | Turborepo monorepo, Next.js dashboard shell, enhanced DB, EventBus, Socket.IO, REST API |
| 2 | Live Dashboard | PENDING | Wire dashboard to live backend data via WebSocket + API |
| 3 | Multi-Model Router | PENDING | Haiku/Sonnet/Opus routing, cost tracking, budget management |
| 4 | MCP Integration | PENDING | Built-in MCP server, Claude Desktop/Code connectivity |
| 5 | Obsidian AI Brain | PENDING | ChromaDB vector memory, bidirectional Obsidian sync |
| 6 | Agent Teams | PENDING | Coordinator, Researcher, Coder, Planner, Executor agents |
| 7 | Plugins & Channels | PENDING | Plugin system, activate Telegram/Slack/WhatsApp/Discord |
