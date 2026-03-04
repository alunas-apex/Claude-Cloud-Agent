/**
 * Slack Channel (STUB)
 *
 * To activate:
 *  1. Create a Slack App at https://api.slack.com/apps
 *  2. Enable "Event Subscriptions" — set Request URL to https://<your-domain>/webhook/slack
 *  3. Subscribe to bot events: message.im (direct messages)
 *  4. Add bot OAuth scopes: chat:write, im:read, im:history
 *  5. Install the app to your workspace and copy the Bot Token
 *  6. Set env vars: SLACK_BOT_TOKEN, SLACK_SIGNING_SECRET
 *  7. Install the Slack Bolt library:
 *       npm install @slack/bolt
 *  8. Uncomment SlackChannel in src/index.ts
 */

import { Express } from 'express';
import { Channel, IncomingMessage } from '../base.js';
import crypto from 'crypto';

function verifySlackSignature(signingSecret: string, req: any): boolean {
  const timestamp = req.headers['x-slack-request-timestamp'];
  const signature = req.headers['x-slack-signature'];
  if (!timestamp || !signature) return false;

  // Protect against replay attacks
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;

  const rawBody = JSON.stringify(req.body);
  const baseString = `v0:${timestamp}:${rawBody}`;
  const hmac = crypto.createHmac('sha256', signingSecret);
  hmac.update(baseString);
  const computed = `v0=${hmac.digest('hex')}`;

  return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(signature));
}

export const SlackChannel: Channel = {
  name: 'slack',

  register(app: Express, onMessage: (msg: IncomingMessage) => Promise<string>): void {
    app.post('/webhook/slack', async (req, res) => {
      const signingSecret = process.env.SLACK_SIGNING_SECRET ?? '';
      if (signingSecret && !verifySlackSignature(signingSecret, req)) {
        res.status(403).send('Forbidden');
        return;
      }

      // Slack URL verification challenge
      if (req.body.type === 'url_verification') {
        res.json({ challenge: req.body.challenge });
        return;
      }

      res.sendStatus(200); // Acknowledge immediately

      const event = req.body.event;
      // Only handle direct messages, ignore bot messages
      if (!event || event.type !== 'message' || event.bot_id || !event.text) return;

      const incoming: IncomingMessage = {
        channel: 'slack',
        userId: event.user,
        text: event.text,
        raw: req.body,
      };

      // Store the channel ID for reply (Slack needs channel, not just user)
      const slackChannel = event.channel;

      try {
        const reply = await onMessage(incoming);
        await sendSlackMessage(slackChannel, reply);
      } catch (err) {
        console.error('[Slack] Error:', err);
      }
    });

    console.log('[Slack] Webhook registered at POST /webhook/slack');
  },

  async send(userId: string, message: string): Promise<void> {
    // For Slack, userId doubles as channel ID for DMs
    await sendSlackMessage(userId, message);
  },
};

async function sendSlackMessage(channel: string, text: string): Promise<void> {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) throw new Error('Missing SLACK_BOT_TOKEN');

  await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ channel, text }),
  });
}
