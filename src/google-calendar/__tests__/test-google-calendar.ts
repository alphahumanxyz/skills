// test-google-calendar.ts — Tests for the Google Calendar skill.
// Runs via the V8 test harness. Globals: describe, it, assert*, setupSkillTest, callTool.

const _describe = (globalThis as any).describe as (name: string, fn: () => void) => void;
const _it = (globalThis as any).it as (name: string, fn: () => void) => void;
const _assert = (globalThis as any).assert as (cond: unknown, msg?: string) => void;
const _assertEqual = (globalThis as any).assertEqual as (
  a: unknown,
  b: unknown,
  msg?: string
) => void;
const _assertNotNull = (globalThis as any).assertNotNull as (v: unknown, msg?: string) => void;
const _assertContains = (globalThis as any).assertContains as (
  h: string,
  n: string,
  msg?: string
) => void;
const _setup = (globalThis as any).setupSkillTest as (opts?: any) => void;
const _callTool = (globalThis as any).callTool as (name: string, args?: any) => any;

const SAMPLE_CALENDAR_LIST = {
  items: [
    { id: 'primary', summary: 'Primary', primary: true, accessRole: 'owner', timeZone: 'UTC' },
    { id: 'work@example.com', summary: 'Work', primary: false, accessRole: 'writer' },
  ],
};

const SAMPLE_EVENTS = {
  items: [
    {
      id: 'evt1',
      summary: 'Team standup',
      start: { dateTime: '2025-02-10T10:00:00Z' },
      end: { dateTime: '2025-02-10T10:30:00Z' },
      status: 'confirmed',
      htmlLink: 'https://calendar.google.com/event/evt1',
    },
  ],
  nextPageToken: null,
};

const SAMPLE_EVENT = {
  id: 'evt1',
  summary: 'Team standup',
  description: 'Daily sync',
  start: { dateTime: '2025-02-10T10:00:00Z' },
  end: { dateTime: '2025-02-10T10:30:00Z' },
  status: 'confirmed',
};

const SAMPLE_CREATED_EVENT = {
  id: 'evt-new',
  summary: 'New meeting',
  start: { dateTime: '2025-02-11T14:00:00Z' },
  end: { dateTime: '2025-02-11T15:00:00Z' },
};

function setupAuthenticatedCalendarTest(overrides?: {
  oauthFetchResponses?: Record<string, { status: number; body: string }>;
}): void {
  _setup({
    stateData: { config: { credentialId: 'test', userEmail: 'test@example.com' } },
    oauthCredential: {
      credentialId: 'test',
      provider: 'google',
      scopes: [],
      isValid: true,
      createdAt: Date.now(),
      accountLabel: 'test@example.com',
    },
    oauthFetchResponses: {
      '/users/me/calendarList': { status: 200, body: JSON.stringify(SAMPLE_CALENDAR_LIST) },
      '/users/me/calendarList?showHidden=true': {
        status: 200,
        body: JSON.stringify(SAMPLE_CALENDAR_LIST),
      },
      '/calendars/primary/events?singleEvents=true&maxResults=50&orderBy=startTime': {
        status: 200,
        body: JSON.stringify(SAMPLE_EVENTS),
      },
      '/calendars/primary/events/evt1': { status: 200, body: JSON.stringify(SAMPLE_EVENT) },
      '/calendars/primary/events': { status: 200, body: JSON.stringify(SAMPLE_CREATED_EVENT) },
      ...overrides?.oauthFetchResponses,
    },
  });
  (globalThis as any).init();
}

function setupUnauthenticatedCalendarTest(): void {
  _setup({ stateData: {}, oauthFetchResponses: {} });
  (globalThis as any).init();
}

_describe('Google Calendar Skill', () => {
  _describe('Initialization', () => {
    _it('should initialize with default config when no stored config', () => {
      setupUnauthenticatedCalendarTest();
      const state = globalThis.getGoogleCalendarSkillState();
      _assertNotNull(state);
      _assertEqual(state.config.credentialId, '');
      _assertEqual(state.config.userEmail, '');
    });

    _it('should load stored config on init', () => {
      setupAuthenticatedCalendarTest();
      const state = globalThis.getGoogleCalendarSkillState();
      _assertEqual(state.config.credentialId, 'test');
      _assertEqual(state.config.userEmail, 'test@example.com');
    });
  });

  _describe('List Calendars Tool', () => {
    _it('should list calendars when authenticated', () => {
      setupAuthenticatedCalendarTest();
      const result = _callTool('google-calendar-list-calendars');
      const response = JSON.parse(result);
      _assertEqual(response.success, true);
      _assertNotNull(response.calendars);
      _assertEqual(response.calendars.length, 2);
      _assertEqual(response.calendars[0].id, 'primary');
      _assertEqual(response.calendars[0].summary, 'Primary');
    });

    _it('should fail when not connected', () => {
      setupUnauthenticatedCalendarTest();
      const result = _callTool('google-calendar-list-calendars');
      const response = JSON.parse(result);
      _assertEqual(response.success, false);
      _assertContains(response.error, 'not connected');
    });
  });

  _describe('List Events Tool', () => {
    _it('should list events with default primary calendar', () => {
      setupAuthenticatedCalendarTest();
      const result = _callTool('google-calendar-list-events', {});
      const response = JSON.parse(result);
      _assertEqual(response.success, true);
      _assertNotNull(response.events);
      _assertEqual(response.events.length, 1);
      _assertEqual(response.events[0].id, 'evt1');
      _assertEqual(response.events[0].summary, 'Team standup');
    });

    _it('should accept calendar_id and time_min', () => {
      setupAuthenticatedCalendarTest({
        oauthFetchResponses: {
          '/calendars/primary/events?singleEvents=true&timeMin=2025-02-01T00%3A00%3A00Z&maxResults=50&orderBy=startTime':
            { status: 200, body: JSON.stringify(SAMPLE_EVENTS) },
        },
      });
      const result = _callTool('google-calendar-list-events', {
        calendar_id: 'primary',
        time_min: '2025-02-01T00:00:00Z',
      });
      const response = JSON.parse(result);
      _assertEqual(response.success, true);
    });
  });

  _describe('Get Event Tool', () => {
    _it('should get event by calendar_id and event_id', () => {
      setupAuthenticatedCalendarTest();
      const result = _callTool('google-calendar-get-event', {
        calendar_id: 'primary',
        event_id: 'evt1',
      });
      const response = JSON.parse(result);
      _assertEqual(response.success, true);
      _assertEqual(response.event.id, 'evt1');
      _assertEqual(response.event.summary, 'Team standup');
    });

    _it('should default calendar_id to primary when omitted', () => {
      setupAuthenticatedCalendarTest();
      const result = _callTool('google-calendar-get-event', { event_id: 'evt1' });
      const response = JSON.parse(result);
      _assertEqual(response.success, true);
      _assertEqual(response.event.id, 'evt1');
    });

    _it('should require event_id', () => {
      setupAuthenticatedCalendarTest();
      const result = _callTool('google-calendar-get-event', { calendar_id: 'primary' });
      const response = JSON.parse(result);
      _assertEqual(response.success, false);
      _assertContains(response.error, 'event_id');
    });
  });

  _describe('Create Event Tool', () => {
    _it('should create event with summary and times', () => {
      setupAuthenticatedCalendarTest();
      const result = _callTool('google-calendar-create-event', {
        summary: 'New meeting',
        start_date_time: '2025-02-11T14:00:00Z',
        end_date_time: '2025-02-11T15:00:00Z',
      });
      const response = JSON.parse(result);
      _assertEqual(response.success, true);
      _assertEqual(response.event.summary, 'New meeting');
      _assertEqual(response.event.id, 'evt-new');
    });

    _it('should require summary', () => {
      setupAuthenticatedCalendarTest();
      const result = _callTool('google-calendar-create-event', {
        start_date_time: '2025-02-11T14:00:00Z',
        end_date_time: '2025-02-11T15:00:00Z',
      });
      const response = JSON.parse(result);
      _assertEqual(response.success, false);
      _assertContains(response.error, 'summary');
    });
  });

  _describe('Update Event Tool', () => {
    _it('should update event', () => {
      setupAuthenticatedCalendarTest({
        oauthFetchResponses: {
          '/calendars/primary/events/evt1': {
            status: 200,
            body: JSON.stringify({ ...SAMPLE_EVENT, summary: 'Updated standup' }),
          },
        },
      });
      const result = _callTool('google-calendar-update-event', {
        calendar_id: 'primary',
        event_id: 'evt1',
        summary: 'Updated standup',
      });
      const response = JSON.parse(result);
      _assertEqual(response.success, true);
      _assertEqual(response.event.summary, 'Updated standup');
    });

    _it('should default calendar_id to primary', () => {
      setupAuthenticatedCalendarTest({
        oauthFetchResponses: {
          '/calendars/primary/events/evt1': {
            status: 200,
            body: JSON.stringify({ ...SAMPLE_EVENT, summary: 'Updated' }),
          },
        },
      });
      const result = _callTool('google-calendar-update-event', {
        event_id: 'evt1',
        summary: 'Updated',
      });
      const response = JSON.parse(result);
      _assertEqual(response.success, true);
    });
  });

  _describe('Delete Event Tool', () => {
    _it('should delete event', () => {
      setupAuthenticatedCalendarTest({
        oauthFetchResponses: { '/calendars/primary/events/evt1': { status: 204, body: '' } },
      });
      const result = _callTool('google-calendar-delete-event', {
        calendar_id: 'primary',
        event_id: 'evt1',
      });
      const response = JSON.parse(result);
      _assertEqual(response.success, true);
      _assertEqual(response.deleted, true);
    });

    _it('should default calendar_id to primary', () => {
      setupAuthenticatedCalendarTest({
        oauthFetchResponses: { '/calendars/primary/events/evt1': { status: 204, body: '' } },
      });
      const result = _callTool('google-calendar-delete-event', { event_id: 'evt1' });
      const response = JSON.parse(result);
      _assertEqual(response.success, true);
    });
  });
});
