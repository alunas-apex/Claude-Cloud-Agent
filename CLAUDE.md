# Claude Cloud Agent — Autonomous AI Command Center

A full autonomous AI agent command center powered by Claude AI. Features a web dashboard, multi-model intelligence routing, MCP server integration, Obsidian.md AI brain, agent teams, and connectivity to all Claude platforms.

**Architecture**: Turborepo monorepo with Express + Socket.IO backend, Next.js dashboard, and shared type package.

---

## What It Does

### Current (v4.0 — Phase 4 MCP Integration)
- **SMS Agent**: Text your Twilio number in plain English for Gmail, Calendar, GCP, and Admin tasks
- **Live Dashboard**: Real-time command center at `localhost:3001` wired to backend via REST API + WebSocket
  - Dashboard home with live stats, model usage breakdown, budget status, health indicators, activity feed
  - Sessions page with live table, search, channel/status filters, real-time updates via Socket.IO
  - Tools page with registered tool registry + live execution log with expandable input/output
  - Settings page with editable model config, budget limits, API key status, channel toggles
  - MCP page with built-in server status, external server management, and marketplace
  - Active navigation sidebar with route highlighting
- **Multi-Model Intelligence Router**: Automatic Haiku/Sonnet/Opus selection based on task complexity
  - Heuristic-based complexity scoring (0-100) — no LLM overhead for classification
  - Opus for complex reasoning/planning, Sonnet for standard tasks, Haiku for simple queries
  - Fallback chains: automatic retry with next model on rate limits (429/529)
  - Budget-aware auto-downgrade when approaching daily/session limits
  - Selective tool inclusion: keyword-based tool pruning to reduce token usage
  - Tool result truncation: configurable max length to save output tokens
  - User-configurable overrides via settings (force model, disable auto-routing)
- **Cost Tracker**: Real-time token usage and cost tracking per model/session/day
  - Per-model breakdown (tokens in/out, cost, request count)
  - Daily and per-session budget limits with auto-enforcement
  - Cost events streamed to dashboard via WebSocket
- **MCP Integration**: Model Context Protocol server and client
  - Built-in MCP server exposing all 39+ tools via SSE and stdio transports
  - Claude Desktop / Claude Code connectivity via `mcp-stdio.ts` entry point
  - MCP client manager for connecting to external MCP servers (stdio + SSE)
  - Auto-discovery and import of external server tools into ToolRegistry
  - Dashboard page for managing MCP server connections with marketplace
  - Persistent server configs stored in SQLite `mcp_servers` table
- **WebSocket**: Real-time event streaming between backend and dashboard via Socket.IO
- **Enhanced Database**: Sessions, messages, tool executions, cost ledger, settings, and plugin registry
- **API**: REST endpoints for sessions, tools, costs, budget, model routing, MCP, and settings at `/api/*`

- **Obsidian AI Brain**: Persistent vector memory with bidirectional Obsidian vault sync
  - ChromaDB vector database for semantic similarity search
  - Obsidian vault as markdown-based knowledge store (auto-created in `data/obsidian-vault/`)
  - File watcher (chokidar) for real-time vault change detection and auto-reindex
  - Agent memory tools: `memory_store`, `memory_search`, `memory_recent`, `vault_status`
  - Fallback to keyword-based file search when ChromaDB is unavailable
  - Dashboard memory page with search, store, and vault status panels

- **Agent Teams**: Multi-agent collaboration with task delegation and synthesis
  - Coordinator agent decomposes tasks, delegates to specialists, synthesizes results
  - Researcher agent for information gathering and analysis (Sonnet)
  - Coder agent for code generation, debugging, GCP operations (Opus)
  - Planner agent for strategy, architecture, multi-step planning (Opus)
  - Executor agent for simple tool calls and routine operations (Haiku)
  - Dashboard page with agent status, task runner, and execution history
  - REST API: list agents, run tasks, get task history

### Planned (Phase 7)
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
│   │   │   ├── agents/                Agent team system
│   │   │   │   ├── base.ts           ✅ SpecialistAgent base class + types
│   │   │   │   ├── specialists.ts    ✅ Pre-configured agent configs (5 roles)
│   │   │   │   └── team.ts           ✅ AgentTeam coordinator + task delegation
│   │   │   │
│   │   │   ├── agent/                 Core agent logic
│   │   │   │   ├── assistant.ts       Claude agentic loop (multi-model, tool use, cost tracking)
│   │   │   │   ├── model-router.ts    ✅ Heuristic complexity scorer → Haiku/Sonnet/Opus selection
│   │   │   │   ├── cost-tracker.ts    ✅ Token usage, cost calculation, budget enforcement
│   │   │   │   └── tool-registry.ts   Aggregates all ToolModules (category-aware, selective inclusion)
│   │   │   │
│   │   │   ├── mcp-stdio.ts          ✅ Standalone MCP stdio entry point for Claude Desktop/Code
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
│   │   │   │   ├── memory/
│   │   │   │   │   └── index.ts       ✅ Memory store/search/recall tools
│   │   │   │   ├── utility/
│   │   │   │   │   └── datetime.ts    ✅ Current date/time
│   │   │   │   └── zoom/              🔧 Stub
│   │   │   │
│   │   │   ├── services/
│   │   │   │   ├── database.ts        SQLite — v1 (conversations) + v2 (sessions, cost, tools)
│   │   │   │   ├── message-router.ts  Channel-agnostic message handler
│   │   │   │   ├── event-bus.ts       ✅ Central event system
│   │   │   │   ├── websocket.ts       ✅ Socket.IO manager
│   │   │   │   ├── mcp-server.ts      ✅ Built-in MCP server (SSE + stdio transports)
│   │   │   │   ├── mcp-client.ts      ✅ MCP client manager (connect to external servers)
│   │   │   │   └── memory.ts         ✅ ChromaDB + Obsidian vault memory service
│   │   │   │
│   │   │   └── types/
│   │   │       └── index.ts           Re-exports from @claude-agent/shared
│   │   │
│   │   └── scripts/
│   │       └── setup-google-auth.ts   Google OAuth setup
│   │
│   └── dashboard/                      Next.js command center UI
│       └── src/
│           ├── app/
│           │   ├── page.tsx           ✅ Dashboard home (live stats + health + activity feed)
│           │   ├── sessions/page.tsx  ✅ Live session table with filters + WebSocket updates
│           │   ├── agents/page.tsx    ✅ Agent team status, task runner, history
│           │   ├── tools/page.tsx     ✅ Tool registry + live execution log
│           │   ├── memory/page.tsx    ✅ Memory search, store, vault status
│           │   ├── mcp/page.tsx       ✅ MCP server management + marketplace
│           │   ├── plugins/page.tsx   🔧 Plugin marketplace (placeholder)
│           │   └── settings/page.tsx  ✅ Editable model config, budgets, API keys, channels
│           ├── components/
│           │   └── Sidebar.tsx        ✅ Active nav sidebar with route highlighting
│           ├── hooks/
│           │   ├── use-api.ts         ✅ REST API data hooks (polling)
│           │   └── use-socket.ts      ✅ WebSocket connection hook
│           └── lib/
│               └── api.ts             ✅ REST API client
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
| `/health` | GET | Health check + version + uptime + channels |
| `/api/sessions` | GET | List all sessions (paginated) |
| `/api/sessions/:id` | GET | Get session with messages |
| `/api/tools` | GET | List all registered tools (name + description) |
| `/api/tools/executions` | GET | Tool execution log (paginated) |
| `/api/agents` | GET | List all agent team members (role, status, tasks) |
| `/api/agents/:role` | GET | Get specific agent info |
| `/api/agents/tasks/history` | GET | Recent task execution history |
| `/api/agents/run` | POST | Run a task through the agent team |
| `/api/cost/today` | GET | Today's total cost |
| `/api/cost/breakdown` | GET | Cost breakdown by model (tokens, cost, requests) |
| `/api/budget` | GET | Budget status (daily/session limits, remaining, over-budget) |
| `/api/model/route` | GET | Test model routing for a message (query: message, conversationLength) |
| `/api/tools/categories` | GET | Tool count per category |
| `/api/mcp/server/status` | GET | Built-in MCP server status |
| `/api/mcp/servers` | GET | List external MCP server connections |
| `/api/mcp/servers` | POST | Add external MCP server |
| `/api/mcp/servers/:id` | DELETE | Remove external MCP server |
| `/api/mcp/servers/:id/toggle` | PUT | Enable/disable external MCP server |
| `/api/memory/status` | GET | Memory/vault status (note count, ChromaDB, watcher) |
| `/api/memory/search` | GET | Semantic memory search (query: q, limit) |
| `/api/memory/recent` | GET | Recent memories (query: limit) |
| `/api/memory` | POST | Store a new memory (body: content, title, tags) |
| `/mcp/sse` | GET | MCP SSE transport endpoint (for Claude Desktop) |
| `/mcp/messages` | POST | MCP SSE message endpoint |
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
- **Token optimization**: Selective tool inclusion, tool result truncation, heuristic model routing
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
| 2 | Live Dashboard | **COMPLETE** | Live stats, sessions table, tool execution log, editable settings, WebSocket activity feed |
| 3 | Multi-Model Router | **COMPLETE** | Heuristic model routing, cost tracking, budget management, selective tools, dashboard integration |
| 4 | MCP Integration | **COMPLETE** | Built-in MCP server, external MCP client, Claude Desktop/Code connectivity, dashboard management |
| 5 | Obsidian AI Brain | **COMPLETE** | ChromaDB vector memory, Obsidian vault sync, memory tools, dashboard |
| 6 | Agent Teams | **COMPLETE** | Coordinator, Researcher, Coder, Planner, Executor agents with delegation |
| 7 | Plugins & Channels | PENDING | Plugin system, activate Telegram/Slack/WhatsApp/Discord |
