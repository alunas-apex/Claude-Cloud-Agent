import twilio from 'twilio';
import { Express } from 'express';
import { Channel, IncomingMessage } from '../base.js';
import { createTwilioRouter } from './routes.js';

let twilioClient: ReturnType<typeof twilio> | null = null;

function getClient() {
  if (!twilioClient) {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    if (!sid || !token) {
      throw new Error('Missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN environment variables.');
    }
    twilioClient = twilio(sid, token);
  }
  return twilioClient;
}

export async function sendSms(to: string, body: string): Promise<void> {
  const from = process.env.TWILIO_PHONE_NUMBER;
  if (!from) throw new Error('Missing TWILIO_PHONE_NUMBER environment variable.');

  // Twilio SMS has a 1600 character limit — split if needed
  const MAX_LENGTH = 1550;
  if (body.length <= MAX_LENGTH) {
    await getClient().messages.create({ to, from, body });
    return;
  }

  // Split into chunks without breaking words
  const chunks: string[] = [];
  let remaining = body;
  while (remaining.length > 0) {
    if (remaining.length <= MAX_LENGTH) {
      chunks.push(remaining);
      break;
    }
    const cutAt = remaining.lastIndexOf(' ', MAX_LENGTH);
    const cut = cutAt > 0 ? cutAt : MAX_LENGTH;
    chunks.push(remaining.slice(0, cut));
    remaining = remaining.slice(cut).trimStart();
  }

  for (const chunk of chunks) {
    await getClient().messages.create({ to, from, body: chunk });
  }
}

export const TwilioChannel: Channel = {
  name: 'twilio',

  register(app: Express, onMessage: (msg: IncomingMessage) => Promise<string>): void {
    const router = createTwilioRouter(onMessage);
    app.use('/', router);
    console.log('[Twilio] Webhook registered at POST /webhook/sms');
  },

  async send(userId: string, message: string): Promise<void> {
    await sendSms(userId, message);
  },
};
