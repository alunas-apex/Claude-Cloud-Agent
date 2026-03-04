# Claude Cloud Agent

An always-running personal assistant powered by Claude AI. Controlled via SMS (Twilio) with full access to Google Workspace. Designed to be easily extended with new messaging channels and tool integrations.

---

## What It Does

Text your Twilio number in plain English and the agent will:
- **Email**: Read, search, compose, send, and reply to Gmail
- **Calendar**: List, create, update, and delete Google Calendar events (with Google Meet links)
- **More**: Extensible — Drive, Zoom, Slack, Telegram, WhatsApp stubs are ready to activate

---

## Quick Start

### Prerequisites
- Node.js 18+
- A Google Cloud project with Gmail API + Calendar API enabled
- A Twilio account with an SMS-capable phone number
- An Anthropic API key

### 1. Install Dependencies

```bash
npm install
npm install -g tsx pm2
```

### 2. Configure Environment

```bash
cp .env.example .env
# Fill in all required values in .env
```

Required values:
- `ANTHROPIC_API_KEY` — from [console.anthropic.com](https://console.anthropic.com)
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — from Google Cloud Console (see below)
- `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_PHONE_NUMBER` — from Twilio Console

### 3. Authorise Google Access (one-time)

```bash
npm run setup-google
```

This opens a browser URL, you sign in, paste the code back. Tokens are saved to `data/google-tokens.json` (gitignored).

**Google Cloud setup steps:**
1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a project → Enable **Gmail API** and **Google Calendar API**
3. Go to **APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID**
4. Application type: **Desktop app**
5. Copy the Client ID and Secret to `.env`

### 4. Configure Twilio Webhook

In your [Twilio Console](https://console.twilio.com):
1. Go to **Phone Numbers → Manage → Active Numbers**
2. Click your number → Under "Messaging", set:
   - Webhook URL: `https://<your-domain>/webhook/sms`
   - HTTP Method: `HTTP POST`

> **Local development**: Use [ngrok](https://ngrok.com) to expose localhost:
> ```bash
> ngrok http 3000
> # Use the https URL as your Twilio webhook
> ```

### 5. Start the Agent

**Development (with auto-reload):**
```bash
npm run dev
```

**Production (always-running with PM2):**
```bash
pm2 start ecosystem.config.js
pm2 save        # Persist across reboots
pm2 startup     # Enable auto-start on boot
```

**Useful PM2 commands:**
```bash
pm2 logs claude-agent     # Live logs
pm2 restart claude-agent  # Restart
pm2 stop claude-agent     # Stop
pm2 status                # View status
```

---

## Project Structure

```
src/
├── index.ts                    Entry point — register channels & tools here
├── server.ts                   Express app factory
│
├── channels/                   Messaging channel adapters
│   ├── base.ts                 Channel interface (IncomingMessage, Channel)
│   ├── twilio/                 ✅ Active — SMS via Twilio
│   ├── telegram/               🔧 Stub — ready to activate
│   ├── slack/                  🔧 Stub — ready to activate
│   └── whatsapp/               🔧 Stub — ready to activate
│
├── tools/                      Tool connector modules
│   ├── base.ts                 ToolModule interface
│   ├── google/
│   │   ├── auth.ts             Shared Google OAuth2 client
│   │   ├── gmail.ts            ✅ Active — Gmail read/write/send
│   │   ├── calendar.ts         ✅ Active — Calendar CRUD + Meet
│   │   └── drive.ts            🔧 Stub — ready to activate
│   ├── zoom/                   🔧 Stub — ready to activate
│   └── utility/
│       └── datetime.ts         ✅ Active — current date/time
│
├── agent/
│   ├── assistant.ts            Claude agentic loop (tool use)
│   └── tool-registry.ts        Aggregates all ToolModules
│
└── services/
    ├── database.ts             SQLite conversation history
    └── message-router.ts       Channel-agnostic message handler
```

---

## How to Add a New Messaging Channel

1. Create `src/channels/<platform>/index.ts` implementing the `Channel` interface:

```typescript
import { Channel, IncomingMessage } from '../base.js';
import { Express } from 'express';

export const MyChannel: Channel = {
  name: 'myplatform',

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

2. Add any required env vars to `.env.example` and `.env`
3. In `src/index.ts`, import and add to the `channels` array
4. Done — MessageRouter handles the rest automatically

---

## How to Add a New Tool Connector

1. Create `src/tools/<service>/index.ts` implementing the `ToolModule` interface:

```typescript
import { ToolModule } from '../base.js';

export const MyToolModule: ToolModule = {
  name: 'MyService',
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
    async do_something(input) {
      // Call your service API
      return `Done: ${input.param}`;
    },
  },
};
```

2. Add any required env vars to `.env.example` and `.env`
3. In `src/index.ts`, import and register:
   ```typescript
   import { MyToolModule } from './tools/myservice/index.js';
   toolRegistry.register(MyToolModule);
   ```
4. Done — Claude will automatically use the new tool when relevant

---

## Built-in Commands

Send these via SMS to control the agent:
- `/clear` or `clear history` — Clear conversation history and start fresh

---

## Development

```bash
npm run dev       # Start with hot-reload (tsx watch)
npm run build     # TypeScript type check (tsc --noEmit)
npm run setup-google  # Re-run Google OAuth setup
```

**Health check:** `GET http://localhost:3000/health`

---

## Architecture Notes

- **Conversation history** is stored in `data/agent.db` (SQLite) — last 20 messages per user
- **Google tokens** are stored in `data/google-tokens.json` — auto-refreshed on expiry
- **SMS length**: Twilio messages over 1,550 chars are automatically split and sent sequentially
- **Agentic loop**: Claude can call up to 10 tools per message before returning a response
- The `data/` directory is gitignored — never commit tokens or the database

---

## Security

- Twilio webhook signatures are validated on every request
- Google OAuth tokens are stored locally (not in env vars)
- No user data is sent to third parties beyond the configured services
- The `ANTHROPIC_API_KEY` is the only secret sent externally for AI processing
