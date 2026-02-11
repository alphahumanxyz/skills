// Tool: google-calendar-list-events
import '../state';

export const listEventsTool: ToolDefinition = {
  name: 'google-calendar-list-events',
  description:
    'List events in a Google Calendar. Optional time range and max results. Use calendar_id "primary" for primary calendar.',
  input_schema: {
    type: 'object',
    properties: {
      calendar_id: {
        type: 'string',
        description: 'Calendar ID (use "primary" for primary calendar). Default: primary',
      },
      time_min: { type: 'string', description: 'Lower bound (RFC3339 or date) for event start' },
      time_max: { type: 'string', description: 'Upper bound (RFC3339 or date) for event end' },
      max_results: {
        type: 'number',
        description: 'Max number of events (default: 50)',
        minimum: 1,
        maximum: 2500,
      },
      single_events: {
        type: 'boolean',
        description: 'Expand recurring events into instances (default: true)',
      },
      order_by: {
        type: 'string',
        description: 'Order by startTime or lastModified (default: startTime)',
        enum: ['startTime', 'lastModified'],
      },
    },
    required: [],
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
      const calendarId = (args.calendar_id as string) || 'primary';
      const params: string[] = [];
      if (args.time_min) params.push(`timeMin=${encodeURIComponent(args.time_min as string)}`);
      if (args.time_max) params.push(`timeMax=${encodeURIComponent(args.time_max as string)}`);
      const maxResults = Math.min(Number(args.max_results) || 50, 2500);
      params.push(`maxResults=${maxResults}`);
      if (args.single_events === true) params.push('singleEvents=true');
      else if (args.single_events === false) params.push('singleEvents=false');
      const orderBy = (args.order_by as string) || 'startTime';
      params.push(`orderBy=${orderBy}`);
      const path = `/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params.join('&')}`;
      const response = calendarFetch(path);
      if (!response.success) {
        return JSON.stringify({
          success: false,
          error: response.error?.message || 'Failed to list events',
        });
      }
      const data = response.data as { items?: Record<string, unknown>[]; nextPageToken?: string };
      const events = (data.items || []).map((ev: Record<string, unknown>) => ({
        id: ev.id,
        summary: ev.summary,
        description: ev.description,
        location: ev.location,
        start: ev.start,
        end: ev.end,
        status: ev.status,
        htmlLink: ev.htmlLink,
        attendees: ev.attendees,
      }));
      return JSON.stringify({ success: true, events, next_page_token: data.nextPageToken || null });
    } catch (e) {
      return JSON.stringify({ success: false, error: e instanceof Error ? e.message : String(e) });
    }
  },
};
