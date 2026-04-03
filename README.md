<div align="center">

# Claude Cloud Agent

### Autonomous AI Command Center

<br />

[![Claude AI](https://img.shields.io/badge/Powered%20by-Claude%20AI-7C3AED?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMTIgMkM2LjQ4IDIgMiA2LjQ4IDIgMTJzNC40OCAxMCAxMCAxMCAxMC00LjQ4IDEwLTEwUzE3LjUyIDIgMTIgMnoiIGZpbGw9IndoaXRlIi8+PC9zdmc+)](https://anthropic.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://typescriptlang.org)
[![MCP](https://img.shields.io/badge/MCP-v1.29-00D4AA?style=for-the-badge)](https://modelcontextprotocol.io)
[![License](https://img.shields.io/badge/License-MIT-F59E0B?style=for-the-badge)](LICENSE)

<br />

**A full-stack autonomous AI agent platform with real-time dashboard,**
**multi-model intelligence routing, MCP server integration, and 39+ tools.**

[Getting Started](#-getting-started) &nbsp;&middot;&nbsp; [Architecture](#-architecture) &nbsp;&middot;&nbsp; [Features](#-features) &nbsp;&middot;&nbsp; [API Reference](#-api-reference) &nbsp;&middot;&nbsp; [Roadmap](#-roadmap)

<br />

---

</div>

<br />

## Overview

Claude Cloud Agent is an **autonomous AI command center** that transforms Claude into a fully controllable platform for managing your digital infrastructure. Text it via SMS, control it from a real-time dashboard, or connect it to any MCP-compatible client.

It doesn't just answer questions — it **takes action**. Send emails, manage calendars, deploy to GCP, administer Google Workspace users, and more — all through natural language across multiple channels.

<br />

<div align="center">

```
                          ┌──────────────────────────────┐
                          │      Claude Cloud Agent      │
                          │        Command Center        │
                          └──────────┬───────────────────┘
                                     │
              ┌──────────────────────┼──────────────────────┐
              │                      │                      │
    ┌─────────▼─────────┐ ┌─────────▼─────────┐ ┌─────────▼─────────┐
    │   Next.js          │ │   Express +        │ │   MCP Server      │
    │   Dashboard        │ │   Socket.IO        │ │   (SSE + stdio)   │
    │   :3001            │ │   :3000            │ │                   │
    └─────────┬─────────┘ └─────────┬─────────┘ └─────────┬─────────┘
              │                      │                      │
              └──────────────────────┼──────────────────────┘
                                     │
              ┌──────────────────────┼──────────────────────┐
              │                      │                      │
    ┌─────────▼─────────┐ ┌─────────▼─────────┐ ┌─────────▼─────────┐
    │   Model Router     │ │   Tool Registry    │ │   Cost Tracker    │
    │   Haiku/Sonnet/    │ │   39+ Tools        │ │   Budget Mgmt     │
    │   Opus             │ │   6 Categories     │ │   Per-model       │
    └───────────────────┘ └───────────────────┘ └───────────────────┘
```

</div>

<br />

## Highlights

<table>
<tr>
<td width="33%" valign="top">

### Multi-Model Intelligence
Automatic Haiku / Sonnet / Opus routing based on task complexity. Zero LLM overhead — pure heuristic scoring. Fallback chains on rate limits.

</td>
<td width="33%" valign="top">

### 39+ Integrated Tools
Gmail, Calendar, GCP (16 tools), Workspace Admin (13 tools), and more. Extensible via simple `ToolModule` interface.

</td>
<td width="33%" valign="top">

### Real-Time Dashboard
Live stats, session management, tool execution logs, cost tracking, and MCP server management — all via WebSocket.

</td>
</tr>
<tr>
<td width="33%" valign="top">

### MCP Protocol Native
Built-in MCP server exposes all tools to Claude Desktop and Claude Code. Connect to external MCP servers via marketplace.

</td>
<td width="33%" valign="top">

### Cost Intelligence
Per-model token tracking, daily/session budgets, auto-downgrade on budget limits. Every cent accounted for.

</td>
<td width="33%" valign="top">

### Multi-Channel
SMS via Twilio today. Telegram, Slack, WhatsApp, Discord ready to activate. Channel-agnostic architecture.

</td>
</tr>
</table>

<br />

## Features

### Multi-Model Intelligence Router

The model router automatically selects the optimal Claude model for each request using a heuristic complexity scorer (0-100):

| Score | Model | Cost (in/out per 1K) | Use Case |
|:---:|:---:|:---:|:---|
| 0-29 | **Haiku 4.5** | $0.001 / $0.005 | Greetings, simple lookups, status checks |
| 30-69 | **Sonnet 4.6** | $0.003 / $0.015 | Multi-tool tasks, standard operations |
| 70-100 | **Opus 4.6** | $0.015 / $0.075 | Complex analysis, planning, code generation |

**Scoring factors:** message length, keyword analysis, question complexity, conversation depth, tool requirements, budget constraints.

**Fallback chains:** If a model returns 429/529, the system automatically retries with the next model in the chain.

### MCP Integration

Connect Claude Cloud Agent to any MCP-compatible client:

```json
{
  "mcpServers": {
    "claude-cloud-agent": {
      "command": "node",
      "args": ["apps/backend/dist/mcp-stdio.js"]
    }
  }
}
```

The built-in MCP server exposes all 39+ tools via **SSE** and **stdio** transports. The MCP client manager connects to external servers, auto-discovers their tools, and imports them into the registry.

### Tool Categories

| Category | Tools | Examples |
|:---|:---:|:---|
| **Gmail** | 5 | Read, search, compose, send, reply |
| **Calendar** | 5 | CRUD events, Google Meet links |
| **GCP** | 16 | Projects, IAM, Cloud Run, Storage, Build |
| **Workspace Admin** | 13 | Users, groups, org units, audit logs |
| **Utility** | 1 | Date/time |
| **MCP** | Dynamic | Auto-imported from external servers |

<br />

## Getting Started

### Prerequisites

| Requirement | Purpose |
|:---|:---|
| **Node.js 20+** | Runtime |
| **Anthropic API Key** | Claude AI access |
| Google Cloud Project | Gmail + Calendar APIs |
| Twilio Account | SMS channel (optional) |

### Quick Start

```bash
# 1. Clone and install
git clone https://github.com/alunas-apex/Claude-Cloud-Agent.git
cd Claude-Cloud-Agent
npm install

# 2. Configure environment
cp .env.example .env
# Fill in: ANTHROPIC_API_KEY, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET,
#          TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER

# 3. Authorize Google (one-time)
npm run setup-google

# 4. Start everything
npm run dev
```

**Services:**

| Service | URL | Description |
|:---|:---|:---|
| Backend | `http://localhost:3000` | API + WebSocket + webhooks |
| Dashboard | `http://localhost:3001` | Next.js command center |
| MCP SSE | `http://localhost:3000/mcp/sse` | MCP transport endpoint |
| WebSocket | `ws://localhost:3000/ws` | Real-time events |

### Docker Compose

```bash
docker compose up -d
```

Includes backend, dashboard, and Redis (for future agent teams job queue).

<br />

## Architecture

```
Turborepo Monorepo
├── apps/backend          Express + Socket.IO server
│   ├── agent/            Model router, cost tracker, tool registry, assistant
│   ├── channels/         Twilio (active), Telegram, Slack, WhatsApp (stubs)
│   ├── services/         Database, EventBus, WebSocket, MCP server/client
│   └── tools/            Google (Gmail, Calendar, GCP, Admin), utility
├── apps/dashboard        Next.js 14 command center
│   ├── app/              Pages: home, sessions, tools, settings, MCP, agents
│   ├── components/       Sidebar with active route highlighting
│   └── hooks/            REST API polling + WebSocket connection
└── packages/shared       TypeScript types and constants
```

**Key design decisions:**
- **SQLite with WAL** — Zero-config, embedded, fast reads. Cost ledger, sessions, tool executions, MCP configs all persisted.
- **EventBus** — Singleton EventEmitter decouples components. Socket.IO forwards events to dashboard in real-time.
- **Heuristic routing** — No LLM calls for model selection. Pure keyword/length/complexity scoring for zero-overhead routing.
- **Category-aware tools** — ToolRegistry supports keyword-based selective inclusion, only sending relevant tool schemas per request.

<br />

## API Reference

### Core Endpoints

| Method | Endpoint | Description |
|:---:|:---|:---|
| `GET` | `/health` | Health check + version + uptime + channels |
| `GET` | `/api/sessions` | List all sessions (paginated) |
| `GET` | `/api/sessions/:id` | Get session with messages |
| `GET` | `/api/tools` | List all registered tools |
| `GET` | `/api/tools/executions` | Tool execution audit log |
| `GET` | `/api/tools/categories` | Tool count per category |

### Cost & Budget

| Method | Endpoint | Description |
|:---:|:---|:---|
| `GET` | `/api/cost/today` | Today's total cost |
| `GET` | `/api/cost/breakdown` | Cost breakdown by model |
| `GET` | `/api/budget` | Budget status (limits, remaining) |
| `GET` | `/api/model/route` | Test model routing for a message |

### MCP Management

| Method | Endpoint | Description |
|:---:|:---|:---|
| `GET` | `/api/mcp/server/status` | Built-in MCP server status |
| `GET` | `/api/mcp/servers` | List external server connections |
| `POST` | `/api/mcp/servers` | Add external MCP server |
| `DELETE` | `/api/mcp/servers/:id` | Remove external server |
| `PUT` | `/api/mcp/servers/:id/toggle` | Enable/disable server |
| `GET` | `/mcp/sse` | MCP SSE transport |
| `POST` | `/mcp/messages` | MCP message endpoint |

### Settings & Webhooks

| Method | Endpoint | Description |
|:---:|:---|:---|
| `GET` | `/api/settings` | Get all settings |
| `PUT` | `/api/settings` | Update a setting |
| `POST` | `/webhook/sms` | Twilio SMS webhook |
| `POST` | `/webhook/telegram` | Telegram (stub) |
| `POST` | `/webhook/slack` | Slack (stub) |
| `POST` | `/webhook/whatsapp` | WhatsApp (stub) |

### WebSocket Events

Connect to `ws://localhost:3000/ws` via Socket.IO:

| Event | Direction | Description |
|:---|:---:|:---|
| `tool:start` | Server → Client | Tool execution started |
| `tool:complete` | Server → Client | Tool execution finished |
| `cost:update` | Server → Client | Cost tracking update |
| `session:created` | Server → Client | New session started |
| `session:updated` | Server → Client | Session metadata changed |
| `message:chunk` | Server → Client | Streaming response chunk |

<br />

## Extending

### Add a Tool

```typescript
// apps/backend/src/tools/my-service/index.ts
import { ToolModule } from '../base.js';

export const MyToolModule: ToolModule = {
  name: 'MyService',
  category: 'utility',
  tools: [{
    name: 'do_something',
    description: 'Does something useful.',
    input_schema: {
      type: 'object',
      properties: { param: { type: 'string', description: 'A parameter.' } },
      required: ['param'],
    },
  }],
  handlers: {
    async do_something(input) {
      return `Done: ${input.param}`;
    },
  },
};

// Register in apps/backend/src/index.ts:
// toolRegistry.register(MyToolModule);
```

### Add a Channel

```typescript
// apps/backend/src/channels/my-platform/index.ts
import { Channel, IncomingMessage } from '../base.js';

export const MyChannel: Channel = {
  name: 'myplatform',
  capabilities: { maxMessageLength: 4000, supportsMarkdown: true,
                  supportsStreaming: false, supportsMedia: false },
  register(app, onMessage) {
    app.post('/webhook/myplatform', async (req, res) => {
      res.sendStatus(200);
      const reply = await onMessage({
        channel: 'myplatform', userId: req.body.userId,
        text: req.body.text, raw: req.body,
      });
      await MyChannel.send(req.body.userId, reply);
    });
  },
  async send(userId, message) { /* Platform API call */ },
};
```

<br />

## Roadmap

<table>
<tr>
<td width="8%" align="center"><strong>Phase</strong></td>
<td width="22%"><strong>Name</strong></td>
<td width="10%" align="center"><strong>Status</strong></td>
<td><strong>Description</strong></td>
</tr>
<tr>
<td align="center">1</td>
<td>Foundation</td>
<td align="center">&#9989;</td>
<td>Turborepo monorepo, Next.js dashboard, enhanced DB, EventBus, Socket.IO, REST API</td>
</tr>
<tr>
<td align="center">2</td>
<td>Live Dashboard</td>
<td align="center">&#9989;</td>
<td>Live stats, sessions, tool logs, settings, WebSocket activity feed</td>
</tr>
<tr>
<td align="center">3</td>
<td>Multi-Model Router</td>
<td align="center">&#9989;</td>
<td>Heuristic model routing, cost tracking, budget management, selective tools</td>
</tr>
<tr>
<td align="center">4</td>
<td>MCP Integration</td>
<td align="center">&#9989;</td>
<td>Built-in MCP server, external MCP client, Claude Desktop/Code connectivity</td>
</tr>
<tr>
<td align="center">5</td>
<td>Obsidian AI Brain</td>
<td align="center">&#9744;</td>
<td>ChromaDB vector memory, bidirectional Obsidian vault sync</td>
</tr>
<tr>
<td align="center">6</td>
<td>Agent Teams</td>
<td align="center">&#9744;</td>
<td>Coordinator, Researcher, Coder, Planner, Executor agents</td>
</tr>
<tr>
<td align="center">7</td>
<td>Plugins & Channels</td>
<td align="center">&#9744;</td>
<td>Plugin system, activate Telegram/Slack/WhatsApp/Discord</td>
</tr>
</table>

<br />

## Development

```bash
npm run dev              # Start all (Turborepo)
npm run dev:backend      # Backend only (hot-reload)
npm run dev:dashboard    # Dashboard only (Next.js dev)
npm run build            # Build all packages
npm run typecheck        # Type check all packages
npm run test             # Run all tests
npm run setup-google     # Google OAuth setup
```

<br />

## Security

- Twilio webhook signature validation on every SMS request
- Google OAuth tokens stored locally with auto-refresh
- No user data sent to third parties beyond configured services
- Dashboard API CORS configured for localhost
- API keys stored encrypted in database via settings UI

<br />

<div align="center">

---

**Built with [Claude AI](https://anthropic.com) &middot; [Model Context Protocol](https://modelcontextprotocol.io) &middot; [Turborepo](https://turbo.build)**

</div>
