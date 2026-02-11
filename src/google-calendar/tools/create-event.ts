// Tool: google-calendar-create-event
import '../state';

export const createEventTool: ToolDefinition = {
  name: 'google-calendar-create-event',
  description:
    'Create a new event in a Google Calendar. Provide start/end as dateTime (RFC3339) or date (YYYY-MM-DD) for all-day.',
  input_schema: {
    type: 'object',
    properties: {
      calendar_id: {
        type: 'string',
        description: 'Calendar ID (use "primary" for primary calendar). Default: primary',
      },
      summary: { type: 'string', description: 'Event title/summary' },
      description: { type: 'string', description: 'Event description' },
      location: { type: 'string', description: 'Event location' },
      start_date_time: {
        type: 'string',
        description: 'Start time in RFC3339 (e.g. 2025-02-10T14:00:00Z) for timed events',
      },
      end_date_time: { type: 'string', description: 'End time in RFC3339 for timed events' },
      start_date: { type: 'string', description: 'Start date YYYY-MM-DD for all-day events' },
      end_date: { type: 'string', description: 'End date YYYY-MM-DD for all-day events' },
      time_zone: {
        type: 'string',
        description: 'IANA time zone (e.g. America/New_York) for start/end',
      },
      attendees: {
        type: 'array',
        items: { type: 'string' },
        description: 'List of attendee email addresses',
      },
    },
    required: ['summary'],
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

      // Input validation: require either all-day pair or timed pair; reject mixing; no zero-length
      const hasStartDate = typeof args.start_date === 'string' && args.start_date.length > 0;
      const hasEndDate = typeof args.end_date === 'string' && args.end_date.length > 0;
      const hasStartDateTime =
        typeof args.start_date_time === 'string' && (args.start_date_time as string).length > 0;
      const hasEndDateTime =
        typeof args.end_date_time === 'string' && (args.end_date_time as string).length > 0;

      const allDayPair = hasStartDate && hasEndDate && !hasStartDateTime && !hasEndDateTime;
      const timedPair = hasStartDateTime && hasEndDateTime && !hasStartDate && !hasEndDate;

      if (!allDayPair && !timedPair) {
        if (hasStartDate && !hasEndDate) {
          return JSON.stringify({
            success: false,
            error: 'start_date requires end_date for all-day events',
          });
        }
        if (hasEndDate && !hasStartDate) {
          return JSON.stringify({
            success: false,
            error: 'end_date requires start_date for all-day events',
          });
        }
        if (hasStartDateTime && !hasEndDateTime) {
          return JSON.stringify({
            success: false,
            error: 'start_date_time requires end_date_time for timed events',
          });
        }
        if (hasEndDateTime && !hasStartDateTime) {
          return JSON.stringify({
            success: false,
            error: 'end_date_time requires start_date_time for timed events',
          });
        }
        if ((hasStartDate || hasEndDate) && (hasStartDateTime || hasEndDateTime)) {
          return JSON.stringify({
            success: false,
            error:
              'Do not mix date (all-day) and dateTime (timed) fields; use either start_date/end_date or start_date_time/end_date_time',
          });
        }
        return JSON.stringify({
          success: false,
          error:
            'Provide either start_date and end_date (all-day) or start_date_time and end_date_time (timed)',
        });
      }

      const tz = (args.time_zone as string) || 'UTC';
      let start: Record<string, string>;
      let end: Record<string, string>;

      if (allDayPair) {
        const startDate = args.start_date as string;
        const endDate = args.end_date as string;
        if (startDate === endDate) {
          return JSON.stringify({
            success: false,
            error:
              'start_date and end_date must differ (zero-length all-day events are not allowed)',
          });
        }
        start = { date: startDate };
        end = { date: endDate };
      } else {
        const startDt = args.start_date_time as string;
        const endDt = args.end_date_time as string;
        if (startDt === endDt) {
          return JSON.stringify({
            success: false,
            error:
              'start_date_time and end_date_time must differ (zero-length events are not allowed)',
          });
        }
        start = { dateTime: startDt, timeZone: tz };
        end = { dateTime: endDt, timeZone: tz };
      }
      const body = {
        summary: args.summary,
        description: args.description,
        location: args.location,
        start,
        end,
        attendees: Array.isArray(args.attendees)
          ? (args.attendees as string[]).map((email: string) => ({ email }))
          : undefined,
      };
      const path = `/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;
      const response = calendarFetch(path, { method: 'POST', body: JSON.stringify(body) });
      if (!response.success) {
        return JSON.stringify({
          success: false,
          error: response.error?.message || 'Failed to create event',
        });
      }
      return JSON.stringify({ success: true, event: response.data });
    } catch (e) {
      return JSON.stringify({ success: false, error: e instanceof Error ? e.message : String(e) });
    }
  },
};
