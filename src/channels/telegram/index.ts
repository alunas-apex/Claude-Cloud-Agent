/**
 * Telegram Channel (STUB)
 *
 * To activate:
 *  1. Create a bot via @BotFather on Telegram and get the token
 *  2. Set TELEGRAM_BOT_TOKEN in .env
 *  3. Install the Telegram Bot API library:
 *       npm install node-telegram-bot-api
 *       npm install --save-dev @types/node-telegram-bot-api
 *  4. Uncomment TelegramChannel in src/index.ts
 *  5. Set your webhook URL: https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<your-domain>/webhook/telegram
 *
 * Telegram messages support Markdown formatting — the system prompt can be
 * adjusted to use richer formatting for Telegram users vs plain SMS.
 */

import { Express } from 'express';
import { Channel, IncomingMessage } from '../base.js';

export const TelegramChannel: Channel = {
  name: 'telegram',

  register(app: Express, onMessage: (msg: IncomingMessage) => Promise<string>): void {
    app.post('/webhook/telegram', async (req, res) => {
      res.sendStatus(200); // Acknowledge immediately

      const update = req.body;
      const message = update?.message;
      if (!message?.text) return;

      const chatId = String(message.chat.id);
      const text: string = message.text;

      const incoming: IncomingMessage = {
        channel: 'telegram',
        userId: chatId,
        text,
        raw: update,
      };

      try {
        const reply = await onMessage(incoming);
        await TelegramChannel.send(chatId, reply);
      } catch (err) {
        console.error('[Telegram] Error:', err);
      }
    });

    console.log('[Telegram] Webhook registered at POST /webhook/telegram');
  },

  async send(userId: string, message: string): Promise<void> {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) throw new Error('Missing TELEGRAM_BOT_TOKEN');

    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: userId,
        text: message,
        parse_mode: 'Markdown',
      }),
    });
  },
};
