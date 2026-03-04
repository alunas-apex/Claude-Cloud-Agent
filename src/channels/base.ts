import { Express } from 'express';

/**
 * Normalized message from any messaging channel.
 * All channel adapters emit this shape so the MessageRouter
 * can handle any channel without knowing its specifics.
 */
export interface IncomingMessage {
  /** Channel name: 'twilio' | 'telegram' | 'slack' | 'whatsapp' */
  channel: string;
  /** Stable user identifier: phone number, Telegram chat ID, Slack user ID, etc. */
  userId: string;
  /** Plain text body of the message */
  text: string;
  /** Original raw webhook payload for channel-specific processing if needed */
  raw: unknown;
}

/**
 * Channel adapter interface. Implement this to add a new messaging platform.
 *
 * Steps to add a new channel:
 *  1. Create src/channels/<platform>/index.ts implementing this interface
 *  2. Add required env vars to .env.example and .env
 *  3. In src/index.ts, import your class and push it onto the `channels` array
 *  4. Done — MessageRouter handles the rest automatically
 */
export interface Channel {
  /** Unique name for this channel (used in logging and DB) */
  name: string;

  /**
   * Mount any required Express routes (e.g. webhook endpoints).
   * Called once during server startup.
   */
  register(app: Express, onMessage: (msg: IncomingMessage) => Promise<string>): void;

  /**
   * Send a reply message back to a specific user on this channel.
   * @param userId - The same userId that appeared in IncomingMessage
   * @param message - Plain text reply (keep concise for SMS; can be Markdown for Slack)
   */
  send(userId: string, message: string): Promise<void>;
}
