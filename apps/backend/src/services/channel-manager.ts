import { Channel } from '../channels/base.js';
import { TwilioChannel } from '../channels/twilio/index.js';
import { TelegramChannel } from '../channels/telegram/index.js';
import { SlackChannel } from '../channels/slack/index.js';
import { WhatsAppChannel } from '../channels/whatsapp/index.js';

/**
 * Channel configuration — maps channel names to their required env vars and module.
 */
interface ChannelDef {
  channel: Channel;
  requiredEnvVars: string[];
  optionalEnvVars?: string[];
}

const CHANNEL_DEFS: ChannelDef[] = [
  {
    channel: TwilioChannel,
    requiredEnvVars: ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_PHONE_NUMBER'],
  },
  {
    channel: TelegramChannel,
    requiredEnvVars: ['TELEGRAM_BOT_TOKEN'],
  },
  {
    channel: SlackChannel,
    requiredEnvVars: ['SLACK_BOT_TOKEN'],
    optionalEnvVars: ['SLACK_SIGNING_SECRET'],
  },
  {
    channel: WhatsAppChannel,
    requiredEnvVars: ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_WHATSAPP_NUMBER'],
  },
];

export interface ChannelStatus {
  name: string;
  enabled: boolean;
  configured: boolean;
  missingEnvVars: string[];
}

/**
 * ChannelManager — Auto-detects available channels based on environment variables.
 *
 * Instead of manually commenting/uncommenting channels in index.ts,
 * this manager checks which channels have their required env vars set
 * and activates them automatically.
 */
export class ChannelManager {
  private activeChannels: Channel[] = [];
  private channelStatuses: ChannelStatus[] = [];

  /**
   * Detect and return all channels that have their required env vars configured.
   */
  detectChannels(): Channel[] {
    this.activeChannels = [];
    this.channelStatuses = [];

    for (const def of CHANNEL_DEFS) {
      const missingVars = def.requiredEnvVars.filter((v) => !process.env[v]);
      const configured = missingVars.length === 0;

      this.channelStatuses.push({
        name: def.channel.name,
        enabled: configured,
        configured,
        missingEnvVars: missingVars,
      });

      if (configured) {
        this.activeChannels.push(def.channel);
      }
    }

    return this.activeChannels;
  }

  /**
   * Get status of all channels (active and inactive).
   */
  getStatuses(): ChannelStatus[] {
    return this.channelStatuses;
  }

  /**
   * Get names of active channels.
   */
  getActiveNames(): string[] {
    return this.activeChannels.map((c) => c.name);
  }
}
