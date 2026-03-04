import { google } from 'googleapis';
import { ToolModule } from '../base.js';
import { getAuthClient } from './auth.js';

function getCalendar() {
  return google.calendar({ version: 'v3', auth: getAuthClient() });
}

export const CalendarToolModule: ToolModule = {
  name: 'GoogleCalendar',

  tools: [
    {
      name: 'list_calendar_events',
      description: 'List upcoming calendar events.',
      input_schema: {
        type: 'object',
        properties: {
          maxResults: {
            type: 'number',
            description: 'Max number of events to return (default 10).',
          },
          timeMin: {
            type: 'string',
            description:
              'Start time in ISO 8601 format. Defaults to now. Example: "2024-12-01T00:00:00Z".',
          },
          timeMax: {
            type: 'string',
            description: 'End time in ISO 8601 format (optional).',
          },
          query: {
            type: 'string',
            description: 'Free-text search query to filter events.',
          },
        },
        required: [],
      },
    },
    {
      name: 'create_calendar_event',
      description: 'Create a new calendar event.',
      input_schema: {
        type: 'object',
        properties: {
          summary: { type: 'string', description: 'Event title.' },
          start: {
            type: 'string',
            description: 'Start time in ISO 8601 format, e.g. "2024-12-15T14:00:00-05:00".',
          },
          end: {
            type: 'string',
            description: 'End time in ISO 8601 format.',
          },
          description: { type: 'string', description: 'Event description/notes (optional).' },
          location: { type: 'string', description: 'Location of the event (optional).' },
          attendees: {
            type: 'array',
            items: { type: 'string' },
            description: 'List of attendee email addresses (optional).',
          },
          videoConference: {
            type: 'boolean',
            description: 'Add a Google Meet link to this event (optional).',
          },
        },
        required: ['summary', 'start', 'end'],
      },
    },
    {
      name: 'update_calendar_event',
      description: 'Update fields on an existing calendar event.',
      input_schema: {
        type: 'object',
        properties: {
          eventId: { type: 'string', description: 'Calendar event ID.' },
          summary: { type: 'string', description: 'New title (optional).' },
          start: { type: 'string', description: 'New start time ISO 8601 (optional).' },
          end: { type: 'string', description: 'New end time ISO 8601 (optional).' },
          description: { type: 'string', description: 'New description (optional).' },
          location: { type: 'string', description: 'New location (optional).' },
        },
        required: ['eventId'],
      },
    },
    {
      name: 'delete_calendar_event',
      description: 'Delete a calendar event by ID.',
      input_schema: {
        type: 'object',
        properties: {
          eventId: { type: 'string', description: 'Calendar event ID to delete.' },
        },
        required: ['eventId'],
      },
    },
  ],

  handlers: {
    async list_calendar_events(input) {
      const calendar = getCalendar();
      const maxResults = Math.min((input.maxResults as number) ?? 10, 25);
      const timeMin = (input.timeMin as string) ?? new Date().toISOString();

      const res = await calendar.events.list({
        calendarId: 'primary',
        timeMin,
        timeMax: input.timeMax as string | undefined,
        maxResults,
        singleEvents: true,
        orderBy: 'startTime',
        q: input.query as string | undefined,
      });

      const events = res.data.items ?? [];
      if (events.length === 0) return 'No upcoming events found.';

      return events
        .map((e) => {
          const start = e.start?.dateTime ?? e.start?.date ?? 'Unknown';
          const end = e.end?.dateTime ?? e.end?.date ?? '';
          const attendees = e.attendees?.map((a) => a.email).join(', ') ?? 'None';
          return [
            `ID: ${e.id}`,
            `Title: ${e.summary ?? '(no title)'}`,
            `Start: ${start}`,
            `End: ${end}`,
            `Location: ${e.location ?? 'N/A'}`,
            `Attendees: ${attendees}`,
            e.hangoutLink ? `Meet: ${e.hangoutLink}` : null,
          ]
            .filter(Boolean)
            .join('\n');
        })
        .join('\n\n---\n\n');
    },

    async create_calendar_event(input) {
      const calendar = getCalendar();
      const {
        summary,
        start,
        end,
        description,
        location,
        attendees,
        videoConference,
      } = input as {
        summary: string;
        start: string;
        end: string;
        description?: string;
        location?: string;
        attendees?: string[];
        videoConference?: boolean;
      };

      const requestBody: any = {
        summary,
        start: { dateTime: start },
        end: { dateTime: end },
        description,
        location,
        attendees: attendees?.map((email) => ({ email })),
      };

      if (videoConference) {
        requestBody.conferenceData = {
          createRequest: {
            requestId: `meet-${Date.now()}`,
            conferenceSolutionKey: { type: 'hangoutsMeet' },
          },
        };
      }

      const res = await calendar.events.insert({
        calendarId: 'primary',
        requestBody,
        conferenceDataVersion: videoConference ? 1 : 0,
        sendUpdates: attendees?.length ? 'all' : 'none',
      });

      const link = res.data.hangoutLink ? `\nMeet link: ${res.data.hangoutLink}` : '';
      return `Event created: "${summary}" on ${start} (ID: ${res.data.id})${link}`;
    },

    async update_calendar_event(input) {
      const calendar = getCalendar();
      const { eventId, ...fields } = input as {
        eventId: string;
        summary?: string;
        start?: string;
        end?: string;
        description?: string;
        location?: string;
      };

      const patch: any = {};
      if (fields.summary) patch.summary = fields.summary;
      if (fields.start) patch.start = { dateTime: fields.start };
      if (fields.end) patch.end = { dateTime: fields.end };
      if (fields.description !== undefined) patch.description = fields.description;
      if (fields.location !== undefined) patch.location = fields.location;

      const res = await calendar.events.patch({
        calendarId: 'primary',
        eventId,
        requestBody: patch,
      });

      return `Event updated: "${res.data.summary}" (ID: ${eventId})`;
    },

    async delete_calendar_event(input) {
      const calendar = getCalendar();
      await calendar.events.delete({
        calendarId: 'primary',
        eventId: input.eventId as string,
        sendUpdates: 'all',
      });
      return `Event ${input.eventId} deleted and attendees notified.`;
    },
  },
};
