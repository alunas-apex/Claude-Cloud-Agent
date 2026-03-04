/**
 * WhatsApp Channel via Twilio (STUB)
 *
 * To activate:
 *  1. Enable WhatsApp in your Twilio account (Sandbox or approved number)
 *  2. Set TWILIO_WHATSAPP_NUMBER in .env (e.g. "whatsapp:+14155238886")
 *  3. Set Twilio WhatsApp webhook URL to https://<your-domain>/webhook/whatsapp
 *  4. Uncomment WhatsAppChannel in src/index.ts
 *
 * Note: This reuses the existing Twilio credentials. The only difference from
 * TwilioChannel is the "whatsapp:" prefix on phone numbers and the separate
 * webhook path so you can route to different channels.
 */

import twilio from 'twilio';
import { Express } from 'express';
import { Channel, IncomingMessage } from '../base.js';

let twilioClient: ReturnType<typeof twilio> | null = null;

function getClient() {
  if (!twilioClient) {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    if (!sid || !token) throw new Error('Missing Twilio credentials for WhatsApp channel.');
    twilioClient = twilio(sid, token);
  }
  return twilioClient;
}

export const WhatsAppChannel: Channel = {
  name: 'whatsapp',

  register(app: Express, onMessage: (msg: IncomingMessage) => Promise<string>): void {
    app.post('/webhook/whatsapp', async (req, res) => {
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      if (authToken) {
        const sig = req.headers['x-twilio-signature'] as string;
        const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
        const valid = twilio.validateRequest(authToken, sig, url, req.body);
        if (!valid) {
          res.status(403).send('Forbidden');
          return;
        }
      }

      res.status(200).set('Content-Type', 'text/xml').send('<Response></Response>');

      const from: string = req.body.From ?? ''; // e.g. "whatsapp:+1234567890"
      const body: string = req.body.Body ?? '';

      if (!from || !body.trim()) return;

      const incoming: IncomingMessage = {
        channel: 'whatsapp',
        userId: from,
        text: body.trim(),
        raw: req.body,
      };

      try {
        const reply = await onMessage(incoming);
        await WhatsAppChannel.send(from, reply);
      } catch (err) {
        console.error('[WhatsApp] Error:', err);
      }
    });

    console.log('[WhatsApp] Webhook registered at POST /webhook/whatsapp');
  },

  async send(userId: string, message: string): Promise<void> {
    const from = process.env.TWILIO_WHATSAPP_NUMBER;
    if (!from) throw new Error('Missing TWILIO_WHATSAPP_NUMBER env var.');

    // WhatsApp supports longer messages but we still chunk at 4000 chars
    const MAX_LENGTH = 4000;
    if (message.length <= MAX_LENGTH) {
      await getClient().messages.create({ to: userId, from, body: message });
      return;
    }

    const chunks: string[] = [];
    let remaining = message;
    while (remaining.length > 0) {
      if (remaining.length <= MAX_LENGTH) { chunks.push(remaining); break; }
      const cut = remaining.lastIndexOf('\n', MAX_LENGTH) || remaining.lastIndexOf(' ', MAX_LENGTH) || MAX_LENGTH;
      chunks.push(remaining.slice(0, cut));
      remaining = remaining.slice(cut).trimStart();
    }
    for (const chunk of chunks) {
      await getClient().messages.create({ to: userId, from, body: chunk });
    }
  },
};
