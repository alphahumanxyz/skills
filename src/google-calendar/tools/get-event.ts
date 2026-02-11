// Tool: google-calendar-get-event
import '../state';

export const getEventTool: ToolDefinition = {
  name: 'google-calendar-get-event',
  description: 'Get a single event by calendar ID and event ID.',
  input_schema: {
    type: 'object',
    properties: {
      calendar_id: {
        type: 'string',
        description: 'Calendar ID (use "primary" for primary calendar)',
      },
      event_id: { type: 'string', description: 'Event ID' },
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
      const path = `/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`;
      const response = calendarFetch(path);
      if (!response.success) {
        return JSON.stringify({
          success: false,
          error: response.error?.message || 'Failed to get event',
        });
      }
      return JSON.stringify({ success: true, event: response.data });
    } catch (e) {
      return JSON.stringify({ success: false, error: e instanceof Error ? e.message : String(e) });
    }
  },
};
