// Shared skill state for Slack skill
import type { SlackConfig } from './types';

export interface SlackSkillState {
  config: SlackConfig;
  syncInProgress: boolean;
  lastSyncTime: number;
  lastSyncChannels: number;
  lastSyncMessages: number;
  lastSyncedLatestPerChannel: Record<string, string>;
}

declare global {
  function getSlackSkillState(): SlackSkillState;
  var __slackSkillState: SlackSkillState;
}

const skillState: SlackSkillState = {
  config: { botToken: '', workspaceName: '', syncIntervalMinutes: 20 },
  syncInProgress: false,
  lastSyncTime: 0,
  lastSyncChannels: 0,
  lastSyncMessages: 0,
  lastSyncedLatestPerChannel: {},
};
globalThis.__slackSkillState = skillState;

globalThis.getSlackSkillState = function getSlackSkillState(): SlackSkillState {
  return globalThis.__slackSkillState;
};

export function getSlackSkillState(): SlackSkillState {
  return globalThis.getSlackSkillState();
}
