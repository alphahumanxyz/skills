// Tool: google-calendar-list-calendars
import '../state';

export const listCalendarsTool: ToolDefinition = {
  name: 'google-calendar-list-calendars',
  description:
    'List all Google Calendars the user has access to. Returns id, summary, timeZone, primary, and accessRole.',
  input_schema: {
    type: 'object',
    properties: {
      show_hidden: { type: 'boolean', description: 'Include hidden calendars (default: false)' },
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
      const showHidden = Boolean(args.show_hidden);
      const qs = showHidden ? '?showHidden=true' : '';
      const response = calendarFetch(`/calendar/v3/users/me/calendarList${qs}`);
      if (!response.success) {
        return JSON.stringify({
          success: false,
          error: response.error?.message || 'Failed to list calendars',
        });
      }
      const data = response.data as { items?: Array<Record<string, unknown>> };
      const items = Array.isArray(data.items) ? data.items : [];
      const calendars = items.map((c: Record<string, unknown>) => ({
        id: c.id,
        summary: c.summary,
        description: c.description,
        timeZone: c.timeZone,
        primary: c.primary,
        accessRole: c.accessRole,
      }));
      return JSON.stringify({ success: true, calendars });
    } catch (e) {
      return JSON.stringify({ success: false, error: e instanceof Error ? e.message : String(e) });
    }
  },
};
