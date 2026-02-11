// Google Calendar skill type definitions

export interface SkillConfig {
  credentialId: string;
  userEmail: string;
}

export interface CalendarListEntry {
  id: string;
  summary: string;
  description?: string;
  timeZone?: string;
  primary?: boolean;
  accessRole: string;
}

export interface CalendarEventDateTime {
  date?: string; // YYYY-MM-DD for all-day
  dateTime?: string; // RFC3339
  timeZone?: string;
}

export interface CalendarEvent {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  start: CalendarEventDateTime;
  end: CalendarEventDateTime;
  status?: string;
  htmlLink?: string;
  attendees?: Array<{ email: string; displayName?: string; responseStatus?: string }>;
  created?: string;
  updated?: string;
}

export interface ApiError {
  code: number;
  message: string;
  errors?: Array<{ domain: string; reason: string; message: string }>;
}
