// Shared skill state for Google Drive skill (Drive, Sheets, Docs)
// Tools and lifecycle access state via globalThis.getGoogleDriveSkillState()
import type { SkillConfig } from './types';

export interface GoogleDriveSkillState {
  config: SkillConfig;
  activeSessions: string[];
  rateLimitRemaining: number;
  rateLimitReset: number;
  lastApiError: string | null;
}

declare global {
  function getGoogleDriveSkillState(): GoogleDriveSkillState;
  var __googleDriveSkillState: GoogleDriveSkillState;
}

function initGoogleDriveSkillState(): GoogleDriveSkillState {
  const state: GoogleDriveSkillState = {
    config: { credentialId: '', userEmail: '' },
    activeSessions: [],
    rateLimitRemaining: 250,
    rateLimitReset: Date.now() + 3600000,
    lastApiError: null,
  };

  globalThis.__googleDriveSkillState = state;
  return state;
}

initGoogleDriveSkillState();

globalThis.getGoogleDriveSkillState = function getGoogleDriveSkillState(): GoogleDriveSkillState {
  const state = globalThis.__googleDriveSkillState;
  if (!state) {
    throw new Error('[google-drive] Skill state not initialized');
  }
  return state;
};

export function getGoogleDriveSkillState(): GoogleDriveSkillState {
  return globalThis.getGoogleDriveSkillState();
}
