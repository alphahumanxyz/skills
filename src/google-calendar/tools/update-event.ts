// Tool: google-calendar-update-event
import '../state';

export const updateEventTool: ToolDefinition = {
  name: 'google-calendar-update-event',
  description:
    'Update an existing event. Only include fields to change. Start/end as dateTime (RFC3339) or date (YYYY-MM-DD) for all-day.',
  input_schema: {
    type: 'object',
    properties: {
      calendar_id: {
        type: 'string',
        description: 'Calendar ID (use "primary" for primary calendar)',
      },
      event_id: { type: 'string', description: 'Event ID to update' },
      summary: { type: 'string', description: 'New title/summary' },
      description: { type: 'string', description: 'New description' },
      location: { type: 'string', description: 'New location' },
      start_date_time: { type: 'string', description: 'New start (RFC3339)' },
      end_date_time: { type: 'string', description: 'New end (RFC3339)' },
      start_date: { type: 'string', description: 'New start date (YYYY-MM-DD) for all-day' },
      end_date: { type: 'string', description: 'New end date for all-day' },
      time_zone: { type: 'string', description: 'IANA time zone for start/end' },
      attendees: {
        type: 'array',
        items: { type: 'string' },
        description: 'Replace attendees with these emails',
      },
    },
    required: ['calendar_id', 'event_id'],
  },
  async execute(args: Record<string, unknown>): Promise<string> {
    try {
      const calendarFetch = (globalThis as { calendarFetch?: (e: string, o?: object) => any })
        .calendarFetch;
      if (!calendarFetch) {
        return JSON.stringify({ success: false, error: 'Calendar API helper not available' });
      }
      if (!oauth.getCredential()) {
        return JSON.stringify({
          success: false,
          error: 'Google Calendar not connected. Complete OAuth setup first.',
        });
      }
      const calendarId = args.calendar_id as string;
      const eventId = args.event_id as string;
      if (!calendarId || !eventId) {
        return JSON.stringify({ success: false, error: 'calendar_id and event_id are required' });
      }
      const body: Record<string, unknown> = {};
      if (args.summary != null) body.summary = args.summary;
      if (args.description != null) body.description = args.description;
      if (args.location != null) body.location = args.location;

      const hasStartDate =
        typeof args.start_date === 'string' && (args.start_date as string).length > 0;
      const hasStartDateTime =
        typeof args.start_date_time === 'string' && (args.start_date_time as string).length > 0;
      const hasEndDate = typeof args.end_date === 'string' && (args.end_date as string).length > 0;
      const hasEndDateTime =
        typeof args.end_date_time === 'string' && (args.end_date_time as string).length > 0;

      if (hasStartDate && hasStartDateTime) {
        return JSON.stringify({
          success: false,
          error: 'Do not mix start_date and start_date_time; use one or the other',
        });
      }
      if (hasEndDate && hasEndDateTime) {
        return JSON.stringify({
          success: false,
          error: 'Do not mix end_date and end_date_time; use one or the other',
        });
      }

      const tz = (args.time_zone as string) || 'UTC';
      if (hasStartDate) {
        body.start = { date: args.start_date as string };
      } else if (hasStartDateTime) {
        body.start = { dateTime: args.start_date_time as string, timeZone: tz };
      }
      if (hasEndDate) {
        body.end = { date: args.end_date as string };
      } else if (hasEndDateTime) {
        body.end = { dateTime: args.end_date_time as string, timeZone: tz };
      }
      if (Array.isArray(args.attendees)) {
        body.attendees = (args.attendees as string[]).map((email: string) => ({ email }));
      }
      const path = `/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`;
      const response = calendarFetch(path, { method: 'PATCH', body: JSON.stringify(body) });
      if (!response.success) {
        return JSON.stringify({
          success: false,
          error: response.error?.message || 'Failed to update event',
        });
      }
      return JSON.stringify({ success: true, event: response.data });
    } catch (e) {
      return JSON.stringify({ success: false, error: e instanceof Error ? e.message : String(e) });
    }
  },
};
