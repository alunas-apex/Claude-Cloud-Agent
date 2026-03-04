import { ToolModule } from '../base.js';

export const DatetimeToolModule: ToolModule = {
  name: 'Utility',

  tools: [
    {
      name: 'get_current_datetime',
      description:
        'Get the current date and time. Use this whenever you need to know today\'s date, the current time, or to calculate relative dates like "next Monday" or "in 2 hours".',
      input_schema: {
        type: 'object',
        properties: {
          timezone: {
            type: 'string',
            description:
              'IANA timezone name, e.g. "America/New_York", "Europe/London". Defaults to UTC.',
          },
        },
        required: [],
      },
    },
  ],

  handlers: {
    async get_current_datetime(input) {
      const tz = (input.timezone as string) || 'UTC';
      try {
        const now = new Date();
        const formatted = new Intl.DateTimeFormat('en-US', {
          timeZone: tz,
          dateStyle: 'full',
          timeStyle: 'long',
        }).format(now);
        return `Current date/time: ${formatted} (ISO: ${now.toISOString()})`;
      } catch {
        const now = new Date();
        return `Current date/time: ${now.toISOString()} (UTC)`;
      }
    },
  },
};
