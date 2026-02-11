// Shared skill state module for Google Calendar skill
// Tools and lifecycle functions access state through globalThis.getGoogleCalendarSkillState()
import type { SkillConfig } from './types';

export interface GoogleCalendarSkillState {
  config: SkillConfig;
  activeSessions: string[];
  rateLimitRemaining: number;
  rateLimitReset: number;
  lastApiError: string | null;
}

declare global {
  function getGoogleCalendarSkillState(): GoogleCalendarSkillState;
  var __googleCalendarSkillState: GoogleCalendarSkillState;
}

/**
 * Initialize the Google Calendar skill state. Called once at module load.
 */
function initGoogleCalendarSkillState(): GoogleCalendarSkillState {
  const state: GoogleCalendarSkillState = {
    config: { credentialId: '', userEmail: '' },
    activeSessions: [],
    rateLimitRemaining: 250,
    rateLimitReset: Date.now() + 3600000,
    lastApiError: null,
  };

  globalThis.__googleCalendarSkillState = state;
  return state;
}

initGoogleCalendarSkillState();

globalThis.getGoogleCalendarSkillState =
  function getGoogleCalendarSkillState(): GoogleCalendarSkillState {
    const state = globalThis.__googleCalendarSkillState;
    if (!state) {
      throw new Error('[google-calendar] Skill state not initialized');
    }
    return state;
  };

export function getGoogleCalendarSkillState(): GoogleCalendarSkillState {
  return globalThis.getGoogleCalendarSkillState();
}
